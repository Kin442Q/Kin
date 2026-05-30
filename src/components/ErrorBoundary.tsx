import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Глобальный перехватчик ошибок рендера. Без него любая ошибка в компоненте
 * (например несовместимая библиотека) роняет весь экран в белизну. Здесь же
 * показываем понятный фоллбэк с кнопкой перезагрузки.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Точка интеграции с внешним мониторингом (Sentry и т.п.) в будущем.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: '#F7F5EF',
          fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 440,
            textAlign: 'center',
            background: '#fff',
            border: '1px solid #E8E4DA',
            borderRadius: 20,
            padding: '36px 28px',
            boxShadow: '0 12px 40px -12px rgba(31,45,39,0.15)',
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 12 }}>🌧️</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1F2D27', margin: 0 }}>
            Что-то пошло не так
          </h1>
          <p style={{ fontSize: 14, color: '#5C6B63', marginTop: 8, lineHeight: 1.5 }}>
            Произошла ошибка при отображении страницы. Попробуйте обновить —
            обычно это помогает. Если повторяется, сообщите администратору.
          </p>

          {import.meta.env.DEV && this.state.error && (
            <pre
              style={{
                textAlign: 'left',
                fontSize: 11,
                color: '#b91c1c',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 10,
                padding: 10,
                marginTop: 14,
                maxHeight: 160,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {this.state.error.message}
            </pre>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '11px 20px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg,#4FB286,#3D9970)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Обновить страницу
            </button>
            <button
              onClick={this.reset}
              style={{
                padding: '11px 20px',
                borderRadius: 12,
                border: '1px solid #E8E4DA',
                background: '#fff',
                color: '#1F2D27',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    )
  }
}
