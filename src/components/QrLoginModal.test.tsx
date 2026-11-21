import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, configure } from '@testing-library/react'
import { App as AntdApp } from 'antd'

vi.mock('../lib/qrScan', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/qrScan')>()
  return { ...actual, decodeQr: vi.fn() }
})

import { decodeQr } from '../lib/qrScan'
import QrLoginModal from './QrLoginModal'

vi.setConfig({ testTimeout: 40_000 })
configure({ asyncUtilTimeout: 15_000 })

const TOKEN = 'cmabc123xyz.AbCdEfGhIjKlMnOpQrStUv'

function renderModal(props: Partial<{ open: boolean; onClose: () => void; onToken: (t: string) => void }> = {}) {
  const onToken = props.onToken ?? vi.fn()
  const onClose = props.onClose ?? vi.fn()
  const ui = (open: boolean) => (
    <AntdApp>
      <QrLoginModal open={open} onClose={onClose} onToken={onToken} />
    </AntdApp>
  )
  const view = render(ui(props.open ?? true))
  return { ...view, onToken, onClose, setOpen: (open: boolean) => view.rerender(ui(open)) }
}

function fakeCamera() {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  const getUserMedia = vi.fn().mockResolvedValue(stream)
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  return { track, getUserMedia }
}

beforeEach(() => {
  vi.mocked(decodeQr).mockReset().mockReturnValue(null)
  // jsdom не показывает видео: подставляем «готовый кадр» и холст, чтобы цикл чтения работал
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => 4, configurable: true })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { get: () => 640, configurable: true })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { get: () => 480, configurable: true })
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
  })) as never
})

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
})

describe('QrLoginModal: вход ученика по QR с камеры', () => {
  it('браузер без камеры на странице: объясняет, что делать, и не падает', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    renderModal()
    expect(await screen.findByText(/не умеет открывать камеру/)).toBeInTheDocument()
    // повторять нечего — кнопки «ещё раз» нет
    expect(screen.queryByRole('button', { name: /Попробовать ещё раз/ })).not.toBeInTheDocument()
  })

  it('запретили камеру: понятный текст и возможность попробовать снова', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
    renderModal()
    expect(await screen.findByText(/Нет доступа к камере/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Попробовать ещё раз/ })).toBeInTheDocument()
  })

  it('камеры нет вообще: отдельное сообщение', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotFoundError' }))
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
    renderModal()
    expect(await screen.findByText(/Камера не найдена/)).toBeInTheDocument()
  })

  it('нашли QR ученика: камера выключается и передаётся только токен', async () => {
    const { track, getUserMedia } = fakeCamera()
    vi.mocked(decodeQr).mockReturnValue(`https://tahlilgar.cyou/s/${TOKEN}`)
    const { onToken } = renderModal()

    await waitFor(() => expect(onToken).toHaveBeenCalledWith(TOKEN))
    expect(onToken).toHaveBeenCalledTimes(1)
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }))
    expect(track.stop).toHaveBeenCalled()
  })

  it('чужой QR: сообщает, что код не ученика, и продолжает искать', async () => {
    fakeCamera()
    vi.mocked(decodeQr).mockReturnValue('https://example.com/promo')
    const { onToken } = renderModal()

    expect(await screen.findByText(/Это не QR-код ученика/)).toBeInTheDocument()
    expect(onToken).not.toHaveBeenCalled()
  })

  it('окно закрыли — камера выключается, чтобы не светилась индикатором', async () => {
    const { track, getUserMedia } = fakeCamera()
    const { setOpen } = renderModal()
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByLabelText('Камера для чтения QR-кода')).toBeInTheDocument())

    setOpen(false)
    await waitFor(() => expect(track.stop).toHaveBeenCalled())
  })

  it('закрытое окно камеру не включает', () => {
    const { getUserMedia } = fakeCamera()
    renderModal({ open: false })
    expect(getUserMedia).not.toHaveBeenCalled()
  })
})
