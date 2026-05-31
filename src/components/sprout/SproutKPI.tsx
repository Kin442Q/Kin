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
 * KPI-карточка дашборда. Левая часть — цветная плашка с иконкой,
 * правая — лейбл, число и тренд-чип.
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
  const trendColor = trendPositive ? SP.primarySoft : SP.yellowSoft
  const trendText = trendPositive ? SP.primaryDeep : SP.yellowDeep

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.2, 0.7, 0.2, 1] }}
      whileHover={{ y: -2 }}
      style={{
        background: SP.surface,
        border: `1px solid ${SP.borderSoft}`,
        boxShadow: shadow.md,
        borderRadius: 18,
        padding: 18,
        minHeight: 130,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {icon && (
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: SP.muted, fontWeight: 600 }}>
            {label}
          </div>
          <div
            className="sp-num"
            style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, marginTop: 6 }}
          >
            {value}
          </div>
          {(trend !== undefined || hint) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              {trend !== undefined && (
                <span
                  className="sp-chip"
                  style={{
                    background: trendColor,
                    color: trendText,
                    padding: '2px 7px',
                  }}
                >
                  {trendPositive ? '↗' : '↘'} {Math.abs(trend).toFixed(1)}%
                </span>
              )}
              {hint && (
                <span style={{ fontSize: 11.5, color: SP.muted }}>{hint}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
