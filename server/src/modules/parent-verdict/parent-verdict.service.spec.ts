import 'reflect-metadata'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { ParentVerdictService } from './parent-verdict.service'
import { ParentVerdictController, PreviewVerdictQuery } from './parent-verdict.controller'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { ClassAccessService } from '../class-access/class-access.service'
import type { FeaturesService } from '../features/features.service'
import { ROLES_KEY } from '../../common/decorators/roles.decorator'
import { FEATURE_KEY } from '../../common/decorators/feature.decorator'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const teacher: AuthUser = {
  sub: 't1', email: 't@s.tj', role: 'TEACHER', kindergartenId: 'k1', groupId: null, childId: null,
}
const group = { id: 'g1', name: '5А', kindergartenId: 'k1', homeroomTeacherId: 't1' }
const NOW = new Date('2026-11-18T08:00:00Z') // в Душанбе тоже 18 ноября
const utc = (d: string) => new Date(`${d}T00:00:00Z`)

describe('ParentVerdictService.preview', () => {
  let prisma: PrismaMock & { term: { findMany: jest.Mock } }
  let access: { assertHomeroomAccess: jest.Mock }
  let features: { isEnabled: jest.Mock }
  let service: ParentVerdictService

  beforeEach(() => {
    prisma = Object.assign(createPrismaMock(), { term: { findMany: jest.fn() } })
    access = { assertHomeroomAccess: jest.fn().mockResolvedValue(undefined) }
    features = { isEnabled: jest.fn().mockResolvedValue(true) }
    service = new ParentVerdictService(
      prisma as unknown as PrismaService,
      access as unknown as ClassAccessService,
      features as unknown as FeaturesService,
    )
    prisma.group.findUnique.mockResolvedValue(group)
    prisma.kindergarten.findUnique.mockResolvedValue({ gradeScale: 'FIVE' })
    prisma.student.findMany.mockResolvedValue([
      { id: 's1', firstName: 'Алишер', lastName: 'Каримов' },
      { id: 's2', firstName: 'Мадина', lastName: 'Расулова' },
    ])
    prisma.subject.findMany.mockResolvedValue([{ id: 'math', name: 'Математика' }])
    prisma.grade.findMany.mockResolvedValue([])
    prisma.attendance.findMany.mockResolvedValue([])
    prisma.scheduleItem.findMany.mockResolvedValue([])
    prisma.term.findMany.mockResolvedValue([])
    prisma.homework.findMany.mockResolvedValue([])
  })

  describe('проверка запроса', () => {
    it('неверный формат месяца — 400, база не трогается', async () => {
      await expect(service.preview(teacher, 'g1', '2026-13', NOW)).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.preview(teacher, 'g1', 'октябрь', NOW)).rejects.toBeInstanceOf(BadRequestException)
      expect(prisma.group.findUnique).not.toHaveBeenCalled()
    })

    it('будущий месяц — 400', async () => {
      await expect(service.preview(teacher, 'g1', '2026-12', NOW)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('несуществующий класс — 404', async () => {
      prisma.group.findUnique.mockResolvedValue(null)
      await expect(service.preview(teacher, 'nope', '2026-10', NOW)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('чужой класс (не руководитель и не директор) — отказ до любых выборок данных', async () => {
      access.assertHomeroomAccess.mockRejectedValue(new ForbiddenException('Только классный руководитель этого класса'))
      await expect(service.preview(teacher, 'g1', '2026-10', NOW)).rejects.toBeInstanceOf(ForbiddenException)
      expect(access.assertHomeroomAccess).toHaveBeenCalledWith(teacher, group)
      expect(prisma.student.findMany).not.toHaveBeenCalled()
      expect(prisma.grade.findMany).not.toHaveBeenCalled()
      expect(prisma.kindergarten.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('границы выборок и изоляция', () => {
    it('закрытый месяц: оценки с начала прошлого месяца по конец этого', async () => {
      const r = await service.preview(teacher, 'g1', '2026-10', NOW)
      expect(r.asOf).toBe('2026-10-31')
      expect(prisma.grade.findMany.mock.calls[0][0].where.date).toEqual({ gte: utc('2026-09-01'), lte: utc('2026-10-31') })
      expect(prisma.homework.findMany.mock.calls[0][0].where.dueDate).toEqual({ gte: utc('2026-10-01'), lte: utc('2026-10-31') })
      // окно «нет оценок» (с 11 октября) целиком внутри месяца — посещаемость с 1 октября
      expect(prisma.attendance.findMany.mock.calls[0][0].where.date).toEqual({ gte: utc('2026-10-01'), lte: utc('2026-10-31') })
    })

    it('текущий месяц: считаем только до сегодняшнего дня, посещаемость берём с начала окна', async () => {
      const r = await service.preview(teacher, 'g1', '2026-11', NOW)
      expect(r.asOf).toBe('2026-11-18')
      expect(r.window).toEqual({ from: '2026-10-29', to: '2026-11-18' })
      expect(prisma.grade.findMany.mock.calls[0][0].where.date).toEqual({ gte: utc('2026-10-01'), lte: utc('2026-11-18') })
      expect(prisma.attendance.findMany.mock.calls[0][0].where.date).toEqual({ gte: utc('2026-10-29'), lte: utc('2026-11-18') })
    })

    it('все выборки привязаны к этому классу и его активным ученикам', async () => {
      await service.preview(teacher, 'g1', '2026-10', NOW)
      expect(prisma.student.findMany.mock.calls[0][0].where).toEqual({ groupId: 'g1', status: 'ACTIVE' })
      expect(prisma.grade.findMany.mock.calls[0][0].where.studentId).toEqual({ in: ['s1', 's2'] })
      expect(prisma.attendance.findMany.mock.calls[0][0].where.studentId).toEqual({ in: ['s1', 's2'] })
      expect(prisma.scheduleItem.findMany.mock.calls[0][0].where).toEqual({ groupId: 'g1' })
      expect(prisma.homework.findMany.mock.calls[0][0].where.groupId).toBe('g1')
      expect(prisma.homework.findMany.mock.calls[0][0].select.submissions.where).toEqual({ studentId: { in: ['s1', 's2'] } })
      // справочники — только своей школы
      expect(prisma.subject.findMany.mock.calls[0][0].where).toEqual({ kindergartenId: 'k1' })
      expect(prisma.term.findMany.mock.calls[0][0].where).toEqual({ kindergartenId: 'k1' })
      expect(prisma.kindergarten.findUnique.mock.calls[0][0].where).toEqual({ id: 'k1' })
    })

    it('в классе нет учеников — данные по оценкам не запрашиваются', async () => {
      prisma.student.findMany.mockResolvedValue([])
      const r = await service.preview(teacher, 'g1', '2026-10', NOW)
      expect(r.students).toEqual([])
      expect(prisma.grade.findMany).not.toHaveBeenCalled()
      expect(prisma.homework.findMany).not.toHaveBeenCalled()
    })
  })

  describe('шкала и разделы школы', () => {
    it('шкала берётся из школы класса: десятибалльная даёт свои пороги', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue({ gradeScale: 'TEN' })
      const r = await service.preview(teacher, 'g1', '2026-10', NOW)
      expect(r.scale).toBe('TEN')
      expect(r.thresholds).toMatchObject({ scaleMax: 10, weakAverage: 5.5, badMark: 3, dropBy: 1, strongAverage: 9.1 })
    })

    it('школа не найдена — берём пятибалльную', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue(null)
      expect((await service.preview(teacher, 'g1', '2026-10', NOW)).scale).toBe('FIVE')
    })

    it('выключенные разделы не запрашиваются и помечены в ответе', async () => {
      features.isEnabled.mockImplementation(async (_k: string | null, key: string) => key === 'homework')
      const r = await service.preview(teacher, 'g1', '2026-10', NOW)
      expect(r.sections).toEqual({ attendance: false, schedule: false, homework: true })
      expect(prisma.attendance.findMany).not.toHaveBeenCalled()
      expect(prisma.scheduleItem.findMany).not.toHaveBeenCalled()
      expect(prisma.homework.findMany).toHaveBeenCalled()
      expect(features.isEnabled).toHaveBeenCalledWith('k1', 'attendance')
    })
  })

  describe('результат', () => {
    it('сигналы приходят вместе с именем ученика, даты из базы разобраны верно', async () => {
      prisma.grade.findMany.mockResolvedValue(
        [1, 2, 3, 4].map((day, i) => ({
          studentId: 's1', subjectId: 'math', value: [3, 3, 2, 4][i], date: utc(`2026-10-0${day}`), createdAt: new Date(),
        })),
      )
      const r = await service.preview(teacher, 'g1', '2026-10', NOW)
      const s1 = r.students.find((s) => s.student.id === 's1')!
      expect(s1.student).toEqual({ id: 's1', firstName: 'Алишер', lastName: 'Каримов' })
      expect(s1.subjects[0]).toMatchObject({ subjectId: 'math', average: 3, gradesCount: 4 })
      expect(s1.focus?.subjectId).toBe('math')
      // у второго ученика оценок нет — нет и выводов
      expect(r.students.find((s) => s.student.id === 's2')?.focus).toBeNull()
    })

    it('оценка вне шкалы блокирует ученика, остальных нет', async () => {
      prisma.grade.findMany.mockResolvedValue([
        { studentId: 's1', subjectId: 'math', value: 8, date: utc('2026-10-03'), createdAt: new Date() },
        { studentId: 's2', subjectId: 'math', value: 4, date: utc('2026-10-03'), createdAt: new Date() },
      ])
      const r = await service.preview(teacher, 'g1', '2026-10', NOW)
      expect(r.blockedStudents).toBe(1)
      expect(r.students.find((s) => s.student.id === 's1')?.blocked).toEqual({ reason: 'GRADE_OUT_OF_SCALE', count: 1 })
      expect(r.students.find((s) => s.student.id === 's2')?.blocked).toBeNull()
    })

    it('только чтение: ничего не пишется и никому не отправляется', async () => {
      await service.preview(teacher, 'g1', '2026-10', NOW)
      expect(prisma.$transaction).not.toHaveBeenCalled()
      for (const model of [prisma.auditLog, prisma.notification, prisma.message, prisma.conversation, prisma.grade, prisma.homeworkSubmission]) {
        expect(model.create).not.toHaveBeenCalled()
        expect(model.update).not.toHaveBeenCalled()
        expect(model.upsert).not.toHaveBeenCalled()
        expect(model.delete).not.toHaveBeenCalled()
      }
    })
  })
})

describe('ParentVerdictController: кто может смотреть', () => {
  it('только сотрудники школы; родителям, ученикам и ведомству доступа нет', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ParentVerdictController) as string[]
    expect(roles.sort()).toEqual(['ADMIN', 'SUPER_ADMIN', 'TEACHER'])
  })

  it('нужен включённый раздел «Итоги месяца» и журнал оценок', () => {
    expect(Reflect.getMetadata(FEATURE_KEY, ParentVerdictController)).toEqual(['parent_verdict', 'grades'])
  })

  it('месяц проверяется как ГГГГ-ММ', async () => {
    const check = (month: string) => validate(plainToInstance(PreviewVerdictQuery, { groupId: 'g1', month }))
    expect(await check('2026-10')).toHaveLength(0)
    for (const bad of ['2026-13', '2026-1', 'x', '']) expect((await check(bad)).length).toBeGreaterThan(0)
    expect((await validate(plainToInstance(PreviewVerdictQuery, { groupId: '', month: '2026-10' }))).length).toBeGreaterThan(0)
  })
})
