import { levelOf, streakDays, totalXp } from './student-progress'

// «Сейчас» — 6 ноября 2026, 14:00 по Душанбе (09:00 UTC).
const now = new Date('2026-11-06T09:00:00Z')
const at = (iso: string) => new Date(iso)

describe('totalXp / levelOf', () => {
  it('квиз из 15 вопросов без ошибок даёт 150 XP, ДЗ — по 20, игра — по 5', () => {
    expect(totalXp({ correctAnswers: 15, homework: 0, games: 0 })).toBe(150)
    expect(totalXp({ correctAnswers: 15, homework: 3, games: 4 })).toBe(150 + 60 + 20)
    expect(totalXp({ correctAnswers: 0, homework: 0, games: 0 })).toBe(0)
  })

  it('каждые 200 XP — новый уровень, первый уровень — с нуля', () => {
    expect(levelOf(0)).toEqual({ level: 1, intoLevel: 0, levelSize: 200 })
    expect(levelOf(199)).toMatchObject({ level: 1, intoLevel: 199 })
    expect(levelOf(200)).toMatchObject({ level: 2, intoLevel: 0 })
    expect(levelOf(1240)).toMatchObject({ level: 7, intoLevel: 40 })
  })

  it('отрицательные и дробные значения не ломают уровень', () => {
    expect(levelOf(-50)).toMatchObject({ level: 1, intoLevel: 0 })
    expect(levelOf(250.9)).toMatchObject({ level: 2, intoLevel: 50 })
  })
})

describe('streakDays — дней подряд с занятиями', () => {
  it('нет занятий — 0', () => {
    expect(streakDays([], now)).toBe(0)
  })

  it('считает подряд идущие дни, включая сегодняшний', () => {
    const list = [at('2026-11-06T05:00:00Z'), at('2026-11-05T10:00:00Z'), at('2026-11-04T07:00:00Z')]
    expect(streakDays(list, now)).toBe(3)
  })

  it('несколько занятий в один день — это один день', () => {
    const list = [at('2026-11-06T03:00:00Z'), at('2026-11-06T04:00:00Z'), at('2026-11-05T04:00:00Z')]
    expect(streakDays(list, now)).toBe(2)
  })

  it('сегодня занятий ещё нет, но вчера были — серия жива', () => {
    const list = [at('2026-11-05T10:00:00Z'), at('2026-11-04T10:00:00Z')]
    expect(streakDays(list, now)).toBe(2)
  })

  it('пропущен вчерашний день — серия 0, даже если раньше занимался', () => {
    const list = [at('2026-11-04T10:00:00Z'), at('2026-11-03T10:00:00Z')]
    expect(streakDays(list, now)).toBe(0)
  })

  it('пропуск посередине обрывает серию', () => {
    const list = [at('2026-11-06T05:00:00Z'), at('2026-11-05T05:00:00Z'), at('2026-11-03T05:00:00Z')]
    expect(streakDays(list, now)).toBe(2)
  })

  it('день определяется по местному времени (UTC+5): 23:30 UTC — уже следующий день в Душанбе', () => {
    // 5 ноября 23:30 UTC = 6 ноября 04:30 в Душанбе, то есть «сегодня».
    expect(streakDays([at('2026-11-05T23:30:00Z')], now)).toBe(1)
    // 4 ноября 19:30 UTC = 5 ноября 00:30 в Душанбе, то есть «вчера»: серия из двух дней.
    expect(streakDays([at('2026-11-05T23:30:00Z'), at('2026-11-04T19:30:00Z')], now)).toBe(2)
  })
})
