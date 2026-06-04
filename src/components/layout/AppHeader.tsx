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
  Sparkles,
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

const { Header } = Layout

interface Props {
  collapsed: boolean
  onToggle: () => void
}

export default function AppHeader({ collapsed, onToggle }: Props) {
  const navigate = useNavigate()
  const mode = useThemeStore((s) => s.mode)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const design = useThemeStore((s) => s.design)
  const toggleDesign = useThemeStore((s) => s.toggleDesign)
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
        className="app-header-bar"
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
          boxShadow: 'var(--sp-shadow-sm)',
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
              title="Текущий класс"
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

        {/* Дизайн: премиум-редизайн ↔ классический */}
        <Tooltip
          title={
            design === 'premium'
              ? 'Премиум-редизайн (нажмите для классического)'
              : 'Классическое оформление (нажмите для премиума)'
          }
        >
          <Button
            type="text"
            onClick={toggleDesign}
            style={{
              width: 38,
              height: 38,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 11,
              background:
                design === 'premium' ? SP.primaryGhost : SP.surfaceAlt,
              color: design === 'premium' ? SP.primaryDeep : undefined,
            }}
            icon={<Sparkles size={17} />}
          />
        </Tooltip>

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

        {/* Сообщения чата — бейдж с числом непрочитанных, иконка «дрожит» когда есть новые */}
        <Tooltip title="Сообщения">
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
                  borderRadius: 11,
                  background: chatUnread > 0 ? SP.primaryGhost : SP.surfaceAlt,
                  color: chatUnread > 0 ? SP.primaryDeep : undefined,
                }}
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
