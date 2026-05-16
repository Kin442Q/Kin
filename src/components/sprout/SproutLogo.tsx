import { SP } from './tokens'

interface Props {
  size?: number
  showSubtitle?: boolean
}

/**
 * Логотип «redi · kindergarten OS» с зелёным градиентным значком-листом.
 */
export default function SproutLogo({ size = 18, showSubtitle = true }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div
        style={{
          width: size * 1.6,
          height: size * 1.6,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${SP.primary}, ${SP.primaryDeep})`,
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 4px 12px -2px rgba(79,178,134,0.4)',
          flexShrink: 0,
        }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 21V11M12 11C12 7 9 4 6 4C6 8 9 11 12 11ZM12 11C12 7 15 4 18 4C18 8 15 11 12 11Z"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {showSubtitle && (
        <div>
          <div
            style={{
              fontWeight: 800,
              fontSize: size,
              letterSpacing: '-0.02em',
              color: SP.text,
              lineHeight: 1,
            }}
          >
            redi
          </div>
          <div
            style={{
              fontSize: 9.5,
              color: SP.muted,
              fontWeight: 500,
              marginTop: 2,
            }}
          >
            kindergarten OS
          </div>
        </div>
      )}
    </div>
  )
}
