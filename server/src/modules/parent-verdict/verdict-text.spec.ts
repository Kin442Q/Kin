import { monthEnd } from './verdict-dates'
import { pickFocus, type Signal, type SubjectResult } from './verdict-rules'
import {
  groundedNumbers, hasSomethingToSay, numbersIn, renderVerdictText, ruPlural, type VerdictTextInput,
} from './verdict-text'

const sig = {
  weak: (id: string, average = 3.3, gradesCount = 6): Signal => ({ code: 'WEAK', subjectId: id, average, gradesCount, reasons: ['AVERAGE'] }),
  badRun: (id: string): Signal => ({ code: 'WEAK', subjectId: id, average: 3.8, gradesCount: 5, reasons: ['BAD_MARKS_IN_ROW'] }),
  drop: (id: string, from = 4.5, to = 3.9): Signal => ({ code: 'DROP', subjectId: id, from, to }),
  hw: (id: string, notDone = 4, assessed = 10): Signal => ({ code: 'HOMEWORK', subjectId: id, notDone, assessed }),
  abs: (id: string, lessons = 3): Signal => ({ code: 'ABSENCES', subjectId: id, lessons, days: 3 }),
  none: (id: string, scope: 'student' | 'class' = 'student'): Signal => ({ code: 'NO_GRADES', subjectId: id, scope, lessons: 9, days: 21 }),
  strong: (id: string, average = 4.8): Signal => ({ code: 'STRONG', subjectId: id, average, previousAverage: 4.9 }),
}

const subj = (id: string, name: string, signals: Signal[], gradesCount = 5): SubjectResult => ({
  subjectId: id, subjectName: name, average: 4, gradesCount, previousAverage: 4, previousGradesCount: 5, signals,
})

function input(subjects: SubjectResult[], over: Partial<VerdictTextInput> = {}): VerdictTextInput {
  return {
    month: '2026-10', asOf: '2026-10-31', studentName: 'Алишер', scaleMax: 5, noGradesDays: 21,
    subjects, focus: pickFocus(subjects), ...over,
  }
}

const rich = () =>
  input([
    subj('math', 'Математика', [sig.weak('math'), sig.hw('math')]),
    subj('rus', 'Русский язык', [sig.drop('rus')]),
    subj('tj', 'Таджикский язык', [sig.strong('tj')]),
    subj('hist', 'История', [sig.none('hist')], 0),
  ])

describe('ruPlural', () => {
  it.each([
    [1, 'урок'], [2, 'урока'], [4, 'урока'], [5, 'уроков'], [11, 'уроков'], [12, 'уроков'], [14, 'уроков'],
    [21, 'урок'], [22, 'урока'], [25, 'уроков'], [101, 'урок'], [111, 'уроков'],
  ])('%i → %s', (n, word) => {
    expect(ruPlural(n, 'урок', 'урока', 'уроков')).toBe(word)
  })
})

