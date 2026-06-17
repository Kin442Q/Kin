import { useState } from 'react'
import { Layout, Grid, Drawer } from 'antd'
import { Outlet, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AppSidebar from './AppSidebar'
import AppHeader from './AppHeader'
import { useTenantSync } from '../../hooks/useTenantSync'
import { useAuthStore } from '../../store/authStore'
import { SP } from '../sprout'

const { Content, Sider } = Layout
const { useBreakpoint } = Grid

/**
 * Основной каркас приложения.
 * - Desktop: фиксированный sider слева, контент справа
 * - Mobile (<md): sidebar открывается как Drawer слева по клику на бургер
 */
export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const navigate = useNavigate()
  const isDemo = useAuthStore((s) => !!s.user?.institution?.isDemo)
  const logout = useAuthStore((s) => s.logout)
  const exitDemo = () => {
    logout()
    navigate('/')
  }

  useTenantSync()

  const onToggle = () => {
    if (isMobile) setMobileOpen((v) => !v)
    else setCollapsed((v) => !v)
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          breakpoint="md"
          collapsedWidth={110}
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={252}
          trigger={null}
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            background: 'transparent',
            padding: 12 ,
            transition: 'all 0.25s ease',
          }}
        >
          <AppSidebar collapsed={collapsed} />
        </Sider>
      )}

      {isMobile && (
        <Drawer
          placement="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          closable={false}
          width={260}
          styles={{
            body: { padding: 12, background: SP.bg },
            content: { background: SP.bg },
          }}
        >
          <div onClick={() => setMobileOpen(false)}>
            <AppSidebar collapsed={false} />
          </div>
        </Drawer>
      )}

      <Layout>
        {isDemo && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              flexWrap: 'wrap',
              padding: '8px 14px',
              background: SP.yellowSoft,
              color: SP.yellowDeep,
              fontSize: 13,
              fontWeight: 600,
              borderBottom: `1px solid ${SP.border}`,
            }}
          >
            <span>
              🔒 Демо-режим — данные доступны только для просмотра, изменения
              отключены.
            </span>
            <button
              type="button"
              onClick={exitDemo}
              style={{
                border: 'none',
                background: SP.yellowDeep,
                color: '#fff',
                fontWeight: 700,
                fontSize: 12,
                padding: '5px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Выйти из демо
            </button>
          </div>
        )}
        <AppHeader
          collapsed={isMobile ? false : collapsed}
          onToggle={onToggle}
        />
        <Content style={{ padding: isMobile ? 12 : 20 }}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <Outlet />
          </motion.div>
        </Content>
      </Layout>
    </Layout>
  )
}
