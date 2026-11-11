import { localizeCopy } from '../i18n/uiText'
/**
 * Подписи интерфейса. Платформа только для школ: «школа / класс / ученик / учитель».
 * Парные с web/src/lib/labels.ts.
 */

export interface UiLabels {
  isSchool: boolean
  /** «школа» */
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

/** Капитализация: «группа» → «Группа». */
export function cap(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}
