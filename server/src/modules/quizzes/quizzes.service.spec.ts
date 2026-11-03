import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { QuizzesService } from './quizzes.service'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const base = { email: 'x@s.tj', kindergartenId: 'k1', groupId: null, childId: null }
const teacher: AuthUser = { ...base, sub: 't1', role: 'TEACHER' }
const otherTeacher: AuthUser = { ...base, sub: 't2', role: 'TEACHER' }
const admin: AuthUser = { ...base, sub: 'adm', role: 'ADMIN' }
const adminOther: AuthUser = { ...base, sub: 'adm2', role: 'ADMIN', kindergartenId: 'k2' }
const student: AuthUser = { ...base, sub: 'u-st', role: 'STUDENT', studentId: 'st1' }
const owner: AuthUser = { ...base, sub: 'own', role: 'SUPER_ADMIN', kindergartenId: null }

const goodQuestion = {
  text: '2 + 2 = ?',
  kind: 'SINGLE' as const,
  options: [
    { text: '3', correct: false },
    { text: '4', correct: true },
  ],
  explanation: 'Потому что четыре',
}

const dbQuiz = (over: Record<string, unknown> = {}) => ({
  id: 'qz1',
  kindergartenId: 'k1',
  title: 'Сложение',
  description: null,
  isPublished: true,
  timeLimitSec: null,
  authorId: 't1',
  ...over,
})

