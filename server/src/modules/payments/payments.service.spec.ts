import { Test } from '@nestjs/testing'
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'

import { PaymentsService } from './payments.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { TelegramLinkService } from '../telegram/telegram-link.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const adminK1: AuthUser = {
  sub: 'admin',
  email: 'admin@kg.tj',
  role: 'ADMIN',
  kindergartenId: 'k1',
  groupId: null,
  childId: null,
}

const teacherK1: AuthUser = {
  sub: 't',
  email: 't@kg.tj',
  role: 'TEACHER',
  kindergartenId: 'k1',
  groupId: 'g1',
  childId: null,
}

describe('PaymentsService', () => {
  let service: PaymentsService
  let prisma: PrismaMock
  let telegram: { sendPaymentConfirmation: jest.Mock }

  beforeEach(async () => {
    prisma = createPrismaMock()
    telegram = { sendPaymentConfirmation: jest.fn().mockResolvedValue({}) }
    const ref = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TelegramLinkService, useValue: telegram },
      ],
    }).compile()
    service = ref.get(PaymentsService)
  })

  describe('upsert', () => {
    const baseDto = {
      studentId: 's1',
      month: '2026-05',
      amount: 1200,
      paid: false,
    }

    it('400 если не указан studentId', async () => {
      await expect(
        service.upsert(adminK1, { ...baseDto, studentId: '' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('400 если не указан month', async () => {
      await expect(
        service.upsert(adminK1, { ...baseDto, month: '' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('404 если ребёнок не найден', async () => {
      prisma.student.findUnique.mockResolvedValue(null)
      await expect(service.upsert(adminK1, baseDto)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('403 если ребёнок из другого садика', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k2',
        firstName: 'A',
        lastName: 'B',
      })
      await expect(service.upsert(adminK1, baseDto)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('403 TEACHER не может отметить ребёнка из чужой группы', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g999',
        kindergartenId: 'k1',
        firstName: 'A',
        lastName: 'B',
      })
      await expect(service.upsert(teacherK1, baseDto)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('создаёт платёж', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
        firstName: 'Айша',
        lastName: 'К',
        motherPhone: null,
        fatherPhone: null,
        group: { name: 'Солнышко' },
      })
      prisma.payment.findUnique.mockResolvedValue(null)
      prisma.payment.upsert.mockResolvedValue({
        id: 'p1',
        paid: false,
        amount: 1200,
      })

      await service.upsert(adminK1, baseDto)

      expect(prisma.payment.upsert).toHaveBeenCalled()
    })

    it('НЕ шлёт Telegram при создании "не оплачено"', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
        firstName: 'Айша',
        lastName: 'К',
        motherPhone: '+992901112233',
        fatherPhone: null,
        group: { name: 'Солнышко' },
      })
      prisma.payment.findUnique.mockResolvedValue(null)
      prisma.payment.upsert.mockResolvedValue({})

      await service.upsert(adminK1, { ...baseDto, paid: false })

      expect(telegram.sendPaymentConfirmation).not.toHaveBeenCalled()
    })

    it('шлёт Telegram при переходе не оплачено → оплачено', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
        firstName: 'Айша',
        lastName: 'К',
        motherPhone: '+992901112233',
        fatherPhone: null,
        group: { name: 'Солнышко' },
      })
      prisma.payment.findUnique.mockResolvedValue(null) // нет предыдущего
      prisma.payment.upsert.mockResolvedValue({
        id: 'p1',
        paid: true,
        amount: 1200,
      })

      await service.upsert(adminK1, { ...baseDto, paid: true })

      // Подождать промис уведомления
      await new Promise((r) => setImmediate(r))

      expect(telegram.sendPaymentConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          phones: ['+992901112233'],
          paid: true,
        }),
      )
    })

    it('НЕ дублирует Telegram если уже было оплачено', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
        firstName: 'A',
        lastName: 'B',
        motherPhone: '+992901112233',
        fatherPhone: null,
        group: { name: 'Sun' },
      })
      prisma.payment.findUnique.mockResolvedValue({ id: 'p1', paid: true })
      prisma.payment.upsert.mockResolvedValue({ id: 'p1', paid: true })

      await service.upsert(adminK1, { ...baseDto, paid: true })
      await new Promise((r) => setImmediate(r))

      expect(telegram.sendPaymentConfirmation).not.toHaveBeenCalled()
    })

    it('НЕ шлёт Telegram если у ребёнка нет телефонов родителей', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
        firstName: 'A',
        lastName: 'B',
        motherPhone: null,
        fatherPhone: null,
        group: { name: 'Sun' },
      })
      prisma.payment.findUnique.mockResolvedValue(null)
      prisma.payment.upsert.mockResolvedValue({})

      await service.upsert(adminK1, { ...baseDto, paid: true })
      await new Promise((r) => setImmediate(r))

      expect(telegram.sendPaymentConfirmation).not.toHaveBeenCalled()
    })
  })

  describe('remove', () => {
    it('404 если платёж не найден', async () => {
      prisma.payment.findUnique.mockResolvedValue(null)
      await expect(service.remove(adminK1, 'pX')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('403 если платёж из другого садика', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'p1',
        student: { groupId: 'g1', kindergartenId: 'k2' },
      })
      await expect(service.remove(adminK1, 'p1')).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('удаляет платёж своего садика', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'p1',
        student: { groupId: 'g1', kindergartenId: 'k1' },
      })
      prisma.payment.delete.mockResolvedValue({})
      const res = await service.remove(adminK1, 'p1')
      expect(res.success).toBe(true)
    })
  })
})
