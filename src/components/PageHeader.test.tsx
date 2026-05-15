import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfigProvider } from 'antd'
import PageHeader from './PageHeader'

function renderWithAntd(ui: React.ReactNode) {
  return render(<ConfigProvider>{ui}</ConfigProvider>)
}

describe('<PageHeader>', () => {
  it('рендерит заголовок', () => {
    renderWithAntd(<PageHeader title="Группы" />)
    expect(screen.getByText('Группы')).toBeInTheDocument()
  })

  it('рендерит описание если передано', () => {
    renderWithAntd(<PageHeader title="X" description="Описание страницы" />)
    expect(screen.getByText('Описание страницы')).toBeInTheDocument()
  })

  it('не рендерит описание если не передано', () => {
    renderWithAntd(<PageHeader title="X" />)
    expect(screen.queryByText(/Описание/)).not.toBeInTheDocument()
  })

  it('рендерит actions', () => {
    renderWithAntd(
      <PageHeader title="X" actions={<button>Действие</button>} />,
    )
    expect(screen.getByText('Действие')).toBeInTheDocument()
  })

  it('рендерит иконку', () => {
    renderWithAntd(
      <PageHeader title="X" icon={<span data-testid="icon">📊</span>} />,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})
