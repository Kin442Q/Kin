import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { PartialType } from '@nestjs/swagger'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { assertCanManage, requireSchool } from '../../common/content-access'
import { bestOf } from '../quizzes/quiz-logic'
import type { AuthUser } from '../../common/types/jwt-payload'

export class CreateTrackDto {
  /** Название задаёт школа: «ЕГЭ», «Вступительные», «Олимпиады»… */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null
}

export class UpdateTrackDto extends PartialType(CreateTrackDto) {}

/** Прогресс ученика по направлению: сколько квизов пройдено и средний лучший результат. */
export function trackProgress(
  quizIds: string[],
  attemptsByQuiz: Map<string, Array<{ score: number; total: number }>>,
) {
  const bests = quizIds
    .map((id) => bestOf(attemptsByQuiz.get(id) ?? []))
    .filter((b): b is NonNullable<typeof b> => b !== null)
  return {
    total: quizIds.length,
    attempted: bests.length,
    avgPercent: bests.length ? Math.round(bests.reduce((s, b) => s + b.percent, 0) / bests.length) : null,
  }
}

@Injectable()
export class ExamPrepService {
  constructor(private readonly prisma: PrismaService) {}

  /** Направления школы. Ученику — число опубликованных квизов и его прогресс. */
  async list(user: AuthUser) {
    const student = user.role === 'STUDENT'
    if (!student && user.role !== 'TEACHER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Нет доступа')
    }

    const tracks = await this.prisma.examTrack.findMany({
      where: user.kindergartenId ? { kindergartenId: user.kindergartenId } : {},
      orderBy: { name: 'asc' },
      include: {
        author: { select: { id: true, fullName: true } },
        quizzes: { select: { id: true, isPublished: true } },
      },
    })

    let attemptsByQuiz = new Map<string, Array<{ score: number; total: number }>>()
    if (student && user.studentId) {
      const quizIds = tracks.flatMap((t) => t.quizzes.filter((q) => q.isPublished).map((q) => q.id))
      if (quizIds.length) {
        const attempts = await this.prisma.quizAttempt.findMany({
          where: { studentId: user.studentId, quizId: { in: quizIds } },
          select: { quizId: true, score: true, total: true },
        })
        for (const a of attempts) {
          attemptsByQuiz.set(a.quizId, [...(attemptsByQuiz.get(a.quizId) ?? []), a])
        }
      }
    }

    return tracks.map(({ quizzes, ...t }) => {
      const visible = student ? quizzes.filter((q) => q.isPublished) : quizzes
      return {
        ...t,
        quizzesCount: visible.length,
        progress: student ? trackProgress(visible.map((q) => q.id), attemptsByQuiz) : undefined,
      }
    })
  }

  async create(user: AuthUser, dto: CreateTrackDto) {
    const kindergartenId = requireSchool(user)
    return this.prisma.examTrack.create({
      data: {
        kindergartenId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        authorId: user.sub,
      },
    })
  }

  private async load(id: string) {
    const track = await this.prisma.examTrack.findUnique({ where: { id } })
    if (!track) throw new NotFoundException('Направление не найдено')
    return track
  }

  async update(user: AuthUser, id: string, dto: UpdateTrackDto) {
    const track = await this.load(id)
    assertCanManage(user, track)
    return this.prisma.examTrack.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      },
    })
  }

  /** Квизы направления остаются (examTrackId → null), удаляется только само направление. */
  async remove(user: AuthUser, id: string) {
    const track = await this.load(id)
    assertCanManage(user, track)
    await this.prisma.examTrack.delete({ where: { id } })
  }
}
