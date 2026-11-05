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
  MessageCircle,
  PanelLeftClose,
  Moon,
  Search,
  Settings as SettingsIcon,
  Sun,
  GraduationCap,
  User as UserIcon,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

import { useThemeStore } from '../../store/themeStore'
import { useAuthStore } from '../../store/authStore'
import { useDataStore } from '../../store/dataStore'
import { useActiveClassStore } from '../../store/activeClassStore'
import { chatApi } from '../../api/chatApi'
import { getSocket } from '../../lib/socket'
import { SP } from '../sprout'
import { initialsOf, roleLabel } from '../../lib/roles'
import LanguageSwitcher from '../LanguageSwitcher'
import { useT } from '../../i18n'

const { Header } = Layout

interface Props {
  collapsed: boolean
  onToggle: () => void
}

export default function AppHeader({ collapsed, onToggle }: Props) {
  const navigate = useNavigate()
  const t = useT()
  const mode = useThemeStore((s) => s.mode)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const notifications = useDataStore((s) => s.notifications)
  const markAllRead = useDataStore((s) => s.markAllNotificationsRead)
  const groups = useDataStore((s) => s.groups)
  const activeClassId = useActiveClassStore((s) => s.activeClassId)
  const setActiveClass = useActiveClassStore((s) => s.setActiveClass)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [chatUnread, setChatUnread] = useState(0)

  const unread = notifications.filter((n) => !n.read).length

  const isTeacher = user?.role === 'TEACHER'
  const chatPath = user?.role === 'PARENT' ? '/parent/chat' : '/admin/chat'

  // Текущий класс учителя (если ведёт несколько — можно переключить прямо в шапке)
  const currentClassId =
    (activeClassId && groups.some((g) => g.id === activeClassId)
      ? activeClassId
      : null) ??
    (user?.groupId && groups.some((g) => g.id === user.groupId)
      ? user.groupId
      : null) ??
    groups[0]?.id ??
    null
  const currentClass = groups.find((g) => g.id === currentClassId) ?? null

  // Непрочитанные сообщения чата — бейдж в шапке, обновляется по сокету
  const loadChatUnread = useCallback(() => {
    chatApi
      .unread()
      .then((r) => setChatUnread(r.count))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) return
    loadChatUnread()
    const socket = getSocket()
    const onEvent = () => loadChatUnread()
    socket.on('message', onEvent)
    socket.on('conversation', onEvent)
    return () => {
      socket.off('message', onEvent)
      socket.off('conversation', onEvent)
    }
  }, [user, loadChatUnread])

  const initials = initialsOf(user?.fullName)

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
      label: t('nav.settings'),
      onClick: () => navigate('/admin/settings'),
    },
    {
      key: 'logout',
      icon: <LogOut size={14} />,
      label: t('nav.logout'),
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
        className="app-header-bar"
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        style={{
          background: SP.surface,
          border: '1px solid var(--sp-glass-border)',
          borderRadius: 22,
          padding: '10px 12px 10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minHeight: 56,
          boxShadow: 'var(--sp-shadow-md)',
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
            borderRadius: 13,
            background: SP.surfaceAlt,
          }}
          aria-label={collapsed ? t('header.expand') : t('header.collapse')}
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
            placeholder={t('header.searchPlaceholder')}
            aria-label={t('header.search')}
            style={{
              paddingLeft: 38,
              background: SP.surfaceAlt,
              border: `1px solid ${SP.borderSoft}`,
              borderRadius: 14,
              height: 40,
              fontSize: 14,
            }}
          />
        </div>

        {/* Spacer для mobile (когда поиска нет) */}
        <div className="flex-1 md:hidden" />

        {/* Текущий класс учителя — заметный чип, по клику можно сменить класс */}
        {isTeacher && currentClass && (
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              selectedKeys: [currentClass.id],
              items: groups.map((g) => ({
                key: g.id,
                label: g.name,
                onClick: () => setActiveClass(g.id),
              })),
            }}
            disabled={groups.length <= 1}
          >
            <motion.button
              animate={{
                boxShadow: [
                  `0 0 0 0 ${currentClass.color}55`,
                  `0 0 0 7px ${currentClass.color}00`,
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 12px',
                borderRadius: 12,
                border: 'none',
                cursor: groups.length > 1 ? 'pointer' : 'default',
                background: `${currentClass.color}1f`,
                color: currentClass.color,
                fontWeight: 700,
                maxWidth: 180,
              }}
              title={t('header.currentClass')}
            >
              <GraduationCap size={16} />
              <span
                style={{
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentClass.name}
              </span>
              {groups.length > 1 && (
                <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
              )}
            </motion.button>
          </Dropdown>
        )}

        {/* Язык */}
        <LanguageSwitcher />

        {/* Theme */}
        <Tooltip title={mode === 'dark' ? t('theme.light') : t('theme.dark')}>
          <Button
            type="text"
            onClick={toggleTheme}
            style={{
              width: 38,
              height: 38,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 13,
              background: SP.surfaceAlt,
            }}
            aria-label={mode === 'dark' ? t('theme.light') : t('theme.dark')}
            icon={mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          />
        </Tooltip>

        {/* Сообщения чата — бейдж с числом непрочитанных, иконка «дрожит» когда есть новые */}
        <Tooltip title={t('header.messages')}>
          <Badge count={chatUnread} size="small" offset={[-4, 4]}>
            <motion.div
              animate={
                chatUnread > 0
                  ? { rotate: [0, -14, 12, -8, 6, 0] }
                  : { rotate: 0 }
              }
              transition={{
                duration: 0.9,
                repeat: chatUnread > 0 ? Infinity : 0,
                repeatDelay: 2.2,
              }}
              style={{ display: 'inline-flex' }}
            >
              <Button
                type="text"
                onClick={() => navigate(chatPath)}
                style={{
                  width: 38,
                  height: 38,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 13,
                  background: chatUnread > 0 ? SP.primaryGhost : SP.surfaceAlt,
                  color: chatUnread > 0 ? SP.primaryDeep : undefined,
                }}
                aria-label={t('header.messages')}
                icon={<MessageCircle size={17} />}
              />
            </motion.div>
          </Badge>
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
              borderRadius: 13,
              background: SP.surfaceAlt,
            }}
            aria-label={t('header.notifications')}
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
              borderRadius: 14,
              background: SP.surfaceAlt,
              border: `1px solid ${SP.borderSoft}`,
              color: SP.text,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Avatar
              size={32}
              style={{
                background: SP.primarySolid,
                color: '#fff',
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
              <span style={{ fontSize: 11.5, color: SP.muted, lineHeight: '14px' }}>
                {roleLabel(user)}
              </span>
            </div>
          </button>
        </Dropdown>
      </motion.div>

      <Drawer
        title={t('header.notifications')}
        placement="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Button size="small" type="link" onClick={markAllRead}>
            {t('header.markAllRead')}
          </Button>
        }
      >
        {notifications.length === 0 ? (
          <Empty description={t('header.noNotifications')} />
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
