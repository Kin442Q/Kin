import type { SubmissionStatus } from '@prisma/client'

/** Шаблоны сообщений родителям о домашнем задании. */
export type NoticeTemplate = 'NOT_DONE' | 'PARTIAL' | 'REMINDER'

export interface NoticeInput {
  template: NoticeTemplate
  /** Имя ученика (как обращаемся к родителю), например «Алишер». */
  studentName: string
  gender?: 'MALE' | 'FEMALE' | null
  subject: string
  title: string
  dueDate: Date
  /** Комментарий учителя — добавляется в конец сообщения. */
  note?: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** dueDate хранится как календарная дата (полночь UTC) — читаем её UTC-геттерами. */
export const formatDueDate = (d: Date) =>
  `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`

/** Окончание глагола по полу: «выполнил» / «выполнила» / «выполнил(а)». */
const ending = (g: NoticeInput['gender']) => (g === 'MALE' ? '' : g === 'FEMALE' ? 'а' : '(а)')

/** Какой шаблон подходит ученику по его текущему статусу. */
export function templateForStatus(status: SubmissionStatus | null | undefined): NoticeTemplate {
  if (status === 'NOT_DONE') return 'NOT_DONE'
  if (status === 'PARTIAL') return 'PARTIAL'
  return 'REMINDER'
}

export function buildHomeworkNotice(i: NoticeInput): string {
  const task = `по предмету «${i.subject}»: «${i.title}» (срок — ${formatDueDate(i.dueDate)})`
  const e = ending(i.gender)

  let text: string
  switch (i.template) {
    case 'NOT_DONE':
      text = `Здравствуйте! Ваш ребёнок ${i.studentName} не выполнил${e} домашнее задание ${task}. Просим обратить внимание.`
      break
    case 'PARTIAL':
      text = `Здравствуйте! Ваш ребёнок ${i.studentName} выполнил${e} домашнее задание ${task} не полностью. Просим помочь довести его до конца.`
      break
    case 'REMINDER':
      text = `Здравствуйте! Напоминаем: ${i.subject} — задано «${i.title}», срок сдачи ${formatDueDate(i.dueDate)}. ${i.studentName} пока не отметил${e} выполнение.`
      break
  }

  const note = i.note?.trim()
  return note ? `${text}\n\nКомментарий учителя: ${note}` : text
}
