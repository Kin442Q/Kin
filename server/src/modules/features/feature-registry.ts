import type { InstitutionType } from '@prisma/client'

/**
 * Реестр разделов (feature flags) платформы.
 *
 * Единый источник правды о том, какие разделы есть в системе. Владелец
 * платформы включает/выключает их для каждого учреждения отдельно
 * (таблица KindergartenFeature хранит только переопределения).
 *
 * Как добавить раздел:
 *   1. Добавить ключ в FeatureKey и описание в FEATURES.
 *   2. Повесить @Feature('<key>') на контроллер/ручки бэкенда.
 *   3. В вебе — `feature: '<key>'` у пункта меню (AppSidebar) и у роута (App.tsx).
 *
 * Права ролей (@Roles) остаются отдельной проверкой: раздел должен быть
 * включён для учреждения И роль должна иметь доступ к ручке.
 */
export type FeatureKey =
  // Состав
  | 'groups'
  | 'students'
  | 'teachers'
  | 'subjects'
  | 'terms'
  // Учебный процесс
  | 'attendance'
  | 'schedule'
  | 'menu'
  | 'grades'
  | 'homework'
  | 'diary'
  // Финансы
  | 'payments'
  | 'expenses'
  | 'analytics'
  // Персонал
  | 'staff'
  | 'timesheet'
  // Общение
  | 'meetings'
  | 'chat'

export type FeatureGroup =
  | 'composition'
  | 'studying'
  | 'finance'
  | 'hr'
  | 'communication'

export interface FeatureDef {
  label: string
  description: string
  group: FeatureGroup
  /** Для каких типов учреждения раздел существует вообще. */
  types: InstitutionType[]
  /** Значение, пока владелец не переопределил его для учреждения. */
  defaultEnabled: boolean
}

const BOTH: InstitutionType[] = ['KINDERGARTEN', 'SCHOOL']
const SCHOOL: InstitutionType[] = ['SCHOOL']
const KINDERGARTEN: InstitutionType[] = ['KINDERGARTEN']

export const FEATURES: Record<FeatureKey, FeatureDef> = {
  // ─── Состав ──────────────────────────────────────────────────────
  groups: {
    label: 'Группы и классы',
    description: 'Список групп/классов, состав и назначение учителей',
    group: 'composition',
    types: BOTH,
    defaultEnabled: true,
  },
  students: {
    label: 'Дети и ученики',
    description: 'Карточки детей/учеников, родители, импорт',
    group: 'composition',
    types: BOTH,
    defaultEnabled: true,
  },
  teachers: {
    label: 'Учителя',
    description: 'Учётные записи учителей и воспитателей',
    group: 'composition',
    types: BOTH,
    defaultEnabled: true,
  },
  subjects: {
    label: 'Предметы',
    description: 'Учебные предметы школы',
    group: 'composition',
    types: SCHOOL,
    defaultEnabled: true,
  },
  terms: {
    label: 'Учебные периоды',
    description: 'Четверти, триместры, полугодия',
    group: 'composition',
    types: SCHOOL,
    defaultEnabled: true,
  },

  // ─── Учебный процесс ─────────────────────────────────────────────
  attendance: {
    label: 'Посещаемость',
    description: 'Ежедневная отметка присутствия',
    group: 'studying',
    types: BOTH,
    defaultEnabled: true,
  },
  schedule: {
    label: 'Расписание',
    description: 'Расписание уроков / занятий',
    group: 'studying',
    types: BOTH,
    defaultEnabled: true,
  },
  menu: {
    label: 'Меню питания',
    description: 'Меню питания детского сада',
    group: 'studying',
    types: KINDERGARTEN,
    defaultEnabled: true,
  },
  grades: {
    label: 'Журнал оценок',
    description: 'Электронный журнал: оценки учеников',
    group: 'studying',
    types: SCHOOL,
    defaultEnabled: true,
  },
  homework: {
    label: 'Домашние задания',
    description: 'Домашние задания по предметам',
    group: 'studying',
    types: SCHOOL,
    defaultEnabled: true,
  },
  diary: {
    label: 'Дневник',
    description: 'Дневник учителя: заметки о ребёнке для родителей',
    group: 'studying',
    types: BOTH,
    defaultEnabled: true,
  },

  // ─── Финансы (по умолчанию выключены) ────────────────────────────
  payments: {
    label: 'Оплата',
    description: 'Платежи родителей, долги, напоминания об оплате',
    group: 'finance',
    types: BOTH,
    defaultEnabled: false,
  },
  expenses: {
    label: 'Расходы и доп. доходы',
    description: 'Учёт расходов и дополнительных доходов учреждения',
    group: 'finance',
    types: BOTH,
    defaultEnabled: false,
  },
  analytics: {
    label: 'Аналитика',
    description: 'Финансовые KPI, прибыльность групп, тренды',
    group: 'finance',
    types: BOTH,
    defaultEnabled: false,
  },

  // ─── Персонал ────────────────────────────────────────────────────
  staff: {
    label: 'Сотрудники',
    description: 'Карточки сотрудников и ФОТ',
    group: 'hr',
    types: BOTH,
    defaultEnabled: true,
  },
  timesheet: {
    label: 'Табель и check-in',
    description: 'Учёт рабочего времени учителей, отметка по геозоне, зарплата',
    group: 'hr',
    types: BOTH,
    defaultEnabled: true,
  },

  // ─── Общение ─────────────────────────────────────────────────────
  meetings: {
    label: 'Собрания',
    description: 'Родительские собрания',
    group: 'communication',
    types: BOTH,
    defaultEnabled: true,
  },
  chat: {
    label: 'Чат с родителями',
    description: 'Переписка родителей с учителями и администрацией',
    group: 'communication',
    types: BOTH,
    defaultEnabled: true,
  },
}

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[]

export function isFeatureKey(key: string): key is FeatureKey {
  return Object.prototype.hasOwnProperty.call(FEATURES, key)
}

/** Значение раздела при заданных типе учреждения и переопределении. */
export function resolveFeature(
  key: FeatureKey,
  type: InstitutionType,
  override: boolean | undefined,
): boolean {
  const def = FEATURES[key]
  if (!def.types.includes(type)) return false
  return override ?? def.defaultEnabled
}
