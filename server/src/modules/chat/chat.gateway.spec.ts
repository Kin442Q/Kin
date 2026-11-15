import { ChatGateway } from './chat.gateway'

/**
 * Комната переписки получает каждое сообщение целиком — значит, вход в неё должен
 * подчиняться тому же правилу, что и чтение по REST.
 */
describe('ChatGateway.onJoin — кто может слушать переписку', () => {
  const convs: Record<string, any> = {
    personal: { id: 'personal', parentId: 'p1', teacherId: 'tA', scope: 'GENERAL', kindergartenId: 'k1', groupId: 'g1' },
    finance: { id: 'finance', parentId: 'p1', teacherId: null, scope: 'ADMIN', kindergartenId: 'k1', groupId: 'g1' },
  }
  const prisma = {
    conversation: {
      findUnique: jest.fn(async ({ where }: any) => convs[where.id] ?? null),
    },
  }
  const gateway = new ChatGateway({} as any, {} as any, prisma as any)

  const client = (userId: string, role: string, kindergartenId: string | null, groupId: string | null = null) =>
    ({ userId, role, kindergartenId, groupId, join: jest.fn() }) as any

  const joined = async (c: any, conversationId: string) => {
    await gateway.onJoin(c, { conversationId })
    return c.join.mock.calls.map((a: any[]) => a[0])
  }

  it('участники личной переписки входят в комнату', async () => {
    expect(await joined(client('p1', 'PARENT', 'k1'), 'personal')).toEqual(['conv:personal'])
    expect(await joined(client('tA', 'TEACHER', 'k1', 'g1'), 'personal')).toEqual(['conv:personal'])
  })

  it('другой учитель того же класса не входит — группа в токене больше ничего не решает', async () => {
    expect(await joined(client('tB', 'TEACHER', 'k1', 'g1'), 'personal')).toEqual([])
  })

  it('директор и администратор не входят в личную переписку (раньше входили)', async () => {
    expect(await joined(client('dir', 'SUPER_ADMIN', 'k1'), 'personal')).toEqual([])
    expect(await joined(client('adm', 'ADMIN', 'k1'), 'personal')).toEqual([])
  })

  it('учитель не входит в финансовый канал своей группы (раньше входил)', async () => {
    expect(await joined(client('tA', 'TEACHER', 'k1', 'g1'), 'finance')).toEqual([])
  })

  it('администрация своей школы входит в финансовый канал, чужой школы — нет', async () => {
    expect(await joined(client('adm', 'ADMIN', 'k1'), 'finance')).toEqual(['conv:finance'])
    expect(await joined(client('admX', 'ADMIN', 'k2'), 'finance')).toEqual([])
  })

  it('чужой родитель и учитель другой школы не входят', async () => {
    expect(await joined(client('p2', 'PARENT', 'k1'), 'personal')).toEqual([])
    expect(await joined(client('tA', 'TEACHER', 'k2', 'g1'), 'personal')).toEqual([])
  })

  it('несуществующая переписка, пустой id и неавторизованный сокет — тихо игнорируются', async () => {
    expect(await joined(client('p1', 'PARENT', 'k1'), 'nope')).toEqual([])
    const anon = { join: jest.fn() } as any
    await gateway.onJoin(anon, { conversationId: 'personal' })
    await gateway.onJoin(client('p1', 'PARENT', 'k1'), { conversationId: '' } as any)
    expect(anon.join).not.toHaveBeenCalled()
  })
})
