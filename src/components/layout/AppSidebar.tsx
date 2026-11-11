import { uiText } from '../../i18n/uiText'
import { Menu, Tooltip } from 'antd'
import {
  School,
  LayoutGrid,
  Baby,
  ClipboardCheck,
  ClipboardList,
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
  KeyRound,
  LogOut,
  Landmark,
  Globe2,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'

import { useAuthStore } from '../../store/authStore'
import { useT, type MsgKey } from '../../i18n'
import { hasFeature, type FeatureKey } from '../../lib/features'
import { SP, SproutLogo, BrandMark } from '../sprout'
import { initialsOf, roleLabel } from '../../lib/roles'
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
  /** Ключ подписи пункта в словаре переводов (src/i18n) */
  labelKey: MsgKey
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

/** Заголовок раздела меню: ключ «nav.section.<раздел>» в словаре переводов. */
const sectionTitleKey = (sec: SectionKey): MsgKey => `nav.section.${sec}`

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
    labelKey: 'nav.schools',
    icon: <School size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN'],
    globalOnly: true,
    section: 'platform',
  },
  {
    key: '/admin/viewers',
    labelKey: 'nav.viewers',
    icon: <Landmark size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
    roles: ['SUPER_ADMIN'],
    globalOnly: true,
    section: 'platform',
  },
  {
    // Кабинет министерства открывается в своём каркасе: владелец видит его так же, как наблюдатель.
    key: '/ministry/overview',
    labelKey: 'nav.ministry',
    icon: <Globe2 size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-cyan',
    roles: ['SUPER_ADMIN'],
    globalOnly: true,
    section: 'platform',
  },

  // ─── Основное ────────────────────────────────────────────────────
  {
    key: '/teacher/dashboard',
    labelKey: 'nav.myCabinet',
    icon: <Clock size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['TEACHER', 'teacher'],
    section: 'main',
  },
  {
    key: '/admin/dashboard',
    labelKey: 'nav.home',
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
    labelKey: 'nav.classes',
    icon: <LayoutGrid size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-yellow',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'composition',
  },
  {
    key: '/admin/children',
    feature: 'students',
    labelKey: 'nav.students',
    icon: <Baby size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'composition',
  },
  {
    key: '/admin/teacher-access',
    feature: 'teachers',
    labelKey: 'nav.teacherAccess',
    icon: <KeyRound size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'composition',
  },
  {
    key: '/admin/subjects',
    feature: 'subjects',
    labelKey: 'nav.subjects',
    icon: <BookMarked size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-cyan',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'composition',
  },
  {
    key: '/admin/terms',
    feature: 'terms',
    labelKey: 'nav.terms',
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
    labelKey: 'nav.students',
    icon: <Baby size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['TEACHER'],
    section: 'my-group',
  },
  {
    key: '/admin/attendance',
    feature: 'attendance',
    labelKey: 'nav.attendance',
    icon: <ClipboardCheck size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
    roles: ['TEACHER'],
    section: 'my-group',
  },
  {
    key: '/admin/menu',
    feature: 'menu',
    labelKey: 'nav.menu',
    icon: <UtensilsCrossed size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['TEACHER'],
    section: 'my-group',
  },

  {
    key: '/admin/homeroom',
    feature: 'homeroom',
    labelKey: 'nav.homeroom',
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
    labelKey: 'nav.grades',
    icon: <GraduationCap size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },
  {
    key: '/admin/director-report',
    feature: 'grades',
    labelKey: 'nav.directorReport',
    icon: <ClipboardList size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },
  {
    key: '/admin/homework',
    feature: 'homework',
    labelKey: 'nav.homework',
    icon: <BookOpen size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-yellow',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },
  {
    key: '/admin/schedule',
    feature: 'schedule',
    labelKey: 'nav.schedule',
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
    labelKey: 'nav.menu',
    icon: <UtensilsCrossed size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },
  {
    key: '/admin/attendance',
    feature: 'attendance',
    labelKey: 'nav.attendance',
    icon: <ClipboardCheck size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },

  {
    key: '/admin/homeroom',
    feature: 'homeroom',
    labelKey: 'nav.homeroom',
    icon: <Users size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },

  {
    key: '/admin/library',
    feature: 'library',
    labelKey: 'nav.library',
    icon: <Library size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    hiddenForGlobalOwner: true,
    section: 'studying',
  },
  {
    key: '/admin/quizzes',
    feature: 'quiz',
    labelKey: 'nav.quizzes',
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
    labelKey: 'nav.payments',
    icon: <Wallet size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-rose',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'finance',
  },
  {
    key: '/admin/expenses',
    feature: 'expenses',
    labelKey: 'nav.expenses',
    icon: <PieChart size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-pink',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'finance',
  },
  {
    key: '/admin/analytics',
    feature: 'analytics',
    labelKey: 'nav.analytics',
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
    labelKey: 'nav.staff',
    icon: <Users size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'hr',
  },
  {
    key: '/admin/timesheet',
    feature: 'timesheet',
    labelKey: 'nav.timesheet',
    icon: <Clock size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-cyan',
    roles: ['SUPER_ADMIN', 'admin'],
    hiddenForGlobalOwner: true,
    section: 'hr',
  },
  {
    key: '/admin/checkin-audit',
    feature: 'timesheet',
    labelKey: 'nav.checkin',
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
    labelKey: 'nav.meetings',
    icon: <Megaphone size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-yellow',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    hiddenForGlobalOwner: true,
    section: 'communication',
  },
  {
    key: '/admin/chat',
    feature: 'chat',
    labelKey: 'nav.chatParents',
    icon: <MessageCircle size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    hiddenForGlobalOwner: true,
    section: 'communication',
  },

  // ─── Система ─────────────────────────────────────────────────────
  {
    key: '/admin/settings',
    labelKey: 'nav.settings',
    icon: <Settings size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-gray',
    roles: ['SUPER_ADMIN', 'admin'],
    section: 'system',
  },

  // ─── РОДИТЕЛЬ ────────────────────────────────────────────────────
  {
    key: '/parent/home',
    labelKey: 'nav.home',
    icon: <HomeIcon size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['PARENT'],
    section: 'parent',
  },
  {
    key: '/parent/schedule',
    feature: 'schedule',
    labelKey: 'nav.parentSchedule',
    icon: <Calendar size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['PARENT'],
    section: 'parent',
  },
  {
    key: '/parent/grades',
    feature: 'grades',
    labelKey: 'nav.parentGrades',
    icon: <GraduationCap size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['PARENT'],
    section: 'parent',
  },
  {
    key: '/parent/payments',
    feature: 'payments',
    labelKey: 'nav.parentPayments',
    icon: <Wallet size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-rose',
    roles: ['PARENT'],
    section: 'parent',
  },
  {
    key: '/parent/chat',
    feature: 'chat',
    labelKey: 'nav.chatTeacher',
    icon: <MessageCircle size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['PARENT'],
    section: 'parent',
  },

  // ─── Ученик ──────────────────────────────────────────────────────
  {
    key: '/student/home',
    feature: 'portal',
    labelKey: 'nav.home',
    icon: <HomeIcon size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['STUDENT'],
    section: 'student',
  },
  {
    key: '/student/homework',
    feature: 'homework',
    labelKey: 'nav.homework',
    icon: <BookOpen size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-yellow',
    roles: ['STUDENT'],
    section: 'student',
  },
  {
    key: '/student/grades',
    feature: 'grades',
    labelKey: 'nav.myGrades',
    icon: <GraduationCap size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['STUDENT'],
    section: 'student',
  },
  {
    key: '/student/library',
    feature: 'library',
    labelKey: 'nav.library',
    icon: <Library size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-cyan',
    roles: ['STUDENT'],
    section: 'student',
  },
  {
    key: '/student/quizzes',
    feature: 'quiz',
    labelKey: 'nav.quizzes',
    icon: <ListChecks size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['STUDENT'],
    section: 'student',
  },
  {
    key: '/student/exam',
    feature: 'exam_prep',
    labelKey: 'nav.exam',
    icon: <Target size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-rose',
    roles: ['STUDENT'],
    section: 'student',
  },
  {
    key: '/student/games',
    feature: 'games',
    labelKey: 'nav.games',
    icon: <Gamepad2 size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
    roles: ['STUDENT'],
    section: 'student',
  },
]

