import { buildHomeworkNotice, formatDueDate, templateForStatus } from './homework-notice'

const base = {
  studentName: 'Алишер',
  gender: 'MALE' as const,
  subject: 'Математика',
  title: 'Задачи 5–7',
  dueDate: new Date('2026-11-05'),
}

describe('buildHomeworkNotice', () => {
  it('NOT_DONE: предмет, задание, срок и глагол по полу (мальчик)', () => {
    expect(buildHomeworkNotice({ ...base, template: 'NOT_DONE' })).toBe(
      'Здравствуйте! Ваш ребёнок Алишер не выполнил домашнее задание по предмету «Математика»: «Задачи 5–7» (срок — 05.11.2026). Просим обратить внимание.',
    )
  })

  it('NOT_DONE: девочка → «не выполнила»', () => {
    expect(
      buildHomeworkNotice({ ...base, studentName: 'Мадина', gender: 'FEMALE', template: 'NOT_DONE' }),
    ).toContain('Мадина не выполнила домашнее задание')
  })

  it('пол неизвестен → «не выполнил(а)»', () => {
    expect(buildHomeworkNotice({ ...base, gender: null, template: 'NOT_DONE' })).toContain(
      'не выполнил(а) домашнее задание',
    )
  })

  it('PARTIAL: «не полностью»', () => {
    const t = buildHomeworkNotice({ ...base, template: 'PARTIAL' })
    expect(t).toContain('выполнил домашнее задание')
    expect(t).toContain('не полностью')
  })

  it('REMINDER: напоминание со сроком', () => {
    const t = buildHomeworkNotice({ ...base, template: 'REMINDER' })
    expect(t).toContain('Напоминаем')
    expect(t).toContain('срок сдачи 05.11.2026')
    expect(t).toContain('Алишер пока не отметил выполнение')
  })

  it('комментарий учителя добавляется отдельным абзацем, пустой — нет', () => {
    const withNote = buildHomeworkNotice({ ...base, template: 'NOT_DONE', note: '  Нет второй задачи ' })
    expect(withNote.endsWith('\n\nКомментарий учителя: Нет второй задачи')).toBe(true)
    expect(buildHomeworkNotice({ ...base, template: 'NOT_DONE', note: '   ' })).not.toContain('Комментарий')
    expect(buildHomeworkNotice({ ...base, template: 'NOT_DONE', note: null })).not.toContain('Комментарий')
  })
})

describe('templateForStatus', () => {
  it('выбирает шаблон по статусу', () => {
    expect(templateForStatus('NOT_DONE')).toBe('NOT_DONE')
    expect(templateForStatus('PARTIAL')).toBe('PARTIAL')
    expect(templateForStatus('SUBMITTED')).toBe('REMINDER')
    expect(templateForStatus('DONE')).toBe('REMINDER')
    expect(templateForStatus(null)).toBe('REMINDER')
    expect(templateForStatus(undefined)).toBe('REMINDER')
  })
})

describe('formatDueDate', () => {
  it('читает календарную дату по UTC (без сдвига часового пояса)', () => {
    expect(formatDueDate(new Date('2026-01-09'))).toBe('09.01.2026')
  })
})
