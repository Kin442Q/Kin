import { useState } from 'react'
import { Layout, Grid, Drawer } from 'antd'
import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import AppSidebar from './AppSidebar'
import AppHeader from './AppHeader'
import { useTenantSync } from '../../hooks/useTenantSync'

const { Content, Sider } = Layout
const { useBreakpoint } = Grid

/**
 * Основной каркас приложения. На мобильных сайдбар открывается как Drawer.
 */
export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const screens = useBreakpoint()
  const isMobile = !screens.md

  // Загружаем данные текущего садика из бекенда
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
          collapsedWidth={80}
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={252}
          trigger={null}
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            background: 'transparent',
            padding: 12,
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
            body: { padding: 12 },
          }}
        >
          <div onClick={() => setMobileOpen(false)}>
            <AppSidebar collapsed={false} />
          </div>
        </Drawer>
      )}

      <Layout>
        <AppHeader
          collapsed={isMobile ? false : collapsed}
          onToggle={onToggle}
        />
        <Content style={{ padding: isMobile ? 12 : 24 }}>
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
