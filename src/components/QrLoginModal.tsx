import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Modal } from 'antd'
import { Camera } from 'lucide-react'

import { uiText } from '../i18n/uiText'
import { decodeQr, studentTokenFromQr } from '../lib/qrScan'

interface Props {
  open: boolean
  onClose: () => void
  /** Найден QR-код ученика: токен его личной ссылки. */
  onToken: (token: string) => void
}

type Problem = 'unsupported' | 'denied' | 'no-camera' | 'failed'

/** Камера: задняя, если она есть; разрешение скромное — для QR хватает, а разбор кадра быстрее. */
const VIDEO = { facingMode: { ideal: 'environment' }, width: { ideal: 960 }, height: { ideal: 720 } }
/** Кадр уменьшается до этой ширины перед разбором: на слабых телефонах иначе тормозит. */
const SCAN_WIDTH = 640
/** Не чаще чем раз в столько миллисекунд (около 8 кадров в секунду). */
const SCAN_EVERY_MS = 120

function problemOf(error: unknown): Problem {
  const name = (error as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-camera'
  return 'failed'
}

const PROBLEM_TEXT: Record<Problem, () => string> = {
  unsupported: () =>
    uiText('Этот браузер не умеет открывать камеру на странице. Наведите камеру телефона на код: откроется ваша личная ссылка.'),
  denied: () =>
    uiText('Нет доступа к камере. Разрешите её для сайта в настройках браузера или наведите камеру телефона на код.'),
  'no-camera': () => uiText('Камера не найдена. Наведите камеру телефона на код или войдите по логину и паролю.'),
  failed: () => uiText('Не удалось включить камеру. Попробуйте ещё раз или наведите камеру телефона на код.'),
}

/**
 * Вход ученика по QR-коду с карточки: камера открывается прямо на странице, читает код и передаёт
 * токен личной ссылки. Видео никуда не отправляется и не сохраняется: кадры разбираются в самом
 * браузере, камера выключается, как только код найден или окно закрыто.
 */
export default function QrLoginModal({ open, onClose, onToken }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // Родитель может передать новую функцию на каждой перерисовке: камеру из-за этого перезапускать нельзя.
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken
  const [problem, setProblem] = useState<Problem | null>(null)
  const [wrongCode, setWrongCode] = useState(false)
  const [starting, setStarting] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // Окно рисует <video> позже, чем стартует камера (содержимое монтируется при открытии): поток цепляем,
  // как только появятся оба.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current
      // iOS Safari не проигрывает видео без playsInline/muted (стоят в разметке) и явного play()
      void el.play?.()?.catch?.(() => undefined)
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    if (!open) return
    setProblem(null)
    setWrongCode(false)

    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem('unsupported')
      return
    }

    let cancelled = false
    let frame = 0
    let last = 0
    let wrongSince = 0
    setStarting(true)

    const scan = (now: number) => {
      if (cancelled) return
      frame = requestAnimationFrame(scan)
      if (now - last < SCAN_EVERY_MS) return
      last = now

      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return

      const scale = Math.min(1, SCAN_WIDTH / video.videoWidth)
      const width = Math.round(video.videoWidth * scale)
      const height = Math.round(video.videoHeight * scale)
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(video, 0, 0, width, height)
      const image = ctx.getImageData(0, 0, width, height)

      const text = decodeQr(image.data, width, height)
      if (!text) return
      const token = studentTokenFromQr(text)
      if (token) {
        cancelled = true
        cancelAnimationFrame(frame)
        stop()
        onTokenRef.current(token)
        return
      }
      // Код не наш (чужая ссылка, текст): говорим об этом, но продолжаем искать нужный.
      wrongSince = now
      setWrongCode(true)
      window.setTimeout(() => {
        if (!cancelled && performance.now() - wrongSince >= 2500) setWrongCode(false)
      }, 2600)
    }

    navigator.mediaDevices
      .getUserMedia({ video: VIDEO, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = s
        attachVideo(videoRef.current)
        setStarting(false)
        frame = requestAnimationFrame(scan)
      })
      .catch((error) => {
        if (cancelled) return
        setStarting(false)
        setProblem(problemOf(error))
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      stop()
    }
  }, [open, attempt, stop, attachVideo])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={uiText('Вход по QR-коду')}
      destroyOnClose
      centered
      width={420}
    >
      <p style={{ color: 'var(--sp-text-mid)', fontSize: 13.5, marginTop: 0 }}>
        {uiText('Поднесите QR-код с вашей карточки к камере. Код читается в самом браузере, видео никуда не отправляется.')}
      </p>

      {problem ? (
        <div>
          <Alert type="warning" showIcon message={PROBLEM_TEXT[problem]()} />
          {problem !== 'unsupported' && (
            <Button style={{ marginTop: 12 }} icon={<Camera size={16} />} onClick={() => setAttempt((n) => n + 1)}>
              {uiText('Попробовать ещё раз')}
            </Button>
          )}
        </div>
      ) : (
        <div>
          <div
            style={{
              position: 'relative',
              aspectRatio: '4 / 3',
              background: '#000',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <video
              ref={attachVideo}
              playsInline
              muted
              aria-label={uiText('Камера для чтения QR-кода')}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {/* Рамка-подсказка: куда поднести код */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: '18% 22%',
                border: '3px solid rgba(255,255,255,0.85)',
                borderRadius: 16,
                boxShadow: '0 0 0 999px rgba(0,0,0,0.28)',
                pointerEvents: 'none',
              }}
            />
            {starting && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 14 }}>
                {uiText('Включаем камеру…')}
              </div>
            )}
          </div>
          {wrongCode && (
            <Alert
              style={{ marginTop: 12 }}
              type="error"
              showIcon
              message={uiText('Это не QR-код ученика. Возьмите карточку, которую выдал классный руководитель.')}
            />
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      )}
    </Modal>
  )
}
