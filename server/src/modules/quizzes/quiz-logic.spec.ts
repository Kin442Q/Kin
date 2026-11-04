import { BadRequestException } from '@nestjs/common'

import {
  bestOf,
  gradeAttempt,
  parseOptions,
  toPlayQuestion,
  validateQuestions,
  type QuestionInput,
  type StoredQuestion,
} from './quiz-logic'

const single = (over: Partial<QuestionInput> = {}): QuestionInput => ({
  text: '2 + 2 = ?',
  kind: 'SINGLE',
  options: [
    { text: '3', correct: false },
    { text: '4', correct: true },
    { text: '5', correct: false },
  ],
  ...over,
})

const stored = (id: string, over: Partial<StoredQuestion> = {}): StoredQuestion => ({
  id,
  position: 0,
  text: 'Вопрос',
  kind: 'SINGLE',
  options: [
    { text: 'A', correct: false },
    { text: 'B', correct: true },
    { text: 'C', correct: false },
  ],
  explanation: 'Потому что B',
  ...over,
})

describe('validateQuestions', () => {
  it('корректный набор проходит', () => {
    expect(() =>
      validateQuestions([
        single(),
        single({
          kind: 'MULTIPLE',
          options: [
            { text: 'Чётное 2', correct: true },
            { text: 'Чётное 4', correct: true },
            { text: 'Нечётное 3', correct: false },
          ],
        }),
      ]),
    ).not.toThrow()
  })

  it('пустой список вопросов — ошибка', () => {
    expect(() => validateQuestions([])).toThrow(BadRequestException)
  })

  it('больше 100 вопросов — ошибка', () => {
    expect(() => validateQuestions(Array.from({ length: 101 }, () => single()))).toThrow(/Не больше 100/)
  })

  it('ошибка называет номер вопроса', () => {
    expect(() => validateQuestions([single(), single({ text: '  ' })])).toThrow(/Вопрос 2: введите текст/)
  })

  it('SINGLE: ровно один правильный', () => {
    const none = single({ options: [{ text: 'a', correct: false }, { text: 'b', correct: false }] })
    const two = single({ options: [{ text: 'a', correct: true }, { text: 'b', correct: true }] })
    expect(() => validateQuestions([none])).toThrow(/ровно один/)
    expect(() => validateQuestions([two])).toThrow(/ровно один/)
  })

  it('MULTIPLE: хотя бы один правильный', () => {
    const q = single({ kind: 'MULTIPLE', options: [{ text: 'a', correct: false }, { text: 'b', correct: false }] })
    expect(() => validateQuestions([q])).toThrow(/хотя бы один/)
  })

  it('число вариантов: от 2 до 8', () => {
    expect(() => validateQuestions([single({ options: [{ text: 'a', correct: true }] })])).toThrow(/от 2 до 8/)
    const nine = Array.from({ length: 9 }, (_, i) => ({ text: String(i), correct: i === 0 }))
    expect(() => validateQuestions([single({ options: nine })])).toThrow(/от 2 до 8/)
  })

  it('пустой вариант ответа — ошибка', () => {
    const q = single({ options: [{ text: 'a', correct: true }, { text: ' ', correct: false }] })
    expect(() => validateQuestions([q])).toThrow(/вариант 2 пустой/)
  })

  it('неизвестный тип вопроса — ошибка', () => {
    expect(() => validateQuestions([single({ kind: 'ESSAY' as never })])).toThrow(/тип вопроса/)
  })
})

