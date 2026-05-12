import { Avatar, Badge, Button, Dropdown, Layout, Tooltip, Typography, MenuProps, Drawer, List, Empty, Tag } from 'antd'
import {
  BellOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SearchOutlined,
  SettingOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useThemeStore } from '../../store/themeStore'
import { useAuthStore } from '../../store/authStore'
import { useDataStore } from '../../store/dataStore'

const { Header } = Layout
const { Text } = Typography

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

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: <Text>{user?.fullName ?? '—'}</Text>,
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
      onClick: () => navigate('/admin/settings'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
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
      }}
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="glass flex items-center justify-between"
        style={{ height: 56, padding: '0 14px' }}
      >
        <div className="flex items-center gap-3">
          <Button
            type="text"
            onClick={onToggle}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          />
          <Tooltip title="Поиск (Ctrl+K)">
            <Button type="text" icon={<SearchOutlined />} className="hidden sm:inline-flex" />
          </Tooltip>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip title={mode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
            <Button
              type="text"
              icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
            />
          </Tooltip>

          <Badge count={unread} size="small">
            <Button
              type="text"
              icon={<BellOutlined />}
              onClick={() => setDrawerOpen(true)}
            />
          </Badge>

          <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
            <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition">
              <Avatar size={32} icon={<UserOutlined />} style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }} />
              <div className="hidden md:block text-left leading-tight">
                <div className="text-sm font-medium">{user?.fullName}</div>
                <Tag color="purple" style={{ margin: 0, fontSize: 10, lineHeight: '14px' }}>
                  {user?.role}
                </Tag>
              </div>
            </button>
          </Dropdown>
        </div>
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
                    <div className="flex items-center gap-2">
                      <span>{n.title}</span>
                      {!n.read && <Badge status="processing" />}
                    </div>
                  }
                  description={
                    <div>
                      <div>{n.description}</div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {dayjs(n.createdAt).format('DD.MM.YYYY HH:mm')}
                      </Text>
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
