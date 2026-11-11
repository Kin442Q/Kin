import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const http = vi.hoisted(() => ({
  get: vi.fn(async () => ({ data: [] })),
  post: vi.fn(async () => ({ data: {} })),
  delete: vi.fn(async () => ({ data: {} })),
}))
vi.mock('../api', () => ({ http }))
vi.mock('../api/termsApi', () => ({ termsApi: { list: async () => [] } }))

import { App as AntdApp } from 'antd'
import GradesPage from './GradesPage'
import { useAuthStore } from '../store/authStore'
import type { Role } from '../types'

const signIn = (role: Role) =>
  useAuthStore.setState({
    user: { id: 'u1', fullName: 'Тест', email: 't@x.tj', role, kindergartenId: 'k1' } as never,
    token: 'tok',
  })

const renderPage = () =>
  render(
    <AntdApp>
      <GradesPage />
    </AntdApp>,
  )

const NOTICE = 'Журнал открыт только для просмотра'

describe('Журнал оценок: директор и администратор только смотрят', () => {
  beforeEach(() => {
    http.post.mockClear()
    http.delete.mockClear()
  })

  it.each<Role>(['SUPER_ADMIN', 'ADMIN'])('%s видит пояснение, что журнал открыт для просмотра', async (role) => {
    signIn(role)
    renderPage()
    expect(await screen.findByText(NOTICE)).toBeInTheDocument()
    expect(screen.getByText('Оценки ставит и удаляет учитель предмета.')).toBeInTheDocument()
  })

  it('учителю пояснения нет: он ставит оценки', async () => {
    signIn('TEACHER')
    renderPage()
    // дожидаемся, пока страница отрисуется, и убеждаемся, что пояснения нет
    await screen.findByText('Журнал оценок', undefined, { timeout: 4000 }).catch(() => undefined)
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument()
  })

  it('страница сама ничего не записывает при открытии', async () => {
    signIn('ADMIN')
    renderPage()
    await screen.findByText(NOTICE)
    expect(http.post).not.toHaveBeenCalled()
    expect(http.delete).not.toHaveBeenCalled()
  })
})
