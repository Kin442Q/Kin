import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SP, SproutLogo } from '../components/sprout'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          background: SP.surface,
          border: `1px solid ${SP.borderSoft}`,
          borderRadius: 24,
          padding: '48px 56px',
          textAlign: 'center',
          maxWidth: 480,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Декоративные пузыри в фоне */}
        <div
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: SP.primaryGhost,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -40,
            left: -40,
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: SP.yellowSoft,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
            <SproutLogo size={22} showSubtitle={false} />
          </div>
          <div
            className="sp-num"
            style={{
              fontSize: 96,
              fontWeight: 800,
              lineHeight: 1,
              color: SP.primaryDeep,
              letterSpacing: '-0.04em',
            }}
          >
            404
          </div>
          <h2
            style={{
              margin: '12px 0 6px',
              fontSize: 22,
              fontWeight: 700,
              color: SP.text,
              letterSpacing: '-0.02em',
            }}
          >
            Страница не найдена
          </h2>
          <p
            style={{
              color: SP.muted,
              fontSize: 14,
              marginBottom: 28,
              lineHeight: 1.5,
            }}
          >
            Возможно, она переехала или ещё не выросла. Вернёмся на главную?
          </p>
          <button
            className="sp-btn-primary"
            style={{ padding: '12px 24px', fontSize: 14 }}
            onClick={() => navigate('/admin/dashboard')}
          >
            🌿 На главную
          </button>
        </div>
      </motion.div>
    </div>
  )
}
