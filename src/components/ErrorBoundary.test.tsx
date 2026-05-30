import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

function Boom(): never {
  throw new Error('тестовый сбой')
}

describe('ErrorBoundary', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('рендерит детей, когда ошибки нет', () => {
    render(
      <ErrorBoundary>
        <div>всё хорошо</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('всё хорошо')).toBeInTheDocument()
  })

  it('показывает фоллбэк при ошибке рендера', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Что-то пошло не так')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Обновить страницу/ }),
    ).toBeInTheDocument()
  })
})
