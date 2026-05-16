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
  GraduationCap,
  Calendar,
  Megaphone,
  UtensilsCrossed,
  Settings,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

import { useAuthStore } from '../../store/authStore'
import { SP, SproutLogo, SproutBalloons } from '../sprout'
import type { Role } from '../../types'

interface NavEntry {
  key: string
  label: string
  icon: ReactNode
  /** Класс из index.css: sp-icon-mint / sp-icon-blue / ... */
  accentClass: string
  roles: Role[]
  /** Если true — показывается только глобальному супер-админу (kindergartenId === null) */
  globalOnly?: boolean
}

const ICON_SIZE = 18

const NAV: NavEntry[] = [
  {
    key: '/admin/kindergartens',
    label: 'Садики',
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
    label: 'Группы',
    icon: <LayoutGrid size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-yellow',
    roles: ['SUPER_ADMIN', 'admin'],
  },
  {
    key: '/admin/children',
    label: 'Дети',
    icon: <Baby size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-blue',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
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
  {
    key: '/admin/TEACHERs',
    label: 'Учителя',
    icon: <GraduationCap size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-lilac',
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
    label: 'Меню',
    icon: <UtensilsCrossed size={ICON_SIZE} strokeWidth={2} />,
    accentClass: 'sp-icon-mint',
    roles: ['SUPER_ADMIN', 'admin', 'TEACHER'],
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

  const isGlobalOwner = !!user && !user.kindergartenId

  const items = NAV.filter((n) => {
    if (!user) return false
    if (!n.roles.includes(user.role)) return false
    if (n.globalOnly && !isGlobalOwner) return false
    return true
  }).map((n) => ({
    key: n.key,
    label: collapsed ? (
      <Tooltip title={n.label} placement="right">
        <span>{n.label}</span>
      </Tooltip>
    ) : (
      n.label
    ),
    icon: <span className={n.accentClass}>{n.icon}</span>,
  }))

  const activeKey =
    items.find((i) => location.pathname.startsWith(i.key))?.key ??
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
