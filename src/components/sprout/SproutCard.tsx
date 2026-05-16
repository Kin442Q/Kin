import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { SP, shadow } from './tokens'

interface Props {
  children: ReactNode
  padding?: number | string
  /** Если true — будет hover-эффект (поднятие + усиление тени) */
  hoverable?: boolean
  /** Анимация появления (sp-rise) */
  animate?: boolean
  /** Задержка анимации появления, сек */
  delay?: number
  /** Дополнительный фон-градиент */
  accent?: 'mint' | 'yellow' | 'blue' | 'mint-yellow'
  className?: string
  style?: CSSProperties
  onClick?: () => void
}

const accentBg: Record<NonNullable<Props['accent']>, string> = {
  mint: `linear-gradient(135deg, ${SP.primarySoft}, ${SP.surface})`,
  yellow: `linear-gradient(135deg, ${SP.yellowSoft}, ${SP.surface})`,
  blue: `linear-gradient(135deg, ${SP.blueSoft}, ${SP.surface})`,
  'mint-yellow': `linear-gradient(95deg, ${SP.primarySoft}, ${SP.yellowSoft})`,
}

/**
 * Базовая Sprout-карточка. Можно использовать вместо Ant Card,
 * либо в дополнение — наследует те же скругления и тени.
 */
export default function SproutCard({
  children,
  padding = 22,
  hoverable = false,
  animate = true,
  delay = 0,
  accent,
  className,
  style,
  onClick,
}: Props) {
  const baseStyle: CSSProperties = {
    background: accent ? accentBg[accent] : SP.surface,
    border: `1px solid ${SP.borderSoft}`,
    boxShadow: shadow.md,
    borderRadius: 18,
    padding,
    ...style,
  }

  const hoverStyle = hoverable
    ? { y: -2, boxShadow: shadow.lg }
    : undefined

  return (
    <motion.div
      className={className}
      style={baseStyle}
      onClick={onClick}
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={animate ? { opacity: 1, y: 0 } : undefined}
      transition={animate ? { duration: 0.4, delay, ease: [0.2, 0.7, 0.2, 1] } : undefined}
      whileHover={hoverStyle}
    >
      {children}
    </motion.div>
  )
}