describe('QuizzesService', () => {
  let prisma: PrismaMock
  let service: QuizzesService

  beforeEach(() => {
    prisma = createPrismaMock()
    service = new QuizzesService(prisma as unknown as PrismaService)
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops))
  })

  describe('list', () => {
    const row = (id: string, published: boolean) => ({
      id,
      title: id,
      isPublished: published,
      _count: { questions: 3, attempts: 7 },
    })

    it('сотрудник видит все квизы своей школы, включая черновики и число попыток', async () => {
      prisma.quiz.findMany.mockResolvedValue([row('a', true), row('b', false)])
      const r = await service.list(teacher, {})
      expect(prisma.quiz.findMany.mock.calls[0][0].where).toEqual({ kindergartenId: 'k1' })
      expect(r.map((x) => x.id)).toEqual(['a', 'b'])
      expect(r[0]).toMatchObject({ questionsCount: 3, attemptsCount: 7 })
      expect(r[0]).not.toHaveProperty('_count')
    })

    it('ученик видит только опубликованные и свой лучший результат; число попыток всех скрыто', async () => {
      prisma.quiz.findMany.mockResolvedValue([row('a', true), row('b', true)])
      prisma.quizAttempt.findMany.mockResolvedValue([
        { quizId: 'a', score: 2, total: 5 },
        { quizId: 'a', score: 4, total: 5 },
      ])
      const r = await service.list(student, {})

      expect(prisma.quiz.findMany.mock.calls[0][0].where).toEqual({ kindergartenId: 'k1', isPublished: true })
      expect(prisma.quizAttempt.findMany.mock.calls[0][0].where).toEqual({
        studentId: 'st1',
        quizId: { in: ['a', 'b'] },
      })
      expect(r[0].myBest).toEqual({ score: 4, total: 5, percent: 80, attempts: 2 })
      expect(r[1].myBest).toBeNull()
      expect(r[0].attemptsCount).toBeUndefined()
    })

    it('фильтры по направлению и предмету передаются в запрос', async () => {
      prisma.quiz.findMany.mockResolvedValue([])
      await service.list(teacher, { examTrackId: 'tr1', subjectId: 's1' })
      expect(prisma.quiz.findMany.mock.calls[0][0].where).toEqual({
        kindergartenId: 'k1',
        examTrackId: 'tr1',
        subjectId: 's1',
      })
    })

    it('родителю список квизов недоступен', async () => {
      await expect(service.list({ ...base, sub: 'p', role: 'PARENT' }, {})).rejects.toThrow(ForbiddenException)
    })
  })

  describe('create', () => {
    beforeEach(() => {
      prisma.quiz.create.mockResolvedValue({ id: 'new' })
      prisma.subject.findFirst.mockResolvedValue({ id: 's1' })
      prisma.examTrack.findFirst.mockResolvedValue({ id: 'tr1' })
    })

    it('создаёт квиз в школе автора; черновик по умолчанию; вопросы с позициями', async () => {
      await service.create(teacher, { title: '  Сложение ', questions: [goodQuestion, goodQuestion] })
      const data = prisma.quiz.create.mock.calls[0][0].data
      expect(data).toMatchObject({
        kindergartenId: 'k1',
        title: 'Сложение',
        isPublished: false,
        authorId: 't1',
        subjectId: null,
        examTrackId: null,
      })
      expect(data.questions.create.map((q: { position: number }) => q.position)).toEqual([0, 1])
      expect(data.questions.create[0].options).toEqual(goodQuestion.options)
    })

    it('владелец платформы (без школы) создавать не может', async () => {
      await expect(service.create(owner, { title: 'x', questions: [goodQuestion] })).rejects.toThrow(ForbiddenException)
    })

    it('плохие вопросы отклоняются с понятным текстом, ничего не создаётся', async () => {
      const bad = { ...goodQuestion, options: [{ text: 'a', correct: false }, { text: 'b', correct: false }] }
      await expect(service.create(teacher, { title: 'x', questions: [bad] })).rejects.toThrow(/ровно один/)
      expect(prisma.quiz.create).not.toHaveBeenCalled()
    })

    it('предмет или направление из чужой школы — 404', async () => {
      prisma.subject.findFirst.mockResolvedValue(null)
      await expect(
        service.create(teacher, { title: 'x', subjectId: 'foreign', questions: [goodQuestion] }),
      ).rejects.toThrow(NotFoundException)
      expect(prisma.subject.findFirst.mock.calls[0][0].where).toEqual({ id: 'foreign', kindergartenId: 'k1' })

      prisma.examTrack.findFirst.mockResolvedValue(null)
      await expect(
        service.create(teacher, { title: 'x', examTrackId: 'foreign', questions: [goodQuestion] }),
      ).rejects.toThrow(NotFoundException)
      expect(prisma.quiz.create).not.toHaveBeenCalled()
    })
  })

  describe('update / remove', () => {
    beforeEach(() => {
      prisma.quiz.findUnique.mockResolvedValue(dbQuiz())
      prisma.quiz.update.mockReturnValue('quiz-updated')
      prisma.quizQuestion.deleteMany.mockReturnValue('deleted')
      prisma.quizQuestion.createMany.mockReturnValue('created')
    })

    it('автор правит своё; вопросы заменяются целиком в одной транзакции', async () => {
      await service.update(teacher, 'qz1', { title: 'Новое', isPublished: true, questions: [goodQuestion] })
      expect(prisma.quiz.update.mock.calls[0][0].data).toEqual({ title: 'Новое', isPublished: true })
      expect(prisma.quizQuestion.deleteMany).toHaveBeenCalledWith({ where: { quizId: 'qz1' } })
      expect(prisma.quizQuestion.createMany.mock.calls[0][0].data[0]).toMatchObject({ quizId: 'qz1', position: 0 })
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('без questions вопросы не трогаются', async () => {
      await service.update(teacher, 'qz1', { isPublished: false })
      expect(prisma.quizQuestion.deleteMany).not.toHaveBeenCalled()
      expect(prisma.quizQuestion.createMany).not.toHaveBeenCalled()
    })

    it('чужой учитель не правит и не удаляет; админ школы — может; админ чужой школы — нет', async () => {
      await expect(service.update(otherTeacher, 'qz1', { title: 'x' })).rejects.toThrow(ForbiddenException)
      await expect(service.remove(otherTeacher, 'qz1')).rejects.toThrow(ForbiddenException)
      await expect(service.update(adminOther, 'qz1', { title: 'x' })).rejects.toThrow(ForbiddenException)
      await expect(service.update(admin, 'qz1', { title: 'x' })).resolves.toBeDefined()
      expect(prisma.quiz.delete).not.toHaveBeenCalled()
      await service.remove(admin, 'qz1')
      expect(prisma.quiz.delete).toHaveBeenCalledWith({ where: { id: 'qz1' } })
    })

    it('несуществующий квиз — 404', async () => {
      prisma.quiz.findUnique.mockResolvedValue(null)
      await expect(service.update(teacher, 'nope', {})).rejects.toThrow(NotFoundException)
    })

    it('невалидные вопросы при правке отклоняются до записи', async () => {
      await expect(service.update(teacher, 'qz1', { questions: [{ ...goodQuestion, text: ' ' }] })).rejects.toThrow(
        BadRequestException,
      )
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('getForEdit', () => {
    it('сотрудник получает правильные ответы для редактора; чужая школа — 403; ученик — 403', async () => {
      prisma.quiz.findUnique.mockResolvedValue({
        ...dbQuiz(),
        questions: [{ id: 'q1', position: 0, text: 'T', kind: 'SINGLE', options: goodQuestion.options, explanation: null }],
      })
      const r = await service.getForEdit(teacher, 'qz1')
      expect(r.questions[0].options).toEqual(goodQuestion.options)
      await expect(service.getForEdit(adminOther, 'qz1')).rejects.toThrow(ForbiddenException)
      await expect(service.getForEdit(student, 'qz1')).rejects.toThrow(ForbiddenException)
    })
  })

  describe('play (ученик)', () => {
    const rows = [
      { id: 'q1', position: 0, text: 'Первый', kind: 'SINGLE', options: goodQuestion.options, explanation: 'secret-explanation' },
    ]

    it('вопросы без признаков правильных ответов и без пояснений', async () => {
      prisma.quiz.findUnique.mockResolvedValue(dbQuiz({ timeLimitSec: 300 }))
      prisma.quizQuestion.findMany.mockResolvedValue(rows)
      const r = await service.play(student, 'qz1')
      expect(r).toMatchObject({ id: 'qz1', title: 'Сложение', timeLimitSec: 300 })
      expect(r.questions[0].options).toEqual([{ text: '3' }, { text: '4' }])
      expect(JSON.stringify(r)).not.toMatch(/correct|secret-explanation/)
    })

    it('неопубликованный и чужой квиз для ученика «не существуют» → 404', async () => {
      prisma.quiz.findUnique.mockResolvedValue(dbQuiz({ isPublished: false }))
      await expect(service.play(student, 'qz1')).rejects.toThrow(NotFoundException)
      prisma.quiz.findUnique.mockResolvedValue(dbQuiz({ kindergartenId: 'k2' }))
      await expect(service.play(student, 'qz1')).rejects.toThrow(NotFoundException)
    })

    it('учитель и ученик без привязки не проходят квиз', async () => {
      await expect(service.play(teacher, 'qz1')).rejects.toThrow(ForbiddenException)
      await expect(service.play({ ...student, studentId: null }, 'qz1')).rejects.toThrow(ForbiddenException)
    })
  })

  describe('submit (ученик)', () => {
    const rows = [
      { id: 'q1', position: 0, text: 'A', kind: 'SINGLE', options: goodQuestion.options, explanation: 'пояснение 1' },
      {
        id: 'q2',
        position: 1,
        text: 'B',
        kind: 'MULTIPLE',
        options: [
          { text: 'x', correct: true },
          { text: 'y', correct: true },
          { text: 'z', correct: false },
        ],
        explanation: null,
      },
    ]

    beforeEach(() => {
      prisma.quiz.findUnique.mockResolvedValue(dbQuiz())
      prisma.quizQuestion.findMany.mockResolvedValue(rows)
      prisma.quizAttempt.create.mockResolvedValue({ id: 'att1', createdAt: new Date('2026-11-03') })
    })

    it('сервер сам считает оценку и сохраняет попытку; разбор содержит верные ответы', async () => {
      const r = await service.submit(student, 'qz1', {
        answers: [
          { questionId: 'q1', selected: [1] },
          { questionId: 'q2', selected: [0] }, // неполный набор — неверно
        ],
        durationSec: 42,
      })

      expect(r).toMatchObject({ attemptId: 'att1', score: 1, total: 2, percent: 50 })
      expect(r.review[0]).toMatchObject({ correct: true, correctOptions: [1], explanation: 'пояснение 1' })
      expect(r.review[1]).toMatchObject({ correct: false, correctOptions: [0, 1] })
      expect(prisma.quizAttempt.create.mock.calls[0][0].data).toMatchObject({
        quizId: 'qz1',
        studentId: 'st1',
        score: 1,
        total: 2,
        durationSec: 42,
      })
    })

    it('клиент не может сам прислать оценку — лишние поля игнорируются, считается по ответам', async () => {
      const r = await service.submit(student, 'qz1', { answers: [] , ...( { score: 2, total: 2 } as object) } as never)
      expect(r.score).toBe(0)
    })

    it('в квизе нет вопросов — 400', async () => {
      prisma.quizQuestion.findMany.mockResolvedValue([])
      await expect(service.submit(student, 'qz1', { answers: [] })).rejects.toThrow(BadRequestException)
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled()
    })

    it('чужой/неопубликованный квиз — 404, попытка не записывается', async () => {
      prisma.quiz.findUnique.mockResolvedValue(dbQuiz({ isPublished: false }))
      await expect(service.submit(student, 'qz1', { answers: [] })).rejects.toThrow(NotFoundException)
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled()
    })
  })

  describe('results / myAttempts', () => {
    it('results: по ученикам, лучший результат, лучшие выше; чужая школа — 403', async () => {
      const al = { id: 's1', firstName: 'Али', lastName: 'Каримов', group: { name: '5А' } }
      const ma = { id: 's2', firstName: 'Мадина', lastName: 'Раҳимова', group: null }
      prisma.quiz.findUnique.mockResolvedValue(dbQuiz())
      prisma.quizAttempt.findMany.mockResolvedValue([
        { score: 3, total: 10, createdAt: new Date('2026-11-03'), student: al },
        { score: 9, total: 10, createdAt: new Date('2026-11-02'), student: ma },
        { score: 6, total: 10, createdAt: new Date('2026-11-01'), student: al },
      ])
      const r = await service.results(teacher, 'qz1')
      expect(r.map((x) => x.student.firstName)).toEqual(['Мадина', 'Али'])
      expect(r[1]).toMatchObject({ best: { percent: 60, attempts: 2 }, student: { group: '5А' } })
      expect(r[0].student.group).toBeNull()
      expect(r[1].lastAt).toEqual(new Date('2026-11-03'))

      await expect(service.results(adminOther, 'qz1')).rejects.toThrow(ForbiddenException)
      await expect(service.results(student, 'qz1')).rejects.toThrow(ForbiddenException)
    })

    it('myAttempts: только свои попытки, с процентом', async () => {
      prisma.quiz.findUnique.mockResolvedValue(dbQuiz())
      prisma.quizAttempt.findMany.mockResolvedValue([{ id: 'a', score: 1, total: 4, durationSec: null, createdAt: new Date() }])
      const r = await service.myAttempts(student, 'qz1')
      expect(prisma.quizAttempt.findMany.mock.calls[0][0].where).toEqual({ quizId: 'qz1', studentId: 'st1' })
      expect(r[0].percent).toBe(25)
    })
  })
})
