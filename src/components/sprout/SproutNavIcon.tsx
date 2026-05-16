import type { ReactNode } from 'react'

interface Props {
  /** Иконка (например из lucide-react) */
  icon: ReactNode
  /** Accent класс для плашки: sp-icon-mint, sp-icon-blue, etc */
  accentClass?: string
  /** Активный ли пункт (тогда плашка становится primary) */
  active?: boolean
  size?: number
}

/**
 * Универсальная иконка для sidebar: цветная плашка + lucide-иконка внутри.
 * Класс accentClass определяет цвет (.sp-icon-mint, .sp-icon-blue, и т.д.)
 * — стили объявлены в index.css.
 */
export default function SproutNavIcon({
  icon,
  accentClass = 'sp-icon-mint',
  active = false,
  size = 32,
}: Props) {
  return (
    <span
      className={active ? '' : accentClass}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 9,
        transition: 'all 0.2s ease',
      }}
    >
      {icon}
    </span>
  )
}
