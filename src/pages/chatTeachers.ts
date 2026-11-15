import type { ChatTeacher, ChatTeachers } from '../api/chatApi'

/**
 * Кому из учителей класса пишет родитель. Выбор не должен «ломаться» на пустом или
 * устаревшем списке: если выбранного учителя уже нет, берём того, кого предложил сервер.
 */
export function pickTeacherId(
  list: Pick<ChatTeachers, 'teachers' | 'defaultTeacherId'> | null | undefined,
  preferredId?: string | null,
): string | null {
  const teachers = list?.teachers ?? []
  if (teachers.length === 0) return null
  if (preferredId && teachers.some((t) => t.id === preferredId)) return preferredId
  const byServer = teachers.find((t) => t.id === list?.defaultTeacherId)
  return (byServer ?? teachers[0]).id
}

/** Подпись учителя в выборе: имя, предметы, у классного — отметка. */
export function teacherOptionText(
  t: Pick<ChatTeacher, 'fullName' | 'isHomeroom' | 'subjects'>,
  homeroomLabel: string,
): string {
  const extra = [t.isHomeroom ? homeroomLabel : null, t.subjects.length ? t.subjects.join(', ') : null]
    .filter(Boolean)
    .join(' · ')
  return extra ? `${t.fullName} — ${extra}` : t.fullName
}
