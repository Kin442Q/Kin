import { ParentNoticeService } from './parent-notice.service'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { PushService } from '../push/push.module'
import type { ChatService } from '../chat/chat.module'
import type { FeaturesService } from '../features/features.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const teacher: AuthUser = {
  sub: 't1',
  email: 't@s.tj',
  role: 'TEACHER',
  kindergartenId: 'k1',
  groupId: null,
  childId: null,
}

describe('ParentNoticeService', () => {
  let prisma: PrismaMock
  let chat: { sendToStudentParents: jest.Mock }
  let push: { sendToUsers: jest.Mock }
  let features: { isEnabled: jest.Mock }
  let service: ParentNoticeService

  beforeEach(() => {
    prisma = createPrismaMock()
    chat = { sendToStudentParents: jest.fn().mockResolvedValue({ sent: 2 }) }
    push = { sendToUsers: jest.fn().mockResolvedValue(undefined) }
    features = { isEnabled: jest.fn().mockResolvedValue(true) }
    service = new ParentNoticeService(
      prisma as unknown as PrismaService,
      chat as unknown as ChatService,
      push as unknown as PushService,
      features as unknown as FeaturesService,
    )
  })

  describe('parentIdsByStudent', () => {
    it('объединяет родителей M:N и legacy childId без дублей; активные', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: 'a', parents: [{ id: 'p1' }, { id: 'p2' }] },
        { id: 'b', parents: [] },
      ])
      prisma.user.findMany.mockResolvedValue([
        { id: 'p2', childId: 'a' }, // тот же родитель по legacy — дубль
        { id: 'p3', childId: 'b' },
      ])

      const m = await service.parentIdsByStudent(['a', 'b', 'c'])

      expect(m.get('a')).toEqual(['p1', 'p2'])
      expect(m.get('b')).toEqual(['p3'])
      expect(m.get('c')).toEqual([]) // родителей нет
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({
        role: 'PARENT',
        isActive: true,
        childId: { in: ['a', 'b', 'c'] },
      })
    })

    it('пустой список учеников — пустая карта без запросов', async () => {
      expect((await service.parentIdsByStudent([])).size).toBe(0)
      expect(prisma.student.findMany).not.toHaveBeenCalled()
    })
  })

  describe('notify', () => {
    it('чат включён → обычное сообщение в чат (с пушем и Telegram внутри чата)', async () => {
      const r = await service.notify(teacher, 'a', 'Здравствуйте')
      expect(r).toEqual({ sent: 2 })
      expect(chat.sendToStudentParents).toHaveBeenCalledWith(teacher, 'a', 'Здравствуйте')
      expect(push.sendToUsers).not.toHaveBeenCalled()
      expect(features.isEnabled).toHaveBeenCalledWith('k1', 'chat')
    })

    it('чат выключен → только пуш родителям', async () => {
      features.isEnabled.mockResolvedValue(false)
      prisma.student.findMany.mockResolvedValue([{ id: 'a', parents: [{ id: 'p1' }] }])
      prisma.user.findMany.mockResolvedValue([])

      const r = await service.notify(teacher, 'a', 'Просим подойти в школу')

      expect(r).toEqual({ sent: 1 })
      expect(chat.sendToStudentParents).not.toHaveBeenCalled()
      expect(push.sendToUsers).toHaveBeenCalledWith(
        ['p1'],
        expect.objectContaining({ title: 'Сообщение от школы', body: 'Просим подойти в школу' }),
      )
    })

    it('чат выключен и родителей нет → sent: 0, пуш не уходит', async () => {
      features.isEnabled.mockResolvedValue(false)
      prisma.student.findMany.mockResolvedValue([{ id: 'a', parents: [] }])
      prisma.user.findMany.mockResolvedValue([])
      expect(await service.notify(teacher, 'a', 'Текст')).toEqual({ sent: 0 })
      expect(push.sendToUsers).not.toHaveBeenCalled()
    })

    it('ошибка пуша не валит отправку', async () => {
      features.isEnabled.mockResolvedValue(false)
      prisma.student.findMany.mockResolvedValue([{ id: 'a', parents: [{ id: 'p1' }] }])
      prisma.user.findMany.mockResolvedValue([])
      push.sendToUsers.mockRejectedValue(new Error('expo down'))
      await expect(service.notify(teacher, 'a', 'Текст')).resolves.toEqual({ sent: 1 })
    })
  })
})
