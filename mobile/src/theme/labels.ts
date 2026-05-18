/**
 * Лейблы UI в зависимости от типа учреждения.
 * Используем как `labels(type).group` — без if/else в компонентах.
 *
 * Для садика: «садик / группа / ребёнок / воспитатель»
 * Для школы:  «школа / класс / ученик / учитель»
 */
import type { InstitutionType } from '../api/auth'

export interface UiLabels {
  /** Тип учреждения как существительное: «садик» / «школа» */
  institution: string
  /** Существительное группы: «группа» / «класс» */
  group: string
  /** «в группу» / «в класс» (предложный) */
  inGroup: string
  /** Список групп — мн.ч.: «Группы» / «Классы» */
  groups: string
  /** Ребёнок / ученик */
  student: string
  /** Дети / ученики */
  students: string
  /** Воспитатель / учитель */
  teacher: string
  /** Воспитатели / учителя */
  teachers: string
  /** Родитель / родитель (одинаковое слово) */
  parent: string
  /** Возрастной диапазон / класс (для отображения в карточке группы) */
  classDescriptor: string
}

const KINDERGARTEN_LABELS: UiLabels = {
  institution: 'садик',
  group: 'группа',
  inGroup: 'в группу',
  groups: 'Группы',
  student: 'ребёнок',
  students: 'Дети',
  teacher: 'воспитатель',
  teachers: 'Воспитатели',
  parent: 'родитель',
  classDescriptor: 'возрастная группа',
}

const SCHOOL_LABELS: UiLabels = {
  institution: 'школа',
  group: 'класс',
  inGroup: 'в класс',
  groups: 'Классы',
  student: 'ученик',
  students: 'Ученики',
  teacher: 'учитель',
  teachers: 'Учителя',
  parent: 'родитель',
  classDescriptor: 'класс',
}

/** Возвращает набор лейблов под тип учреждения. По умолчанию — садик. */
export function labels(type?: InstitutionType | null): UiLabels {
  return type === 'SCHOOL' ? SCHOOL_LABELS : KINDERGARTEN_LABELS
}

/** Капитализация: «группа» → «Группа». */
export function cap(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}
