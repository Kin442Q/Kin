import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfigProvider } from 'antd'
import StatCard from './StatCard'

const wrap = (ui: React.ReactNode) =>
  render(<ConfigProvider>{ui}</ConfigProvider>)

describe('<StatCard>', () => {
  it('рендерит title и value', () => {
    wrap(<StatCard title="Дети" value={50} />)
    expect(screen.getByText('Дети')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('format=money форматирует в сомони', () => {
    wrap(<StatCard title="Доход" value={12500} format="money" />)
    expect(screen.getByText(/12,5 тыс/)).toBeInTheDocument()
    expect(screen.getByText(/сомони/)).toBeInTheDocument()
  })

  it('format=number компактно форматирует', () => {
    wrap(<StatCard title="Всего" value={12500} format="number" />)
    expect(screen.getByText('12,5 тыс.')).toBeInTheDocument()
  })

  it('format=raw оставляет как есть', () => {
    wrap(<StatCard title="Код" value={123456} format="raw" />)
    expect(screen.getByText('123456')).toBeInTheDocument()
  })

  it('строковое значение не форматирует', () => {
    wrap(<StatCard title="Статус" value="OK" />)
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('рендерит hint если передан', () => {
    wrap(<StatCard title="X" value={1} hint="дополнительно" />)
    expect(screen.getByText('дополнительно')).toBeInTheDocument()
  })

  it('рендерит trend (положительный)', () => {
    wrap(<StatCard title="X" value={100} trend={5.5} />)
    expect(screen.getByText(/5\.5/)).toBeInTheDocument()
  })
})
