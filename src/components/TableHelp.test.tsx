import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'

import { HelpLabel, TableTitle, helpColumns, type HelpMap } from './TableHelp'

interface Row {
  id: string
  name: string
  grades: number
  value: number | null
}

const ROWS: Row[] = [
  { id: 'a', name: 'Школа А', grades: 120, value: 80 },
  { id: 'b', name: 'Школа Б', grades: 0, value: null },
]

const HELP: HelpMap<Row> = {
  'Средний балл': {
    help: 'Среднее за период в процентах от шкалы.',
    basis: (r) => (r.grades > 0 ? `По ${r.grades} оценкам` : 'Нет данных'),
  },
  'Свой цвет': { help: 'Только заголовок.', cell: false },
}

const COLUMNS: ColumnsType<Row> = [
  { title: 'Школа', dataIndex: 'name', key: 'name' },
  { title: 'Средний балл', dataIndex: 'value', key: 'value', render: (v: number | null) => (v == null ? '—' : `${v} %`) },
  { title: 'Свой цвет', dataIndex: 'value', key: 'color', render: (v: number | null) => <i data-testid="own">{v}</i> },
]

describe('helpColumns', () => {
  it('колонки без пояснения остаются как были', () => {
    const out = helpColumns(COLUMNS, { rowLabel: (r) => r.name, help: HELP })
    expect(out[0]).toBe(COLUMNS[0])
  })

  it('колонка с пояснением получает заголовок-подсказку, сортировка и ключи сохраняются', () => {
    const sortable: ColumnsType<Row> = [{ ...COLUMNS[1], sorter: (a, b) => (a.value ?? 0) - (b.value ?? 0) }]
    const out = helpColumns(sortable, { rowLabel: (r) => r.name, help: HELP })
    expect(typeof out[0].title).not.toBe('string')
    expect((out[0] as { sorter?: unknown }).sorter).toBeDefined()
    expect(out[0].key).toBe('value')
  })

  it('значения в ячейках отображаются как раньше', () => {
    render(<Table<Row> rowKey="id" pagination={false} dataSource={ROWS} columns={helpColumns(COLUMNS, { rowLabel: (r) => r.name, help: HELP })} />)
    expect(screen.getByText('80 %')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('Школа А')).toBeInTheDocument()
  })

  it('«только заголовок»: значение в ячейке не оборачивается в подсказку', () => {
    const out = helpColumns(COLUMNS, { rowLabel: (r) => r.name, help: HELP })
    // оригинальная отрисовка сохранена без обёртки
    expect((out[2] as { render: unknown }).render).toBe((COLUMNS[2] as { render: unknown }).render)
    expect(typeof out[2].title).not.toBe('string')
  })

  it('заголовок колонки показывает пояснение при наведении на значок', async () => {
    render(<Table<Row> rowKey="id" pagination={false} dataSource={ROWS} columns={helpColumns(COLUMNS, { rowLabel: (r) => r.name, help: HELP })} />)
    const header = screen.getAllByText('Средний балл')[0]
    header.focus?.()
    // антд открывает подсказку по наведению/фокусу; проверяем, что обёртка фокусируема (доступна с клавиатуры)
    expect(header.closest('span[tabindex="0"]')).not.toBeNull()
  })
})

describe('HelpLabel и TableTitle', () => {
  it('подпись фокусируется клавишей Tab и показывает текст заголовка', () => {
    render(<HelpLabel title="Посещаемость" help="Доля присутствовавших." />)
    expect(screen.getByText('Посещаемость').closest('span[tabindex="0"]')).not.toBeNull()
  })

  it('название таблицы выводит заголовок', () => {
    render(<TableTitle title="По областям" what="Итоги по областям." how="Суммы по школам." />)
    expect(screen.getByText('По областям')).toBeInTheDocument()
  })
})
