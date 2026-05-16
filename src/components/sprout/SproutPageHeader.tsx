import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { SP } from './tokens'

interface Props {
  title: ReactNode
  description?: ReactNode
  /** Иконка слева от заголовка — рендерится в цветной плашке */
  icon?: ReactNode
  /** Цветовая плашка иконки */
  iconAccent?: 'mint' | 'blue' | 'yellow' | 'lilac' | 'rose' | 'pink' | 'cyan'
  actions?: ReactNode
  /** Дополнительный «чип» рядом с заголовком (например счётчик «142 ребёнка») */
  chip?: ReactNode
}

const accentBg: Record<NonNullable<Props['iconAccent']>, { bg: string; fg: string }> = {
  mint:   { bg: SP.primaryGhost,   fg: SP.primaryDeep },
  blue:   { bg: SP.blueSoft,       fg: SP.blueDeep },
  yellow: { bg: SP.yellowSoft,     fg: SP.yellowDeep },
  lilac:  { bg: SP.lilacSoft,      fg: SP.lilacDeep },
  rose:   { bg: SP.roseSoft,       fg: SP.roseDeep },
  pink:   { bg: SP.pinkSoft,       fg: SP.pink },
  cyan:   { bg: SP.cyanSoft,       fg: SP.cyan },
}

/**
 * Шапка страницы Sprout: иконка + заголовок + описание + кнопки действий справа.
 * Заменяет старый PageHeader.
 */
export default function SproutPageHeader({
  title,
  description,
  icon,
  iconAccent = 'mint',
  actions,
  chip,
}: Props) {
  const a = accentBg[iconAccent]
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 20,
      }}
      className="sp-page-header"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
          {icon && (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: a.bg,
                color: a.fg,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: SP.text,
                  lineHeight: 1.2,
                }}
              >
                {title}
              </h1>
              {chip}
            </div>
            {description && (
              <div
                style={{
                  fontSize: 13,
                  color: SP.muted,
                  marginTop: 4,
                  lineHeight: 1.4,
                }}
              >
                {description}
              </div>
            )}
          </div>
        </div>
        {actions && (
          <div
            className="page-actions-wrap"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {actions}
          </div>
        )}
      </div>
    </motion.div>
  )
}
