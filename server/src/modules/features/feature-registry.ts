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
  | 'homeroom'
  // Учебный процесс
  | 'attendance'
  | 'schedule'
  | 'menu'
  | 'grades'
  | 'homework'
  | 'diary'
  | 'portal'
  | 'library'
  | 'lesson_materials'
  | 'quiz'
  | 'exam_prep'
  | 'games'
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
  /** Значение, пока владелец не переопределил его для учреждения. */
  defaultEnabled: boolean
}


export const FEATURES: Record<FeatureKey, FeatureDef> = {
  // ─── Состав ──────────────────────────────────────────────────────
  groups: {
    label: 'Классы',
    description: 'Список классов, состав, классные руководители и учителя',
    group: 'composition',
    defaultEnabled: true,
  },
  students: {
    label: 'Ученики',
    description: 'Карточки учеников, родители, доступ учеников, импорт',
    group: 'composition',
    defaultEnabled: true,
  },
  teachers: {
    label: 'Учителя',
    description: 'Учётные записи учителей',
    group: 'composition',
    defaultEnabled: true,
  },
  subjects: {
    label: 'Предметы',
    description: 'Учебные предметы школы',
    group: 'composition',
    defaultEnabled: true,
  },
  homeroom: {
    label: 'Классный руководитель',
    description: 'Классный руководитель: сводка по своему классу и связь с родителями',
    group: 'composition',
    defaultEnabled: true,
  },
  terms: {
    label: 'Учебные периоды',
    description: 'Четверти, триместры, полугодия',
    group: 'composition',
    defaultEnabled: true,
  },

  // ─── Учебный процесс ─────────────────────────────────────────────
  attendance: {
    label: 'Посещаемость',
    description: 'Ежедневная отметка присутствия',
    group: 'studying',
    defaultEnabled: true,
  },
  schedule: {
    label: 'Расписание',
    description: 'Расписание уроков',
    group: 'studying',
    defaultEnabled: true,
  },
  menu: {
    label: 'Меню питания',
    description: 'Меню школьной столовой',
    group: 'studying',
    defaultEnabled: false,
  },
  grades: {
    label: 'Журнал оценок',
    description: 'Электронный журнал: оценки учеников',
    group: 'studying',
    defaultEnabled: true,
  },
  homework: {
    label: 'Домашние задания',
    description: 'Домашние задания по предметам',
    group: 'studying',
    defaultEnabled: true,
  },
  diary: {
    label: 'Дневник',
    description: 'Дневник учителя: заметки об ученике для родителей',
    group: 'studying',
    defaultEnabled: true,
  },

  portal: {
    label: 'Кабинет ученика',
    description: 'Свой вход для учеников: домашние задания, оценки, расписание',
    group: 'studying',
    defaultEnabled: true,
  },

  library: {
    label: 'Библиотека',
    description: 'Книги, статьи, видео и ссылки для учеников: учителя добавляют, ученики читают',
    group: 'studying',
    defaultEnabled: true,
  },
  lesson_materials: {
    label: 'Материалы к уроку',
    description: 'Учитель выкладывает классу файл, ссылку или текст урока; хранится 30 дней и удаляется сам',
    group: 'studying',
    defaultEnabled: true,
  },
  quiz: {
    label: 'Квизы',
    description: 'Тесты с автоматической проверкой: учителя создают, ученики проходят',
    group: 'studying',
    defaultEnabled: true,
  },
  exam_prep: {
    label: 'Подготовка к экзаменам',
    description: 'Направления подготовки (название задаёт школа) и квизы по ним с прогрессом ученика',
    group: 'studying',
    defaultEnabled: true,
  },
  games: {
    label: 'Игры для развития мозга',
    description: 'Память, устный счёт, внимание: мини-игры и рейтинг класса',
    group: 'studying',
    defaultEnabled: true,
  },

  // ─── Финансы (по умолчанию выключены) ────────────────────────────
  payments: {
    label: 'Оплата',
    description: 'Платежи родителей, долги, напоминания об оплате',
    group: 'finance',
    defaultEnabled: false,
  },
  expenses: {
    label: 'Расходы и доп. доходы',
    description: 'Учёт расходов и дополнительных доходов учреждения',
    group: 'finance',
    defaultEnabled: false,
  },
  analytics: {
    label: 'Аналитика',
    description: 'Финансовые KPI, прибыльность групп, тренды',
    group: 'finance',
    defaultEnabled: false,
  },

  // ─── Персонал ────────────────────────────────────────────────────
  staff: {
    label: 'Сотрудники',
    description: 'Карточки сотрудников и ФОТ',
    group: 'hr',
    defaultEnabled: true,
  },
  timesheet: {
    label: 'Табель и check-in',
    description: 'Учёт рабочего времени учителей, отметка по геозоне, зарплата',
    group: 'hr',
    defaultEnabled: true,
  },

  // ─── Общение ─────────────────────────────────────────────────────
  meetings: {
    label: 'Собрания',
    description: 'Родительские собрания',
    group: 'communication',
    defaultEnabled: true,
  },
  chat: {
    label: 'Чат с родителями',
    description: 'Переписка родителей с учителями и администрацией',
    group: 'communication',
    defaultEnabled: true,
  },
}

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[]

export function isFeatureKey(key: string): key is FeatureKey {
  return Object.prototype.hasOwnProperty.call(FEATURES, key)
}

/** Значение раздела: переопределение школы, а если его нет — значение по умолчанию. */
export function resolveFeature(key: FeatureKey, override: boolean | undefined): boolean {
  return override ?? FEATURES[key].defaultEnabled
}
