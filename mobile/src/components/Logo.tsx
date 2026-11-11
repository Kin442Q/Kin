import { SvgXml } from 'react-native-svg'
import { brandAssets } from './brandAssets'
import { useLangStore } from '../i18n'

export function BrandMark({ width = 44 }: { width?: number; page2?: string }) {
  return <SvgXml xml={brandAssets.icon} width={width} height={width * 153.81 / 160.32} />
}

export default function Logo({ size = 22, lang: overrideLang }: { size?: number; lang?: 'ru' | 'en' | 'tg' }) {
  const savedLang = useLangStore(s => s.lang)
  const lang = overrideLang ?? savedLang
  const height = Math.round(size * 2.4)
  const width = { ru: 265.64, en: 250.05, tg: 313.43 }[lang] * height / 62.89
  return <SvgXml xml={brandAssets[lang]} width={width} height={height}
    accessibilityLabel={{ ru: 'Моя школа', en: 'My School', tg: 'Мактаби ман' }[lang]} />
}