describe('Текст вердикта: русский', () => {
  it('полный текст: акцент, что хорошо, ещё заметили', () => {
    expect(renderVerdictText('ru', rich())).toBe(
      [
        'Итоги за октябрь: Алишер',
        '',
        'Сделайте акцент на предмет «Математика»:',
        '• По предмету «Математика» средний балл за месяц — 3,3 из 5 (6 оценок).',
        '• По предмету «Математика» не сдано 4 из 10 заданий.',
        'Рекомендуем уделить этому предмету больше внимания дома.',
        '',
        'Что идёт хорошо:',
        '• Отлично идёт предмет «Таджикский язык»: средний балл 4,8 из 5 уже два месяца подряд. Похвалите ребёнка.',
        '',
        'Ещё заметили:',
        '• По предмету «Русский язык» средний балл снизился с 4,5 до 3,9.',
        '• По предмету «История» за последние 3 недели нет оценок — спросите учителя.',
        '',
        'Если есть вопросы, напишите классному руководителю.',
      ].join('\n'),
    )
  })

  it('примеры владельца звучат так же: падение, ДЗ, пропуски, похвала', () => {
    const t = renderVerdictText('ru', input([
      subj('rus', 'Русский язык', [sig.drop('rus')]),
      subj('eng', 'Английский язык', [sig.hw('eng')]),
      subj('pe', 'Физкультура', [sig.abs('pe')]),
    ]))
    expect(t).toContain('По предмету «Русский язык» средний балл снизился с 4,5 до 3,9.')
    expect(t).toContain('По предмету «Английский язык» не сдано 4 из 10 заданий.')
    // пропуски — честно: по расписанию, а не «пропустил 3 урока физики»
    expect(t).toContain('в дни, когда ребёнка не было в школе, по расписанию было 3 урока.')
  })

  it('«низкие оценки подряд» — отдельное предложение без числа среднего', () => {
    const t = renderVerdictText('ru', input([subj('math', 'Математика', [sig.badRun('math')])]))
    expect(t).toContain('По предмету «Математика» были две низкие оценки подряд.')
    expect(t).not.toContain('средний балл за месяц')
  })

  it('согласование: 1 оценка, 21 задания, 11 заданий', () => {
    const one = renderVerdictText('ru', input([subj('m', 'Математика', [sig.weak('m', 3, 1)])]))
    expect(one).toContain('(1 оценка)')
    const hw21 = renderVerdictText('ru', input([subj('m', 'Математика', [sig.hw('m', 7, 21)])]))
    expect(hw21).toContain('не сдано 7 из 21 задания.')
    const hw11 = renderVerdictText('ru', input([subj('m', 'Математика', [sig.hw('m', 4, 11)])]))
    expect(hw11).toContain('не сдано 4 из 11 заданий.')
  })

  it('период «нет оценок»: 3 недели, 2 недели, 5 недель, 10 дней', () => {
    const at = (days: number) => renderVerdictText('ru', input([subj('h', 'История', [sig.none('h')], 0)], { noGradesDays: days }))
    expect(at(21)).toContain('за последние 3 недели')
    expect(at(14)).toContain('за последние 2 недели')
    expect(at(35)).toContain('за последние 5 недель')
    expect(at(10)).toContain('за последние 10 дней')
  })

  it('нет проблем: спокойный текст, ничего не выдумываем', () => {
    const t = renderVerdictText('ru', input([subj('math', 'Математика', [])]))
    expect(t).toBe(
      'Итоги за октябрь: Алишер\n\n' +
        'По журналу, посещаемости и домашним заданиям поводов для беспокойства не заметили.\n\n' +
        'Если есть вопросы, напишите классному руководителю.',
    )
  })

  it('только похвала: хвалим и добавляем спокойную строку', () => {
    const t = renderVerdictText('ru', input([subj('tj', 'Таджикский язык', [sig.strong('tj')])]))
    expect(t).toContain('Что идёт хорошо:')
    expect(t).toContain('поводов для беспокойства не заметили')
    expect(t).not.toContain('акцент')
  })

  it('«нет оценок у всего класса» — без акцента и без «всё хорошо», мягкая формулировка', () => {
    const t = renderVerdictText('ru', input([subj('h', 'История', [sig.none('h', 'class')], 0)]))
    expect(t).not.toContain('Сделайте акцент')
    expect(t).not.toContain('поводов для беспокойства')
    expect(t).toContain('Ещё заметили:')
    expect(t).toContain('это касается всего класса')
  })

  it('«Ещё заметили»: не больше двух пунктов, остальное — у классного руководителя', () => {
    const t = renderVerdictText('ru', input([
      subj('math', 'Математика', [sig.weak('math'), sig.hw('math')]),
      subj('rus', 'Русский язык', [sig.drop('rus')]),
      subj('eng', 'Английский язык', [sig.hw('eng')]),
      subj('pe', 'Физкультура', [sig.abs('pe')]),
    ]))
    const other = t.split('Ещё заметили:')[1]
    expect(other.match(/•/g)).toHaveLength(2)
    expect(other).toContain('Подробности — у классного руководителя.')
  })

  it('месяц идёт: в заголовке «на 18.11»', () => {
    const t = renderVerdictText('ru', input([subj('m', 'Математика', [])], { month: '2026-11', asOf: '2026-11-18', studentName: 'Мадина' }))
    expect(t.split('\n')[0]).toBe('Итоги за ноябрь: Мадина (на 18.11)')
  })

  it('все двенадцать месяцев названы; пустое имя заменяется', () => {
    const names = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
    names.forEach((name, i) => {
      const month = `2026-${String(i + 1).padStart(2, '0')}`
      const t = renderVerdictText('ru', input([subj('m', 'Математика', [])], { month, asOf: monthEnd(month), studentName: ' ' }))
      expect(t.split('\n')[0]).toBe(`Итоги за ${name}: ученик`)
    })
  })

  it('десятибалльная шкала: «из 10»', () => {
    const t = renderVerdictText('ru', input([subj('m', 'Математика', [sig.weak('m', 5.4, 10)])], { scaleMax: 10 }))
    expect(t).toContain('средний балл за месяц — 5,4 из 10 (10 оценок).')
  })
})

