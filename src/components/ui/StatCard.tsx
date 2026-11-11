import { uiText, uiLanguage } from '../../i18n/uiText'
import { ReactNode } from 'react'
import { Tooltip, Typography } from 'antd'
import { motion } from 'framer-motion'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import { formatMoneyCompact, formatNumberCompact } from '../../lib/format'

const { Text } = Typography

interface Props {
  title: ReactNode
  /** Значение KPI. Числа автоматически сокращаются (1,23 млн / 12,3 тыс.). */
  value: number | string
  /** Если задан 'money' — форматируется в сомони компактно. Иначе как число. */
  format?: 'money' | 'number' | 'raw'
  suffix?: ReactNode
  prefix?: ReactNode
  icon?: ReactNode
  /** Изменение в процентах к прошлому периоду. */
  trend?: number
  variant?: 'primary' | 'success' | 'warning' | 'danger'
  hint?: ReactNode
  delay?: number
}

const variants = {
  primary: 'kpi-gradient',
  success: 'kpi-gradient-emerald',
  warning: 'kpi-gradient-amber',
  danger: 'kpi-gradient-rose',
} as const

/**
 * Карточка KPI. Гарантирует фиксированную высоту и обрезку контента,
 * чтобы при огромных числах верстка не разъезжалась.
 */
export default function StatCard({
  title,
  value,
  format = 'number',
  suffix,
  prefix,
  icon,
  trend,
  variant = 'primary',
  hint,
  delay = 0,
}: Props) {
  // Приводим значение к компактной строке. Если value уже строка — оставляем как есть.
  let displayValue: string
  if (typeof value === 'string') {
    displayValue = value
  } else if (format === 'money') {
    displayValue = formatMoneyCompact(value)
  } else if (format === 'number') {
    displayValue = formatNumberCompact(value)
  } else {
    displayValue = String(value)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -3 }}
      className={`glass glass-hover ${variants[variant]}`}
      style={{
        padding: 18,
        minHeight: 128,
        maxHeight: 160,
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <Text
          type="secondary"
          style={{
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '70%',
          }}
        >
          {title}
        </Text>
        {icon && (
          <div className="text-lg" style={{ color: 'var(--sp-primary-deep)', opacity: 0.85 }}>
            {icon}
          </div>
        )}
      </div>

      <Tooltip title={typeof value === 'number' ? value.toLocaleString(uiLanguage() === 'en' ? 'en-US' : uiLanguage() === 'tg' ? 'tg-TJ' : 'ru-RU') : undefined}>
        <div
          className="sp-num"
          style={{
            fontWeight: 800,
            fontSize: 26,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: 4,
          }}
        >
          {prefix}
          {displayValue}
          {suffix}
        </div>
      </Tooltip>

      {(trend !== undefined || hint) && (
        <div
          className="mt-2 flex items-center gap-2"
          style={{ fontSize: 12, overflow: 'hidden' }}
        >
          {trend !== undefined && isFinite(trend) && (
            <Tooltip title={uiText("Изменение к прошлому месяцу")}>
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                style={{
                  background: trend >= 0 ? 'var(--sp-primary-soft)' : 'var(--sp-rose-soft)',
                  color: trend >= 0 ? 'var(--sp-primary-deep)' : 'var(--sp-rose-deep)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {trend >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                {Math.abs(trend).toFixed(1)}%
              </span>
            </Tooltip>
          )}
          {hint && (
            <Text
              type="secondary"
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {hint}
            </Text>
          )}
        </div>
      )}
    </motion.div>
  )
}
