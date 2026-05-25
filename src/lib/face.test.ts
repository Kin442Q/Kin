import { describe, it, expect, vi } from 'vitest'

// face-api.js тянет tfjs — мокаем, нам нужны только чистые функции сравнения.
vi.mock('face-api.js', () => ({
  nets: {
    tinyFaceDetector: { loadFromUri: vi.fn() },
    faceLandmark68Net: { loadFromUri: vi.fn() },
    faceRecognitionNet: { loadFromUri: vi.fn() },
  },
  TinyFaceDetectorOptions: class {},
  detectSingleFace: vi.fn(),
}))

import {
  compareDescriptors,
  isSameFace,
  FACE_MATCH_THRESHOLD,
} from './face'

describe('compareDescriptors', () => {
  it('одинаковые дескрипторы → расстояние 0', () => {
    expect(compareDescriptors([1, 2, 3], [1, 2, 3])).toBe(0)
  })

  it('евклидово расстояние считается верно', () => {
    // (0,0) → (3,4) = 5
    expect(compareDescriptors([0, 0], [3, 4])).toBe(5)
  })

  it('разная длина → Infinity', () => {
    expect(compareDescriptors([1, 2], [1, 2, 3])).toBe(Infinity)
  })
})

describe('isSameFace', () => {
  it('идентичные лица — true', () => {
    expect(isSameFace([0.1, 0.2], [0.1, 0.2])).toBe(true)
  })

  it('далёкие дескрипторы — false', () => {
    expect(isSameFace([0, 0], [1, 1])).toBe(false)
  })

  it('порог = FACE_MATCH_THRESHOLD', () => {
    expect(FACE_MATCH_THRESHOLD).toBe(0.55)
    // расстояние чуть меньше порога → совпадение
    const near = compareDescriptors([0, 0], [0.5, 0])
    expect(near < FACE_MATCH_THRESHOLD).toBe(true)
  })
})
