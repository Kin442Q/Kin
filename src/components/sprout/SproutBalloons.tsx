import { useMemo } from 'react'

/**
 * Декоративная анимация — цветные шарики поднимаются вверх в фоне sidebar.
 * Каждый шарик имеет свою задержку, длительность и амплитуду покачивания,
 * чтобы они не двигались в унисон. Используется absolute-позиционирование.
 */
export default function SproutBalloons() {
  const balloons = useMemo(() => {
    const palette = [
      { c: '#A8D8F0', s: '#5BA9D1' }, // soft blue
      { c: '#FFE08A', s: '#E5B43A' }, // yellow
      { c: '#D8EFE3', s: '#4FB286' }, // mint
      { c: '#F4B5B5', s: '#D86464' }, // rose
      { c: '#C7B8E8', s: '#9B7BD4' }, // lilac
      { c: '#A8D8F0', s: '#5BA9D1' },
      { c: '#FFE08A', s: '#E5B43A' },
      { c: '#D8EFE3', s: '#4FB286' },
    ]
    return palette.map((p, i) => ({
      ...p,
      size: 14 + (i % 4) * 4, // 14, 18, 22, 26 px
      x: 8 + ((i * 53) % 90), // pseudo-random horizontal start (%)
      delay: (i * 1.3) % 9,
      duration: 9 + (i % 4) * 2.5, // 9–16.5s
    }))
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 260,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        maskImage: 'linear-gradient(to top, black 60%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to top, black 60%, transparent 100%)',
      }}
    >
      {balloons.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${b.x}%`,
            bottom: -40,
            animation: `sp-balloon-rise ${b.duration}s linear ${b.delay}s infinite, sp-balloon-sway ${b.duration / 3}s ease-in-out ${b.delay}s infinite`,
          }}
        >
          <svg width={b.size} height={b.size * 1.4} viewBox="0 0 30 42" fill="none">
            <ellipse cx="15" cy="15" rx="12" ry="14" fill={b.c} />
            <ellipse cx="10" cy="10" rx="3" ry="5" fill="white" opacity="0.55" />
            <path d="M13 28 L17 28 L15 31 Z" fill={b.s} />
            <path
              d="M15 31 Q13 35 15 38 Q17 41 15 42"
              stroke={b.s}
              strokeWidth="0.8"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>
      ))}
    </div>
  )
}