describe('gradeAttempt', () => {
  const questions = [
    stored('q1'),
    stored('q2', {
      kind: 'MULTIPLE',
      options: [
        { text: 'a', correct: true },
        { text: 'b', correct: false },
        { text: 'c', correct: true },
      ],
    }),
  ]

  it('всё верно → 100%', () => {
    const r = gradeAttempt(questions, [
      { questionId: 'q1', selected: [1] },
      { questionId: 'q2', selected: [0, 2] },
    ])
    expect(r).toMatchObject({ score: 2, total: 2, percent: 100 })
    expect(r.review.every((x) => x.correct)).toBe(true)
  })

  it('SINGLE: неверный вариант и выбор нескольких — неверно', () => {
    expect(gradeAttempt([stored('q1')], [{ questionId: 'q1', selected: [0] }]).score).toBe(0)
    expect(gradeAttempt([stored('q1')], [{ questionId: 'q1', selected: [1, 0] }]).score).toBe(0)
  })

  it('MULTIPLE: нужен точный набор — лишний или недостающий вариант неверен', () => {
    const q = [questions[1]]
    expect(gradeAttempt(q, [{ questionId: 'q2', selected: [0, 2] }]).score).toBe(1)
    expect(gradeAttempt(q, [{ questionId: 'q2', selected: [2, 0] }]).score).toBe(1) // порядок неважен
    expect(gradeAttempt(q, [{ questionId: 'q2', selected: [0] }]).score).toBe(0)
    expect(gradeAttempt(q, [{ questionId: 'q2', selected: [0, 1, 2] }]).score).toBe(0)
  })

  it('без ответа — неверно; доля считается от всех вопросов', () => {
    const r = gradeAttempt(questions, [{ questionId: 'q1', selected: [1] }])
    expect(r).toMatchObject({ score: 1, total: 2, percent: 50 })
    expect(r.review[1]).toMatchObject({ correct: false, selected: [] })
  })

  it('мусор в ответах не ломает проверку и не засчитывается', () => {
    const r = gradeAttempt(questions, [
      { questionId: 'q1', selected: [99, -1, 1.5, 'x' as never] }, // нет допустимых индексов
      { questionId: 'нет-такого', selected: [0] },
      null as never,
    ])
    expect(r.score).toBe(0)
    expect(r.review[0].selected).toEqual([])
  })

  it('повторы индексов схлопываются: [1,1] для SINGLE = один выбор', () => {
    expect(gradeAttempt([stored('q1')], [{ questionId: 'q1', selected: [1, 1] }]).score).toBe(1)
  })

  it('разбор содержит правильные варианты и пояснение', () => {
    const r = gradeAttempt([stored('q1')], [{ questionId: 'q1', selected: [0] }])
    expect(r.review[0]).toEqual({
      questionId: 'q1',
      correct: false,
      selected: [0],
      correctOptions: [1],
      explanation: 'Потому что B',
    })
  })

  it('пустой квиз: 0 из 0 и 0% без деления на ноль', () => {
    expect(gradeAttempt([], [])).toMatchObject({ score: 0, total: 0, percent: 0 })
  })
})

describe('toPlayQuestion', () => {
  it('не раскрывает правильные ответы и пояснение', () => {
    const play = toPlayQuestion(stored('q1'))
    expect(play).toEqual({
      id: 'q1',
      position: 0,
      text: 'Вопрос',
      kind: 'SINGLE',
      options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
    })
    expect(JSON.stringify(play)).not.toMatch(/correct|explanation|Потому/)
  })
})

describe('parseOptions / bestOf', () => {
  it('parseOptions: битый Json → пустой список, лишние поля отбрасываются', () => {
    expect(parseOptions(null)).toEqual([])
    expect(parseOptions('x')).toEqual([])
    expect(parseOptions([{ text: 'a', correct: true, junk: 1 }, null, { text: 5 }])).toEqual([
      { text: 'a', correct: true },
      { text: '5', correct: false },
    ])
  })

  it('bestOf: лучшая попытка по проценту и число попыток', () => {
    expect(bestOf([])).toBeNull()
    expect(bestOf([{ score: 3, total: 10 }, { score: 8, total: 10 }, { score: 5, total: 10 }])).toEqual({
      score: 8,
      total: 10,
      percent: 80,
      attempts: 3,
    })
  })
})