describe('Текст вердикта: таджикский (черновик перевода)', () => {
  it('те же факты и цифры, что в русском', () => {
    const t = renderVerdictText('tg', rich())
    expect(t.split('\n')[0]).toBe('Натиҷаҳои моҳи октябр: Алишер')
    expect(t).toContain('Ба фанни «Математика» таваҷҷуҳи бештар диҳед:')
    expect(t).toContain('баҳои миёнаи моҳ — 3,3 аз 5 (6 баҳо)')
    expect(t).toContain('4 аз 10 вазифаи хонагӣ супорида нашудааст')
    expect(t).toContain('аз 4,5 то 3,9')
    expect(t).toContain('дар 3 ҳафтаи охир баҳо гузошта нашудааст')
    expect(t).toContain('Фанни «Таджикский язык» хуб пеш меравад')
  })

  it('спокойный текст и заголовок месяца, который идёт', () => {
    const t = renderVerdictText('tg', input([subj('m', 'Математика', [])], { month: '2026-11', asOf: '2026-11-18' }))
    expect(t.split('\n')[0]).toBe('Натиҷаҳои моҳи ноябр: Алишер (то 18.11)')
    expect(t).toContain('ҷои нигаронӣ ба назар нарасид')
  })
})

describe('Числа в тексте не выдуманы', () => {
  const scenarios: [string, VerdictTextInput][] = [
    ['полный случай', rich()],
    ['низкие оценки подряд', input([subj('m', 'Математика', [sig.badRun('m')])])],
    ['пропуски', input([subj('pe', 'Физкультура', [sig.abs('pe', 7)])])],
    ['шкала 10', input([subj('m', 'Математика', [sig.weak('m', 5.4, 10), sig.drop('m', 8, 6.9)])], { scaleMax: 10 })],
    ['месяц идёт', input([subj('m', 'Математика', [sig.hw('m', 3, 3)])], { month: '2026-11', asOf: '2026-11-18' })],
    ['окно 14 дней', input([subj('h', 'История', [sig.none('h')], 0)], { noGradesDays: 14 })],
  ]

  it.each(scenarios)('%s: каждое число из сигналов', (_name, scenario) => {
    const allowed = groundedNumbers(scenario)
    for (const lang of ['ru', 'tg'] as const) {
      const text = renderVerdictText(lang, scenario)
      const stray = numbersIn(text).filter((n) => !allowed.has(n))
      expect(stray).toEqual([])
    }
  })

  it('выдуманное число ловится: проверка пригодится для текста от ИИ', () => {
    const scenario = rich()
    const allowed = groundedNumbers(scenario)
    const invented = renderVerdictText('ru', scenario).replace('3,3 из 5', '3,9 из 5').replace('4 из 10', '7 из 10')
    expect(numbersIn(invented).filter((n) => !allowed.has(n))).toEqual(['7'])
  })

  it('numbersIn понимает запятую и точку', () => {
    expect(numbersIn('с 4,5 до 3.9, 21 день')).toEqual(['4.5', '3.9', '21'])
  })
})

describe('Тон и сравнение с другими', () => {
  it('ни рейтинга, ни одноклассников, ни ярлыков', () => {
    for (const lang of ['ru', 'tg'] as const) {
      const text = renderVerdictText(lang, rich())
      expect(text).not.toMatch(/рейтинг|одноклассник|лучш|худш|слаб(ый|ая) учени|ленив|место в классе|беҳтарин|ҳамсинф|танбал/i)
    }
  })
})

describe('hasSomethingToSay', () => {
  it('сигналы или оценки за месяц — есть что сказать', () => {
    expect(hasSomethingToSay({ subjects: [subj('m', 'Математика', [], 3)] })).toBe(true)
    expect(hasSomethingToSay({ subjects: [subj('h', 'История', [sig.none('h')], 0)] })).toBe(true)
  })

  it('ни оценок, ни сигналов (или ученик заблокирован) — вердикт не строим', () => {
    expect(hasSomethingToSay({ subjects: [] })).toBe(false)
    expect(hasSomethingToSay({ subjects: [subj('m', 'Математика', [], 0)] })).toBe(false)
  })
})
