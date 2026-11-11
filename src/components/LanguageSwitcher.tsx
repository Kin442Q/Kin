import { Dropdown, type MenuProps } from 'antd'
import { Globe } from 'lucide-react'

import { LANGS, useLangStore, useT, type Lang } from '../i18n'

interface Props {
  /** header — квадратная кнопка в шапке; login — рядом с кнопкой темы на экране входа */
  variant?: 'header' | 'login'
}

/** Выбор языка интерфейса: русский, английский, таджикский. */
export default function LanguageSwitcher({ variant = 'header' }: Props) {
  const t = useT()
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]

  const items: MenuProps['items'] = LANGS.map((l) => ({
    key: l.code,
    label: <span lang={l.htmlLang}>{l.name}</span>,
  }))

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{ items, selectedKeys: [lang], onClick: ({ key }) => setLang(key as Lang) }}
    >
      <button
        type="button"
        className={`lang-btn lang-btn-${variant}`}
        aria-label={t('lang.aria')}
        title={t('lang.title')}
      >
        <Globe size={variant === 'login' ? 18 : 16} aria-hidden="true" />
        <span>{current.short}</span>
      </button>
    </Dropdown>
  )
}
