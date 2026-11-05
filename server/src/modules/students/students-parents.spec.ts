import { Test } from '@nestjs/testing'
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { StudentsService } from './students.service'
import { StudentLinkService } from '../student-links/student-link.service'
import { AccessService } from '../access/access.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import { createAccessMock, AccessMock, SECRET_HASH } from '../../test-utils/access-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const base: Omit<AuthUser, 'sub' | 'role'> = { email: 'x@s.tj', kindergartenId: 'k1', groupId: null, childId: null }
const admin: AuthUser = { ...base, sub: 'adm', role: 'ADMIN' }
const teacher: AuthUser = { ...base, sub: 't1', role: 'TEACHER' }
const adminOtherSchool: AuthUser = { ...base, sub: 'adm2', role: 'ADMIN', kindergartenId: 'k2' }

describe('StudentsService.addParent — родитель без пароля от админа', () => {
  let service: StudentsService
  let prisma: PrismaMock
  let access: AccessMock

  beforeEach(async () => {
    prisma = createPrismaMock()
    access = createAccessMock()
    const ref = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: StudentLinkService, useValue: { link: jest.fn() } },
        { provide: AccessService, useValue: access },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()
    service = ref.get(StudentsService)

    prisma.student.findUnique.mockResolvedValue({ id: 'st1', groupId: 'g1', kindergartenId: 'k1' })
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'p1',
      isActive: true,
      phone: null,
      ...data,
    }))
    prisma.student.update.mockResolvedValue({})
  })

  it('учитель и админ другой школы родителей не добавляют', async () => {
    await expect(service.addParent('st1', { fullName: 'Мама', email: 'm@mail.tj' }, teacher)).rejects.toThrow(ForbiddenException)
    await expect(service.addParent('st1', { fullName: 'Мама', email: 'm@mail.tj' }, adminOtherSchool)).rejects.toThrow(ForbiddenException)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('старый клиент прислал пароль → понятный отказ, аккаунт не создаётся', async () => {
    await expect(service.addParent('st1', { fullName: 'Мама', email: 'm@mail.tj', password: 'hack-123456' } as never, admin)).rejects.toThrow(/Пароль не задаётся/)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('нет ученика → 404', async () => {
    prisma.student.findUnique.mockResolvedValue(null)
    await expect(service.addParent('nope', { fullName: 'Мама', email: 'm@mail.tj' }, admin)).rejects.toThrow(NotFoundException)
  })

  it('есть почта: аккаунт создаётся со случайным паролем, который никто не вводил; доступ уходит письмом', async () => {
    const res: any = await service.addParent('st1', { fullName: 'Мама Тест', email: 'Mama@Mail.TJ', phone: '+992900000001' }, admin)

    const data = prisma.user.create.mock.calls[0][0].data
    expect(data).toMatchObject({ email: 'mama@mail.tj', passwordHash: SECRET_HASH, role: 'PARENT', kindergartenId: 'k1', childId: 'st1' })
    expect(access.deliver).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', email: 'mama@mail.tj' }))
    expect(res.access).toEqual({ sent: true, email: 'mama@mail.tj' })
    expect(prisma.student.update).toHaveBeenCalledWith({ where: { id: 'st1' }, data: { parents: { connect: { id: 'p1' } } } })
  })

  it('в ответе нет хеша пароля и вообще никакого пароля', async () => {
    const res: any = await service.addParent('st1', { fullName: 'Мама Тест', email: 'mama@mail.tj' }, admin)

    expect(JSON.stringify(res)).not.toContain(SECRET_HASH)
    expect(JSON.stringify(res)).not.toMatch(/password/i)
  })

  it('без настоящей почты родитель не создаётся: даже с телефоном, служебные адреса не выдумываются', async () => {
    await expect(service.addParent('st1', { fullName: 'Папа Тест', phone: '+992900000002' }, admin)).rejects.toThrow(/Укажите email/)
    await expect(service.addParent('st1', { fullName: 'Папа Тест', email: 'не-почта', phone: '+992900000002' }, admin)).rejects.toThrow(BadRequestException)

    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(access.deliver).not.toHaveBeenCalled()
  })

  it('письмо не ушло: родитель создан и привязан, ответ без пароля, видна причина', async () => {
    access.deliver.mockResolvedValue({ sent: false, email: 'mama@mail.tj', reason: 'NOT_CONFIGURED' })

    const res: any = await service.addParent('st1', { fullName: 'Мама Тест', email: 'mama@mail.tj' }, admin)

    expect(res.access).toMatchObject({ sent: false, reason: 'NOT_CONFIGURED' })
    expect(JSON.stringify(res)).not.toMatch(/password/i)
  })

  it('нет ни почты, ни телефона → 400; нет ФИО → 400', async () => {
    await expect(service.addParent('st1', { fullName: 'Мама' }, admin)).rejects.toThrow(/Укажите email/)
    await expect(service.addParent('st1', { email: 'm@mail.tj' }, admin)).rejects.toThrow(/ФИО/)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('email уже занят → 409', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'someone' })
    await expect(service.addParent('st1', { fullName: 'Мама', email: 'taken@mail.tj' }, admin)).rejects.toThrow(ConflictException)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('привязка существующего родителя: новый доступ не выдаётся', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'p9', role: 'PARENT', kindergartenId: 'k1', fullName: 'Мама', email: 'm@mail.tj', phone: null, isActive: true })

    const res: any = await service.addParent('st1', { existingUserId: 'p9' }, admin)

    expect(res).not.toHaveProperty('access')
    expect(access.deliver).not.toHaveBeenCalled()
    expect(access.newSecret).not.toHaveBeenCalled()
  })
})