interface Props {
  collapsed: boolean
}

/** Учебный год вида «2025/26»: с августа начинается новый. */
function schoolYear(now = new Date()): string {
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return `${y}/${String(y + 1).slice(2)}`
}

const NAV_OPEN_KEY = 'kg_nav_open'

function loadOpenSections(): string[] | null {
  try {
    const raw = localStorage.getItem(NAV_OPEN_KEY)
    const v = raw ? JSON.parse(raw) : null
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : null
  } catch {
    return null
  }
}

export default function AppSidebar({ collapsed }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const t = useT()

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
    const text = t(n.labelKey)
    return {
      key: n.key,
      label: collapsed ? (
        <Tooltip title={text} placement="right">
          <span>{text}</span>
        </Tooltip>
      ) : (
        text
      ),
      icon: <span className="sp-nav-icon">{n.icon}</span>,
    }
  }

  const flat = list
  const activeKey =
    flat.find((i) => location.pathname.startsWith(i.key))?.key ??
    flat[0]?.key ??
    '/admin/dashboard'
  const activeSection = flat.find((i) => i.key === activeKey)?.section

  // Разделы меню — складные. По умолчанию раскрыты «Платформа», «Основное»
  // и раздел с открытой страницей; остальные свёрнуты, выбор запоминается.
  const [openSections, setOpenSections] = useState<string[]>(
    () => loadOpenSections() ?? ['section-platform', 'section-main'],
  )
  useEffect(() => {
    if (!activeSection) return
    const key = `section-${activeSection}`
    setOpenSections((cur) => (cur.includes(key) ? cur : [...cur, key]))
  }, [activeSection])
  const onOpenChange = (keys: string[]) => {
    setOpenSections(keys)
    try {
      localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(keys))
    } catch {
      /* без localStorage просто не запоминаем */
    }
  }

  // Свёрнутое меню (только иконки) — плоские группы; обычное — складные разделы.
  const items: any[] = []
  for (const sec of SECTION_ORDER) {
    const inSection = list.filter((n) => n.section === sec)
    if (inSection.length === 0) continue
    items.push({
      type: collapsed ? 'group' : undefined,
      key: `section-${sec}`,
      label: collapsed ? null : t(sectionTitleKey(sec)),
      children: inSection.map(renderEntry),
    })
  }

  const schoolName = isGlobalOwner
    ? t('nav.mySchool')
    : (user?.institution?.name ?? t('nav.mySchool'))
  const schoolSub = isGlobalOwner ? t('nav.platform') : t('nav.schoolYear', { year: schoolYear() })
  const doLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

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
        gap: 14,
        padding: collapsed ? '16px 8px' : '18px 10px',
        overflow: 'hidden',
      }}
    >
      {/* Логотип */}
      <div
        style={{
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-start',
          alignItems: 'center',
          minHeight: 40,
          padding: collapsed ? 0 : '0 8px',
        }}
      >
        {collapsed ? <BrandMark width={40} /> : <SproutLogo size={17} />}
      </div>

      {/* Школа */}
      {!collapsed && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 16,
            background: SP.surfaceAlt,
            border: `1px solid ${SP.borderSoft}`,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              flex: 'none',
              borderRadius: 11,
              background: '#FF8A65',
              color: '#10282A',
              fontWeight: 800,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {schoolName.trim().charAt(0).toUpperCase()}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span
              title={schoolName}
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: SP.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {schoolName}
            </span>
            <span style={{ fontSize: 12, color: SP.muted }}>{schoolSub}</span>
          </span>
        </div>
      )}

      {/* Меню с разделами */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0,
        }}
      >
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          inlineIndent={0}
          selectedKeys={[activeKey]}
          openKeys={collapsed ? undefined : openSections}
          onOpenChange={onOpenChange}
          items={items}
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

      {/* Пользователь */}
      {user && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8,
            padding: collapsed ? 4 : 10,
            borderRadius: 16,
            background: collapsed ? 'transparent' : SP.primaryGhost,
          }}
        >
          {!collapsed && (
            <>
              <span
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 36,
                  flex: 'none',
                  borderRadius: 999,
                  fontSize: 13,
                  background: SP.primarySolid,
                  color: '#fff',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {initialsOf(user.fullName)}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span
                  title={user.fullName}
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: SP.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user.fullName}
                </span>
                <span
                  title={roleLabel(user)}
                  style={{
                    fontSize: 12,
                    color: SP.muted,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {roleLabel(user)}
                </span>
              </span>
            </>
          )}
          <Tooltip title={t('nav.logout')} placement={collapsed ? 'right' : 'top'}>
            <button
              type="button"
              aria-label={t('nav.logout')}
              onClick={doLogout}
              style={{
                width: 36,
                height: 36,
                border: 0,
                borderRadius: 10,
                background: 'transparent',
                color: SP.muted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flex: 'none',
              }}
            >
              <LogOut size={18} />
            </button>
          </Tooltip>
        </div>
      )}
    </motion.div>
  )
}
