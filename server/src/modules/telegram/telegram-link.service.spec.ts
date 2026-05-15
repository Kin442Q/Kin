import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { BadRequestException } from '@nestjs/common'
import { getQueueToken } from '@nestjs/bullmq'

import { TelegramLinkService } from './telegram-link.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { QUEUE_TELEGRAM } from '../../infrastructure/bullmq/bull.module'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import { normalizePhone, phoneSuffix9 } from './telegram-bot.service'

describe('TelegramLinkService', () => {
  let service: TelegramLinkService
  let prisma: PrismaMock
  let queue: { add: jest.Mock }

  beforeEach(async () => {
    prisma = createPrismaMock()
    queue = { add: jest.fn().mockResolvedValue({}) }
    const ref = await Test.createTestingModule({
      providers: [
        TelegramLinkService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: getQueueToken(QUEUE_TELEGRAM), useValue: queue },
      ],
    }).compile()
    service = ref.get(TelegramLinkService)
  })

  describe('sendBulkReminders', () => {
    it('400 если пустой список', async () => {
      await expect(service.sendBulkReminders([])).rejects.toThrow(
        BadRequestException,
      )
    })

    it('пропускает с reason если родители не зарегистрированы', async () => {
      prisma.phoneChatLink.findMany.mockResolvedValue([])

      const res = await service.sendBulkReminders([
        {
          phones: ['+992901112233'],
          studentName: 'Айша К',
          amount: 1200,
          daysLeft: 5,
        },
      ])

      expect(res.familiesNotified).toBe(0)
      expect(res.messagesQueued).toBe(0)
      expect(res.skipped).toHaveLength(1)
      expect(res.skipped[0].reason).toContain('Родители')
    })

    it('ставит в очередь сообщение для каждого chatId', async () => {
      prisma.phoneChatLink.findMany.mockResolvedValue([
        { chatId: BigInt(123456789) },
        { chatId: BigInt(987654321) },
      ])

      const res = await service.sendBulkReminders([
        {
          phones: ['+992901112233', '+992502223344'],
          studentName: 'Айша К',
          amount: 1200,
          daysLeft: 5,
        },
      ])

      expect(res.familiesNotified).toBe(1)
      expect(res.messagesQueued).toBe(2)
      expect(queue.add).toHaveBeenCalledTimes(2)
    })

    it('обрабатывает несколько семей независимо', async () => {
      // Первая семья — зарегистрирована, вторая — нет
      prisma.phoneChatLink.findMany
        .mockResolvedValueOnce([{ chatId: BigInt(111) }])
        .mockResolvedValueOnce([])

      const res = await service.sendBulkReminders([
        {
          phones: ['+992901112233'],
          studentName: 'Один',
          amount: 1000,
          daysLeft: 3,
        },
        {
          phones: ['+992999999999'],
          studentName: 'Два',
          amount: 1500,
          daysLeft: 5,
        },
      ])

      expect(res.familiesNotified).toBe(1)
      expect(res.skipped).toHaveLength(1)
      expect(res.skipped[0].studentName).toBe('Два')
    })
  })

  describe('sendPaymentConfirmation', () => {
    it('возвращает success: false если родители не зарегистрированы', async () => {
      prisma.phoneChatLink.findMany.mockResolvedValue([])
      const res = await service.sendPaymentConfirmation({
        phones: ['+992999999999'],
        studentName: 'Айша',
        amount: 1200,
        paid: true,
      })
      expect(res.success).toBe(false)
    })

    it('ставит в очередь сообщения для всех chatIds', async () => {
      prisma.phoneChatLink.findMany.mockResolvedValue([
        { chatId: BigInt(111) },
        { chatId: BigInt(222) },
      ])

      const res = await service.sendPaymentConfirmation({
        phones: ['+992901112233', '+992502223344'],
        studentName: 'Айша',
        amount: 1200,
        paid: true,
      })

      expect(res.success).toBe(true)
      expect(res.sent).toBe(2)
      expect(queue.add).toHaveBeenCalledTimes(2)
    })
  })
})

describe('phone normalization helpers', () => {
  it('normalizePhone убирает все нецифровые символы', () => {
    expect(normalizePhone('+992 (90) 111-22-33')).toBe('992901112233')
    expect(normalizePhone('+1 555 0100')).toBe('15550100')
  })

  it('phoneSuffix9 возвращает последние 9 цифр', () => {
    expect(phoneSuffix9('+992 90 111 22 33')).toBe('901112233')
    expect(phoneSuffix9('992901112233')).toBe('901112233')
  })

  it('phoneSuffix9 для коротких номеров', () => {
    expect(phoneSuffix9('12345')).toBe('12345')
  })
})
