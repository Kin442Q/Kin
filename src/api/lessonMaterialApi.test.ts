import { describe, it, expect, vi, beforeEach } from 'vitest'

const get = vi.fn()
const post = vi.fn()
const del = vi.fn()
vi.mock('./http', () => ({
  http: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    delete: (...a: unknown[]) => del(...a),
    defaults: { baseURL: '/api' },
  },
}))

import { LESSON_MATERIAL_TTL_DAYS, buildMaterialInput, daysWord, expiryText, lessonMaterialApi } from './lessonMaterialApi'
import { libraryApi } from './learningApi'

beforeEach(() => {
  ;[get, post, del].forEach((m) => m.mockReset())
  get.mockResolvedValue({ data: [] })
  post.mockResolvedValue({ data: {} })
  del.mockResolvedValue({ data: {} })
})

describe('lessonMaterialApi', () => {
  it('list → GET /v1/lesson-materials с фильтрами', async () => {
    await lessonMaterialApi.list({ groupId: 'g1', subjectId: 's1' })
    expect(get).toHaveBeenCalledWith('/v1/lesson-materials', { params: { groupId: 'g1', subjectId: 's1' } })
  })

  it('create → POST /v1/lesson-materials с телом', async () => {
    const body = { groupId: 'g1', title: 'Тема 5', fileId: 'f1' }
    await lessonMaterialApi.create(body)
    expect(post).toHaveBeenCalledWith('/v1/lesson-materials', body)
  })

  it('remove → DELETE /v1/lesson-materials/:id; fileLink → GET …/file-link', async () => {
    await lessonMaterialApi.remove('m1')
    expect(del).toHaveBeenCalledWith('/v1/lesson-materials/m1')
    await lessonMaterialApi.fileLink('m1')
    expect(get).toHaveBeenCalledWith('/v1/lesson-materials/m1/file-link')
  })

  it('upload → POST /v1/lesson-materials/upload (multipart)', async () => {
    post.mockResolvedValue({ data: { id: 'f1' } })
    await lessonMaterialApi.upload(new File(['x'], 'a.pdf'))
    expect(post.mock.calls[0][0]).toBe('/v1/lesson-materials/upload')
  })
})

describe('libraryApi — файлы', () => {
  it('upload → POST /v1/library/upload; fileLink → GET /v1/library/:id/file-link', async () => {
    post.mockResolvedValue({ data: { id: 'f1' } })
    await libraryApi.upload(new File(['x'], 'a.pdf'))
    expect(post.mock.calls[0][0]).toBe('/v1/library/upload')
    await libraryApi.fileLink('i1')
    expect(get).toHaveBeenCalledWith('/v1/library/i1/file-link')
  })
})

describe('подписи срока', () => {
  it('склонение «день / дня / дней»', () => {
    const w = (n: number) => `${n} ${daysWord(n)}`
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 30].map(w)).toEqual([
      '1 день', '2 дня', '4 дня', '5 дней', '11 дней', '12 дней', '14 дней', '21 день', '22 дня', '25 дней', '30 дней',
    ])
  })

  it('«удалится сегодня / завтра / через N дней»', () => {
    expect(expiryText(0)).toBe('удалится сегодня')
    expect(expiryText(1)).toBe('удалится завтра')
    expect(expiryText(3)).toBe('удалится через 3 дня')
    expect(expiryText(30)).toBe('удалится через 30 дней')
  })

  it('срок хранения — 30 дней (как на сервере)', () => {
    expect(LESSON_MATERIAL_TTL_DAYS).toBe(30)
  })
})

describe('buildMaterialInput — что уходит на сервер', () => {
  const file = { id: 'f1', name: 'a.pdf', size: 10, mime: 'application/pdf' }

  it('нужен хотя бы файл, ссылка или текст; пробелы не считаются', () => {
    expect(buildMaterialInput({ groupId: 'g1', title: 'T' })).toEqual({ error: expect.stringMatching(/файл, ссылку или текст/) })
    expect(buildMaterialInput({ groupId: 'g1', title: 'T', description: '   ', url: ' ', file: null })).toHaveProperty('error')
  })

  it('достаточно одного из трёх; пустое превращается в null, название и текст обрезаются', () => {
    expect(buildMaterialInput({ groupId: 'g1', title: ' Тема ', description: ' Прочитать ' })).toEqual({
      body: { groupId: 'g1', subjectId: null, title: 'Тема', description: 'Прочитать', url: null, fileId: null },
    })
    expect(buildMaterialInput({ groupId: 'g1', title: 'T', url: ' https://youtu.be/x ', subjectId: 's1' })).toEqual({
      body: { groupId: 'g1', subjectId: 's1', title: 'T', description: null, url: 'https://youtu.be/x', fileId: null },
    })
    expect(buildMaterialInput({ groupId: 'g1', title: 'T', file })).toEqual({
      body: { groupId: 'g1', subjectId: null, title: 'T', description: null, url: null, fileId: 'f1' },
    })
  })
})
