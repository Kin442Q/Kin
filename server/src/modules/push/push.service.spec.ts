import { PushService } from './push.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'

const TOKEN_A = 'ExponentPushToken[aaaa]'
const TOKEN_B = 'ExponentPushToken[bbbb]'

function okResponse(tickets: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: tickets }),
    text: async () => '',
  } as unknown as Response
}

describe('PushService', () => {
  let prisma: PrismaMock
  let service: PushService
  let fetchMock: jest.SpyInstance

  beforeEach(() => {
    prisma = createPrismaMock()
    prisma.notification.createMany.mockResolvedValue({ count: 0 })
    prisma.user.updateMany.mockResolvedValue({ count: 1 })
    service = new PushService(prisma as any)
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(okResponse([{ status: 'ok' }]))
  })

  afterEach(() => jest.restoreAllMocks())

  const sentMessages = () => JSON.parse((fetchMock.mock.calls[0][1] as any).body)

  describe('sendToUsers', () => {
    it('запись в «Оповещения» создаётся для всех, push — только тем, у кого есть токен', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', expoPushToken: TOKEN_A },
        { id: 'u2', expoPushToken: null },
      ])

      await service.sendToUsers(['u1', 'u2'], {
        title: 'Привет',
        body: 'текст',
        data: { kind: 'chat', conversationId: 'c1' },
      })

      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: 'u1',
            title: 'Привет',
            description: 'текст',
            channel: 'IN_APP',
            payload: { kind: 'chat', conversationId: 'c1' },
          }),
          expect.objectContaining({ userId: 'u2', title: 'Привет' }),
        ],
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const msgs = sentMessages()
      expect(msgs).toHaveLength(1)
      expect(msgs[0]).toEqual(
        expect.objectContaining({
          to: TOKEN_A,
          title: 'Привет',
          channelId: 'default',
          priority: 'high',
          data: { kind: 'chat', conversationId: 'c1' },
        }),
      )
    })

    it('только неактивные пользователи отфильтрованы запросом (isActive)', async () => {
      prisma.user.findMany.mockResolvedValue([])
      await service.sendToUsers(['u1'], { title: 't', body: 'b' })
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      )
      expect(prisma.notification.createMany).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('пустой список — ничего не делает', async () => {
      await service.sendToUsers([], { title: 't', body: 'b' })
      expect(prisma.user.findMany).not.toHaveBeenCalled()
    })

    it('один токен у двух аккаунтов — одно сообщение', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', expoPushToken: TOKEN_A },
        { id: 'u2', expoPushToken: TOKEN_A },
      ])
      await service.sendToUsers(['u1', 'u2'], { title: 't', body: 'b' })
      expect(sentMessages()).toHaveLength(1)
    })

    it('«не Expo» токен не отправляется, но запись в оповещения остаётся', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', expoPushToken: 'garbage' }])
      await service.sendToUsers(['u1'], { title: 't', body: 'b' })
      expect(prisma.notification.createMany).toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('сбой записи в БД не мешает отправить push', async () => {
      prisma.notification.createMany.mockRejectedValue(new Error('db down'))
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', expoPushToken: TOKEN_A }])
      await expect(service.sendToUsers(['u1'], { title: 't', body: 'b' })).resolves.toBeUndefined()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('родители ученика / группы', () => {
    it('sendToStudentParents: M:N и legacy-родители, все получают запись, токены не дублируются', async () => {
      prisma.student.findUnique.mockResolvedValue({
        parents: [{ id: 'p1', expoPushToken: TOKEN_A }],
      })
      prisma.user.findMany.mockResolvedValue([
        { id: 'p1', expoPushToken: TOKEN_A }, // тот же родитель по старой привязке
        { id: 'p2', expoPushToken: null },
      ])

      await service.sendToStudentParents('s1', { title: 't', body: 'b' })

      const rows = prisma.notification.createMany.mock.calls[0][0].data
      expect(rows.map((r: any) => r.userId).sort()).toEqual(['p1', 'p2'])
      expect(sentMessages()).toHaveLength(1)
    })

    it('sendToGroupParents: родители группы получают запись даже без токена', async () => {
      prisma.student.findMany.mockResolvedValue([
        { parents: [{ id: 'p1', expoPushToken: null }] },
      ])
      prisma.user.findMany.mockResolvedValue([])
      await service.sendToGroupParents('g1', { title: 't', body: 'b' })
      expect(prisma.notification.createMany).toHaveBeenCalledTimes(1)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('разбор ответа Expo', () => {
    beforeEach(() => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', expoPushToken: TOKEN_A }])
    })

    it('DeviceNotRegistered → токен снимается с пользователя', async () => {
      fetchMock.mockResolvedValue(
        okResponse([{ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }]),
      )
      await service.sendToUsers(['u1'], { title: 't', body: 'b' })
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { expoPushToken: TOKEN_A },
        data: { expoPushToken: null },
      })
    })

    it('InvalidCredentials (нет ключа FCM) → не падает, ошибка попадает в результат', async () => {
      fetchMock.mockResolvedValue(
        okResponse([
          { status: 'error', message: 'Unable to retrieve the FCM server key', details: { error: 'InvalidCredentials' } },
        ]),
      )
      const res = await service.send([{ to: TOKEN_A, title: 't', body: 'b' }])
      expect(res.accepted).toBe(0)
      expect(res.failures).toEqual([
        { token: TOKEN_A, error: 'InvalidCredentials', message: 'Unable to retrieve the FCM server key' },
      ])
      expect(prisma.user.updateMany).not.toHaveBeenCalled()
    })

    it('HTTP-ошибка Expo → не падает, отражается в результате', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'unavailable',
      } as unknown as Response)
      const res = await service.send([{ to: TOKEN_A, title: 't', body: 'b' }])
      expect(res.failures[0]).toEqual(expect.objectContaining({ token: TOKEN_A, error: 'HTTP_503' }))
    })

    it('сеть недоступна → не падает', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNRESET'))
      const res = await service.send([{ to: TOKEN_A, title: 't', body: 'b' }])
      expect(res.failures[0].error).toBe('NETWORK')
    })

    it('принятые сообщения считаются', async () => {
      fetchMock.mockResolvedValue(okResponse([{ status: 'ok' }, { status: 'ok' }]))
      const res = await service.send([
        { to: TOKEN_A, title: 't', body: 'b' },
        { to: TOKEN_B, title: 't', body: 'b' },
      ])
      expect(res).toEqual({ accepted: 2, failures: [] })
    })

    it('больше 100 сообщений делятся на пачки', async () => {
      fetchMock.mockImplementation(async (_url: any, init: any) => {
        const n = JSON.parse(init.body).length
        return okResponse(Array.from({ length: n }, () => ({ status: 'ok' })))
      })
      const msgs = Array.from({ length: 230 }, (_, i) => ({
        to: `ExponentPushToken[t${i}]`,
        title: 't',
        body: 'b',
      }))
      const res = await service.send(msgs)
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(res.accepted).toBe(230)
    })
  })

  describe('sendTest', () => {
    it('нет токена → registered: false, в Expo не ходим', async () => {
      prisma.user.findUnique.mockResolvedValue({ expoPushToken: null })
      expect(await service.sendTest('u1')).toEqual({ registered: false, result: null })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('есть токен → отправляет тест без записи в «Оповещения»', async () => {
      prisma.user.findUnique.mockResolvedValue({ expoPushToken: TOKEN_A })
      const res = await service.sendTest('u1')
      expect(res.registered).toBe(true)
      expect(res.result?.accepted).toBe(1)
      expect(prisma.notification.createMany).not.toHaveBeenCalled()
    })
  })
})
