import { useState } from 'react'
import { Layout, Grid } from 'antd'
import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import AppSidebar from './AppSidebar'
import AppHeader from './AppHeader'

const { Content, Sider } = Layout
const { useBreakpoint } = Grid

/**
 * Основной каркас приложения. Содержит сайдбар, шапку и контентную
 * область с плавной сменой страниц через framer-motion.
 */
export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const screens = useBreakpoint()
  const isMobile = !screens.md

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="md"
        collapsedWidth={isMobile ? 0 : 80}
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

      <Layout>
        <AppHeader collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
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
