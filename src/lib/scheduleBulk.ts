/**
 * Пакетное добавление уроков: чистые функции для окна «Добавить уроки».
 * Время везде строкой «ЧЧ:ММ», внутри считаем минутами от полуночи.
 */

export interface LessonRow {
  key: string
  start: string | null
  end: string | null
  subjectId?: string
  teacherId?: string
  room?: string
  /** Название урока без предмета (для садика) */
  activity?: string
}

export interface Template {
  /** Сколько уроков в дне */
  count: number
  /** Начало первого урока */
  start: string
  /** Длительность урока, минут */
  lessonMin: number
  /** Перемена, минут */
  breakMin: number
}

export const DEFAULT_TEMPLATE: Template = { count: 6, start: '08:00', lessonMin: 45, breakMin: 10 }

export const MAX_LESSONS = 20

const DAY_END = 24 * 60

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function fromMinutes(min: number): string {
  const m = Math.max(0, Math.min(DAY_END - 1, Math.round(min)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** «08:00» + 45 → «08:45»; за полночь не уходит. */
export function addMinutes(hhmm: string, delta: number): string {
  return fromMinutes(toMinutes(hhmm) + delta)
}

/** Звонки по шаблону: N уроков подряд с переменами; что не влезает в сутки — отбрасывается. */
export function buildTimetable(t: Template): Array<{ start: string; end: string }> {
  const out: Array<{ start: string; end: string }> = []
  let at = toMinutes(t.start)
  for (let i = 0; i < Math.min(t.count, MAX_LESSONS); i++) {
    const end = at + t.lessonMin
    if (end >= DAY_END) break
    out.push({ start: fromMinutes(at), end: fromMinutes(end) })
    at = end + t.breakMin
  }
  return out
}

/** Время для следующего урока: после последнего плюс перемена (или начало шаблона, если уроков ещё нет). */
export function nextSlot(rows: LessonRow[], t: Template): { start: string; end: string } {
  const last = [...rows].reverse().find((r) => r.end)
  const start = last?.end ? addMinutes(last.end, t.breakMin) : t.start
  return { start, end: addMinutes(start, t.lessonMin) }
}

let seq = 0
export const newKey = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`

/** Строки уроков по шаблону; предметы, учителя и кабинеты прежних строк сохраняются по порядку. */
export function rowsFromTemplate(t: Template, previous: LessonRow[] = []): LessonRow[] {
  return buildTimetable(t).map((slot, i) => ({
    key: previous[i]?.key ?? newKey(),
    start: slot.start,
    end: slot.end,
    subjectId: previous[i]?.subjectId,
    teacherId: previous[i]?.teacherId,
    room: previous[i]?.room,
    activity: previous[i]?.activity,
  }))
}

/** Первая пара пересекающихся уроков (индексы в исходном списке) или null. */
export function findOverlap(rows: LessonRow[]): [number, number] | null {
  const timed = rows
    .map((r, i) => ({ i, s: r.start ? toMinutes(r.start) : NaN, e: r.end ? toMinutes(r.end) : NaN }))
    .filter((x) => !Number.isNaN(x.s) && !Number.isNaN(x.e))
    .sort((a, b) => a.s - b.s)
  for (let k = 1; k < timed.length; k++) {
    if (timed[k].s < timed[k - 1].e) return [timed[k - 1].i, timed[k].i]
  }
  return null
}

/** Что не так со списком уроков (текст для человека) или null, если можно отправлять. */
export function validateRows(rows: LessonRow[], needSubject: boolean): string | null {
  if (rows.length === 0) return 'Добавьте хотя бы один урок'
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const n = i + 1
    if (!r.start || !r.end) return `Урок ${n}: укажите время начала и конца`
    if (toMinutes(r.end) <= toMinutes(r.start)) return `Урок ${n}: конец должен быть позже начала`
    if (needSubject ? !r.subjectId : !r.subjectId && !r.activity?.trim()) {
      return needSubject ? `Урок ${n}: выберите предмет` : `Урок ${n}: укажите название`
    }
  }
  const o = findOverlap(rows)
  if (o) return `Уроки ${o[0] + 1} и ${o[1] + 1} пересекаются по времени`
  return null
}

export interface TeacherOption {
  id: string
  name: string
  /** Классы, к которым открыт доступ */
  groupIds?: string[]
  /** Предметы, которые открыты учителю */
  subjectIds?: string[]
}

/**
 * Автоподстановка учителя: если ровно один учитель ведёт этот класс И ему открыт этот предмет —
 * он и подставляется. Если таких нет или несколько, решает человек.
 */
export function pickTeacher(teachers: TeacherOption[], groupId: string | undefined, subjectId: string | undefined): string | undefined {
  if (!groupId || !subjectId) return undefined
  const fit = teachers.filter((t) => t.groupIds?.includes(groupId) && t.subjectIds?.includes(subjectId))
  return fit.length === 1 ? fit[0].id : undefined
}

/** Учителя, подходящие под предмет и класс, идут первыми в списке выбора. */
export function sortTeachers(teachers: TeacherOption[], groupId: string | undefined, subjectId: string | undefined): TeacherOption[] {
  const score = (t: TeacherOption) =>
    (subjectId && t.subjectIds?.includes(subjectId) ? 2 : 0) + (groupId && t.groupIds?.includes(groupId) ? 1 : 0)
  return [...teachers].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, 'ru'))
}

export interface BulkPayload {
  groupId: string
  days: number[]
  replace: boolean
  lessons: Array<{ startTime: string; endTime: string; subjectId?: string; teacherId?: string; room?: string; activity?: string }>
}

export function toPayload(groupId: string, days: number[], rows: LessonRow[], replace: boolean): BulkPayload {
  return {
    groupId,
    days: [...days].sort((a, b) => a - b),
    replace,
    lessons: rows.map((r) => ({
      startTime: r.start!,
      endTime: r.end!,
      subjectId: r.subjectId || undefined,
      teacherId: r.teacherId || undefined,
      room: r.room?.trim() || undefined,
      activity: r.subjectId ? undefined : r.activity?.trim() || undefined,
    })),
  }
}
