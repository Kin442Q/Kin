/**
 * Лейблы UI в зависимости от типа учреждения. Парные с mobile/src/theme/labels.ts.
 */
import type { InstitutionType } from '../types'

export interface UiLabels {
  institution: string
  group: string
  inGroup: string
  groups: string
  student: string
  students: string
  teacher: string
  teachers: string
  parent: string
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

export function labels(type?: InstitutionType | null): UiLabels {
  return type === 'SCHOOL' ? SCHOOL_LABELS : KINDERGARTEN_LABELS
}

export function cap(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}
