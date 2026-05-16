import { useEffect, useRef, useState } from 'react'
import { Button, Spin, App as AntdApp } from 'antd'
import { Camera, Check, RefreshCw, X } from 'lucide-react'
import {
  loadFaceModels,
  detectDescriptor,
  startCamera,
  stopCamera,
  compareDescriptors,
  FACE_MATCH_THRESHOLD,
} from '../../lib/face'
import { SP } from '../sprout'

interface Props {
  /**
   * Режим:
   * - 'register' — снять лицо для последующего сохранения (onCapture(descriptor))
   * - 'verify'   — сравнить с уже сохранённым (verifyAgainst) и вернуть результат
   */
  mode: 'register' | 'verify'
  /** Сохранённый дескриптор для verify-режима */
  verifyAgainst?: number[] | null
  /** Колбэк при удачной съёмке/верификации */
  onSuccess: (descriptor: number[]) => void
  onCancel?: () => void
  /** Высота видео-окна */
  height?: number
}

/**
 * Универсальный компонент съёмки лица: запускает камеру, рисует круглую
 * рамку, по кнопке делает снимок и извлекает дескриптор.
 *
 * В режиме 'verify' автоматически сравнивает с verifyAgainst.
 */
export default function FaceCapture({
  mode,
  verifyAgainst,
  onSuccess,
  onCancel,
  height = 320,
}: Props) {
  const { message } = AntdApp.useApp()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<
    'loading-models' | 'starting-camera' | 'ready' | 'capturing' | 'error'
  >('loading-models')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        setStatus('loading-models')
        await loadFaceModels()
        if (cancelled) return

        setStatus('starting-camera')
        const stream = await startCamera()
        if (cancelled) {
          stopCamera(stream)
          return
        }
        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('ready')
      } catch (e: any) {
        const msg = e?.message || String(e)
        setError(
          msg.includes('Permission')
            ? 'Доступ к камере запрещён. Разрешите его в настройках браузера.'
            : msg.includes('NotFoundError')
              ? 'Камера не найдена на устройстве.'
              : msg,
        )
        setStatus('error')
      }
    }

    init()

    return () => {
      cancelled = true
      stopCamera(streamRef.current)
      streamRef.current = null
    }
  }, [])

  const capture = async () => {
    if (!videoRef.current || status !== 'ready') return
    setStatus('capturing')

    try {
      const descriptor = await detectDescriptor(videoRef.current)
      if (!descriptor) {
        message.error('Лицо не обнаружено. Поднесите лицо к центру кадра.')
        setStatus('ready')
        return
      }

      if (mode === 'verify') {
        if (!verifyAgainst || verifyAgainst.length !== 128) {
          message.error('Эталонный дескриптор не задан')
          setStatus('ready')
          return
        }
        const distance = compareDescriptors(descriptor, verifyAgainst)
        if (distance >= FACE_MATCH_THRESHOLD) {
          message.error(
            `Лицо не совпадает (точность ${(1 - distance).toFixed(2)}). Попробуйте ещё раз.`,
          )
          setStatus('ready')
          return
        }
        message.success(`Распознано (точность ${(1 - distance).toFixed(2)})`)
      }

      onSuccess(descriptor)
    } catch (e: any) {
      message.error(e?.message || 'Ошибка распознавания')
      setStatus('ready')
    }
  }

  const isLoading = status === 'loading-models' || status === 'starting-camera'
  const loadingText =
    status === 'loading-models'
      ? 'Загружаем модели распознавания...'
      : status === 'starting-camera'
        ? 'Включаем камеру...'
        : ''

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: height,
          height: height,
          borderRadius: '50%',
          overflow: 'hidden',
          background: SP.surfaceAlt,
          border: `4px solid ${
            status === 'error'
              ? SP.danger
              : status === 'ready'
                ? SP.primary
                : SP.border
          }`,
          transition: 'border-color 0.2s',
          boxShadow: status === 'ready' ? '0 0 0 6px rgba(79,178,134,0.15)' : 'none',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', // mirror, как селфи
            display: status === 'error' ? 'none' : 'block',
          }}
        />

        {isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.85)',
              color: SP.text,
              fontSize: 13,
              textAlign: 'center',
              padding: 16,
            }}
          >
            <Spin size="large" />
            <div style={{ marginTop: 12 }}>{loadingText}</div>
          </div>
        )}

        {status === 'error' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: SP.surfaceAlt,
              color: SP.danger,
              fontSize: 13,
              textAlign: 'center',
              padding: 24,
            }}
          >
            <X size={32} />
            <div style={{ marginTop: 8 }}>{error}</div>
          </div>
        )}

        {status === 'capturing' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(79,178,134,0.2)',
            }}
          >
            <Spin size="large" />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {onCancel && (
          <Button onClick={onCancel} icon={<X size={14} />}>
            Отмена
          </Button>
        )}
        {status === 'error' ? (
          <Button
            type="primary"
            icon={<RefreshCw size={14} />}
            onClick={() => window.location.reload()}
          >
            Перезагрузить
          </Button>
        ) : (
          <Button
            type="primary"
            disabled={status !== 'ready'}
            loading={status === 'capturing'}
            icon={mode === 'register' ? <Camera size={14} /> : <Check size={14} />}
            onClick={capture}
            style={{ minWidth: 200, height: 44 }}
          >
            {mode === 'register' ? 'Снять и сохранить' : 'Подтвердить лицо'}
          </Button>
        )}
      </div>
    </div>
  )
}
