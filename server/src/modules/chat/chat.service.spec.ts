import { Test } from '@nestjs/testing'
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'

import { ChatService } from './chat.module'
import { ChatGateway } from './chat.gateway'
import { PushService } from '../push/push.module'
import { TelegramLinkService } from '../telegram/telegram-link.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createFakeChatDb, type FakeSeed } from '../../test-utils/chat-fake-db'
import type { AuthUser } from '../../common/types/jwt-payload'

const au = (
  sub: string,
  role: AuthUser['role'],
  kindergartenId: string | null,
  extra: Partial<AuthUser> = {},
): AuthUser => ({
  sub,
  email: `${sub}@test.tj`,
  role,
  kindergartenId,
  groupId: null,
  childId: null,
  ...extra,
})

// Школа 1: класс g1 (классный — Алиев), у класса три учителя-собеседника: Алиев, Бобоев;
// Саидов ведёт только g2. Директор и администратор школы. Школа 2 — отдельный мир.
const tA = au('tA', 'TEACHER', 'k1', { groupId: 'g1' })
const tB = au('tB', 'TEACHER', 'k1')
const tC = au('tC', 'TEACHER', 'k1', { groupId: 'g2' })
const tX = au('tX', 'TEACHER', 'k2', { groupId: 'g9' })
const director = au('dir', 'SUPER_ADMIN', 'k1')
const admin = au('adm', 'ADMIN', 'k1')
const adminX = au('admX', 'ADMIN', 'k2')
const p1 = au('p1', 'PARENT', 'k1', { childId: 's1' })
const p2 = au('p2', 'PARENT', 'k1', { childId: 's2' })
const p3 = au('p3', 'PARENT', 'k1', { childId: 's3' })
const pX = au('pX', 'PARENT', 'k2', { childId: 's9' })
const pNoKid = au('pNo', 'PARENT', 'k1')

function world(): FakeSeed {
  return {
    users: [
      { id: 'tA', role: 'TEACHER', fullName: 'Алиев А.', kindergartenId: 'k1', groupId: 'g1', homeroomGroupIds: ['g1'], expoPushToken: 'tok-a' },
      { id: 'tB', role: 'TEACHER', fullName: 'Бобоев Б.', kindergartenId: 'k1', teachingGroupIds: ['g1'], subjects: ['Физика'], expoPushToken: 'tok-b' },
      { id: 'tC', role: 'TEACHER', fullName: 'Саидов С.', kindergartenId: 'k1', groupId: 'g2', expoPushToken: 'tok-c' },
      { id: 'tX', role: 'TEACHER', fullName: 'Хасанов Х.', kindergartenId: 'k2', groupId: 'g9', expoPushToken: 'tok-x' },
      { id: 'dir', role: 'SUPER_ADMIN', fullName: 'Директор', kindergartenId: 'k1', expoPushToken: 'tok-dir' },
      { id: 'adm', role: 'ADMIN', fullName: 'Админ', kindergartenId: 'k1', expoPushToken: 'tok-adm' },
      { id: 'admX', role: 'ADMIN', fullName: 'Админ 2', kindergartenId: 'k2' },
      { id: 'p1', role: 'PARENT', fullName: 'Мама 1', kindergartenId: 'k1', childId: 's1' },
      { id: 'p2', role: 'PARENT', fullName: 'Мама 2', kindergartenId: 'k1', childId: 's2' },
      { id: 'p3', role: 'PARENT', fullName: 'Мама 3', kindergartenId: 'k1', childId: 's3' },
      { id: 'pX', role: 'PARENT', fullName: 'Мама Х', kindergartenId: 'k2', childId: 's9' },
      { id: 'pNo', role: 'PARENT', fullName: 'Без ребёнка', kindergartenId: 'k1' },
    ],
    groups: [
      { id: 'g1', name: '5А', kindergartenId: 'k1', homeroomTeacherId: 'tA' },
      { id: 'g2', name: '6Б', kindergartenId: 'k1' },
      { id: 'g9', name: '7В', kindergartenId: 'k2' },
    ],
    students: [
      { id: 's1', groupId: 'g1', kindergartenId: 'k1', parentIds: ['p1'] },
      { id: 's2', groupId: 'g1', kindergartenId: 'k1', parentIds: ['p2'] },
      { id: 's3', groupId: 'g1', kindergartenId: 'k1', parentIds: ['p3'] },
      { id: 's9', groupId: 'g9', kindergartenId: 'k2', parentIds: ['pX'] },
    ],
    conversations: [
      { id: 'c1', groupId: 'g1', parentId: 'p1', scope: 'GENERAL', teacherId: 'tA' },
      { id: 'c2', groupId: 'g1', parentId: 'p1', scope: 'GENERAL', teacherId: 'tB' },
      { id: 'c3', groupId: 'g1', parentId: 'p2', scope: 'GENERAL', teacherId: 'tB' },
      { id: 'cFin', groupId: 'g1', parentId: 'p1', scope: 'ADMIN' },
      { id: 'cX', groupId: 'g9', parentId: 'pX', scope: 'GENERAL', teacherId: 'tX' },
      { id: 'cEmpty', groupId: 'g1', parentId: 'p3', scope: 'GENERAL', teacherId: 'tA' },
    ],
    messages: [
      { conversationId: 'c1', senderId: 'p1', text: 'Для Алиева' },
      { conversationId: 'c2', senderId: 'p1', text: 'Секрет для Бобоева' },
      { conversationId: 'c3', senderId: 'p2', text: 'Вопрос по физике' },
      { conversationId: 'cFin', senderId: 'adm', text: 'Оплата за ноябрь', kind: 'PAYMENT' },
      { conversationId: 'cX', senderId: 'pX', text: 'Другая школа' },
    ],
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))
const ids = (list: Array<{ id: string }>) => list.map((c) => c.id).sort()

