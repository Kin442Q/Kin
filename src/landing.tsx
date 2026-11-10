import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import LanguageSwitcher from './components/LanguageSwitcher'
import { useLangStore } from './i18n'
import { antdLocale } from './i18n/antdLocale'
import { buildAntdTheme } from './theme/antdTheme'
import './landing.css'

function LandingLanguage() {
  const lang = useLangStore(state => state.lang)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('maktab-language-change', { detail: lang }))
    if (parent !== window) parent.postMessage({type:'maktab-language',lang}, location.origin)
  }, [lang])
  return <ConfigProvider locale={antdLocale(lang)} theme={buildAntdTheme('light')}>
    <LanguageSwitcher variant="login" />
  </ConfigProvider>
}

createRoot(document.getElementById('landing-language-root')!).render(<LandingLanguage />)
