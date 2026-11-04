import { describe, it, expect } from 'vitest'
import { scoreGame, starsFor, BASE_POINTS, SPEED_SECONDS } from './quizGame'

describe('starsFor', () => {
  it('звёзды по проценту', () => {
    expect([0, 49, 50, 79, 80, 99, 100].map(starsFor)).toEqual([0, 0, 1, 1, 2, 2, 3])
  })
})

describe('scoreGame', () => {
  it('без скорости: верный ответ — базовые очки, серия растёт и умножает', () => {
    const r = scoreGame([true, true, true], [5, 5, 5], false)
    expect(r.perQuestion.map((p) => p.points)).toEqual([100, 110, 120])
    expect(r.xp).toBe(330)
    expect(r.bestStreak).toBe(3)
    expect(r.stars).toBe(3)
  })

  it('неверный ответ даёт 0 и сбрасывает серию', () => {
    const r = scoreGame([true, false, true, true], [3, 3, 3, 3], false)
    expect(r.perQuestion.map((p) => p.points)).toEqual([100, 0, 100, 110])
    expect(r.perQuestion.map((p) => p.streak)).toEqual([1, 0, 1, 2])
    expect(r.bestStreak).toBe(2)
    // верно 3 из 4 = 75%: одна звезда
    expect(r.stars).toBe(1)
  })

  it('режим на скорость: чем быстрее, тем больше бонус', () => {
    const fast = scoreGame([true], [0], true).perQuestion[0]
    const slow = scoreGame([true], [SPEED_SECONDS], true).perQuestion[0]
    expect(fast.speedBonus).toBe(50)
    expect(fast.points).toBe(BASE_POINTS + 50)
    expect(slow.speedBonus).toBe(0)
    expect(slow.points).toBe(BASE_POINTS)
  })

  it('бонус серии ограничен +50%', () => {
    const r = scoreGame(Array(10).fill(true), Array(10).fill(10), false)
    expect(r.perQuestion[9].points).toBe(150)
    expect(r.bestStreak).toBe(10)
  })

  it('пустой квиз — ноль очков и звёзд', () => {
    expect(scoreGame([], [], false)).toEqual({ xp: 0, bestStreak: 0, stars: 0, perQuestion: [] })
  })
})
