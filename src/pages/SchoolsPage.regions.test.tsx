import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App as AntdApp } from 'antd'

vi.mock('../api', () => ({ http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('../api/regionsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/regionsApi')>()
  return { ...actual, regionsApi: { tree: vi.fn() } }
})

import { http } from '../api'
import { regionsApi } from '../api/regionsApi'
import SchoolsPage from './SchoolsPage'

vi.setConfig({ testTimeout: 40_000 })
configure({ asyncUtilTimeout: 15_000 })

const tree = [
  {
    id: 'rg_sughd', code: 'SUGHD', nameRu: 'Согдийская область', nameTg: 'Вилояти Суғд', nameEn: 'Sughd Region', centerRu: 'Худжанд',
    districts: [
      { id: 'ds_sughd_khujand_city', code: 'SUGHD-KHUJAND-CITY', kind: 'CITY' as const, nameRu: 'город Худжанд', nameTg: 'шаҳри Хуҷанд', nameEn: 'Khujand city' },
      { id: 'ds_sughd_asht', code: 'SUGHD-ASHT', kind: 'DISTRICT' as const, nameRu: 'Аштский район', nameTg: 'ноҳияи Ашт', nameEn: 'Asht district' },
    ],
  },
  {
    id: 'rg_khatlon', code: 'KHATLON', nameRu: 'Хатлонская область', nameTg: 'Вилояти Хатлон', nameEn: 'Khatlon Region', centerRu: 'Бохтар',
    districts: [{ id: 'ds_khatlon_vakhsh', code: 'KHATLON-VAKHSH', kind: 'DISTRICT' as const, nameRu: 'Вахшский район', nameTg: 'ноҳияи Вахш', nameEn: 'Vakhsh district' }],
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <AntdApp>
        <SchoolsPage />
      </AntdApp>
    </MemoryRouter>,
  )
}

async function openForm() {
  // в jsdom экран «узкий»: кнопка называется «Новая»
  fireEvent.click(await screen.findByRole('button', { name: /Новая/ }))
  await screen.findByText('Первый администратор', { exact: false })
}

function fillOwner() {
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Школа №1' } })
  fireEvent.change(screen.getByLabelText('ФИО владельца'), { target: { value: 'Иван Иванов' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ivan@school.tj' } })
}

describe('форма школы: область → район и шкала оценок', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset().mockResolvedValue({ data: [] } as never)
    vi.mocked(http.post).mockReset().mockResolvedValue({ data: { kindergarten: { id: 'k1' }, invite: { sent: true, email: 'ivan@school.tj' } } } as never)
    vi.mocked(regionsApi.tree).mockReset().mockResolvedValue(tree)
  })

  it('сначала выбирается область, потом её район; на сервер уходит район и шкала по умолчанию', async () => {
    renderPage()
    await openForm()
    fillOwner()

    fireEvent.mouseDown(screen.getByLabelText('Область и район'))
    // области видны сразу, районы — только после выбора области
    expect(await screen.findByText('Согдийская область')).toBeInTheDocument()
    expect(screen.getByText('Хатлонская область')).toBeInTheDocument()
    expect(screen.queryByText('Аштский район')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Согдийская область'))
    expect(await screen.findByText('Аштский район')).toBeInTheDocument()
    expect(screen.getByText('город Худжанд')).toBeInTheDocument()
    // районы другой области не показываются
    expect(screen.queryByText('Вахшский район')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Аштский район'))
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1))
    const [url, body] = vi.mocked(http.post).mock.calls[0] as [string, Record<string, unknown>]
    expect(url).toBe('/v1/kindergartens')
    expect(body).toMatchObject({ name: 'Школа №1', districtId: 'ds_sughd_asht', gradeScale: 'FIVE', owner: { fullName: 'Иван Иванов', email: 'ivan@school.tj' } })
  })

  it('без выбора области и района школу создать нельзя: подсказка и ни одного запроса', async () => {
    renderPage()
    await openForm()
    fillOwner()

    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

    expect(await screen.findByText('Выберите область и район')).toBeInTheDocument()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('в таблице у школы видны район и область, у старой школы без района — «Не указан»', async () => {
    const common = { slug: 's', address: null, phone: null, isActive: true, createdAt: '2026-11-01T00:00:00Z', gradeScale: 'FIVE', stats: { usersCount: 1, groupsCount: 2, studentsCount: 3 } }
    vi.mocked(http.get).mockResolvedValue({
      data: [
        { ...common, id: 'a', name: 'Школа Ашт', districtId: 'ds_sughd_asht', district: { id: 'ds_sughd_asht', nameRu: 'Аштский район', nameTg: 'ноҳияи Ашт', nameEn: 'Asht district' }, region: { id: 'rg_sughd', nameRu: 'Согдийская область', nameTg: 'Вилояти Суғд', nameEn: 'Sughd Region' } },
        { ...common, id: 'b', name: 'Старая школа', districtId: null, district: null, region: null },
      ],
    } as never)

    renderPage()

    expect(await screen.findByText('Аштский район')).toBeInTheDocument()
    expect(screen.getByText('Согдийская область')).toBeInTheDocument()
    expect(screen.getByText('Не указан')).toBeInTheDocument()
  })
})
