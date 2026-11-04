import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { StudentPortalService } from './student-portal.service'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const studentUser: AuthUser = {
  sub: 'u-st',
  email: 'st@students.local',
  role: 'STUDENT',
  kindergartenId: 'k1',
  groupId: null,
  childId: null,
  studentId: 'st1',
}

const student = {
  id: 'st1',
  firstName: 'Али',
  lastName: 'Каримов',
  middleName: null,
  photoUrl: null,
  status: 'ACTIVE',
  groupId: 'g1',
  group: { id: 'g1', name: '5А', homeroomTeacher: { id: 't1', fullName: 'Мария Ивановна' } },
}

describe('StudentPortalService', () => {
  let prisma: PrismaMock
  let service: StudentPortalService

  beforeEach(() => {
    prisma = createPrismaMock()
    service = new StudentPortalService(prisma as unknown as PrismaService)
    prisma.student.findUnique.mockResolvedValue(student)
  })

  describe('кто такой ученик', () => {
    it('аккаунт без привязки к ученику → 403', async () => {
      await expect(service.profile({ ...studentUser, studentId: null })).rejects.toThrow(ForbiddenException)
      expect(prisma.student.findUnique).not.toHaveBeenCalled()
    })

    it('id ученика берётся из токена', async () => {
      await service.profile(studentUser)
      expect(prisma.student.findUnique.mock.calls[0][0].where).toEqual({ id: 'st1' })
    })

    it('отчисленный (ARCHIVED) ученик не входит в кабинет → 403', async () => {
      prisma.student.findUnique.mockResolvedValue({ ...student, status: 'ARCHIVED' })
      await expect(service.profile(studentUser)).rejects.toThrow(ForbiddenException)
    })

    it('профиль: класс и классный руководитель', async () => {
      const p = await service.profile(studentUser)
      expect(p).toMatchObject({
        firstName: 'Али',
        group: { id: 'g1', name: '5А' },
        homeroomTeacher: { fullName: 'Мария Ивановна' },
      })
    })
  })

  describe('homework', () => {
    it('ДЗ только моего класса, статус схлопывается в submission', async () => {
      prisma.homework.findMany.mockResolvedValue([
        { id: 'h1', title: 'A', submissions: [{ status: 'SUBMITTED', comment: null }] },
        { id: 'h2', title: 'B', submissions: [] },
      ])
      const list = await service.homework(studentUser, {})

      expect(prisma.homework.findMany.mock.calls[0][0].where.groupId).toBe('g1')
      expect(prisma.homework.findMany.mock.calls[0][0].include.submissions.where).toEqual({ studentId: 'st1' })
      expect(list[0]).toMatchObject({ id: 'h1', submission: { status: 'SUBMITTED' } })
      expect(list[0]).not.toHaveProperty('submissions')
      expect(list[1].submission).toBeNull()
    })
  })

  describe('setSubmitted', () => {
    beforeEach(() => {
      prisma.homework.findUnique.mockResolvedValue({ id: 'h1', groupId: 'g1' })
      prisma.homeworkSubmission.findUnique.mockResolvedValue(null)
      prisma.homeworkSubmission.upsert.mockResolvedValue({ status: 'SUBMITTED' })
    })

    it('«я сделал» создаёт SUBMITTED от имени ученика', async () => {
      const r = await service.setSubmitted(studentUser, 'h1', true)
      expect(r).toEqual({ status: 'SUBMITTED' })
      expect(prisma.homeworkSubmission.upsert.mock.calls[0][0].create).toEqual({
        homeworkId: 'h1',
        studentId: 'st1',
        status: 'SUBMITTED',
        markedById: 'u-st',
      })
    })

    it('ДЗ чужого класса «не существует» → 404', async () => {
      prisma.homework.findUnique.mockResolvedValue({ id: 'h9', groupId: 'OTHER' })
      await expect(service.setSubmitted(studentUser, 'h9', true)).rejects.toThrow(NotFoundException)
      expect(prisma.homeworkSubmission.upsert).not.toHaveBeenCalled()
    })

    it('учитель уже проверил — ученик не меняет вердикт → 409', async () => {
      for (const status of ['DONE', 'PARTIAL', 'NOT_DONE']) {
        prisma.homeworkSubmission.findUnique.mockResolvedValue({ id: 'x', status })
        await expect(service.setSubmitted(studentUser, 'h1', true)).rejects.toThrow(ConflictException)
        await expect(service.setSubmitted(studentUser, 'h1', false)).rejects.toThrow(ConflictException)
      }
      expect(prisma.homeworkSubmission.upsert).not.toHaveBeenCalled()
      expect(prisma.homeworkSubmission.delete).not.toHaveBeenCalled()
    })

    it('снять собственную отметку SUBMITTED можно', async () => {
      prisma.homeworkSubmission.findUnique.mockResolvedValue({ id: 'sub1', status: 'SUBMITTED' })
      const r = await service.setSubmitted(studentUser, 'h1', false)
      expect(r).toEqual({ status: null })
      expect(prisma.homeworkSubmission.delete).toHaveBeenCalledWith({ where: { id: 'sub1' } })
    })

    it('снять, когда отметки нет, — безопасно', async () => {
      await expect(service.setSubmitted(studentUser, 'h1', false)).resolves.toEqual({ status: null })
      expect(prisma.homeworkSubmission.delete).not.toHaveBeenCalled()
    })
  })

  describe('grades', () => {
    it('средний балл по предметам считается из оценок ученика', async () => {
      const math = { id: 's1', name: 'Математика', color: '#111' }
      const art = { id: 's2', name: 'Рисование', color: '#222' }
      prisma.grade.findMany.mockResolvedValue([
        { subjectId: 's1', subject: math, value: 5 },
        { subjectId: 's1', subject: math, value: 4 },
        { subjectId: 's2', subject: art, value: 3 },
      ])
      const r = await service.grades(studentUser, {})
      expect(prisma.grade.findMany.mock.calls[0][0].where).toEqual({ studentId: 'st1' })
      expect(r.averages).toEqual([
        { subject: math, count: 2, average: 4.5 },
        { subject: art, count: 1, average: 3 },
      ])
    })
  })

  it('schedule: расписание моего класса', async () => {
    prisma.scheduleItem.findMany.mockResolvedValue([])
    await service.schedule(studentUser)
    expect(prisma.scheduleItem.findMany.mock.calls[0][0].where).toEqual({ groupId: 'g1' })
  })
})
