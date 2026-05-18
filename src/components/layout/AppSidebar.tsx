import { Menu, Tooltip } from 'antd'
import {
  LayoutDashboard,
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
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

import { useAuthStore } from '../../store/authStore'
import { useLabels } from '../../hooks/useLabels'
import { SP, SproutLogo, SproutBalloons } from '../sprout'
import type { Role, InstitutionType } from '../../types'

interface NavEntry {
  key: string
  /** Может быть статичная строка или функция от лейблов */
  label: string | ((L: { groups: string; students: string }) => string)
  icon: ReactNode
  /** Класс из index.css: sp-icon-mint / sp-icon-blue / ... */
  accentClass: string
  roles: Role[]
  /** Если true — показывается только глобальному супер-админу (kindergartenId === null) */
  globalOnly?: boolean
  /** Если задано — пункт показывается только для учреждений этого типа */
  institutionType?: InstitutionType
}

const ICON_SIZE = 18

const NAV: NavEntry[] = [
  // ─── Для учителя — личный кабинет ────────────────────────────────
  {
    key: '/teacher/dashboard',
    label: 'Мой кабинет',
    icon: <Clock size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['TEACHER', 'teacher'],
  },
  // ─── Для админа ──────────────────────────────────────────────────
  {
    key: '/admin/kindergartens',
    label: 'Учреждения',
    icon: <School size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN'],
    globalOnly: true,
  },
  {
    key: '/admin/dashboard',
    label: 'Главная',
    icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['SUPER_ADMIN', 'admin'],
  },
  {
    key: '/admin/groups',
    label: (l) => l.groups, // «Группы» для садика, «Классы» для школы
    icon: <LayoutGrid size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-yellow',
    roles: ['SUPER_ADMIN', 'admin'],
  },
  {
    key: '/admin/children',
    label: (l) => l.students, // «Дети» / «Ученики»
    icon: <Baby size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
  },
  // ─── Школа: предметы / журнал / домашка ──────────────────────────
  {
    key: '/admin/subjects',
    label: 'Предметы',
    icon: <BookMarked size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-cyan',
    roles: ['SUPER_ADMIN', 'admin'],
    institutionType: 'SCHOOL',
  },
  {
    key: '/admin/grades',
    label: 'Журнал оценок',
    icon: <GraduationCap size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    institutionType: 'SCHOOL',
  },
  {
    key: '/admin/homework',
    label: 'Домашние задания',
    icon: <BookOpen size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-yellow',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    institutionType: 'SCHOOL',
  },
  {
    key: '/admin/attendance',
    label: 'Посещаемость',
    icon: <ClipboardCheck size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
  },
  {
    key: '/admin/payments',
    label: 'Оплата',
    icon: <Wallet size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-rose',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
  },
  {
    key: '/admin/expenses',
    label: 'Расходы',
    icon: <PieChart size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-pink',
    roles: ['SUPER_ADMIN', 'admin'],
  },
  {
    key: '/admin/analytics',
    label: 'Аналитика',
    icon: <TrendingUp size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-cyan',
    roles: ['SUPER_ADMIN', 'admin'],
  },
  {
    key: '/admin/staff',
    label: 'Сотрудники',
    icon: <Users size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['SUPER_ADMIN', 'admin'],
  },
  // «Учителя» убрали — воспитатели заводятся теперь на странице «Сотрудники»
  // с галочкой «Может входить в систему».
  // Старый роут /admin/teachers оставлен в App.tsx для обратной совместимости.
  {
    key: '/admin/timesheet',
    label: 'Табель',
    icon: <Clock size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-cyan',
    roles: ['SUPER_ADMIN', 'admin'],
  },
  {
    key: '/admin/schedule',
    label: 'Расписание',
    icon: <Calendar size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
  },
  {
    key: '/admin/meetings',
    label: 'Собрания',
    icon: <Megaphone size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-yellow',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
  },
  {
    key: '/admin/menu',
    label: 'Меню питания',
    icon: <UtensilsCrossed size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
    institutionType: 'KINDERGARTEN',
  },
  {
    key: '/admin/settings',
    label: 'Настройки',
    icon: <Settings size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-gray',
    roles: ['SUPER_ADMIN', 'admin'],
  },
]

interface Props {
  collapsed: boolean
}

export default function AppSidebar({ collapsed }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const L = useLabels()

  const isGlobalOwner = !!user && !user.kindergartenId
  const institutionType = user?.institution?.type ?? null

  const items = NAV.filter((n) => {
    if (!user) return false
    if (!n.roles.includes(user.role)) return false
    if (n.globalOnly && !isGlobalOwner) return false
    if (n.institutionType && institutionType !== n.institutionType) return false
    return true
  }).map((n) => {
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
  })

  const activeKey =
    items.find((i) => location.pathname.startsWith(i.key))?.key ??
    items[0]?.key ??
    '/admin/dashboard'

  return (
    <motion.div
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

      {/* Section label */}
      {!collapsed && (
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: SP.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '6px 12px',
            marginBottom: 4,
            position: 'relative',
            zIndex: 2,
          }}
        >
          Меню
        </div>
      )}

      {/* Menu */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', zIndex: 2 }}>
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[activeKey]}
          items={items}
          onClick={({ key }) => navigate(key as string)}
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

      {/* Decorative balloons (только в развёрнутом виде, чтобы не отвлекать) */}
      {!collapsed && <SproutBalloons />}
    </motion.div>
  )
}
