import { useState } from 'react'
import { Button, Modal, Tabs, Tooltip } from 'antd'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, KeyRound, LogOut, Moon, Sun } from 'lucide-react'

import { uiText } from '../../i18n/uiText'
import { useT } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { SP, SproutLogo } from '../sprout'
import LanguageSwitcher from '../LanguageSwitcher'
import ChangePasswordForm from '../ChangePasswordForm'
import ChangeEmailForm from '../ChangeEmailForm'
import { useMinistryFilters } from '../../pages/ministry/shared'

const TABS = [
  { path: '/ministry/overview', label: () => uiText('Сводка') },
  { path: '/ministry/districts', label: () => uiText('Районы') },
  { path: '/ministry/schools', label: () => uiText('Школы') },
]

/**
 * Каркас кабинета министерства и районных отделов образования. Своя шапка и вкладки вместо школьного
 * меню: у наблюдателя нет школы, и школьные экраны (классы, журнал, чат) ему не нужны и закрыты на сервере.
 * Владелец платформы открывает тот же кабинет, чтобы видеть его глазами наблюдателя, и возвращается кнопкой слева.
 */
export default function MinistryLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  useT() // перерисовка при смене языка
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const mode = useThemeStore((s) => s.mode)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const filters = useMinistryFilters()
  const [securityOpen, setSecurityOpen] = useState(false)

  const isOwner = user?.role === 'SUPER_ADMIN' && !user.kindergartenId
  // Фильтры живут в адресной строке; при переходе между вкладками переносим их.
  const search = location.search

  return (
    <div style={{ minHeight: '100vh', background: SP.bg }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: SP.surface,
          borderBottom: `1px solid ${SP.border}`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ maxWidth: 1480, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {isOwner && (
            <Tooltip title={uiText('К платформе')}>
              <Button type="text" icon={<ArrowLeft size={18} />} aria-label={uiText('К платформе')} onClick={() => navigate('/admin/schools')} />
            </Tooltip>
          )}
          <SproutLogo size={16} />
          <div style={{ minWidth: 0, flex: '1 1 220px' }}>
            <div style={{ fontWeight: 700, color: SP.text, lineHeight: 1.2 }}>{filters.data?.organization ?? uiText('Кабинет наблюдателя')}</div>
            <div style={{ fontSize: 12, color: SP.muted }}>
              {filters.data?.allSchools === false ? uiText('Школы вашего района') : uiText('Статистика школ')}
            </div>
          </div>

          <nav aria-label={uiText('Разделы кабинета')} style={{ display: 'flex', gap: 4 }}>
            {TABS.map((tab) => (
              <NavLink
                key={tab.path}
                to={{ pathname: tab.path, search }}
                style={({ isActive }) => ({
                  padding: '8px 14px',
                  borderRadius: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: isActive ? '#fff' : SP.textMid,
                  background: isActive ? SP.primarySolid : 'transparent',
                })}
              >
                {tab.label()}
              </NavLink>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LanguageSwitcher />
            <Tooltip title={mode === 'dark' ? uiText('Светлая тема') : uiText('Тёмная тема')}>
              <Button
                type="text"
                onClick={toggleTheme}
                aria-label={mode === 'dark' ? uiText('Светлая тема') : uiText('Тёмная тема')}
                icon={mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              />
            </Tooltip>
            <Tooltip title={uiText('Пароль и вход')}>
              <Button type="text" icon={<KeyRound size={17} />} aria-label={uiText('Пароль и вход')} onClick={() => setSecurityOpen(true)} />
            </Tooltip>
            <Tooltip title={uiText('Выйти')}>
              <Button
                type="text"
                icon={<LogOut size={17} />}
                aria-label={uiText('Выйти')}
                onClick={() => {
                  logout()
                  navigate('/login', { replace: true })
                }}
              />
            </Tooltip>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1480, margin: '0 auto', padding: '20px 20px 48px' }}>
        <Outlet />
      </main>

      <Modal open={securityOpen} onCancel={() => setSecurityOpen(false)} title={uiText('Пароль и вход')} footer={null} destroyOnClose>
        <Tabs
          items={[
            { key: 'password', label: uiText('Пароль'), children: <ChangePasswordForm onDone={() => setSecurityOpen(false)} /> },
            { key: 'email', label: uiText('Email для входа'), children: <ChangeEmailForm /> },
          ]}
        />
      </Modal>
    </div>
  )
}
