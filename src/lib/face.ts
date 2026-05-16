/**
 * Face recognition helper на базе face-api.js.
 *
 * Workflow:
 * 1. loadFaceModels() — один раз при старте teacher dashboard (~6MB с CDN)
 * 2. detectDescriptor(video) — снять с камеры → получить Float32Array (128)
 * 3. compareDescriptors(a, b) — евклидово расстояние; < 0.6 = одно лицо
 *
 * Модели загружаются с justadudewhohacks CDN (автор face-api.js).
 */

import * as faceapi from 'face-api.js'

/** URL для моделей. Лежат в JSDelivr CDN — стабильно и быстро. */
const MODEL_URL =
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model'

let modelsLoaded = false
let loadingPromise: Promise<void> | null = null

/**
 * Загрузить все нужные модели face-api (TinyFaceDetector + LandmarkNet + RecognitionNet).
 * Идемпотентно: повторный вызов не загрузит заново.
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
    modelsLoaded = true
  })()

  return loadingPromise
}

export function areModelsReady(): boolean {
  return modelsLoaded
}

/**
 * Извлечь дескриптор лица с видео-стрима.
 * @returns массив из 128 чисел или null, если лицо не найдено
 */
export async function detectDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<number[] | null> {
  if (!modelsLoaded) await loadFaceModels()

  const detection = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!detection) return null

  return Array.from(detection.descriptor)
}

/**
 * Евклидово расстояние между двумя дескрипторами.
 * < 0.6 — обычно одно лицо.
 */
export function compareDescriptors(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

/** Порог совпадения по умолчанию (face-api рекомендует 0.6). */
export const FACE_MATCH_THRESHOLD = 0.55

export function isSameFace(a: number[], b: number[]): boolean {
  return compareDescriptors(a, b) < FACE_MATCH_THRESHOLD
}

/**
 * Запросить медиа-поток с камеры. Возвращает stream — его нужно
 * приклеить к <video>.srcObject и не забыть остановить треки на cleanup.
 */
export async function startCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Камера не поддерживается этим браузером')
  }
  return navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 480 },
      height: { ideal: 360 },
      facingMode: 'user',
    },
    audio: false,
  })
}

export function stopCamera(stream: MediaStream | null) {
  if (!stream) return
  stream.getTracks().forEach((t) => t.stop())
}
