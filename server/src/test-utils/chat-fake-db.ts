/**
 * Маленькая «база в памяти» для тестов чата. В отличие от jest-моков, которые отдают
 * заранее заданный ответ, она применяет where-условия к данным — поэтому тест видимости
 * («учитель А не видит переписку учителя Б») проверяет реальную фильтрацию сервиса.
 *
 * Понимает только то, что нужно чату; незнакомое условие бросает ошибку,
 * чтобы тест не прошёл «вхолостую».
 */

export interface FakeUser {
  id: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'PARENT'
  fullName: string
  kindergartenId: string | null
  groupId?: string | null
  teachingGroupIds?: string[]
  homeroomGroupIds?: string[]
  subjects?: string[]
  isActive?: boolean
  expoPushToken?: string | null
  phone?: string | null
  childId?: string | null
}

export interface FakeGroup {
  id: string
  name: string
  kindergartenId: string | null
  homeroomTeacherId?: string | null
}

export interface FakeStudent {
  id: string
  groupId: string | null
  kindergartenId: string | null
  parentIds: string[]
}

export interface FakeConv {
  id: string
  groupId: string
  parentId: string
  scope: 'GENERAL' | 'ADMIN'
  teacherId: string | null
  kindergartenId: string | null
  lastMessageAt: Date
  parentReadAt: Date | null
  staffReadAt: Date | null
}

export interface FakeMsg {
  id: string
  conversationId: string
  senderId: string
  text: string
  kind: 'TEXT' | 'PAYMENT'
  createdAt: Date
}

export interface FakeSeed {
  users: FakeUser[]
  groups: FakeGroup[]
  students: FakeStudent[]
  conversations?: Array<Partial<FakeConv> & Pick<FakeConv, 'id' | 'groupId' | 'parentId' | 'scope'>>
  /** Сообщения в порядке отправки; время ставится по порядку. */
  messages?: Array<Pick<FakeMsg, 'conversationId' | 'senderId' | 'text'> & Partial<FakeMsg>>
}

type Any = any // eslint-disable-line @typescript-eslint/no-explicit-any

