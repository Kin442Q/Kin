import { ForbiddenException, NotFoundException } from '@nestjs/common'

import { ExamPrepService, trackProgress } from './exam-prep.service'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const base = { email: 'x@s.tj', kindergartenId: 'k1', groupId: null, childId: null }
const teacher: AuthUser = { ...base, sub: 't1', role: 'TEACHER' }
const other: AuthUser = { ...base, sub: 't2', role: 'TEACHER' }
const admin: AuthUser = { ...base, sub: 'a', role: 'ADMIN' }
const student: AuthUser = { ...base, sub: 'u', role: 'STUDENT', studentId: 'st1' }

describe('trackProgress', () => {
  it('пройдено, всего и средний ЛУЧШИЙ результат по квизам', () => {
    const attempts = new Map([
      ['q1', [{ score: 2, total: 10 }, { score: 8, total: 10 }]], // лучший 80
      ['q2', [{ score: 5, total: 10 }]], // 50
    ])
    expect(trackProgress(['q1', 'q2', 'q3'], attempts)).toEqual({ total: 3, attempted: 2, avgPercent: 65 })
  })

  it('ничего не пройдено → avgPercent null; пустое направление — нули', () => {
    expect(trackProgress(['q1'], new Map())).toEqual({ total: 1, attempted: 0, avgPercent: null })
    expect(trackProgress([], new Map())).toEqual({ total: 0, attempted: 0, avgPercent: null })
  })
})

describe('ExamPrepService', () => {
  let prisma: PrismaMock
  let service: ExamPrepService

  beforeEach(() => {
    prisma = createPrismaMock()
    service = new ExamPrepService(prisma as unknown as PrismaService)
  })

  describe('list', () => {
    const tracks = [
      {
        id: 'tr1',
        name: 'ЕГЭ',
        description: null,
        author: null,
        quizzes: [
          { id: 'q1', isPublished: true },
          { id: 'q2', isPublished: false },
          { id: 'q3', isPublished: true },
        ],
      },
    ]

    it('сотрудник видит все квизы направления, без прогресса', async () => {
      prisma.examTrack.findMany.mockResolvedValue(tracks)
      const r = await service.list(teacher)
      expect(prisma.examTrack.findMany.mock.calls[0][0].where).toEqual({ kindergartenId: 'k1' })
      expect(r[0]).toMatchObject({ name: 'ЕГЭ', quizzesCount: 3, progress: undefined })
      expect(r[0]).not.toHaveProperty('quizzes')
    })

    it('ученик: считаются только опубликованные квизы и его прогресс', async () => {
      prisma.examTrack.findMany.mockResolvedValue(tracks)
      prisma.quizAttempt.findMany.mockResolvedValue([{ quizId: 'q1', score: 7, total: 10 }])
      const r = await service.list(student)
      expect(prisma.quizAttempt.findMany.mock.calls[0][0].where).toEqual({
        studentId: 'st1',
        quizId: { in: ['q1', 'q3'] }, // черновик q2 не участвует
      })
      expect(r[0]).toMatchObject({ quizzesCount: 2, progress: { total: 2, attempted: 1, avgPercent: 70 } })
    })

    it('родителю — 403', async () => {
      await expect(service.list({ ...base, sub: 'p', role: 'PARENT' })).rejects.toThrow(ForbiddenException)
    })
  })

  describe('create / update / remove', () => {
    beforeEach(() => {
      prisma.examTrack.create.mockResolvedValue({ id: 'tr1' })
      prisma.examTrack.findUnique.mockResolvedValue({ id: 'tr1', kindergartenId: 'k1', authorId: 't1' })
      prisma.examTrack.update.mockResolvedValue({})
    })

    it('название задаёт школа; направление привязано к школе автора', async () => {
      await service.create(teacher, { name: '  Вступительные ', description: 'К поступлению' })
      expect(prisma.examTrack.create.mock.calls[0][0].data).toEqual({
        kindergartenId: 'k1',
        name: 'Вступительные',
        description: 'К поступлению',
        authorId: 't1',
      })
    })

    it('правит автор или админ школы; чужой учитель — 403', async () => {
      await service.update(teacher, 'tr1', { name: ' Олимпиады ' })
      expect(prisma.examTrack.update.mock.calls[0][0].data).toEqual({ name: 'Олимпиады' })
      await service.update(admin, 'tr1', { description: null })
      await expect(service.update(other, 'tr1', { name: 'x' })).rejects.toThrow(ForbiddenException)
      await expect(service.remove(other, 'tr1')).rejects.toThrow(ForbiddenException)
      await service.remove(admin, 'tr1')
      expect(prisma.examTrack.delete).toHaveBeenCalledWith({ where: { id: 'tr1' } })
    })

    it('несуществующее направление — 404', async () => {
      prisma.examTrack.findUnique.mockResolvedValue(null)
      await expect(service.remove(admin, 'nope')).rejects.toThrow(NotFoundException)
    })
  })
})
