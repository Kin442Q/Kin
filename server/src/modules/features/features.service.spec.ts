import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'

import { FeaturesService } from './features.service'
import { FEATURE_KEYS, FEATURES, resolveFeature } from './feature-registry'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'

describe('resolveFeature', () => {
  it('значение по умолчанию, если переопределения нет', () => {
    expect(resolveFeature('chat', undefined)).toBe(true)
    expect(resolveFeature('payments', undefined)).toBe(false)
    expect(resolveFeature('menu', undefined)).toBe(false)
  })

  it('переопределение сильнее значения по умолчанию', () => {
    expect(resolveFeature('payments', true)).toBe(true)
    expect(resolveFeature('chat', false)).toBe(false)
  })
})

describe('FeaturesService', () => {
  let service: FeaturesService
  let prisma: PrismaMock

  const school = (overrides: Array<{ key: string; enabled: boolean }> = []) => ({
    features: overrides,
  })

  beforeEach(async () => {
    prisma = createPrismaMock()
    const ref = await Test.createTestingModule({
      providers: [FeaturesService, { provide: PrismaService, useValue: prisma }],
    }).compile()
    service = ref.get(FeaturesService)
  })

  describe('enabledKeys / isEnabled', () => {
    it('владелец платформы (без учреждения) видит все разделы без запроса в БД', async () => {
      expect(await service.enabledKeys(null)).toEqual(FEATURE_KEYS)
      expect(await service.isEnabled(null, 'payments')).toBe(true)
      expect(prisma.kindergarten.findUnique).not.toHaveBeenCalled()
    })

    it('финансовые разделы и меню выключены по умолчанию, школьные включены', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue(school())
      const keys = await service.enabledKeys('k1')
      expect(keys).toEqual(
        expect.arrayContaining(['grades', 'homework', 'chat', 'attendance', 'groups']),
      )
      expect(keys).not.toContain('payments')
      expect(keys).not.toContain('expenses')
      expect(keys).not.toContain('analytics')
      expect(keys).not.toContain('menu')
    })

    it('включённое владельцем переопределение попадает в список', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue(
        school([{ key: 'payments', enabled: true }, { key: 'chat', enabled: false }]),
      )
      const keys = await service.enabledKeys('k1')
      expect(keys).toContain('payments')
      expect(keys).not.toContain('chat')
    })

    it('несуществующее учреждение — ничего не включено', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue(null)
      expect(await service.enabledKeys('nope')).toEqual([])
      expect(await service.isEnabled('nope', 'chat')).toBe(false)
    })

    it('неизвестный ключ закрывается (опечатка в @Feature не открывает раздел)', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue(school())
      expect(await service.isEnabled('k1', 'gradez' as never)).toBe(false)
    })

    it('состояние кэшируется: второй вызов без запроса в БД', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue(school())
      await service.isEnabled('k1', 'chat')
      await service.isEnabled('k1', 'grades')
      expect(prisma.kindergarten.findUnique).toHaveBeenCalledTimes(1)
    })
  })

  describe('listForSchool', () => {
    it('отдаёт все разделы с признаком overridden', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue(school([{ key: 'payments', enabled: true }]))
      const list = await service.listForSchool('k1')
      expect(list).toHaveLength(FEATURE_KEYS.length)

      const payments = list.find((f) => f.key === 'payments')!
      expect(payments).toMatchObject({ enabled: true, defaultEnabled: false, overridden: true })

      const chat = list.find((f) => f.key === 'chat')!
      expect(chat).toMatchObject({ enabled: true, overridden: false, label: FEATURES.chat.label })
    })

    it('404 для несуществующего учреждения', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue(null)
      await expect(service.listForSchool('nope')).rejects.toThrow(NotFoundException)
    })
  })

  describe('setOverrides', () => {
    beforeEach(() => {
      prisma.kindergarten.findUnique.mockResolvedValue(school())
      prisma.kindergartenFeature.upsert.mockReturnValue('upsert')
      prisma.kindergartenFeature.deleteMany.mockReturnValue('delete')
    })

    it('true/false → upsert, null → удаление переопределения', async () => {
      await service.setOverrides('k1', { payments: true, chat: false, analytics: null })

      expect(prisma.kindergartenFeature.upsert).toHaveBeenCalledWith({
        where: { kindergartenId_key: { kindergartenId: 'k1', key: 'payments' } },
        create: { kindergartenId: 'k1', key: 'payments', enabled: true },
        update: { enabled: true },
      })
      expect(prisma.kindergartenFeature.upsert).toHaveBeenCalledWith({
        where: { kindergartenId_key: { kindergartenId: 'k1', key: 'chat' } },
        create: { kindergartenId: 'k1', key: 'chat', enabled: false },
        update: { enabled: false },
      })
      expect(prisma.kindergartenFeature.deleteMany).toHaveBeenCalledWith({
        where: { kindergartenId: 'k1', key: 'analytics' },
      })
    })

    it('400 на неизвестный ключ, в БД ничего не пишется', async () => {
      await expect(service.setOverrides('k1', { payments: true, bogus: true })).rejects.toThrow(
        BadRequestException,
      )
      expect(prisma.kindergartenFeature.upsert).not.toHaveBeenCalled()
    })

    it('400 на не-булево значение', async () => {
      await expect(service.setOverrides('k1', { chat: 'yes' as never })).rejects.toThrow(
        BadRequestException,
      )
    })

    it('после изменения кэш сбрасывается — следующий запрос идёт в БД', async () => {
      await service.isEnabled('k1', 'chat') // прогрели кэш
      prisma.kindergarten.findUnique.mockClear()
      await service.setOverrides('k1', { chat: false })
      expect(prisma.kindergarten.findUnique).toHaveBeenCalled() // loadState внутри setOverrides + listForSchool
      prisma.kindergarten.findUnique.mockClear()
      await service.isEnabled('k1', 'chat')
      expect(prisma.kindergarten.findUnique).toHaveBeenCalledTimes(1) // кэш был сброшен
    })

    it('404 для несуществующего учреждения', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue(null)
      await expect(service.setOverrides('nope', { chat: true })).rejects.toThrow(NotFoundException)
    })
  })
})
