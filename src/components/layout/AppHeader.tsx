import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  Layout,
  Tooltip,
  MenuProps,
  Drawer,
  List,
  Empty,
  Tag,
  Input,
} from 'antd'
import {
  Bell,
  LogOut,
  Menu as MenuIcon,
  PanelLeftClose,
  Moon,
  Search,
  Settings as SettingsIcon,
  Sun,
  User as UserIcon,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

import { useThemeStore } from '../../store/themeStore'
import { useAuthStore } from '../../store/authStore'
import { useDataStore } from '../../store/dataStore'
import { SP } from '../sprout'

const { Header } = Layout

interface Props {
  collapsed: boolean
  onToggle: () => void
}

export default function AppHeader({ collapsed, onToggle }: Props) {
  const navigate = useNavigate()
  const mode = useThemeStore((s) => s.mode)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const notifications = useDataStore((s) => s.notifications)
  const markAllRead = useDataStore((s) => s.markAllNotificationsRead)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const unread = notifications.filter((n) => !n.read).length

  const initials = user?.fullName
    ?.split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserIcon size={14} />,
      label: <span>{user?.fullName ?? '—'}</span>,
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'settings',
      icon: <SettingsIcon size={14} />,
      label: 'Настройки',
      onClick: () => navigate('/admin/settings'),
    },
    {
      key: 'logout',
      icon: <LogOut size={14} />,
      label: 'Выйти',
      onClick: () => {
        logout()
        navigate('/login', { replace: true })
      },
    },
  ]

  return (
    <Header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '12px 20px',
        marginBottom: 4,
        height: 'auto',
        lineHeight: 1,
      }}
    >
      <motion.div
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        style={{
          background: SP.surface,
          border: `1px solid ${SP.borderSoft}`,
          borderRadius: 16,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minHeight: 56,
        }}
      >
        {/* Toggle */}
        <Button
          type="text"
          onClick={onToggle}
          style={{
            width: 38,
            height: 38,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 11,
            background: SP.surfaceAlt,
          }}
          icon={collapsed ? <MenuIcon size={18} /> : <PanelLeftClose size={18} />}
        />

        {/* Поиск — на больших экранах */}
        <div
          className="hidden md:flex"
          style={{ flex: 1, maxWidth: 360, alignItems: 'center', position: 'relative' }}
        >
          <Search
            size={15}
            color={SP.muted}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          />
          <Input
            placeholder="Поиск ребёнка, группы…"
            style={{
              paddingLeft: 36,
              background: SP.surfaceAlt,
              border: 'none',
              borderRadius: 12,
              height: 38,
              fontSize: 13,
            }}
          />
        </div>

        {/* Spacer для mobile (когда поиска нет) */}
        <div className="flex-1 md:hidden" />

        {/* Theme */}
        <Tooltip title={mode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
          <Button
            type="text"
            onClick={toggleTheme}
            style={{
              width: 38,
              height: 38,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 11,
              background: SP.surfaceAlt,
            }}
            icon={mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          />
        </Tooltip>

        {/* Notifications */}
        <Badge count={unread} size="small" offset={[-4, 4]}>
          <Button
            type="text"
            onClick={() => setDrawerOpen(true)}
            style={{
              width: 38,
              height: 38,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 11,
              background: SP.surfaceAlt,
            }}
            icon={<Bell size={17} />}
          />
        </Badge>

        {/* User */}
        <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 10px 4px 4px',
              borderRadius: 12,
              background: SP.surfaceAlt,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Avatar
              size={32}
              style={{
                background: `linear-gradient(135deg, ${SP.yellow}, ${SP.primarySoft})`,
                color: SP.primaryDeep,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {initials}
            </Avatar>
            <div className="hidden md:block" style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: SP.text }}>
                {user?.fullName}
              </div>
              <Tag
                style={{
                  margin: 0,
                  fontSize: 10,
                  lineHeight: '14px',
                  background: SP.primaryGhost,
                  color: SP.primaryDeep,
                  border: 'none',
                  padding: '0 8px',
                }}
              >
                {user?.role}
              </Tag>
            </div>
          </button>
        </Dropdown>
      </motion.div>

      <Drawer
        title="Уведомления"
        placement="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Button size="small" type="link" onClick={markAllRead}>
            Прочитать все
          </Button>
        }
      >
        {notifications.length === 0 ? (
          <Empty description="Нет уведомлений" />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(n) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{n.title}</span>
                      {!n.read && <Badge status="processing" />}
                    </div>
                  }
                  description={
                    <div>
                      <div>{n.description}</div>
                      <span style={{ fontSize: 11, color: SP.muted }}>
                        {dayjs(n.createdAt).format('DD.MM.YYYY HH:mm')}
                      </span>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </Header>
  )
}
