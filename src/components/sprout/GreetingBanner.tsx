import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface Props {
  /** Строка над заголовком: дата, четверть */
  eyebrow?: ReactNode
  /** Приветствие: «Добрый день, Малика!» */
  title: ReactNode
  subtitle?: ReactNode
  /** Кнопки быстрых действий справа */
  actions?: ReactNode
}

/**
 * Приветственная плашка кабинета (как на макете «Кабинет директора»):
 * дата, крупное приветствие, подпись и быстрые действия. Внизу — тихая
 * гряда гор, как на фоне приложения.
 */
export default function GreetingBanner({ eyebrow, title, subtitle, actions }: Props) {
  return (
    <motion.section
      className="sp-card sp-greeting"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <svg
        className="sp-greeting-mount"
        viewBox="0 0 1600 200"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M0 200 L0 120 L220 40 L420 120 L640 30 L860 120 L1060 50 L1280 130 L1600 60 L1600 200 Z" />
      </svg>
      <div className="sp-greeting-text">
        {eyebrow && <span className="sp-greeting-eyebrow">{eyebrow}</span>}
        <h1 className="sp-greeting-title">{title}</h1>
        {subtitle && <p className="sp-greeting-sub">{subtitle}</p>}
      </div>
      {actions && <div className="sp-greeting-actions">{actions}</div>}
    </motion.section>
  )
}
