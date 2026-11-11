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
    // район из справочника существует (в отдельных тестах переопределяется)
    prisma.district.findUnique.mockResolvedValue({ id: 'ds_sughd_asht' })
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
      districtId: 'ds_sughd_asht',
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
    const dto = { name: 'Радуга', districtId: 'ds_sughd_asht', owner: { fullName: 'Иван Иванов', email: 'Ivan@KG.tj' } }

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

  describe('область → район и шкала оценок школы', () => {
    const base = { name: 'Радуга', owner: { fullName: 'Иван Иванов', email: 'ivan@kg.tj' } }

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.kindergarten.findUnique.mockResolvedValue(null)
      prisma.kindergarten.create.mockResolvedValue({ id: 'newK', name: 'Радуга', slug: 'raduga' })
      prisma.user.create.mockResolvedValue({ id: 'o1', email: 'ivan@kg.tj', fullName: 'Иван Иванов', role: 'SUPER_ADMIN' })
    })

    it('без района школу не создать: 400, ничего не записывается', async () => {
      await expect(service.create(globalOwner, { ...base } as never)).rejects.toThrow('Выберите область и район')
      await expect(service.create(globalOwner, { ...base, districtId: '' })).rejects.toThrow(BadRequestException)
      expect(prisma.kindergarten.create).not.toHaveBeenCalled()
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('района нет в справочнике — 400', async () => {
      prisma.district.findUnique.mockResolvedValue(null)
      await expect(service.create(globalOwner, { ...base, districtId: 'ds_nowhere' })).rejects.toThrow('нет в справочнике')
      expect(prisma.kindergarten.create).not.toHaveBeenCalled()
    })

    it('район сохраняется, шкала по умолчанию пятибалльная', async () => {
      await service.create(globalOwner, { ...base, districtId: 'ds_sughd_asht' })
      expect(prisma.district.findUnique).toHaveBeenCalledWith({ where: { id: 'ds_sughd_asht' }, select: { id: true } })
      expect(prisma.kindergarten.create.mock.calls[0][0].data).toMatchObject({ districtId: 'ds_sughd_asht', gradeScale: 'FIVE' })
    })

    it('десятибалльная шкала принимается, неизвестная — 400', async () => {
      await service.create(globalOwner, { ...base, districtId: 'ds_sughd_asht', gradeScale: 'TEN' })
      expect(prisma.kindergarten.create.mock.calls[0][0].data.gradeScale).toBe('TEN')
      await expect(
        service.create(globalOwner, { ...base, districtId: 'ds_sughd_asht', gradeScale: 'TWELVE' as never }),
      ).rejects.toThrow('Шкала оценок')
    })

    it('список школ отдаёт район и область, у старой школы без района — null', async () => {
      const region = { id: 'rg_sughd', code: 'SUGHD', nameRu: 'Согдийская область', nameTg: 'Вилояти Суғд', nameEn: 'Sughd Region' }
      const district = { id: 'ds_sughd_asht', kind: 'DISTRICT', nameRu: 'Аштский район', nameTg: 'ноҳияи Ашт', nameEn: 'Asht district', region }
      const common = { slug: 's', address: null, phone: null, isActive: true, type: 'SCHOOL', gradeScale: 'FIVE', latitude: null, longitude: null, checkInRadiusMeters: 150, createdAt: new Date(), _count: { users: 1, groups: 2, students: 3 } }
      prisma.kindergarten.findMany.mockResolvedValue([
        { ...common, id: 'a', name: 'Школа 1', districtId: 'ds_sughd_asht', district },
        { ...common, id: 'b', name: 'Старая', districtId: null, district: null },
      ])
      const list = await service.list(globalOwner)
      expect(list[0]).toMatchObject({ districtId: 'ds_sughd_asht', region: { code: 'SUGHD', nameRu: 'Согдийская область' }, district: { nameRu: 'Аштский район' } })
      expect(list[0].district).not.toHaveProperty('region')
      expect(list[1]).toMatchObject({ districtId: null, district: null, region: null })
    })

    it('владелец платформы меняет и снимает район, неизвестный район — 400', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue({ id: 'k1' })
      prisma.kindergarten.update.mockResolvedValue({})

      await service.update(globalOwner, 'k1', { districtId: 'ds_khatlon_vakhsh', gradeScale: 'TEN' })
      expect(prisma.kindergarten.update.mock.calls[0][0].data).toEqual({ districtId: 'ds_khatlon_vakhsh', gradeScale: 'TEN' })

      await service.update(globalOwner, 'k1', { districtId: null })
      expect(prisma.kindergarten.update.mock.calls[1][0].data).toEqual({ districtId: null })

      prisma.district.findUnique.mockResolvedValue(null)
      await expect(service.update(globalOwner, 'k1', { districtId: 'ds_nowhere' })).rejects.toThrow(BadRequestException)
      expect(prisma.kindergarten.update).toHaveBeenCalledTimes(2)
    })

    it('директор школы район не меняет (даже если пришлёт), шкалу оценок — может', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue({ id: 'k1' })
      prisma.kindergarten.update.mockResolvedValue({})

      await service.updateMine(tenantAdmin, { districtId: 'ds_khatlon_vakhsh', gradeScale: 'TEN', name: 'Новое' } as never)

      expect(prisma.kindergarten.update.mock.calls[0][0].data).toEqual({ name: 'Новое', gradeScale: 'TEN' })
      expect(prisma.district.findUnique).not.toHaveBeenCalled()
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
