import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { SP, shadow, accentMap, type SproutAccent } from './tokens'

interface Props {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  /** Изменение к прошлому периоду в процентах (+12.4 = рост на 12.4%) */
  trend?: number
  accent?: SproutAccent
  icon?: ReactNode
  delay?: number
}

/**
 * KPI-карточка дашборда (как на макете «Кабинет директора»):
 * название и цветная плашка с иконкой сверху, крупное число
 * (Montserrat) и чип с динамикой снизу.
 */
export default function SproutKPI({
  label,
  value,
  hint,
  trend,
  accent = 'mint',
  icon,
  delay = 0,
}: Props) {
  const a = accentMap[accent]
  const trendPositive = trend !== undefined && trend >= 0
  const trendColor = trendPositive ? SP.primarySoft : SP.roseSoft
  const trendText = trendPositive ? SP.primaryDeep : SP.roseDeep

  return (
    <motion.div
      className="sp-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.2, 0.7, 0.2, 1] }}
      whileHover={{ y: -3, boxShadow: shadow.lg }}
      style={{
        padding: 20,
        minHeight: 132,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 14, color: SP.textMid, fontWeight: 600, minWidth: 0 }}>{label}</div>
        {icon && (
          <div
            style={{
              width: 38,
              height: 38,
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
      </div>
      <div
        className="sp-num"
        style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, color: SP.text }}
      >
        {value}
      </div>
      {(trend !== undefined || hint) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {trend !== undefined && (
            <span
              className="sp-chip"
              style={{ background: trendColor, color: trendText, padding: '3px 9px' }}
            >
              {trendPositive ? '↗' : '↘'} {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {hint && <span style={{ fontSize: 12.5, color: SP.muted }}>{hint}</span>}
        </div>
      )}
    </motion.div>
  )
}
