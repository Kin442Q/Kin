/**
 * Куда вести по уведомлению: одна таблица на тап по push-баннеру и на тап по строке в списке «Оповещения».
 * data.kind задаёт сервер (server/src/modules/**): chat, absence, grade, homework, payment, diary, meeting, notice.
 *
 * Возвращает маршрут для navigation.navigate(name, params) либо null, если для этой роли открывать нечего.
 */
export type NoticeTarget = { name: string; params?: Record<string, unknown> }

export function noticeTarget(data: unknown, role?: string | null): NoticeTarget | null {
  if (!data || typeof data !== 'object') return null
  const kind = (data as { kind?: unknown }).kind
  const r = String(role ?? '').toUpperCase()
  const isParent = r === 'PARENT'
  const isTeacher = r === 'TEACHER'

  if (kind === 'chat') {
    if (isParent) return { name: 'ParentChat' }
    if (isTeacher) return { name: 'TeacherChat' }
    return null
  }
  if (isParent) {
    // Для родителя — главная (отсутствие, дневник, оплата, собрание, сообщение школы)
    if (kind === 'absence' || kind === 'diary' || kind === 'payment' || kind === 'meeting' || kind === 'notice') {
      return { name: 'Tabs', params: { screen: 'ParentHome' } }
    }
    // Школьные — оценки/домашка
    if (kind === 'grade' || kind === 'homework') {
      return { name: 'Tabs', params: { screen: 'ParentGrades' } }
    }
  }
  // Учитель — домашние задания
  if (isTeacher && kind === 'homework') {
    return { name: 'Tabs', params: { screen: 'TeacherHomework' } }
  }
  return null
}
