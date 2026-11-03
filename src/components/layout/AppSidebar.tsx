import { Menu, Tooltip } from 'antd'
import {
  School,
  LayoutGrid,
  Baby,
  ClipboardCheck,
  Wallet,
  PieChart,
  TrendingUp,
  Users,
  Calendar,
  Megaphone,
  UtensilsCrossed,
  Settings,
  Clock,
  GraduationCap,
  BookOpen,
  BookMarked,
  Home as HomeIcon,
  MapPin,
  CalendarRange,
  Library,
  ListChecks,
  Target,
  Gamepad2,
  MessageCircle,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { useLabels } from '../../hooks/useLabels'
import { hasFeature, type FeatureKey } from '../../lib/features'
import { SP, SproutLogo, SproutBalloons } from '../sprout'
import type { Role } from '../../types'

/**
 * Структура сайдбара (платформа только для школ):
 *
 * Владелец платформы (SUPER_ADMIN без kindergartenId):
 *   ▸ Платформа: Школы, Настройки
 *
 * Директор школы (SUPER_ADMIN/admin школы):
 *   ▸ Основное: Главная
 *   ▸ Состав: Классы, Ученики, Предметы, Учебные периоды
 *   ▸ Учебный процесс: Расписание уроков, Журнал оценок, Домашние задания, Посещаемость, Сводка класса
 *   ▸ Финансы (по умолчанию выключены): Оплата, Расходы, Аналитика
 *   ▸ Персонал: Сотрудники, Табель
 *   ▸ Общение: Собрания, Чат
 *   ▸ Система: Настройки
 *
 * Учитель (TEACHER):
 *   ▸ Мой кабинет
 *   ▸ Мой класс: Ученики, Посещаемость, Сводка класса (если классный руководитель)
 *   ▸ Учебный процесс: Журнал оценок, Домашние задания, Расписание уроков
 *   ▸ Общение: Собрания, Чат
 *
 * Родитель (PARENT): Мой ребёнок — главная, расписание, оценки и ДЗ, оплаты, чат
 * Ученик (STUDENT): Мой кабинет — главная, домашние задания, оценки, библиотека, квизы,
 *   подготовка к экзаменам, игры для мозга
 * Учитель и директор: «Библиотека» и «Квизы» (с направлениями подготовки) в разделе «Учебный процесс»
 *
 * Пункты прячутся по разделам платформы (feature): владелец включает и
 * выключает их для каждой школы.
 */

type SectionKey =
  | 'platform'
  | 'main'
  | 'composition'
  | 'studying'
  | 'finance'
  | 'hr'
  | 'system'
  | 'my-group'
  | 'communication'
  | 'parent'
  | 'student'

interface NavEntry {
  key: string
  /** Текст пункта — статический или функция от лейблов институции (для «Группы»/«Классы») */
  label: string | ((L: { groups: string; students: string }) => string)
  icon: ReactNode
  /** Класс из index.css: sp-icon-mint / sp-icon-blue / ... */
  accentClass: string
  roles: Role[]
  /** Раздел платформы: пункт скрыт, если раздел выключен для учреждения */
  feature?: FeatureKey
  /** Показывать, только если учитель — классный руководитель хотя бы одного класса */
  requiresHomeroom?: boolean
  /** Если true — показывается только глобальному владельцу платформы */
  globalOnly?: boolean
  /** Если false — НЕ показывается глобальному владельцу (он не в одном из учреждений) */
  hiddenForGlobalOwner?: boolean
  /** В какой раздел поместить */
  section: SectionKey
}

const ICON_SIZE = 18

const SECTION_TITLES: Record<SectionKey, string> = {
  platform: 'Платформа',
  main: 'Основное',
  composition: 'Состав',
  studying: 'Учебный процесс',
  finance: 'Финансы',
  hr: 'Персонал',
  system: 'Система',
  'my-group': 'Мой класс',
  communication: 'Общение',
  parent: 'Мой ребёнок',
  student: 'Мой кабинет',
}

const SECTION_ORDER: SectionKey[] = [
  'platform',
  'main',
  'composition',
  'my-group',
  'parent',
  'student',
  'studying',
  'finance',
  'hr',
  'communication',
  'system',
]

const NAV: NavEntry[] = [
  // ─── Платформа (только глобальный владелец) ──────────────────────
  {
    key: '/admin/schools',
    label: 'Школы',
    icon: <School size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN'],
    globalOnly: true,
    section: 'platform',
  },

  // ─── Основное ────────────────────────────────────────────────────
  {
    key: '/teacher/dashboard',
    label: 'Мой кабинет',
    icon: <Clock size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['TEACHER', 'teacher'],
    section: 'main',
  },
  {
    key: '/admin/dashboard',
    label: 'Главная',
    icon: <HomeIcon size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'main',
  },

  // ─── Состав (админ) ──────────────────────────────────────────────
  {
    key: '/admin/groups',
    feature: 'groups',
    label: (l) => l.groups,
    icon: <LayoutGrid size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-yellow',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'composition',
  },
  {
    key: '/admin/children',
    feature: 'students',
    label: (l) => l.students,
    icon: <Baby size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'composition',
  },
  {
    key: '/admin/subjects',
    feature: 'subjects',
    label: 'Предметы',
    icon: <BookMarked size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-cyan',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'composition',
  },
  {
    key: '/admin/terms',
    feature: 'terms',
    label: 'Учебные периоды',
    icon: <CalendarRange size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'composition',
  },

  // ─── Моя группа/класс (учитель) ──────────────────────────────────
  {
    key: '/admin/children',
    feature: 'students',
    label: (l) => l.students,
    icon: <Baby size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['TEACHER'],
    section: 'my-group',
  },
  {
    key: '/admin/attendance',
    feature: 'attendance',
    label: 'Посещаемость',
    icon: <ClipboardCheck size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
    roles: ['TEACHER'],
    section: 'my-group',
  },
  {
    key: '/admin/menu',
    feature: 'menu',
    label: 'Меню питания',
    icon: <UtensilsCrossed size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['TEACHER'],
    section: 'my-group',
  },

  {
    key: '/admin/homeroom',
    feature: 'homeroom',
    label: 'Сводка класса',
    icon: <Users size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
    roles: ['TEACHER'],
    // показываем, только если учитель — классный руководитель хотя бы одного класса
    requiresHomeroom: true,
    section: 'my-group',
  },

  // ─── Учебный процесс ─────────────────────────────────────────────
  // Школа — для админа и учителя:
  {
    key: '/admin/grades',
    feature: 'grades',
    label: 'Журнал оценок',
    icon: <GraduationCap size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },
  {
    key: '/admin/homework',
    feature: 'homework',
    label: 'Домашние задания',
    icon: <BookOpen size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-yellow',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },
  {
    key: '/admin/schedule',
    feature: 'schedule',
    label: 'Расписание уроков',
    icon: <Calendar size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },
  // Админ садика — учебный блок:
  {
    key: '/admin/menu',
    feature: 'menu',
    label: 'Меню питания',
    icon: <UtensilsCrossed size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },
  {
    key: '/admin/attendance',
    feature: 'attendance',
    label: 'Посещаемость',
    icon: <ClipboardCheck size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },

  {
    key: '/admin/homeroom',
    feature: 'homeroom',
    label: 'Сводка класса',
    icon: <Users size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },

  {
    key: '/admin/library',
    feature: 'library',
    label: 'Библиотека',
    icon: <Library size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },
  {
    key: '/admin/quizzes',
    feature: 'quiz',
    label: 'Квизы',
    icon: <ListChecks size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },

  // ─── Финансы (только админ) ──────────────────────────────────────
  {
    key: '/admin/payments',
    feature: 'payments',
    label: 'Оплата',
    icon: <Wallet size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-rose',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'finance',
  },
  {
    key: '/admin/expenses',
    feature: 'expenses',
    label: 'Расходы',
    icon: <PieChart size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-pink',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'finance',
  },
  {
    key: '/admin/analytics',
    feature: 'analytics',
    label: 'Аналитика',
    icon: <TrendingUp size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-cyan',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'finance',
  },

  // ─── Персонал (только админ) ─────────────────────────────────────
  {
    key: '/admin/staff',
    feature: 'staff',
    label: 'Сотрудники',
    icon: <Users size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'hr',
  },
  {
    key: '/admin/timesheet',
    feature: 'timesheet',
    label: 'Табель',
    icon: <Clock size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-cyan',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'hr',
  },
  {
    key: '/admin/checkin-audit',
    feature: 'timesheet',
    label: 'Журнал check-in',
    icon: <MapPin size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'hr',
  },

  // ─── Общение (родительские собрания) ─────────────────────────────
  {
    key: '/admin/meetings',
    feature: 'meetings',
    label: 'Собрания',
    icon: <Megaphone size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-yellow',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    hiddenForGlobalOwner: true,
    section: 'communication',
  },
  {
    key: '/admin/chat',
    feature: 'chat',
    label: 'Чат с родителями',
    icon: <MessageCircle size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    hiddenForGlobalOwner: true,
    section: 'communication',
  },

  // ─── Система ─────────────────────────────────────────────────────
  {
    key: '/admin/settings',
    label: 'Настройки',
    icon: <Settings size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-gray',
    roles: ['SUPER_ADMIN', 'admin'],
    section: 'system',
  },

  // ─── РОДИТЕЛЬ ────────────────────────────────────────────────────
  {
    key: '/parent/home',
    label: 'Главная',
    icon: <HomeIcon size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['PARENT'],
    section: 'parent',
  },
  {
    key: '/parent/schedule',
    feature: 'schedule',
    label: 'Расписание',
    icon: <Calendar size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['PARENT'],
    section: 'parent',
  },
  {
    key: '/parent/grades',
    feature: 'grades',
    label: 'Оценки и ДЗ',
    icon: <GraduationCap size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['PARENT'],
    section: 'parent',
  },
  {
    key: '/parent/payments',
    feature: 'payments',
    label: 'Оплаты',
    icon: <Wallet size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-rose',
    roles: ['PARENT'],
    section: 'parent',
  },
  {
    key: '/parent/chat',
    feature: 'chat',
    label: 'Чат с учителем',
    icon: <MessageCircle size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['PARENT'],
    section: 'parent',
  },

  // ─── Ученик ──────────────────────────────────────────────────────
  {
    key: '/student/home',
    feature: 'portal',
    label: 'Главная',
    icon: <HomeIcon size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['STUDENT'],
    section: 'student',
  },
  {
    key: '/student/homework',
    feature: 'homework',
    label: 'Домашние задания',
    icon: <BookOpen size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-yellow',
    roles: ['STUDENT'],
    section: 'student',
  },
  {
    key: '/student/grades',
    feature: 'grades',
    label: 'Мои оценки',
    icon: <GraduationCap size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['STUDENT'],
    section: 'student',
  },
  {
    key: '/student/library',
    feature: 'library',
    label: 'Библиотека',
    icon: <Library size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-cyan',
    roles: ['STUDENT'],
    section: 'student',
  },
  {
    key: '/student/quizzes',
    feature: 'quiz',
    label: 'Квизы',
    icon: <ListChecks size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['STUDENT'],
    section: 'student',
  },
  {
    key: '/student/exam',
    feature: 'exam_prep',
    label: 'Подготовка к экзаменам',
    icon: <Target size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-rose',
    roles: ['STUDENT'],
    section: 'student',
  },
  {
    key: '/student/games',
    feature: 'games',
    label: 'Игры для мозга',
    icon: <Gamepad2 size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
    roles: ['STUDENT'],
    section: 'student',
  },
]

interface Props {
  collapsed: boolean
}

export default function AppSidebar({ collapsed }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const design = useThemeStore((s) => s.design)
  const L = useLabels()

  const isGlobalOwner = !!user && !user.kindergartenId

  // Сначала фильтруем по правам и типу учреждения,
  // затем группируем по разделам.
  const visible = NAV.filter((n) => {
    if (!user) return false
    if (!n.roles.includes(user.role)) return false
    if (n.globalOnly && !isGlobalOwner) return false
    if (n.hiddenForGlobalOwner && isGlobalOwner) return false
    if (n.feature && !hasFeature(user, n.feature)) return false
    if (n.requiresHomeroom && !(user.homeroomGroups?.length ?? 0)) return false
    return true
  })

  // У некоторых пунктов key дублируется (например /admin/schedule для разных
  // типов учреждения). Защита: сохраняем только первое попадание.
  const dedup = new Map<string, NavEntry>()
  for (const n of visible) {
    if (!dedup.has(n.key)) dedup.set(n.key, n)
  }
  const list = Array.from(dedup.values())

  const renderEntry = (n: NavEntry) => {
    const text =
      typeof n.label === 'function'
        ? n.label({ groups: L.groups, students: L.students })
        : n.label
    return {
      key: n.key,
      label: collapsed ? (
        <Tooltip title={text} placement="right">
          <span>{text}</span>
        </Tooltip>
      ) : (
        text
      ),
      icon: <span className={`sp-nav-icon ${n.accentClass}`}>{n.icon}</span>,
    }
  }

  // Собираем элементы Menu с заголовками разделов через item-group
  const items: ReturnType<typeof toMenuItem>[] = []
  function toMenuItem(n: NavEntry) {
    return renderEntry(n)
  }
  for (const sec of SECTION_ORDER) {
    const inSection = list.filter((n) => n.section === sec)
    if (inSection.length === 0) continue
    items.push({
      // тип-группа — заголовок раздела
      type: 'group',
      key: `section-${sec}`,
      label: collapsed ? null : SECTION_TITLES[sec],
      children: inSection.map(toMenuItem),
    } as any)
  }

  const flat = list
  const activeKey =
    flat.find((i) => location.pathname.startsWith(i.key))?.key ??
    flat[0]?.key ??
    '/admin/dashboard'

  return (
    <motion.div
      className="app-sidebar-card"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: collapsed ? '16px 8px' : 16,
        background: SP.surface,
        borderRadius: 18,
        border: `1px solid ${SP.borderSoft}`,
        boxShadow: 'var(--sp-shadow-md)',
        overflow: 'hidden',
      }}
    >
      {/* Логотип */}
      <div
        style={{
          marginBottom: 18,
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-start',
          alignItems: 'center',
          minHeight: 44,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <SproutLogo size={collapsed ? 16 : 18} showSubtitle={!collapsed} />
      </div>

      {/* Menu с разделами */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[activeKey]}
          items={items as any}
          onClick={({ key }) => {
            if (typeof key === 'string' && !key.startsWith('section-')) {
              navigate(key)
            }
          }}
          className="nav-menu"
          style={{
            background: 'transparent',
            border: 'none',
          }}
        />
      </div>

      {/* Pro-карточка */}
      {!collapsed && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            background: SP.primaryGhost,
            borderRadius: 14,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: SP.primaryDeep,
              marginBottom: 4,
            }}
          >
            🌿 Pro · v2.0
          </div>
          <div style={{ fontSize: 11, color: SP.textMid, lineHeight: 1.4 }}>
            Все возможности, безлимит детей
          </div>
        </div>
      )}

      {/* Шарики — только в классической теме. В премиуме сайдбар строгий,
          как в редизайне (без декоративной анимации). */}
      {!collapsed && design === 'classic' && <SproutBalloons />}
    </motion.div>
  )
}
