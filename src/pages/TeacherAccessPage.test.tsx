import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App as AntdApp } from 'antd'

vi.mock('../api', () => ({ http: { get: vi.fn(), patch: vi.fn() } }))

import { http } from '../api'
import { useDataStore } from '../store/dataStore'
import TeacherAccessPage from './TeacherAccessPage'

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

const teacher = {
  id: 't1',
  fullName: 'Рахимова Нигина',
  email: 'n@school.tj',
  phone: null,
  groupId: 'g1',
  isActive: true,
  teachingGroups: [{ id: 'g1', name: '4 А' }],
  teachingSubjects: [{ id: 's1', name: 'Математика' }],
}
const subjects = [
  { id: 's1', name: 'Математика', color: '#0D7A7C' },
  { id: 's2', name: 'Рисование', color: '#FF8A65' },
]

/** Ждём, пока выбранный учитель подхватит сохранённый доступ (черновик заполняется отдельным эффектом). */
async function renderReady() {
  renderPage()
  const math = await screen.findByRole('button', { name: 'Математика' })
  await waitFor(() => expect(math).toHaveAttribute('aria-pressed', 'true'))
  return math
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AntdApp>
        <TeacherAccessPage />
      </AntdApp>
    </MemoryRouter>,
  )
}

describe('Доступ учителей — предметы', () => {
  beforeEach(() => {
    useDataStore.setState({ groups: [{ id: 'g1', name: '4 А' } as never] })
    vi.mocked(http.patch).mockReset()
    vi.mocked(http.get).mockReset().mockImplementation(async (url: string) =>
      ({ data: url === '/v1/subjects' ? subjects : [teacher] }) as never,
    )
  })

  it('показывает предметы школы; выданные учителю отмечены', async () => {
    await renderReady()

    expect(screen.getByRole('button', { name: 'Рисование' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('выдать ещё один предмет: уходит только список предметов, классы не трогаются', async () => {
    vi.mocked(http.patch).mockResolvedValue({
      data: { id: 't1', teachingSubjects: subjects },
    } as never)
    await renderReady()

    fireEvent.click(screen.getByRole('button', { name: 'Рисование' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить доступ' }))

    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1))
    expect(http.patch).toHaveBeenCalledWith('/v1/teachers/t1/subjects', { subjectIds: ['s1', 's2'] })
  })

  it('снять все предметы: уходит пустой список', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: { id: 't1', teachingSubjects: [] } } as never)
    await renderReady()
    // «Снять все» относится и к классам, и к предметам; блок предметов — второй
    const clearButtons = screen.getAllByRole('button', { name: 'Снять все' })
    fireEvent.click(clearButtons[clearButtons.length - 1])
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить доступ' }))

    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1))
    expect(http.patch).toHaveBeenCalledWith('/v1/teachers/t1/subjects', { subjectIds: [] })
  })

  it('без изменений кнопка «Сохранить доступ» выключена', async () => {
    await renderReady()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить доступ' })).toBeDisabled())
  })
})
