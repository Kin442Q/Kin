import { BadRequestException, ForbiddenException } from '@nestjs/common'

import { validateOverrides } from './verdict-config'
import { VerdictConfigService } from './verdict-config.service'
import { DEFAULT_THRESHOLDS, thresholdsFor, type VerdictScale } from './verdict-scale'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

describe('validateOverrides', () => {
  it.each(['FIVE', 'TEN'] as const)('значения по умолчанию шкалы %s сами проходят проверку', (scale) => {
    const { scaleMax: _max, ...defaults } = DEFAULT_THRESHOLDS[scale]
    expect(validateOverrides(scale, defaults)).toEqual({ overrides: defaults, errors: [] })
  })

  it('возвращает только заданные ключи', () => {
    expect(validateOverrides('FIVE', { weakAverage: 3.2, absenceMinLessons: 4 })).toEqual({
      overrides: { weakAverage: 3.2, absenceMinLessons: 4 },
      errors: [],
    })
    expect(validateOverrides('FIVE', {})).toEqual({ overrides: {}, errors: [] })
  })

  it('не объект, массив, null — ошибка', () => {
    for (const raw of [null, undefined, 5, 'x', [1]]) {
      expect(validateOverrides('FIVE', raw).errors).toHaveLength(1)
    }
  })

  it('неизвестный ключ — ошибка (в том числе scaleMax: шкалу меняют в настройках школы, не здесь)', () => {
    expect(validateOverrides('FIVE', { foo: 1 }).errors).toEqual(['Неизвестный порог: foo'])
    expect(validateOverrides('FIVE', { scaleMax: 10 }).errors).toEqual(['Неизвестный порог: scaleMax'])
  })

  it('не число, NaN, бесконечность, строка с числом — ошибка', () => {
    for (const bad of ['3.5', NaN, Infinity, null, true]) {
      expect(validateOverrides('FIVE', { weakAverage: bad }).errors).toHaveLength(1)
    }
  })

  it('счётные пороги — только целые', () => {
    expect(validateOverrides('FIVE', { absenceMinLessons: 2.5 }).errors[0]).toContain('целое')
    expect(validateOverrides('FIVE', { badMark: 1.5 }).errors[0]).toContain('целое')
  })

  it('пороги по баллам проверяются относительно шкалы', () => {
    // пятибалльная: слабый предмет от 1,5 до 4,5
    expect(validateOverrides('FIVE', { weakAverage: 1.4 }).errors).toHaveLength(1)
    expect(validateOverrides('FIVE', { weakAverage: 4.6 }).errors).toHaveLength(1)
    expect(validateOverrides('FIVE', { weakAverage: 4.5 }).errors).toEqual([])
    // та же 4,6 для десятибалльной — нормально
    expect(validateOverrides('TEN', { weakAverage: 4.6 }).errors).toEqual([])
    expect(validateOverrides('TEN', { weakAverage: 9.6 }).errors).toHaveLength(1)
    // «плохая» оценка: пятибалльная до 3, десятибалльная до 8 (и всегда ниже порога слабого предмета)
    expect(validateOverrides('FIVE', { badMark: 4 }).errors).toHaveLength(1)
    expect(validateOverrides('TEN', { badMark: 9 }).errors).toHaveLength(1)
    expect(validateOverrides('TEN', { badMark: 5 }).errors).toEqual([])
    // падение: 5–50% шкалы
    expect(validateOverrides('FIVE', { dropBy: 0.2 }).errors).toHaveLength(1)
    expect(validateOverrides('TEN', { dropBy: 0.5 }).errors).toEqual([])
  })

  it('нельзя судить по одной оценке или одному уроку: минимумы данных не опускаются ниже границы', () => {
    for (const key of ['weakMinGrades', 'dropMinGrades', 'strongMinGrades', 'homeworkMinAssessed', 'noGradesMinLessons']) {
      expect(validateOverrides('FIVE', { [key]: 1 }).errors).toHaveLength(1)
    }
    expect(validateOverrides('FIVE', { absenceMinLessons: 1 }).errors).toEqual([])
    expect(validateOverrides('FIVE', { noGradesDays: 7 }).errors).toHaveLength(1)
    expect(validateOverrides('FIVE', { noGradesDays: 90 }).errors).toHaveLength(1)
  })

  it('доли — от 0,1 до 0,9 или 1', () => {
    expect(validateOverrides('FIVE', { homeworkNotDoneShare: 0.05 }).errors).toHaveLength(1)
    expect(validateOverrides('FIVE', { homeworkNotDoneShare: 1 }).errors).toEqual([])
    expect(validateOverrides('FIVE', { noGradesMaxAbsentShare: 1 }).errors).toHaveLength(1)
  })

  it('итоговые пороги согласованы: «плохая» оценка ниже «слабого», «слабый» ниже «сильного»', () => {
    expect(validateOverrides('FIVE', { weakAverage: 3, badMark: 3 }).errors).toEqual([
      '«Плохая» оценка должна быть ниже порога слабого предмета',
    ])
    expect(validateOverrides('FIVE', { weakAverage: 4.5, strongAverage: 4.5 }).errors).toEqual([
      'Порог слабого предмета должен быть ниже порога сильного',
    ])
    // проверка идёт по итоговым значениям, вместе с умолчанием: сильный 4,7 по умолчанию, слабый 4,5 — можно
    expect(validateOverrides('FIVE', { weakAverage: 4.5 }).errors).toEqual([])
  })

  it('при любой ошибке ничего не возвращается: частично применённые пороги опаснее отказа', () => {
    expect(validateOverrides('FIVE', { weakAverage: 3.2, foo: 1 })).toMatchObject({ overrides: {}, errors: ['Неизвестный порог: foo'] })
  })

  it('округляет до сотых', () => {
    expect(validateOverrides('FIVE', { weakAverage: 3.456 }).overrides).toEqual({ weakAverage: 3.46 })
  })
})

