import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import TermGradesCard from './TermGradesCard'
import type { StudentTermReport } from '../api/termGradesApi'

const subject = (id: string, name: string) => ({ id, name, color: '#3B8FBF' })

const REPORT: StudentTermReport = {
  scaleMax: 5,
  terms: [
    {
      id: 'q1',
      name: '1 четверть',
      startDate: '2026-09-01',
      endDate: '2026-11-01',
      finished: true,
      subjects: [
        { subject: subject('s1', 'Алгебра'), value: 4, source: 'SYSTEM', date: '2026-10-30', average: 3.5, count: 2 },
      ],
    },
    {
      id: 'q2',
      name: '2 четверть',
      startDate: '2026-11-09',
      endDate: '2026-12-27',
      finished: false,
      subjects: [
        { subject: subject('s1', 'Алгебра'), value: 5, source: 'TEACHER', date: '2026-11-25T08:00:00.000Z', average: 3, count: 1 },
        { subject: subject('s2', 'Физика'), value: 3, source: 'SYSTEM', date: '2026-11-20', average: 3, count: 4 },
      ],
    },
  ],
}

describe('Итоги четвертей у ученика и родителя', () => {
  it('сначала поздняя четверть; помечено, кто поставил, а расчётная до конца четверти — предварительная', () => {
    render(<TermGradesCard report={REPORT} />)
    const rows = screen.getAllByTestId('term-grade-row')
    expect(rows.map((r) => r.textContent)).toEqual([
      'АлгебраПоставил учитель · 25.11.20265',
      'ФизикаРасчётная · средний балл 3, оценок: 4 · предварительно3',
    ])
    expect(screen.getByLabelText('Итог: 5, поставил учитель')).toBeInTheDocument()
    expect(screen.getByLabelText('Итог: 3, расчётная')).toBeInTheDocument()
  })

  it('в законченной четверти расчётная — без «предварительно»', () => {
    render(<TermGradesCard report={REPORT} />)
    fireEvent.click(screen.getByText('1 четверть'))
    expect(screen.getAllByTestId('term-grade-row')).toHaveLength(1)
    expect(screen.getByText('Расчётная · средний балл 3.5, оценок: 2')).toBeInTheDocument()
    expect(screen.queryByText(/предварительно/)).not.toBeInTheDocument()
  })

  it('без итогов (или раздел выключен) ничего не рисует', () => {
    const { container, rerender } = render(<TermGradesCard report={null} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<TermGradesCard report={{ scaleMax: 5, terms: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
