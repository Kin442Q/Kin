import { uiText } from '../../i18n/uiText'
import { useLangStore } from '../../i18n'
import { useThemeStore } from '../../store/themeStore'

interface MarkProps {
  width?: number
  animated?: boolean
  page2?: string
}

/** Supplied book symbol, shared by compact navigation and the favicon. */
export function BrandMark({ width = 44 }: MarkProps) {
  return <img src={import.meta.env.BASE_URL + 'brand/icon.svg'} alt="" aria-hidden="true"
    width={width} height={width * 153.81 / 160.32}
    style={{ flexShrink: 0, display: 'block', objectFit: 'contain' }} />
}

interface Props {
  size?: number
  showSubtitle?: boolean
  animated?: boolean
}

const brands = {
  ru: { get name() { return uiText("Моя школа") }, width: 265.64 },
  en: { name: 'My School', width: 250.05 },
  tg: { get name() { return uiText("Мактаби ман") }, width: 313.43 },
}

/** Original vector wordmark selected by the current interface language. */
export default function SproutLogo({ size = 18, showSubtitle = true }: Props) {
  const lang = useLangStore((s) => s.lang)
  const mode = useThemeStore((s) => s.mode)
  const brand = brands[lang]
  if (!showSubtitle) return <BrandMark width={Math.round(size * 2.3)} />
  const height = Math.round(size * 2.4)
  return <img className="brand-logo" src={import.meta.env.BASE_URL + 'brand/logo-' + lang + (mode === 'dark' ? '-dark' : '') + '.svg'}
    alt={brand.name} width={height * brand.width / 62.89} height={height}
    style={{ display: 'block', maxWidth: '100%', height: 'auto', flexShrink: 1 }} />
}
