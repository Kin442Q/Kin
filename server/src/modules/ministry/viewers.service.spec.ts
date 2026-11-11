import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'

import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'
import type { AccessService } from '../access/access.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import { ViewersService } from './viewers.service'

const owner: AuthUser = { sub: 'o1', email: 'o@x.tj', role: 'SUPER_ADMIN', kindergartenId: null }
const director: AuthUser = { sub: 'd1', email: 'd@x.tj', role: 'SUPER_ADMIN', kindergartenId: 'k1' }

const record = (over: Record<string, unknown> = {}) => ({
  id: 'v1', email: 'minister@edu.tj', fullName: 'Иван Иванов', role: 'VIEWER', isActive: true, lastLoginAt: null, createdAt: new Date('2026-11-11'),
  viewerScope: {
    organization: 'Министерство образования', allSchools: true,
    regions: [], districts: [],
  },
  ...over,
})

describe('ViewersService: учётные записи министерства', () => {
  let prisma: PrismaMock
  let access: { newSecret: jest.Mock; deliver: jest.Mock }
  let service: ViewersService

  beforeEach(() => {
    prisma = createPrismaMock()
    access = {
      newSecret: jest.fn().mockResolvedValue({ hash: 'HASH' }),
      deliver: jest.fn().mockResolvedValue({ sent: true, email: 'minister@edu.tj' }),
    }
    service = new ViewersService(prisma as unknown as PrismaService, access as unknown as AccessService)
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue(record())
    prisma.user.findUniqueOrThrow.mockResolvedValue(record())
    prisma.region.findMany.mockResolvedValue([{ id: 'rg_sughd' }])
    prisma.district.findMany.mockResolvedValue([{ id: 'ds_asht' }])
  })

  const dto = { fullName: ' Иван Иванов ', email: 'Minister@EDU.tj', organization: 'Министерство образования', allSchools: true }

  it('завести наблюдателя может только владелец платформы, не директор школы', async () => {
    await expect(service.create(director, dto)).rejects.toThrow(ForbiddenException)
    await expect(service.create({ ...owner, role: 'ADMIN' }, dto)).rejects.toThrow(ForbiddenException)
    await expect(service.list(director)).rejects.toThrow(ForbiddenException)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('создаёт аккаунт без школы с недоступным паролем, охватом и письмом-приглашением', async () => {
    const res = await service.create(owner, dto)

    // аккаунт и охват пишутся одной атомарной операцией
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
      email: 'minister@edu.tj', passwordHash: 'HASH', fullName: 'Иван Иванов', role: 'VIEWER', kindergartenId: null, isActive: true,
      viewerScope: { create: { organization: 'Министерство образования', allSchools: true } },
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(access.deliver).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1', email: 'minister@edu.tj' }), 'INVITE')
    expect(res.invite).toEqual({ sent: true, email: 'minister@edu.tj' })
    expect(res.viewer).toMatchObject({ id: 'v1', allSchools: true, organization: 'Министерство образования' })
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ actorId: 'o1', action: 'CREATE', entity: 'Viewer', entityId: 'v1' })
  })

  it('пароль не принимается вовсе, email обязателен и не должен быть занят', async () => {
    await expect(service.create(owner, { ...dto, password: 'secret123' } as never)).rejects.toThrow('Пароль не задаётся')
    await expect(service.create(owner, { ...dto, email: 'нет-почты' })).rejects.toThrow(BadRequestException)
    prisma.user.findUnique.mockResolvedValue({ id: 'someone' })
    await expect(service.create(owner, dto)).rejects.toThrow(ConflictException)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('без «Все школы» нужен хотя бы один район или область, и они должны быть в справочнике', async () => {
    const district = { ...dto, allSchools: false }
    await expect(service.create(owner, district)).rejects.toThrow('Выберите область или район')

    prisma.district.findMany.mockResolvedValue([])
    await expect(service.create(owner, { ...district, districtIds: ['ds_missing'] })).rejects.toThrow('нет в справочнике')

    prisma.district.findMany.mockResolvedValue([{ id: 'ds_asht' }])
    await service.create(owner, { ...district, regionIds: ['rg_sughd', 'rg_sughd'], districtIds: ['ds_asht'] })
    const data = prisma.user.create.mock.calls[0][0].data.viewerScope.create
    expect(data.allSchools).toBe(false)
    expect(data.regions).toEqual({ connect: [{ id: 'rg_sughd' }] }) // повтор отброшен
    expect(data.districts).toEqual({ connect: [{ id: 'ds_asht' }] })
  })

  it('«Все школы» отбрасывает выбранные районы: охват один и однозначный', async () => {
    await service.create(owner, { ...dto, regionIds: ['rg_sughd'] })
    const data = prisma.user.create.mock.calls[0][0].data.viewerScope.create
    expect(data).toMatchObject({ allSchools: true, regions: { connect: [] }, districts: { connect: [] } })
  })

  it('письмо не ушло — аккаунт остаётся, владелец видит причину', async () => {
    access.deliver.mockResolvedValue({ sent: false, email: 'minister@edu.tj', reason: 'NOT_CONFIGURED' })
    const res = await service.create(owner, dto)
    expect(res.invite).toMatchObject({ sent: false, reason: 'NOT_CONFIGURED' })
    expect(res.viewer.id).toBe('v1')
  })

  it('отключение закрывает сессии: refresh-токены гасятся, охват остаётся для возврата', async () => {
    prisma.user.findUnique.mockResolvedValue(record())
    prisma.user.findUniqueOrThrow.mockResolvedValue(record({ isActive: false }))
    prisma.user.update.mockResolvedValue({})

    const res = await service.update(owner, 'v1', { isActive: false })

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { isActive: false } })
    expect(prisma.refreshToken.updateMany.mock.calls[0][0]).toMatchObject({ where: { userId: 'v1', revokedAt: null } })
    expect(prisma.viewerScope.update).not.toHaveBeenCalled()
    expect(res.isActive).toBe(false)
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'UPDATE', entity: 'Viewer' })
  })

  it('смена охвата заменяет области и районы целиком', async () => {
    prisma.user.findUnique.mockResolvedValue(record())
    prisma.viewerScope.update.mockResolvedValue({})

    await service.update(owner, 'v1', { allSchools: false, regionIds: ['rg_sughd'], organization: 'Отдел образования Согда' })

    expect(prisma.viewerScope.update.mock.calls[0][0]).toEqual({
      where: { userId: 'v1' },
      data: {
        organization: 'Отдел образования Согда',
        allSchools: false,
        regions: { set: [{ id: 'rg_sughd' }] },
        districts: { set: [] },
      },
    })
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled()
  })

  it('изменить можно только наблюдателя; чужую роль и несуществующий id не трогаем', async () => {
    prisma.user.findUnique.mockResolvedValue(record({ role: 'TEACHER' }))
    await expect(service.update(owner, 'v1', { isActive: false })).rejects.toThrow(NotFoundException)
    prisma.user.findUnique.mockResolvedValue(null)
    await expect(service.resendInvite(owner, 'nope')).rejects.toThrow(NotFoundException)
    await expect(service.update(owner, 'v1', { isActive: false, password: 'x' } as never)).rejects.toThrow('Пароль не задаётся')
  })

  it('повторное письмо: приглашение тому, кто не входил, ссылка для смены пароля — тому, кто входил; отключённому — отказ', async () => {
    prisma.user.findUnique.mockResolvedValue(record())
    await service.resendInvite(owner, 'v1')
    expect(access.deliver).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'v1' }), 'INVITE')

    prisma.user.findUnique.mockResolvedValue(record({ lastLoginAt: new Date() }))
    await service.resendInvite(owner, 'v1')
    expect(access.deliver).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'v1' }), 'RESET')

    prisma.user.findUnique.mockResolvedValue(record({ isActive: false }))
    await expect(service.resendInvite(owner, 'v1')).rejects.toThrow('Доступ отключён')
  })

  it('список наблюдателей не содержит паролей и хэшей', async () => {
    prisma.user.findMany.mockResolvedValue([record({ passwordHash: 'SECRET' })])
    const list = await service.list(owner)
    expect(JSON.stringify(list)).not.toContain('SECRET')
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ role: 'VIEWER' })
  })
})