export function createFakeChatDb(seed: FakeSeed) {
  let tick = 0
  let idSeq = 0
  const nextTime = () => new Date(Date.UTC(2026, 10, 1, 8, 0, 0) + ++tick * 60_000)

  const users = seed.users.map((u) => ({ isActive: true, expoPushToken: null, ...u }))
  const groups = [...seed.groups]
  const students = [...seed.students]
  const conversations: FakeConv[] = []
  const messages: FakeMsg[] = []

  const state = { users, groups, students, conversations, messages }

  for (const c of seed.conversations ?? []) {
    conversations.push({
      teacherId: null,
      kindergartenId: groups.find((g) => g.id === c.groupId)?.kindergartenId ?? null,
      lastMessageAt: nextTime(),
      parentReadAt: null,
      staffReadAt: null,
      ...c,
    })
  }
  for (const m of seed.messages ?? []) {
    const msg: FakeMsg = { id: `m${++idSeq}`, kind: 'TEXT', createdAt: nextTime(), ...m }
    messages.push(msg)
    const conv = conversations.find((c) => c.id === msg.conversationId)
    if (conv) conv.lastMessageAt = msg.createdAt
  }

  const userById = (id: string) => users.find((u) => u.id === id)

  function match(row: Any, where: Any): boolean {
    if (!where) return true
    return Object.entries(where).every(([k, v]: [string, Any]) => {
      if (k === 'OR') return (v as Any[]).some((w) => match(row, w))
      if (k === 'AND') return (v as Any[]).every((w) => match(row, w))
      if (k === 'messages') {
        return messages.filter((m) => m.conversationId === row.id).some((m) => match(m, v.some))
      }
      if (k === 'teachingGroups') {
        return (row.teachingGroupIds ?? []).some((id: string) => match({ id }, v.some))
      }
      if (k === 'homeroomGroups') {
        return (row.homeroomGroupIds ?? []).some((id: string) => match({ id }, v.some))
      }
      if (k === 'parents') {
        return (row.parentIds ?? []).some((id: string) => match({ id }, v.some))
      }
      const val = row[k] ?? null
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('in' in v) return (v.in as unknown[]).includes(val)
        if ('not' in v) return val !== (v.not ?? null)
        throw new Error(`chat-fake-db: неподдерживаемое условие для «${k}»`)
      }
      return val === (v ?? null)
    })
  }

  const sender = (id: string) => {
    const u = userById(id)
    return { id, fullName: u?.fullName ?? id, role: u?.role ?? 'TEACHER' }
  }

  function lastMessages(convId: string, take?: number) {
    const list = messages
      .filter((m) => m.conversationId === convId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return take ? list.slice(0, take) : list
  }

  /** Строка переписки со связями, которые просили include/select. */
  function shape(c: FakeConv, opts: Any = {}) {
    const rel = { ...(opts.include ?? {}), ...(opts.select ?? {}) }
    const out: Any = { ...c }
    if (rel.parent) out.parent = sender(c.parentId)
    if (rel.group) {
      const g = groups.find((x) => x.id === c.groupId)
      out.group = { id: c.groupId, name: g?.name ?? c.groupId }
    }
    if (rel.messages) out.messages = lastMessages(c.id, rel.messages.take)
    return out
  }

  const prisma = {
    conversation: {
      findMany: async (opts: Any = {}) => {
        let rows = conversations.filter((c) => match(c, opts.where))
        if (opts.orderBy?.lastMessageAt === 'desc') {
          rows = [...rows].sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
        }
        return rows.map((c) => shape(c, opts))
      },
      findFirst: async (opts: Any = {}) => {
        const c = conversations.find((x) => match(x, opts.where))
        return c ? shape(c, opts) : null
      },
      findUnique: async (opts: Any) => {
        const c = conversations.find((x) => x.id === opts.where.id)
        return c ? shape(c, opts) : null
      },
      create: async ({ data }: Any) => {
        const dup = conversations.find(
          (c) =>
            c.groupId === data.groupId &&
            c.parentId === data.parentId &&
            c.scope === data.scope &&
            c.teacherId === (data.teacherId ?? null),
        )
        if (dup) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
        const c: FakeConv = {
          id: `c${++idSeq}`,
          teacherId: null,
          kindergartenId: null,
          lastMessageAt: nextTime(),
          parentReadAt: null,
          staffReadAt: null,
          ...data,
        }
        conversations.push(c)
        return { ...c }
      },
      update: async ({ where, data }: Any) => {
        const c = conversations.find((x) => x.id === where.id)
        if (!c) throw new Error('conversation.update: не найдена')
        Object.assign(c, data)
        return { ...c }
      },
    },
    message: {
      create: async ({ data }: Any) => {
        const msg: FakeMsg = { id: `m${++idSeq}`, kind: 'TEXT', createdAt: nextTime(), ...data }
        messages.push(msg)
        return { ...msg, sender: sender(msg.senderId) }
      },
      findMany: async (opts: Any = {}) =>
        messages
          .filter((m) => match(m, opts.where))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((m) => ({ ...m, sender: sender(m.senderId) })),
    },
    user: {
      findMany: async (opts: Any = {}) => {
        let rows = users.filter((u) => match(u, opts.where))
        if (opts.orderBy?.fullName === 'asc') {
          rows = [...rows].sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'))
        }
        return rows.map((u) => ({
          ...u,
          teachingSubjects: (u.subjects ?? []).map((name) => ({ name })),
        }))
      },
      findUnique: async (opts: Any) => {
        const u = userById(opts.where.id)
        return u ? { ...u } : null
      },
    },
    student: {
      findFirst: async (opts: Any = {}) => {
        const s = students.find((x) => match(x, opts.where))
        if (!s) return null
        const g = groups.find((x) => x.id === s.groupId)
        return {
          ...s,
          group: g ? { name: g.name, homeroomTeacherId: g.homeroomTeacherId ?? null } : null,
        }
      },
      findUnique: async (opts: Any) => {
        const s = students.find((x) => x.id === opts.where.id)
        if (!s) return null
        const activeOnly = !!opts.select?.parents?.where?.isActive
        return {
          ...s,
          parents: s.parentIds
            .filter((id) => !activeOnly || userById(id)?.isActive !== false)
            .map((id) => ({ id })),
        }
      },
      findMany: async () => [] as Any[], // телефоны детей для Telegram — в этих тестах не нужны
    },
  }

  return { prisma, state }
}
