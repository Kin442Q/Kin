import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { assertSameSchool } from '../../common/content-access'
import type { AuthUser } from '../../common/types/jwt-payload'
import { GAMES, GAME_KEYS, isGameKey, type GameKey } from './game-registry'

export class SubmitScoreDto {
  @IsInt()
  @Min(0)
  score!: number

  /** Достигнутый уровень (для игр с уровнями). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  level?: number
}

const isStaff = (u: AuthUser) => u.role === 'TEACHER' || u.role === 'ADMIN' || u.role === 'SUPER_ADMIN'

/** «Алишер Каримов» → «Алишер К.»: в рейтинге класса фамилию целиком не показываем. */
export const shortName = (s: { firstName: string; lastName: string }) =>
  `${s.firstName} ${s.lastName.trim().slice(0, 1).toUpperCase()}.`.trim()

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  private assertKey(key: string): GameKey {
    if (!isGameKey(key)) throw new NotFoundException('Игра не найдена')
    return key
  }

  /** Список игр; ученику — его лучший результат в каждой. */
  async list(user: AuthUser) {
    if (user.role !== 'STUDENT' && !isStaff(user)) throw new ForbiddenException('Нет доступа')

    const best = new Map<string, number>()
    if (user.role === 'STUDENT' && user.studentId) {
      const rows = await this.prisma.gameScore.groupBy({
        by: ['gameKey'],
        where: { studentId: user.studentId },
        _max: { score: true },
      })
      for (const r of rows) best.set(r.gameKey, r._max.score ?? 0)
    }

    return GAME_KEYS.map((key) => ({
      key,
      ...GAMES[key],
      myBest: user.role === 'STUDENT' ? (best.get(key) ?? null) : undefined,
    }))
  }

  /** Сохранить результат игры. Всё выше потолка игры считается подделкой. */
  async submit(user: AuthUser, key: string, dto: SubmitScoreDto) {
    const gameKey = this.assertKey(key)
    if (user.role !== 'STUDENT' || !user.studentId) throw new ForbiddenException('Играют ученики')
    if (dto.score > GAMES[gameKey].maxScore) throw new BadRequestException('Недопустимый результат')

    const previous = await this.prisma.gameScore.aggregate({
      where: { studentId: user.studentId, gameKey },
      _max: { score: true },
    })
    await this.prisma.gameScore.create({
      data: { studentId: user.studentId, gameKey, score: dto.score, level: dto.level ?? null },
    })
    const prevBest = previous._max.score ?? null
    return { score: dto.score, best: Math.max(prevBest ?? 0, dto.score), isRecord: prevBest === null || dto.score > prevBest }
  }

  /**
   * Рейтинг класса: лучшие результаты, по одному на ученика. Ученик видит
   * свой класс; сотрудник указывает класс своей школы.
   */
  async leaderboard(user: AuthUser, key: string, groupId?: string) {
    const gameKey = this.assertKey(key)

    let targetGroup: string
    if (user.role === 'STUDENT' && user.studentId) {
      const me = await this.prisma.student.findUnique({ where: { id: user.studentId }, select: { groupId: true } })
      if (!me) throw new NotFoundException('Ученик не найден')
      targetGroup = me.groupId
    } else if (isStaff(user)) {
      if (!groupId) throw new BadRequestException('Укажите класс (groupId)')
      const g = await this.prisma.group.findUnique({ where: { id: groupId }, select: { id: true, kindergartenId: true } })
      // класс чужой школы для сотрудника «не существует»
      if (!g || (user.kindergartenId && g.kindergartenId !== user.kindergartenId)) {
        throw new NotFoundException('Класс не найден')
      }
      assertSameSchool(user, g.kindergartenId ?? '')
      targetGroup = g.id
    } else {
      throw new ForbiddenException('Нет доступа')
    }

    const top = await this.prisma.gameScore.groupBy({
      by: ['studentId'],
      where: { gameKey, student: { groupId: targetGroup } },
      _max: { score: true },
      orderBy: { _max: { score: 'desc' } },
      take: 10,
    })
    const students = await this.prisma.student.findMany({
      where: { id: { in: top.map((t) => t.studentId) } },
      select: { id: true, firstName: true, lastName: true },
    })
    const byId = new Map(students.map((s) => [s.id, s]))

    return top.map((t, i) => ({
      rank: i + 1,
      name: shortName(byId.get(t.studentId) ?? { firstName: '—', lastName: '' }),
      score: t._max.score ?? 0,
      isMe: user.studentId === t.studentId,
    }))
  }
}
