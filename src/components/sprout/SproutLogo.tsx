interface MarkProps {
  /** Ширина знака в px (высота — 5/6 от неё) */
  width?: number
  /** Вращать лучи солнца */
  animated?: boolean
  /** Цвет второй страницы книги (в тёмной теме светлее) */
  page2?: string
}

/**
 * Знак «Офтоб»: солнце знаний встаёт над раскрытой книгой.
 * Используется в логотипе, фавиконе и иконке приложения.
 */
export function BrandMark({ width = 44, animated = true, page2 }: MarkProps) {
  return (
    <svg
      width={width}
      height={Math.round(width * (100 / 120))}
      viewBox="0 0 120 100"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <g
        className={animated ? 'brand-rays' : undefined}
        stroke="#FF8A65"
        strokeWidth="5"
        strokeLinecap="round"
      >
        <path d="M60 6 V14" />
        <path d="M30 18 L35 24" />
        <path d="M90 18 L85 24" />
        <path d="M20 44 H28" />
        <path d="M100 44 H92" />
      </g>
      <circle cx="60" cy="44" r="18" fill="#FF8A65" />
      <path d="M8 52 Q34 44 60 60 V94 Q34 78 8 86 Z" fill="#0D7A7C" />
      <path
        d="M112 52 Q86 44 60 60 V94 Q86 78 112 86 Z"
        style={{ fill: page2 ?? 'var(--brand-page2, #075B5D)' }}
      />
    </svg>
  )
}

interface Props {
  /** Базовый размер: высота знака ≈ size × 2.4, кегль надписи = size */
  size?: number
  /** false — только знак (свёрнутое меню) */
  showSubtitle?: boolean
  animated?: boolean
}

/**
 * Логотип «мактаби ман»: знак + надпись. «мактаби» плотным начертанием,
 * «ма» тонким и «н» плотным бирюзовым — так читается и как «ман», и как «мактаби».
 */
export default function SproutLogo({ size = 18, showSubtitle = true, animated = true }: Props) {
  return (
    <div
      role="img"
      aria-label="Мактаби ман"
      style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.55) }}
    >
      <BrandMark width={Math.round(size * 2.3)} animated={animated} />
      {showSubtitle && (
        <span className="brand-wordmark" aria-hidden="true" style={{ fontSize: Math.round(size * 1.15) }}>
          мактаби
          <span className="brand-man">
            <span className="brand-ma">ма</span>н
          </span>
        </span>
      )}
    </div>
  )
}
