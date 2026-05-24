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

const teacherG1: AuthUser = {
  sub: 'teacher',
  email: 't@kg.tj',
  role: 'TEACHER',
  kindergartenId: 'k1',
  groupId: 'g1',
  childId: null,
}

const parent: AuthUser = {
  sub: 'parent',
  email: 'p@kg.tj',
  role: 'PARENT',
  kindergartenId: 'k1',
  groupId: null,
  childId: 's1',
}

describe('ChatService', () => {
  let service: ChatService
  let prisma: PrismaMock
  let gateway: { emitMessage: jest.Mock; emitConversationUpdate: jest.Mock }
  let push: { sendToUser: jest.Mock; sendToUsers: jest.Mock }
  let telegram: { notifyByPhones: jest.Mock }

  beforeEach(async () => {
    prisma = createPrismaMock()
    gateway = { emitMessage: jest.fn(), emitConversationUpdate: jest.fn() }
    push = {
      sendToUser: jest.fn().mockResolvedValue({}),
      sendToUsers: jest.fn().mockResolvedValue({}),
    }
    telegram = { notifyByPhones: jest.fn().mockResolvedValue(1) }
    const ref = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatGateway, useValue: gateway },
        { provide: PushService, useValue: push },
        { provide: TelegramLinkService, useValue: telegram },
      ],
    }).compile()
    service = ref.get(ChatService)
    // teacherGroupIds() по умолчанию: учитель ведёт только g1
    prisma.user.findUnique.mockResolvedValue({ groupId: 'g1', teachingGroups: [] })
  })

  describe('myConversation', () => {
    it('403 если роль не PARENT', async () => {
      await expect(service.myConversation(teacherG1)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('404 если нет привязанного ребёнка', async () => {
      prisma.student.findFirst.mockResolvedValue(null)
      await expect(service.myConversation(parent)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('по умолчанию открывает канал GENERAL (учитель)', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
        group: { name: 'Солнышко' },
      })
      prisma.conversation.upsert.mockResolvedValue({ id: 'c1', scope: 'GENERAL' })
      prisma.message.findMany.mockResolvedValue([])
      prisma.conversation.update.mockResolvedValue({})

      const r = await service.myConversation(parent)

      expect(prisma.conversation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            groupId_parentId_scope: {
              groupId: 'g1',
              parentId: 'parent',
              scope: 'GENERAL',
            },
          },
        }),
      )
      expect(r.conversation.groupName).toBe('Солнышко')
    })

    it('открывает финансовый канал ADMIN, когда scope=ADMIN', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
        group: { name: 'Солнышко' },
      })
      prisma.conversation.upsert.mockResolvedValue({ id: 'c2', scope: 'ADMIN' })
      prisma.message.findMany.mockResolvedValue([])
      prisma.conversation.update.mockResolvedValue({})

      await service.myConversation(parent, 'ADMIN')

      expect(prisma.conversation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            groupId_parentId_scope: {
              groupId: 'g1',
              parentId: 'parent',
              scope: 'ADMIN',
            },
          },
        }),
      )
    })
  })

  describe('listConversations — учитель НЕ видит финансы', () => {
    it('403 для родителя', async () => {
      await expect(service.listConversations(parent)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('учитель: фильтр форсит scope=GENERAL и свои классы', async () => {
      prisma.conversation.findMany.mockResolvedValue([])
      await service.listConversations(teacherG1)

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId: { in: ['g1'] }, scope: 'GENERAL' },
        }),
      )
    })

    it('учитель без классов получает пустой список', async () => {
      prisma.user.findUnique.mockResolvedValue({ groupId: null, teachingGroups: [] })
      const r = await service.listConversations({ ...teacherG1, groupId: null })
      expect(r).toEqual([])
      expect(prisma.conversation.findMany).not.toHaveBeenCalled()
    })

    it('админ: видит оба канала (без фильтра по scope), только своё учреждение', async () => {
      prisma.conversation.findMany.mockResolvedValue([])
      await service.listConversations(adminK1)

      const arg = prisma.conversation.findMany.mock.calls[0][0]
      expect(arg.where).toEqual({ kindergartenId: 'k1' })
      expect(arg.where.scope).toBeUndefined()
    })

    it('возвращает scope каждой переписки', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'c1',
          parentId: 'p1',
          parent: { id: 'p1', fullName: 'Мама' },
          groupId: 'g1',
          group: { id: 'g1', name: 'Солнышко' },
          scope: 'ADMIN',
          lastMessageAt: new Date(),
          staffReadAt: null,
          messages: [],
        },
      ])
      const r = await service.listConversations(adminK1)
      expect(r[0].scope).toBe('ADMIN')
    })
  })

  describe('assertStaffAccess через conversationMessages', () => {
    it('404 если переписка не найдена', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)
      await expect(
        service.conversationMessages(adminK1, 'cX'),
      ).rejects.toThrow(NotFoundException)
    })

    it('403: учитель не может открыть ADMIN-канал по прямому ID', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'c1',
        scope: 'ADMIN',
        groupId: 'g1',
        kindergartenId: 'k1',
        parent: { id: 'p1', fullName: 'Мама' },
        group: { id: 'g1', name: 'Солнышко' },
      })
      await expect(
        service.conversationMessages(teacherG1, 'c1'),
      ).rejects.toThrow(ForbiddenException)
    })

    it('403: учитель не может открыть чужую группу', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'c1',
        scope: 'GENERAL',
        groupId: 'g999',
        kindergartenId: 'k1',
        parent: { id: 'p1', fullName: 'Мама' },
        group: { id: 'g999', name: 'Чужая' },
      })
      await expect(
        service.conversationMessages(teacherG1, 'c1'),
      ).rejects.toThrow(ForbiddenException)
    })

    it('учитель открывает GENERAL своей группы', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'c1',
        scope: 'GENERAL',
        groupId: 'g1',
        kindergartenId: 'k1',
        parent: { id: 'p1', fullName: 'Мама' },
        group: { id: 'g1', name: 'Солнышко' },
      })
      prisma.message.findMany.mockResolvedValue([])
      prisma.conversation.update.mockResolvedValue({})
      const r = await service.conversationMessages(teacherG1, 'c1')
      expect(r.messages).toEqual([])
    })
  })

  describe('paymentReminder — только админ, в канал ADMIN', () => {
    const student = {
      firstName: 'Айша',
      groupId: 'g1',
      kindergartenId: 'k1',
      parents: [{ id: 'p1' }],
    }

    it('403 если отправляет учитель', async () => {
      await expect(
        service.paymentReminder(teacherG1, 's1', '2026-05', 1200),
      ).rejects.toThrow(ForbiddenException)
    })

    it('403 если отправляет родитель', async () => {
      await expect(
        service.paymentReminder(parent, 's1', '2026-05', 1200),
      ).rejects.toThrow(ForbiddenException)
    })

    it('404 если ученик не найден', async () => {
      prisma.student.findUnique.mockResolvedValue(null)
      await expect(
        service.paymentReminder(adminK1, 's1', '2026-05', 1200),
      ).rejects.toThrow(NotFoundException)
    })

    it('403 если ученик из другого учреждения', async () => {
      prisma.student.findUnique.mockResolvedValue({
        ...student,
        kindergartenId: 'k2',
      })
      await expect(
        service.paymentReminder(adminK1, 's1', '2026-05', 1200),
      ).rejects.toThrow(ForbiddenException)
    })

    it('400 если у ученика нет родительских аккаунтов', async () => {
      prisma.student.findUnique.mockResolvedValue({ ...student, parents: [] })
      prisma.user.findMany.mockResolvedValue([]) // нет legacy
      await expect(
        service.paymentReminder(adminK1, 's1', '2026-05', 1200),
      ).rejects.toThrow(BadRequestException)
    })

    it('создаёт ADMIN-канал и шлёт PAYMENT-сообщение каждому родителю', async () => {
      prisma.student.findUnique.mockResolvedValue(student)
      prisma.user.findMany
        .mockResolvedValueOnce([]) // legacy childId parents
        .mockResolvedValue([]) // notifyStaff
      prisma.conversation.upsert.mockResolvedValue({
        id: 'c1',
        parentId: 'p1',
        groupId: 'g1',
        kindergartenId: 'k1',
        scope: 'ADMIN',
        lastMessageAt: new Date(),
      })
      prisma.message.create.mockResolvedValue({
        id: 'm1',
        kind: 'PAYMENT',
        sender: { id: 'admin', fullName: 'Админ', role: 'ADMIN' },
      })
      prisma.conversation.update.mockResolvedValue({
        id: 'c1',
        parentId: 'p1',
        groupId: 'g1',
        kindergartenId: 'k1',
        scope: 'ADMIN',
        lastMessageAt: new Date(),
      })

      const r = await service.paymentReminder(adminK1, 's1', '2026-05', 1200)

      expect(r.sent).toBe(1)
      // канал именно ADMIN
      expect(prisma.conversation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            groupId_parentId_scope: {
              groupId: 'g1',
              parentId: 'p1',
              scope: 'ADMIN',
            },
          },
        }),
      )
      // сообщение типа PAYMENT
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kind: 'PAYMENT' }),
        }),
      )
    })
  })

  describe('Telegram-уведомление родителю при сообщении сотрудника', () => {
    const flush = () => new Promise((r) => setTimeout(r, 0))

    function mockStaffSendChain() {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'c1',
        scope: 'GENERAL',
        groupId: 'g1',
        kindergartenId: 'k1',
        parent: { id: 'p1', fullName: 'Мама' },
        group: { id: 'g1', name: 'Солнышко' },
      })
      prisma.message.create.mockResolvedValue({
        id: 'm1',
        kind: 'TEXT',
        sender: { id: 'admin', fullName: 'Админ', role: 'ADMIN' },
      })
      prisma.conversation.update.mockResolvedValue({
        id: 'c1',
        parentId: 'p1',
        groupId: 'g1',
        kindergartenId: 'k1',
        scope: 'GENERAL',
        lastMessageAt: new Date(),
      })
      // parentPhones: личный телефон + телефоны детей
      prisma.user.findUnique.mockResolvedValue({
        phone: '+992900112233',
        childId: null,
      })
      prisma.student.findMany.mockResolvedValue([
        { motherPhone: '+992900445566', fatherPhone: null },
      ])
    }

    it('шлёт в Telegram телефоны родителя при ответе сотрудника', async () => {
      mockStaffSendChain()
      await service.staffSend(adminK1, 'c1', 'Здравствуйте!')
      await flush()

      expect(telegram.notifyByPhones).toHaveBeenCalledTimes(1)
      const [phones, text] = telegram.notifyByPhones.mock.calls[0]
      expect(phones).toEqual(
        expect.arrayContaining(['+992900112233', '+992900445566']),
      )
      expect(text).toContain('Здравствуйте!')
    })

    it('НЕ шлёт в Telegram, когда пишет сам родитель', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
        group: { name: 'Солнышко' },
      })
      prisma.conversation.upsert.mockResolvedValue({ id: 'c1', scope: 'GENERAL' })
      prisma.message.findMany.mockResolvedValue([])
      prisma.message.create.mockResolvedValue({
        id: 'm2',
        kind: 'TEXT',
        sender: { id: 'parent', fullName: 'Мама', role: 'PARENT' },
      })
      prisma.conversation.update.mockResolvedValue({
        id: 'c1',
        parentId: 'parent',
        groupId: 'g1',
        kindergartenId: 'k1',
        scope: 'GENERAL',
        lastMessageAt: new Date(),
      })
      prisma.user.findMany.mockResolvedValue([]) // notifyStaff

      await service.parentSend(parent, 'Спасибо!')
      await flush()

      expect(telegram.notifyByPhones).not.toHaveBeenCalled()
    })
  })
})
