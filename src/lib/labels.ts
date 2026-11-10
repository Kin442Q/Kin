import { localizeCopy } from '../i18n/uiText'
/**
 * Подписи интерфейса. Платформа только для школ, поэтому набор один.
 * Парные с mobile/src/theme/labels.ts.
 */
export interface UiLabels {
  isSchool: boolean
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

const SCHOOL_LABELS: UiLabels = localizeCopy({
  isSchool: true,
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
})

export function labels(): UiLabels {
  return SCHOOL_LABELS
}

export function cap(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}
