import { memo } from 'react'

interface Star {
  x: number
  y: number
  r: number
  d: number
}

/** Звёзды для тёмной темы. Расположение детерминированное — без случайных скачков при рендере. */
const STARS: Star[] = (() => {
  const out: Star[] = []
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 38; i++) {
    out.push({
      x: Math.round(rnd() * 1000) / 10,
      y: Math.round(rnd() * 560) / 10,
      r: 1 + Math.round(rnd() * 20) / 10,
      d: Math.round(rnd() * 30) / 10,
    })
  }
  return out
})()

/**
 * Фон приложения: закат над горами (светлая тема) или ночное небо со звёздами
 * (тёмная). Цвета берутся из CSS-переменных --bd-* в index.css, поэтому
 * компонент не зависит от состояния темы. Лежит под всем контентом
 * (position: fixed; z-index: -1) и не перехватывает клики.
 */
function AppBackdrop() {
  return (
    <div className="app-backdrop" aria-hidden="true" data-testid="app-backdrop">
      <div className="bd-orb" />
      <div className="bd-blob" />
      {STARS.map((s, i) => (
        <span
          key={i}
          className="bd-star"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r,
            height: s.r,
            animationDelay: `${s.d}s`,
          }}
        />
      ))}
      <svg className="bd-mount bd-m1" viewBox="0 0 1600 420" preserveAspectRatio="none">
        <path d="M0 420 L0 250 L160 130 L300 220 L460 90 L620 210 L780 120 L940 230 L1100 100 L1260 200 L1420 130 L1600 220 L1600 420 Z" />
      </svg>
      <svg className="bd-mount bd-m2" viewBox="0 0 1600 360" preserveAspectRatio="none">
        <path d="M0 360 L0 220 L200 110 L360 200 L560 80 L760 190 L940 110 L1140 210 L1340 120 L1600 200 L1600 360 Z" />
      </svg>
    </div>
  )
}

export default memo(AppBackdrop)
