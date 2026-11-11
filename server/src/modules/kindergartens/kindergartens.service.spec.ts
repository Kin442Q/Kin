import { Test } from '@nestjs/testing'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'

import { KindergartensService } from './kindergartens.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { FilesService } from '../files/files.service'
import { MailService } from '../mail/mail.service'
import { PasswordTokensService } from '../password-tokens/password-tokens.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const globalOwner: AuthUser = {
  sub: 'owner',
  email: 'owner@kg.tj',
  role: 'SUPER_ADMIN',
  kindergartenId: null,
  groupId: null,
  childId: null,
}

const tenantAdmin: AuthUser = {
  sub: 'admin',
  email: 'admin@kg.tj',
  role: 'SUPER_ADMIN',
  kindergartenId: 'k1',
  groupId: null,
  childId: null,
}

describe('KindergartensService', () => {
  let service: KindergartensService
  let prisma: PrismaMock
  let files: { removeSchoolFiles: jest.Mock }
  let mail: { send: jest.Mock }
  let tokens: { issue: jest.Mock }

  beforeEach(async () => {
    prisma = createPrismaMock()
    files = { removeSchoolFiles: jest.fn().mockResolvedValue(undefined) }
    mail = { send: jest.fn().mockResolvedValue({ sent: true }) }
    tokens = {
      issue: jest.fn().mockResolvedValue({ token: 'tok', link: 'https://tahlilgar.cyou/set-password?token=tok', hours: 48 }),
    }
    const ref = await Test.createTestingModule({
      providers: [
        KindergartensService,
        { provide: PrismaService, useValue: prisma },
        { provide: FilesService, useValue: files },
        { provide: MailService, useValue: mail },
        { provide: PasswordTokensService, useValue: tokens },
      ],
    }).compile()
    service = ref.get(KindergartensService)
  })

  describe('assertGlobalOwner (через list)', () => {
    it('403 если у пользователя есть kindergartenId', async () => {
      await expect(service.list(tenantAdmin)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('403 если не SUPER_ADMIN', async () => {
      await expect(
        service.list({ ...globalOwner, role: 'ADMIN' }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('успех для глобального супер-админа', async () => {
      prisma.kindergarten.findMany.mockResolvedValue([])
      await service.list(globalOwner)
      expect(prisma.kindergarten.findMany).toHaveBeenCalled()
    })
  })

  describe('create', () => {
    const validDto = {
      name: 'Радуга',
      owner: {
        fullName: 'Иван Иванов',
        email: 'ivan@kg.tj',
      },
    }

    it('403 для не-глобального пользователя', async () => {
      await expect(
        service.create(tenantAdmin, validDto),
      ).rejects.toThrow(ForbiddenException)
    })

    it('400 если нет названия', async () => {
      await expect(
        service.create(globalOwner, { ...validDto, name: '' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('400 если email владельца не указан', async () => {
      await expect(
        service.create(globalOwner, {
          ...validDto,
          owner: { ...validDto.owner, email: '' },
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('400 если в запросе пришёл пароль: его задаёт сам директор по ссылке', async () => {
      await expect(
        service.create(globalOwner, {
          ...validDto,
          owner: { ...validDto.owner, password: 'secret123' },
        } as never),
      ).rejects.toThrow(/по ссылке из письма/)
      expect(mail.send).not.toHaveBeenCalled()
    })

    it('400 если email владельца — служебный, не настоящая почта', async () => {
      await expect(
        service.create(globalOwner, {
          ...validDto,
          owner: { ...validDto.owner, email: 'st1@students.local' },
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('400 если ФИО владельца не указано', async () => {
      await expect(
        service.create(globalOwner, {
          ...validDto,
          owner: { ...validDto.owner, fullName: '' },
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('409 если email уже занят', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' })
      await expect(service.create(globalOwner, validDto)).rejects.toThrow(
        ConflictException,
      )
    })

    it('успешно создаёт садик + первого владельца', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      // Для проверки уникальности slug
      prisma.kindergarten.findUnique
        .mockResolvedValueOnce(null) // base slug — свободен
      prisma.kindergarten.create.mockResolvedValue({
        id: 'newK',
        name: 'Радуга',
        slug: 'raduga',
      })
      prisma.user.create.mockResolvedValue({
        id: 'newOwner',
        email: 'ivan@kg.tj',
      })

      const res = await service.create(globalOwner, validDto)

      expect(res.kindergarten.name).toBe('Радуга')
      expect(res.owner.email).toBe('ivan@kg.tj')
    })

    it('генерирует уникальный slug при коллизии', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.kindergarten.findUnique
        .mockResolvedValueOnce({ id: 'existing' }) // base slug занят
        .mockResolvedValueOnce(null) // base-1 — свободен
      prisma.kindergarten.create.mockResolvedValue({
        id: 'newK',
        slug: 'raduga-1',
      })
      prisma.user.create.mockResolvedValue({ id: 'newOwner' })

      await service.create(globalOwner, validDto)

      expect(prisma.kindergarten.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ slug: 'raduga-1' }),
      })
    })
  })

  describe('create — приглашение директора письмом', () => {
    const dto = { name: 'Радуга', owner: { fullName: 'Иван Иванов', email: 'Ivan@KG.tj' } }

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.kindergarten.findUnique.mockResolvedValue(null)
      prisma.kindergarten.create.mockResolvedValue({ id: 'newK', name: 'Радуга', slug: 'raduga' })
      prisma.user.create.mockResolvedValue({ id: 'newOwner', email: 'ivan@kg.tj', fullName: 'Иван Иванов', role: 'SUPER_ADMIN' })
    })

    it('директору уходит письмо со ссылкой, пароль владельцу не показывается', async () => {
      const res = await service.create(globalOwner, dto)

      expect(tokens.issue).toHaveBeenCalledWith('newOwner', 'INVITE')
      expect(mail.send).toHaveBeenCalledTimes(1)
      const msg = mail.send.mock.calls[0][0]
      expect(msg.to).toBe('ivan@kg.tj')
      expect(msg.text).toContain('https://tahlilgar.cyou/set-password?token=tok')
      expect(msg.html).toContain('Иван Иванов')

      expect(res.invite).toEqual({ sent: true, email: 'ivan@kg.tj' })
      expect(res).not.toHaveProperty('temporaryPassword')
      expect(JSON.stringify(res)).not.toMatch(/password/i)
    })

    it('директор создаётся со случайным паролем, который никто не знает', async () => {
      await service.create(globalOwner, dto)
      await service.create(globalOwner, dto)

      const [a, b] = prisma.user.create.mock.calls.map((c) => c[0].data.passwordHash)
      expect(a).toMatch(/^\$2[aby]\$\d\d\$/) // bcrypt-хеш, а не открытый пароль
      expect(a).not.toBe(b)
    })

    it('почта не настроена: школа создана, пароль не показывается никому, видна причина', async () => {
      mail.send.mockResolvedValue({ sent: false, reason: 'NOT_CONFIGURED' })

      const res = await service.create(globalOwner, dto)

      expect(res.invite).toEqual({ sent: false, email: 'ivan@kg.tj', reason: 'NOT_CONFIGURED', detail: undefined })
      expect(res).not.toHaveProperty('temporaryPassword')
      expect(JSON.stringify(res)).not.toMatch(/password/i)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('провайдер отклонил письмо: причина и сообщение провайдера в ответе, пароля нет', async () => {
      mail.send.mockResolvedValue({ sent: false, reason: 'REJECTED', detail: 'The tahlilgar.cyou domain is not verified.' })

      const res = await service.create(globalOwner, dto)

      expect(res.invite).toMatchObject({ sent: false, reason: 'REJECTED', detail: 'The tahlilgar.cyou domain is not verified.' })
      expect(res).not.toHaveProperty('temporaryPassword')
    })

    it('сбой при выдаче ссылки не роняет создание школы', async () => {
      tokens.issue.mockRejectedValue(new Error('db down'))

      const res = await service.create(globalOwner, dto)

      expect(res.kindergarten.id).toBe('newK')
      expect(mail.send).not.toHaveBeenCalled()
      expect(res.invite).toMatchObject({ sent: false, reason: 'NETWORK' })
    })

    it('занятый email: 409, ни токена, ни письма', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' })

      await expect(service.create(globalOwner, dto)).rejects.toThrow(ConflictException)
      expect(tokens.issue).not.toHaveBeenCalled()
      expect(mail.send).not.toHaveBeenCalled()
    })
  })

  describe('resendOwnerInvite — повторное письмо директору', () => {
    const owner = { id: 'o1', email: 'ivan@kg.tj', fullName: 'Иван Иванов', role: 'SUPER_ADMIN', kindergartenId: 'k1', lastLoginAt: null }

    it('403 для не-глобального пользователя', async () => {
      await expect(service.resendOwnerInvite(tenantAdmin, 'k1')).rejects.toThrow(ForbiddenException)
    })

    it('404 если у школы нет директора', async () => {
      prisma.user.findFirst.mockResolvedValue(null)
      await expect(service.resendOwnerInvite(globalOwner, 'k1')).rejects.toThrow(NotFoundException)
    })

    it('директор ещё не входил — приглашение; входил — ссылка для смены пароля', async () => {
      prisma.user.findFirst.mockResolvedValue(owner)
      const a = await service.resendOwnerInvite(globalOwner, 'k1')
      expect(a).toEqual({ sent: true, email: 'ivan@kg.tj' })
      expect(tokens.issue).toHaveBeenLastCalledWith('o1', 'INVITE')

      prisma.user.findFirst.mockResolvedValue({ ...owner, lastLoginAt: new Date() })
      await service.resendOwnerInvite(globalOwner, 'k1')
      expect(tokens.issue).toHaveBeenLastCalledWith('o1', 'RESET')
    })

    it('письмо снова не ушло — вернётся причина, а не ошибка', async () => {
      prisma.user.findFirst.mockResolvedValue(owner)
      mail.send.mockResolvedValue({ sent: false, reason: 'NOT_CONFIGURED' })

      await expect(service.resendOwnerInvite(globalOwner, 'k1')).resolves.toMatchObject({ sent: false, reason: 'NOT_CONFIGURED' })
    })
  })

  describe('update / remove', () => {
    it('update 403 для не-глобального', async () => {
      await expect(
        service.update(tenantAdmin, 'k1', { name: 'X' }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('update 404 если садик не найден', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue(null)
      await expect(
        service.update(globalOwner, 'kX', { name: 'X' }),
      ).rejects.toThrow(NotFoundException)
    })

    it('remove 403 для не-глобального', async () => {
      await expect(service.remove(tenantAdmin, 'k1')).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('remove успех для глобального', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue({ id: 'k1' })
      prisma.kindergarten.delete.mockResolvedValue({})
      const res = await service.remove(globalOwner, 'k1')
      expect(res.success).toBe(true)
      // файлы школы лежат вне базы — их убирают из хранилища
      expect(files.removeSchoolFiles).toHaveBeenCalledWith('k1')
    })

    it('remove: сначала убирает данные без каскада (ДЗ, оценки, дневник, сообщения), потом школу', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue({ id: 'k1' })
      const order: string[] = []
      const track = (mock: unknown, name: string) =>
        (mock as jest.Mock).mockImplementation(() => {
          order.push(name)
          return name
        })
      track(prisma.message.deleteMany, 'message')
      track(prisma.homework.deleteMany, 'homework')
      track(prisma.grade.deleteMany, 'grade')
      track(prisma.diaryEntry.deleteMany, 'diaryEntry')
      track(prisma.kidNote.deleteMany, 'kidNote')
      track(prisma.kindergarten.delete, 'kindergarten')
      prisma.$transaction.mockImplementation(async (ops: unknown[]) => ops)

      await service.remove(globalOwner, 'k1')

      expect(order).toEqual(['message', 'homework', 'grade', 'diaryEntry', 'kidNote', 'kindergarten'])
      expect(prisma.homework.deleteMany).toHaveBeenCalledWith({ where: { group: { kindergartenId: 'k1' } } })
      expect(prisma.grade.deleteMany).toHaveBeenCalledWith({ where: { student: { kindergartenId: 'k1' } } })
    })

    it('remove 404 если школы нет, ничего не удаляется', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue(null)
      await expect(service.remove(globalOwner, 'nope')).rejects.toThrow(NotFoundException)
      expect(prisma.$transaction).not.toHaveBeenCalled()
      expect(files.removeSchoolFiles).not.toHaveBeenCalled()
    })
  })
})
