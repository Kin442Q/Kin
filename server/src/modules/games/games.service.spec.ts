import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { GamesService, shortName } from './games.service'
import { GAMES, GAME_KEYS, isGameKey } from './game-registry'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const base = { email: 'x@s.tj', kindergartenId: 'k1', groupId: null, childId: null }
const student: AuthUser = { ...base, sub: 'u', role: 'STUDENT', studentId: 'st1' }
const teacher: AuthUser = { ...base, sub: 't1', role: 'TEACHER' }

describe('game-registry', () => {
  it('у каждой игры есть название, описание и потолок результата', () => {
    expect([...GAME_KEYS].sort()).toEqual(['math', 'memory', 'sequence'])
    for (const k of GAME_KEYS) {
      expect(GAMES[k].title).toBeTruthy()
      expect(GAMES[k].maxScore).toBeGreaterThan(0)
    }
  })

  it('isGameKey не принимает чужое, в том числе свойства прототипа', () => {
    expect(isGameKey('memory')).toBe(true)
    expect(isGameKey('chess')).toBe(false)
    expect(isGameKey('toString')).toBe(false)
    expect(isGameKey('__proto__')).toBe(false)
  })
})

describe('shortName', () => {
  it('имя и первая буква фамилии: «Алишер Каримов» → «Алишер К.»', () => {
    expect(shortName({ firstName: 'Алишер', lastName: 'Каримов' })).toBe('Алишер К.')
    expect(shortName({ firstName: 'Мадина', lastName: 'раҳимова' })).toBe('Мадина Р.')
  })
})

describe('GamesService', () => {
  let prisma: PrismaMock
  let service: GamesService

  beforeEach(() => {
    prisma = createPrismaMock()
    service = new GamesService(prisma as unknown as PrismaService)
  })

  describe('list', () => {
    it('ученик видит все игры и лучший результат в каждой', async () => {
      prisma.gameScore.groupBy.mockResolvedValue([{ gameKey: 'memory', _max: { score: 640 } }])
      const r = await service.list(student)
      expect(r.map((g) => g.key)).toEqual(['memory', 'math', 'sequence'])
      expect(r.find((g) => g.key === 'memory')?.myBest).toBe(640)
      expect(r.find((g) => g.key === 'math')?.myBest).toBeNull()
      expect(prisma.gameScore.groupBy.mock.calls[0][0].where).toEqual({ studentId: 'st1' })
    })

    it('сотрудник видит игры без личных результатов; родитель — 403', async () => {
      const r = await service.list(teacher)
      expect(r[0].myBest).toBeUndefined()
      expect(prisma.gameScore.groupBy).not.toHaveBeenCalled()
      await expect(service.list({ ...base, sub: 'p', role: 'PARENT' })).rejects.toThrow(ForbiddenException)
    })
  })

  describe('submit', () => {
    beforeEach(() => prisma.gameScore.create.mockResolvedValue({}))

    it('первый результат — рекорд', async () => {
      prisma.gameScore.aggregate.mockResolvedValue({ _max: { score: null } })
      expect(await service.submit(student, 'math', { score: 25 })).toEqual({ score: 25, best: 25, isRecord: true })
      expect(prisma.gameScore.create.mock.calls[0][0].data).toEqual({
        studentId: 'st1',
        gameKey: 'math',
        score: 25,
        level: null,
      })
    })

    it('рекорд только если строго выше прежнего лучшего', async () => {
      prisma.gameScore.aggregate.mockResolvedValue({ _max: { score: 30 } })
      expect(await service.submit(student, 'math', { score: 30 })).toMatchObject({ best: 30, isRecord: false })
      expect(await service.submit(student, 'math', { score: 31, level: 4 })).toMatchObject({ best: 31, isRecord: true })
      expect(await service.submit(student, 'math', { score: 10 })).toMatchObject({ best: 30, isRecord: false })
    })

    it('результат выше потолка игры — подделка, 400, ничего не пишется', async () => {
      await expect(service.submit(student, 'math', { score: GAMES.math.maxScore + 1 })).rejects.toThrow(
        BadRequestException,
      )
      expect(prisma.gameScore.create).not.toHaveBeenCalled()
    })

    it('потолок включительно допустим', async () => {
      prisma.gameScore.aggregate.mockResolvedValue({ _max: { score: null } })
      await expect(service.submit(student, 'sequence', { score: GAMES.sequence.maxScore })).resolves.toBeDefined()
    })

    it('неизвестная игра — 404; не ученик — 403', async () => {
      await expect(service.submit(student, 'chess', { score: 1 })).rejects.toThrow(NotFoundException)
      await expect(service.submit(teacher, 'math', { score: 1 })).rejects.toThrow(ForbiddenException)
    })
  })

  describe('leaderboard', () => {
    const top = [
      { studentId: 'st2', _max: { score: 90 } },
      { studentId: 'st1', _max: { score: 70 } },
    ]
    beforeEach(() => {
      prisma.gameScore.groupBy.mockResolvedValue(top)
      prisma.student.findMany.mockResolvedValue([
        { id: 'st1', firstName: 'Али', lastName: 'Каримов' },
        { id: 'st2', firstName: 'Мадина', lastName: 'Раҳимова' },
      ])
    })

    it('ученик видит рейтинг СВОЕГО класса: места, короткие имена, пометка «это я»', async () => {
      prisma.student.findUnique.mockResolvedValue({ groupId: 'g1' })
      const r = await service.leaderboard(student, 'memory')

      const q = prisma.gameScore.groupBy.mock.calls[0][0]
      expect(q.where).toEqual({ gameKey: 'memory', student: { groupId: 'g1' } })
      expect(q.take).toBe(10)
      expect(r).toEqual([
        { rank: 1, name: 'Мадина Р.', score: 90, isMe: false },
        { rank: 2, name: 'Али К.', score: 70, isMe: true },
      ])
      expect(JSON.stringify(r)).not.toMatch(/Каримов|Раҳимова|studentId/)
    })

    it('сотруднику нужен groupId своей школы', async () => {
      await expect(service.leaderboard(teacher, 'memory')).rejects.toThrow(BadRequestException)
      prisma.group.findUnique.mockResolvedValue({ id: 'gX', kindergartenId: 'OTHER' })
      await expect(service.leaderboard(teacher, 'memory', 'gX')).rejects.toThrow(NotFoundException)
      prisma.group.findUnique.mockResolvedValue({ id: 'g1', kindergartenId: 'k1' })
      await expect(service.leaderboard(teacher, 'memory', 'g1')).resolves.toHaveLength(2)
    })

    it('неизвестная игра — 404; родитель — 403', async () => {
      await expect(service.leaderboard(student, 'chess')).rejects.toThrow(NotFoundException)
      await expect(service.leaderboard({ ...base, sub: 'p', role: 'PARENT' }, 'memory')).rejects.toThrow(
        ForbiddenException,
      )
    })
  })
})