describe('ChatService — приватность переписок', () => {
  let service: ChatService
  let db: ReturnType<typeof createFakeChatDb>
  let gateway: { emitMessage: jest.Mock; emitConversationUpdate: jest.Mock }
  let push: { sendToUser: jest.Mock; sendToUsers: jest.Mock }
  let telegram: { notifyByPhones: jest.Mock }

  const build = async (seed: FakeSeed = world()) => {
    db = createFakeChatDb(seed)
    gateway = { emitMessage: jest.fn(), emitConversationUpdate: jest.fn() }
    push = {
      sendToUser: jest.fn().mockResolvedValue({}),
      sendToUsers: jest.fn().mockResolvedValue({}),
    }
    telegram = { notifyByPhones: jest.fn().mockResolvedValue(1) }
    const ref = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: db.prisma },
        { provide: ChatGateway, useValue: gateway },
        { provide: PushService, useValue: push },
        { provide: TelegramLinkService, useValue: telegram },
      ],
    }).compile()
    service = ref.get(ChatService)
  }

  beforeEach(() => build())

  // ─── Список переписок ────────────────────────────────────────────────

  describe('listConversations', () => {
    it('403 для родителя', async () => {
      await expect(service.listConversations(p1)).rejects.toThrow(ForbiddenException)
    })

    it('учитель А видит только свою переписку, а не переписки коллеги Б из того же класса', async () => {
      const list = await service.listConversations(tA)
      expect(ids(list)).toEqual(['c1'])
      expect(list[0].lastText).toBe('Для Алиева')
    })

    it('учитель Б видит свои две переписки (с разными родителями), но не переписку А', async () => {
      expect(ids(await service.listConversations(tB))).toEqual(['c2', 'c3'])
    })

    it('учитель того же класса, у которого нет переписок, получает пустой список', async () => {
      await build({
        ...world(),
        users: [
          ...world().users,
          { id: 'tD', role: 'TEACHER', fullName: 'Новый', kindergartenId: 'k1', groupId: 'g1' },
        ],
      })
      expect(await service.listConversations(au('tD', 'TEACHER', 'k1', { groupId: 'g1' }))).toEqual([])
    })

    it('учитель с другого класса школы не видит чужие переписки класса g1', async () => {
      expect(await service.listConversations(tC)).toEqual([])
    })

    it('учитель другой школы видит только свою школу', async () => {
      expect(ids(await service.listConversations(tX))).toEqual(['cX'])
    })

    it('пустую переписку (родитель открыл чат, но ничего не написал) учитель не видит', async () => {
      const list = await service.listConversations(tA)
      expect(list.map((c) => c.id)).not.toContain('cEmpty')
    })

    it('директор и администратор видят только финансовый канал своей школы, но не личные переписки', async () => {
      for (const staff of [director, admin]) {
        const list = await service.listConversations(staff)
        expect(ids(list)).toEqual(['cFin'])
        expect(list[0].scope).toBe('ADMIN')
      }
    })

    it('администратор другой школы не видит финансовый канал школы 1', async () => {
      expect(await service.listConversations(adminX)).toEqual([])
    })

    it('возвращает scope и непрочитанное по каждой переписке', async () => {
      const list = await service.listConversations(tB)
      expect(list.every((c) => c.scope === 'GENERAL')).toBe(true)
      expect(list.every((c) => c.unread)).toBe(true)
    })
  })

  // ─── Сообщения по id ─────────────────────────────────────────────────

  describe('conversationMessages / staffSend', () => {
    it('404 если переписки нет', async () => {
      await expect(service.conversationMessages(admin, 'nope')).rejects.toThrow(NotFoundException)
    })

    it('собеседник-учитель открывает свою переписку', async () => {
      const r = await service.conversationMessages(tA, 'c1')
      expect(r.messages.map((m) => m.text)).toEqual(['Для Алиева'])
    })

    it('403: учитель А не может открыть переписку учителя Б по прямому id', async () => {
      await expect(service.conversationMessages(tA, 'c2')).rejects.toThrow(ForbiddenException)
      await expect(service.conversationMessages(tA, 'c3')).rejects.toThrow(ForbiddenException)
    })

    it('403: даже классный руководитель не читает переписку коллеги', async () => {
      // tA — классный руководитель g1 (homeroomTeacherId), но переписка c2 — Бобоева
      await expect(service.conversationMessages(tA, 'c2')).rejects.toThrow(ForbiddenException)
    })

    it('403: учитель другой школы не открывает переписку школы 1', async () => {
      await expect(service.conversationMessages(tX, 'c1')).rejects.toThrow(ForbiddenException)
    })

    it('403: директор и администратор не открывают личную переписку учителя с родителем', async () => {
      for (const staff of [director, admin]) {
        await expect(service.conversationMessages(staff, 'c1')).rejects.toThrow(ForbiddenException)
        await expect(service.conversationMessages(staff, 'c2')).rejects.toThrow(ForbiddenException)
      }
    })

    it('403: учитель не может открыть ADMIN-канал по прямому ID', async () => {
      await expect(service.conversationMessages(tA, 'cFin')).rejects.toThrow(ForbiddenException)
      await expect(service.conversationMessages(tB, 'cFin')).rejects.toThrow(ForbiddenException)
    })

    it('администрация открывает финансовый канал своей школы, чужая школа — нет', async () => {
      expect((await service.conversationMessages(admin, 'cFin')).messages).toHaveLength(1)
      expect((await service.conversationMessages(director, 'cFin')).messages).toHaveLength(1)
      await expect(service.conversationMessages(adminX, 'cFin')).rejects.toThrow(ForbiddenException)
    })

    it('403: родитель не ходит по сотрудническому маршруту', async () => {
      await expect(service.conversationMessages(p1, 'c1')).rejects.toThrow(ForbiddenException)
    })

    it('учитель А не может писать в переписку Б: сообщение не создаётся', async () => {
      const before = db.state.messages.length
      await expect(service.staffSend(tA, 'c2', 'вторгаюсь')).rejects.toThrow(ForbiddenException)
      expect(db.state.messages).toHaveLength(before)
      expect(gateway.emitMessage).not.toHaveBeenCalled()
      expect(push.sendToUser).not.toHaveBeenCalled()
    })

    it('учитель пишет в свою переписку: родитель получает пуш и Telegram', async () => {
      db.state.users.find((u) => u.id === 'p1')!.phone = '+992900112233'
      await service.staffSend(tA, 'c1', 'Здравствуйте!')
      await flush()
      expect(push.sendToUser).toHaveBeenCalledWith('p1', expect.objectContaining({ body: 'Здравствуйте!' }))
      expect(telegram.notifyByPhones).toHaveBeenCalledTimes(1)
      const [phones, text] = telegram.notifyByPhones.mock.calls[0]
      expect(phones).toContain('+992900112233')
      expect(text).toContain('Здравствуйте!')
    })

    it('прочтение отмечается только в той переписке, которую открыли', async () => {
      await service.conversationMessages(tB, 'c2')
      expect(db.state.conversations.find((c) => c.id === 'c2')!.staffReadAt).not.toBeNull()
      expect(db.state.conversations.find((c) => c.id === 'c3')!.staffReadAt).toBeNull()
      expect(db.state.conversations.find((c) => c.id === 'c1')!.staffReadAt).toBeNull()
    })
  })

  // ─── Непрочитанное ───────────────────────────────────────────────────

  describe('unreadCount', () => {
    it('учитель считает только свои переписки', async () => {
      expect((await service.unreadCount(tA)).count).toBe(1) // c1 (cEmpty без сообщений)
      expect((await service.unreadCount(tB)).count).toBe(2) // c2, c3
      expect((await service.unreadCount(tC)).count).toBe(0)
      expect((await service.unreadCount(tX)).count).toBe(1) // cX
    })

    it('чтение учителем Б не меняет счётчик учителя А', async () => {
      await service.conversationMessages(tB, 'c2')
      expect((await service.unreadCount(tB)).count).toBe(1)
      expect((await service.unreadCount(tA)).count).toBe(1)
    })

    it('новое сообщение родителя учителю Б не добавляет непрочитанного учителю А', async () => {
      await service.parentSend(p2, 'ещё вопрос', 'GENERAL', 'tB')
      expect((await service.unreadCount(tA)).count).toBe(1)
    })

    it('администрация считает только финансовый канал, учитель его не считает', async () => {
      // последнее сообщение в cFin — от самого админа: своё непрочитанным не считается
      expect((await service.unreadCount(admin)).count).toBe(0)
      await service.parentSend(p1, 'оплатил', 'ADMIN')
      expect((await service.unreadCount(admin)).count).toBe(1)
      expect((await service.unreadCount(director)).count).toBe(1)
      expect((await service.unreadCount(adminX)).count).toBe(0)
      expect((await service.unreadCount(tA)).count).toBe(1) // его c1; финансы не добавились
    })

    it('родитель считает свои переписки', async () => {
      // сейчас у p1 одно непрочитанное: напоминание об оплате в канале «Администрация»
      expect((await service.unreadCount(p1)).count).toBe(1)
      await service.staffSend(tB, 'c2', 'ответ Бобоева')
      expect((await service.unreadCount(p1)).count).toBe(2)
      expect((await service.unreadCount(p2)).count).toBe(0)
    })
  })

  // ─── Родитель ────────────────────────────────────────────────────────

  describe('родитель: выбор учителя и переписка', () => {
    it('403 если роль не PARENT', async () => {
      await expect(service.myConversation(tA)).rejects.toThrow(ForbiddenException)
      await expect(service.myTeachers(tA)).rejects.toThrow(ForbiddenException)
    })

    it('404 если нет привязанного ребёнка', async () => {
      await expect(service.myConversation(pNoKid)).rejects.toThrow(NotFoundException)
    })

    it('список учителей: только учителя класса ребёнка, классный первым', async () => {
      const r = await service.myTeachers(p1)
      expect(r.teachers.map((t) => t.id)).toEqual(['tA', 'tB'])
      expect(r.teachers[0].isHomeroom).toBe(true)
      expect(r.teachers[1].subjects).toEqual(['Физика'])
      // Саидов (другой класс) и Хасанов (другая школа) в списке не появляются
      expect(r.teachers.map((t) => t.id)).not.toContain('tC')
      expect(r.teachers.map((t) => t.id)).not.toContain('tX')
    })

    it('в списке учителей бейдж непрочитанного только там, где ответил учитель', async () => {
      await service.staffSend(tB, 'c2', 'Ответ Бобоева')
      const r = await service.myTeachers(p1)
      expect(r.teachers.find((t) => t.id === 'tB')!.unread).toBe(true)
      expect(r.teachers.find((t) => t.id === 'tA')!.unread).toBe(false) // последним писал сам родитель
    })

    it('открывает личную переписку с выбранным учителем — свои сообщения, не чужие', async () => {
      const toB = await service.myConversation(p1, 'GENERAL', 'tB')
      expect(toB.conversation.id).toBe('c2')
      expect(toB.conversation.teacherName).toBe('Бобоев Б.')
      expect(toB.messages.map((m) => m.text)).toEqual(['Секрет для Бобоева'])

      const toA = await service.myConversation(p1, 'GENERAL', 'tA')
      expect(toA.conversation.id).toBe('c1')
      expect(toA.messages.map((m) => m.text)).toEqual(['Для Алиева'])
    })

    it('403: родитель не может выбрать учителя не из класса ребёнка (другой класс, другая школа)', async () => {
      await expect(service.myConversation(p1, 'GENERAL', 'tC')).rejects.toThrow(ForbiddenException)
      await expect(service.myConversation(p1, 'GENERAL', 'tX')).rejects.toThrow(ForbiddenException)
      await expect(service.parentSend(p1, 'привет', 'GENERAL', 'tX')).rejects.toThrow(ForbiddenException)
      expect(db.state.conversations.some((c) => c.teacherId === 'tX' && c.parentId === 'p1')).toBe(false)
    })

    it('родитель другой школы не попадает в чужие переписки', async () => {
      const r = await service.myConversation(pX, 'GENERAL', 'tX')
      expect(r.conversation.id).toBe('cX')
      await expect(service.myConversation(pX, 'GENERAL', 'tA')).rejects.toThrow(ForbiddenException)
    })

    it('без teacherId (старое приложение): тот, с кем переписка шла последней', async () => {
      // у p1 две переписки; последним писал p1 в c2 (Бобоев) — после c1
      const r = await service.myConversation(p1)
      expect(r.conversation.id).toBe('c2')
    })

    it('без teacherId и без истории: классный руководитель', async () => {
      const r = await service.myConversation(p3)
      expect(r.conversation.teacherId).toBe('tA')
    })

    it('пустая переписка не считается «последней»: по умолчанию снова классный', async () => {
      // cEmpty (p3↔tA) без сообщений — выбор по умолчанию всё равно tA, и новая переписка не плодится
      const before = db.state.conversations.length
      const r = await service.myConversation(p3)
      expect(r.conversation.id).toBe('cEmpty')
      expect(db.state.conversations).toHaveLength(before)
    })

    it('400 если у класса нет учителей', async () => {
      await build({
        ...world(),
        users: world().users.filter((u) => u.role !== 'TEACHER' || u.kindergartenId !== 'k1'),
      })
      await expect(service.myConversation(p1)).rejects.toThrow(BadRequestException)
    })

    it('родитель пишет конкретному учителю: сообщение в его переписке, пуш только ему', async () => {
      await service.parentSend(p1, 'вопрос Бобоеву', 'GENERAL', 'tB')
      await flush()

      const sent = db.state.messages.find((m) => m.text === 'вопрос Бобоеву')!
      expect(sent.conversationId).toBe('c2')
      expect(gateway.emitMessage).toHaveBeenCalledWith('c2', expect.anything())

      // пуш с текстом — строго учителю-собеседнику
      expect(push.sendToUsers).toHaveBeenCalledTimes(1)
      expect(push.sendToUsers.mock.calls[0][0]).toEqual(['tB'])
      // по тапу на уведомление приложение открывает именно эту переписку
      expect(push.sendToUsers.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          title: expect.stringContaining('Сообщение от'),
          body: 'вопрос Бобоеву',
          data: expect.objectContaining({ kind: 'chat', conversationId: 'c2' }),
        }),
      )
      // список обновляется у родителя и у этого учителя, но не у других
      const notified = gateway.emitConversationUpdate.mock.calls.map((c) => c[0]).sort()
      expect(notified).toEqual(['p1', 'tB'])
    })

    it('сообщение родителя в личной переписке не уходит пушем ни директору, ни администратору, ни другим учителям', async () => {
      await service.parentSend(p1, 'личное', 'GENERAL', 'tA')
      await flush()
      const recipients = push.sendToUsers.mock.calls.flatMap((c) => c[0])
      expect(recipients).toEqual(['tA'])
      expect(recipients).not.toContain('dir')
      expect(recipients).not.toContain('adm')
      expect(recipients).not.toContain('tB')
    })

    it('сообщение в канал «Администрация» — пуш админам школы, не учителям', async () => {
      await service.parentSend(p1, 'про оплату', 'ADMIN')
      await flush()
      const recipients = push.sendToUsers.mock.calls.flatMap((c) => c[0])
      expect(recipients).toEqual(['adm'])
      expect(recipients).not.toContain('tA')
      expect(recipients).not.toContain('tB')
    })

    it('канал «Администрация» переиспользуется и не имеет учителя', async () => {
      const r = await service.myConversation(p1, 'ADMIN')
      expect(r.conversation.id).toBe('cFin')
      expect(r.conversation.teacherId).toBeNull()
      const created = await service.myConversation(p2, 'ADMIN')
      expect(created.conversation.teacherId).toBeNull()
      expect(created.conversation.scope).toBe('ADMIN')
    })

    it('гонка: если переписку успели создать параллельно, берётся созданная', async () => {
      const existing = db.state.conversations.find((c) => c.id === 'cEmpty')!
      const realFindFirst = db.prisma.conversation.findFirst
      const spy = jest
        .spyOn(db.prisma.conversation, 'findFirst')
        .mockImplementationOnce(async () => null) // первый поиск «ничего не нашёл»
        .mockImplementation(realFindFirst)
      const r = await service.myConversation(p3, 'GENERAL', 'tA') // create → P2002 → повторный поиск
      expect(r.conversation.id).toBe(existing.id)
      spy.mockRestore()
    })
  })

  // ─── Рассылка сотрудника родителям ученика ───────────────────────────

  describe('sendToStudentParents', () => {
    it('учитель пишет в свою личную переписку с родителем, коллега её не видит', async () => {
      const r = await service.sendToStudentParents(tA, 's2', 'Ребёнок не сделал ДЗ')
      expect(r.sent).toBe(1)
      const created = db.state.conversations.find(
        (c) => c.parentId === 'p2' && c.teacherId === 'tA',
      )!
      expect(created.scope).toBe('GENERAL')
      // у Бобоева с этим родителем — своя переписка c3, текст рассылки Алиева в ней не появился
      const inB = await service.conversationMessages(tB, 'c3')
      expect(inB.messages.map((m) => m.text)).not.toContain('Ребёнок не сделал ДЗ')
      // а Бобоев не может открыть переписку, созданную Алиевым
      await expect(service.conversationMessages(tB, created.id)).rejects.toThrow(ForbiddenException)
      // Алиев видит её в списке
      expect(ids(await service.listConversations(tA))).toContain(created.id)
    })

    it('учитель переиспользует уже существующую свою переписку с этим родителем', async () => {
      await service.sendToStudentParents(tA, 's1', 'Напоминание')
      expect(
        db.state.conversations.filter((c) => c.parentId === 'p1' && c.teacherId === 'tA'),
      ).toHaveLength(1)
      expect(
        db.state.messages.filter((m) => m.conversationId === 'c1').map((m) => m.text),
      ).toContain('Напоминание')
    })

    it('директор/администратор пишет в канал «Администрация», который сам видит', async () => {
      await service.sendToStudentParents(director, 's2', 'Собрание завтра')
      const conv = db.state.conversations.find((c) => c.parentId === 'p2' && c.scope === 'ADMIN')!
      expect(conv.teacherId).toBeNull()
      expect(ids(await service.listConversations(director))).toContain(conv.id)
      // а учителя этот канал не видят
      expect(ids(await service.listConversations(tB))).not.toContain(conv.id)
    })

    it('404 если ученика нет', async () => {
      await expect(service.sendToStudentParents(tA, 'nope', 'x')).rejects.toThrow(NotFoundException)
    })
  })

  // ─── Напоминание об оплате ───────────────────────────────────────────

  describe('paymentReminder — только админ, в канал ADMIN', () => {
    it('403 если отправляет учитель или родитель', async () => {
      await expect(service.paymentReminder(tA, 's1', '2026-05', 1200)).rejects.toThrow(ForbiddenException)
      await expect(service.paymentReminder(p1, 's1', '2026-05', 1200)).rejects.toThrow(ForbiddenException)
    })

    it('404 если ученик не найден', async () => {
      await expect(service.paymentReminder(admin, 'nope', '2026-05', 1200)).rejects.toThrow(NotFoundException)
    })

    it('403 если ученик из другого учреждения', async () => {
      await expect(service.paymentReminder(admin, 's9', '2026-05', 1200)).rejects.toThrow(ForbiddenException)
    })

    it('400 если у ученика нет родительских аккаунтов', async () => {
      await build({
        ...world(),
        // ни привязки M:N, ни legacy childId
        users: world().users.map((u) => (u.id === 'p1' ? { ...u, childId: null } : u)),
        students: [{ id: 's1', groupId: 'g1', kindergartenId: 'k1', parentIds: [] }],
      })
      await expect(service.paymentReminder(admin, 's1', '2026-05', 1200)).rejects.toThrow(BadRequestException)
    })

    it('шлёт PAYMENT-сообщение в канал ADMIN, учитель его не видит', async () => {
      const r = await service.paymentReminder(admin, 's2', '2026-05', 1200)
      expect(r.sent).toBe(1)
      const conv = db.state.conversations.find((c) => c.parentId === 'p2' && c.scope === 'ADMIN')!
      expect(conv.teacherId).toBeNull()
      const msg = db.state.messages.find((m) => m.conversationId === conv.id)!
      expect(msg.kind).toBe('PAYMENT')
      expect(ids(await service.listConversations(tB))).not.toContain(conv.id)
      await expect(service.conversationMessages(tB, conv.id)).rejects.toThrow(ForbiddenException)
    })

    it('Telegram родителю: при ответе сотрудника да, при сообщении самого родителя нет', async () => {
      db.state.users.find((u) => u.id === 'p1')!.phone = '+992900445566'
      await service.staffSend(admin, 'cFin', 'Здравствуйте!')
      await flush()
      expect(telegram.notifyByPhones).toHaveBeenCalledTimes(1)

      telegram.notifyByPhones.mockClear()
      await service.parentSend(p1, 'Спасибо!', 'ADMIN')
      await flush()
      expect(telegram.notifyByPhones).not.toHaveBeenCalled()
    })
  })
})