describe('VerdictConfigService', () => {
  let prisma: PrismaMock
  let service: VerdictConfigService
  const admin: AuthUser = { sub: 'a1', email: 'a@s.tj', role: 'ADMIN', kindergartenId: 'k1', groupId: null, childId: null }

  beforeEach(() => {
    prisma = createPrismaMock()
    service = new VerdictConfigService(prisma as unknown as PrismaService)
    prisma.kindergarten.findUnique.mockResolvedValue({ gradeScale: 'FIVE' })
    prisma.verdictConfig.findUnique.mockResolvedValue(null)
  })

  describe('effective', () => {
    it('нет записи — значения по умолчанию для шкалы', async () => {
      for (const scale of ['FIVE', 'TEN'] as VerdictScale[]) {
        expect(await service.effective('k1', scale)).toEqual({ thresholds: thresholdsFor(scale), overrides: {}, ignored: false })
      }
    })

    it('нет школы — в базу не ходим', async () => {
      expect((await service.effective(null, 'FIVE')).thresholds).toEqual(thresholdsFor('FIVE'))
      expect(prisma.verdictConfig.findUnique).not.toHaveBeenCalled()
    })

    it('пороги школы накладываются на значения по умолчанию', async () => {
      prisma.verdictConfig.findUnique.mockResolvedValue({ overrides: { weakAverage: 3.2, absenceMinLessons: 4 } })
      const r = await service.effective('k1', 'FIVE')
      expect(r.thresholds).toMatchObject({ weakAverage: 3.2, absenceMinLessons: 4, dropBy: 0.5, scaleMax: 5 })
      expect(r.ignored).toBe(false)
    })

    it('испорченная запись в базе не применяется и не ломает расчёт', async () => {
      prisma.verdictConfig.findUnique.mockResolvedValue({ overrides: { weakAverage: 99, hack: 1 } })
      expect(await service.effective('k1', 'FIVE')).toEqual({ thresholds: thresholdsFor('FIVE'), overrides: {}, ignored: true })
    })

    it('записанные для пятибалльной шкалы пороги не подходят десятибалльной после смены шкалы — игнорируются', async () => {
      prisma.verdictConfig.findUnique.mockResolvedValue({ overrides: { badMark: 5, weakAverage: 6 } })
      expect((await service.effective('k1', 'FIVE')).ignored).toBe(true)
      expect((await service.effective('k1', 'TEN')).ignored).toBe(false)
    })
  })

  describe('get / put', () => {
    it('без школы (владелец платформы) — отказ', async () => {
      await expect(service.get({ ...admin, kindergartenId: null })).rejects.toBeInstanceOf(ForbiddenException)
      await expect(service.put({ ...admin, kindergartenId: null }, {})).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('get: показывает шкалу, значения по умолчанию, изменённое и действующее', async () => {
      prisma.verdictConfig.findUnique.mockResolvedValue({ overrides: { weakAverage: 3.2 } })
      const r = await service.get(admin)
      expect(r).toMatchObject({ scale: 'FIVE', overrides: { weakAverage: 3.2 }, ignored: false })
      expect(r.defaults.weakAverage).toBe(3.5)
      expect(r.effective.weakAverage).toBe(3.2)
    })

    it('put: неверные пороги — 400, ничего не записано', async () => {
      await expect(service.put(admin, { weakAverage: 99 })).rejects.toBeInstanceOf(BadRequestException)
      expect(prisma.verdictConfig.upsert).not.toHaveBeenCalled()
      expect(prisma.verdictConfig.deleteMany).not.toHaveBeenCalled()
      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })

    it('put: проверка по шкале своей школы', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue({ gradeScale: 'TEN' })
      await expect(service.put(admin, { weakAverage: 6 })).resolves.toBeDefined()
      expect(prisma.verdictConfig.upsert).toHaveBeenCalled()
      prisma.verdictConfig.upsert.mockClear()
      prisma.kindergarten.findUnique.mockResolvedValue({ gradeScale: 'FIVE' })
      await expect(service.put(admin, { weakAverage: 6 })).rejects.toBeInstanceOf(BadRequestException)
    })

    it('put: сохраняет только свою школу, пишет автора и журнал действий', async () => {
      prisma.verdictConfig.findUnique.mockResolvedValueOnce({ overrides: { weakAverage: 3 } })
      await service.put(admin, { weakAverage: 3.2 })
      const call = prisma.verdictConfig.upsert.mock.calls[0][0]
      expect(call.where).toEqual({ kindergartenId: 'k1' })
      expect(call.create).toEqual({ kindergartenId: 'k1', overrides: { weakAverage: 3.2 }, updatedById: 'a1' })
      expect(call.update).toEqual({ overrides: { weakAverage: 3.2 }, updatedById: 'a1' })
      expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
        actorId: 'a1', action: 'UPDATE', entity: 'VerdictConfig', entityId: 'k1',
        diff: { before: { weakAverage: 3 }, after: { weakAverage: 3.2 } },
      })
    })

    it('put: пустой объект возвращает значения по умолчанию (запись удаляется)', async () => {
      await service.put(admin, {})
      expect(prisma.verdictConfig.deleteMany).toHaveBeenCalledWith({ where: { kindergartenId: 'k1' } })
      expect(prisma.verdictConfig.upsert).not.toHaveBeenCalled()
    })
  })
})
