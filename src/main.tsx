import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import AppBackdrop from './components/layout/AppBackdrop'
import './index.css'
import { antdLocale } from './i18n/antdLocale'
import { useLangStore } from './i18n'
import { useThemeStore } from './store/themeStore'
import { buildAntdTheme } from './theme/antdTheme'

// Язык дат (dayjs) и атрибут lang у <html> ставит хранилище языка при загрузке и при смене.
dayjs.locale(useLangStore.getState().lang)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 60_000 },
  },
})

function Root() {
  const mode = useThemeStore((s) => s.mode)
  const lang = useLangStore((s) => s.lang)

  // Применяем data-theme (светлая «закат» / тёмная «ночь») на html.
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

  return (
    <ConfigProvider locale={antdLocale(lang)} theme={buildAntdTheme(mode)}>
      <AntdApp>
        <AppBackdrop />
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <App />
            </BrowserRouter>
          </QueryClientProvider>
        </ErrorBoundary>
      </AntdApp>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
