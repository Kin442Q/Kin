import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { assertCanManage, assertSameSchool, requireSchool } from '../../common/content-access'
import type { AuthUser } from '../../common/types/jwt-payload'
import type { CreateQuizDto, SubmitAttemptDto, UpdateQuizDto } from './quizzes.dto'
import {
  bestOf,
  gradeAttempt,
  parseOptions,
  toPlayQuestion,
  validateQuestions,
  type QuestionInput,
  type StoredQuestion,
} from './quiz-logic'

const isStaff = (u: AuthUser) => u.role === 'TEACHER' || u.role === 'ADMIN' || u.role === 'SUPER_ADMIN'

@Injectable()
export class QuizzesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── вспомогательное ────────────────────────────────────────────

  private toStored(q: {
    id: string
    position: number
    text: string
    kind: 'SINGLE' | 'MULTIPLE'
    options: unknown
    explanation: string | null
  }): StoredQuestion {
    return { ...q, options: parseOptions(q.options) }
  }

  /** Предмет и направление должны быть из той же школы, иначе — «не найдено». */
  private async assertRefs(kindergartenId: string, subjectId?: string | null, examTrackId?: string | null) {
    if (subjectId) {
      const s = await this.prisma.subject.findFirst({ where: { id: subjectId, kindergartenId }, select: { id: true } })
      if (!s) throw new NotFoundException('Предмет не найден')
    }
    if (examTrackId) {
      const t = await this.prisma.examTrack.findFirst({ where: { id: examTrackId, kindergartenId }, select: { id: true } })
      if (!t) throw new NotFoundException('Направление подготовки не найдено')
    }
  }

  private async loadQuiz(id: string) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id } })
    if (!quiz) throw new NotFoundException('Квиз не найден')
    return quiz
  }

  /** Квиз, который ученик вправе проходить: опубликованный и из его школы. */
  private async loadPlayable(user: AuthUser, id: string) {
    if (user.role !== 'STUDENT' || !user.studentId) throw new ForbiddenException('Квизы проходят ученики')
    const quiz = await this.prisma.quiz.findUnique({ where: { id } })
    // Чужой или неопубликованный квиз для ученика «не существует».
    if (!quiz || !quiz.isPublished || quiz.kindergartenId !== user.kindergartenId) {
      throw new NotFoundException('Квиз не найден')
    }
    return quiz
  }

  // ─── список ─────────────────────────────────────────────────────

  async list(user: AuthUser, params: { examTrackId?: string; subjectId?: string }) {
    const where: Prisma.QuizWhereInput = {
      ...(user.kindergartenId ? { kindergartenId: user.kindergartenId } : {}),
      ...(params.examTrackId ? { examTrackId: params.examTrackId } : {}),
      ...(params.subjectId ? { subjectId: params.subjectId } : {}),
    }
    const student = user.role === 'STUDENT'
    if (student) where.isPublished = true
    else if (!isStaff(user)) throw new ForbiddenException('Нет доступа')

    const quizzes = await this.prisma.quiz.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        examTrack: { select: { id: true, name: true } },
        author: { select: { id: true, fullName: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    })

    let myBest = new Map<string, ReturnType<typeof bestOf>>()
    if (student && user.studentId && quizzes.length) {
      const attempts = await this.prisma.quizAttempt.findMany({
        where: { studentId: user.studentId, quizId: { in: quizzes.map((q) => q.id) } },
        select: { quizId: true, score: true, total: true },
      })
      const grouped = new Map<string, Array<{ score: number; total: number }>>()
      for (const a of attempts) grouped.set(a.quizId, [...(grouped.get(a.quizId) ?? []), a])
      myBest = new Map([...grouped].map(([id, list]) => [id, bestOf(list)]))
    }

    return quizzes.map(({ _count, ...q }) => ({
      ...q,
      questionsCount: _count.questions,
      attemptsCount: student ? undefined : _count.attempts,
      myBest: student ? (myBest.get(q.id) ?? null) : undefined,
    }))
  }

  // ─── сотрудники: правка ─────────────────────────────────────────

  /** Квиз целиком, с правильными ответами — для редактора. */
  async getForEdit(user: AuthUser, id: string) {
    if (!isStaff(user)) throw new ForbiddenException('Нет доступа')
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { questions: { orderBy: { position: 'asc' } } },
    })
    if (!quiz) throw new NotFoundException('Квиз не найден')
    assertSameSchool(user, quiz.kindergartenId)
    return { ...quiz, questions: quiz.questions.map((q) => ({ ...q, options: parseOptions(q.options) })) }
  }

  async create(user: AuthUser, dto: CreateQuizDto) {
    const kindergartenId = requireSchool(user)
    validateQuestions(dto.questions as QuestionInput[])
    await this.assertRefs(kindergartenId, dto.subjectId, dto.examTrackId)

    return this.prisma.quiz.create({
      data: {
        kindergartenId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        subjectId: dto.subjectId || null,
        examTrackId: dto.examTrackId || null,
        timeLimitSec: dto.timeLimitSec ?? null,
        isPublished: dto.isPublished ?? false,
        authorId: user.sub,
        questions: {
          create: dto.questions.map((q, i) => ({
            position: i,
            text: q.text.trim(),
            kind: q.kind,
            options: q.options.map((o) => ({ text: o.text.trim(), correct: o.correct })) as Prisma.InputJsonValue,
            explanation: q.explanation?.trim() || null,
          })),
        },
      },
    })
  }

  async update(user: AuthUser, id: string, dto: UpdateQuizDto) {
    const quiz = await this.loadQuiz(id)
    assertCanManage(user, quiz)
    if (dto.questions) validateQuestions(dto.questions as QuestionInput[])
    await this.assertRefs(quiz.kindergartenId, dto.subjectId, dto.examTrackId)

    const data: Prisma.QuizUncheckedUpdateInput = {}
    if (dto.title !== undefined) data.title = dto.title.trim()
    if (dto.description !== undefined) data.description = dto.description?.trim() || null
    if (dto.subjectId !== undefined) data.subjectId = dto.subjectId || null
    if (dto.examTrackId !== undefined) data.examTrackId = dto.examTrackId || null
    if (dto.timeLimitSec !== undefined) data.timeLimitSec = dto.timeLimitSec ?? null
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished

    // Вопросы заменяются целиком; уже сохранённые результаты попыток не меняются.
    const ops: Prisma.PrismaPromise<unknown>[] = [this.prisma.quiz.update({ where: { id }, data })]
    if (dto.questions) {
      ops.push(
        this.prisma.quizQuestion.deleteMany({ where: { quizId: id } }),
        this.prisma.quizQuestion.createMany({
          data: dto.questions.map((q, i) => ({
            quizId: id,
            position: i,
            text: q.text.trim(),
            kind: q.kind,
            options: q.options.map((o) => ({ text: o.text.trim(), correct: o.correct })) as Prisma.InputJsonValue,
            explanation: q.explanation?.trim() || null,
          })),
        }),
      )
    }
    const [updated] = await this.prisma.$transaction(ops)
    return updated
  }

  async remove(user: AuthUser, id: string) {
    const quiz = await this.loadQuiz(id)
    assertCanManage(user, quiz)
    await this.prisma.quiz.delete({ where: { id } })
  }

  /** Результаты учеников по квизу: попытки, лучший результат, последняя дата. */
  async results(user: AuthUser, id: string) {
    if (!isStaff(user)) throw new ForbiddenException('Нет доступа')
    const quiz = await this.loadQuiz(id)
    assertSameSchool(user, quiz.kindergartenId)

    const attempts = await this.prisma.quizAttempt.findMany({
      where: { quizId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        score: true,
        total: true,
        createdAt: true,
        student: { select: { id: true, firstName: true, lastName: true, group: { select: { name: true } } } },
      },
    })

    const byStudent = new Map<string, { student: (typeof attempts)[number]['student']; list: typeof attempts }>()
    for (const a of attempts) {
      const cur = byStudent.get(a.student.id) ?? { student: a.student, list: [] }
      cur.list.push(a)
      byStudent.set(a.student.id, cur)
    }

    return [...byStudent.values()]
      .map(({ student, list }) => ({
        student: { id: student.id, firstName: student.firstName, lastName: student.lastName, group: student.group?.name ?? null },
        best: bestOf(list),
        lastAt: list[0].createdAt, // попытки уже отсортированы от новых к старым
      }))
      .sort((a, b) => (b.best?.percent ?? 0) - (a.best?.percent ?? 0))
  }

  // ─── ученик: прохождение ────────────────────────────────────────

  /** Квиз для прохождения: вопросы без правильных ответов. */
  async play(user: AuthUser, id: string) {
    const quiz = await this.loadPlayable(user, id)
    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId: id },
      orderBy: { position: 'asc' },
    })
    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      timeLimitSec: quiz.timeLimitSec,
      questions: questions.map((q) => toPlayQuestion(this.toStored(q))),
    }
  }

  /** Оценку считает сервер; ученик получает разбор с правильными ответами уже после сдачи. */
  async submit(user: AuthUser, id: string, dto: SubmitAttemptDto) {
    const quiz = await this.loadPlayable(user, id)
    const rows = await this.prisma.quizQuestion.findMany({ where: { quizId: id }, orderBy: { position: 'asc' } })
    if (rows.length === 0) throw new BadRequestException('В квизе нет вопросов')

    const result = gradeAttempt(rows.map((q) => this.toStored(q)), dto.answers)
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentId: user.studentId!,
        score: result.score,
        total: result.total,
        answers: dto.answers.map((a) => ({ questionId: a.questionId, selected: a.selected })) as Prisma.InputJsonValue,
        durationSec: dto.durationSec ?? null,
      },
      select: { id: true, createdAt: true },
    })
    return { attemptId: attempt.id, createdAt: attempt.createdAt, ...result }
  }

  async myAttempts(user: AuthUser, id: string) {
    await this.loadPlayable(user, id)
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { quizId: id, studentId: user.studentId! },
      orderBy: { createdAt: 'desc' },
      select: { id: true, score: true, total: true, durationSec: true, createdAt: true },
    })
    return attempts.map((a) => ({ ...a, percent: a.total > 0 ? Math.round((a.score / a.total) * 100) : 0 }))
  }
}
