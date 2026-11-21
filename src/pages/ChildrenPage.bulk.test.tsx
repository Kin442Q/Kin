import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react'

const http = vi.hoisted(() => ({
  get: vi.fn(async () => ({ data: [] })),
  post: vi.fn(async () => ({ data: {} })),
  patch: vi.fn(async () => ({ data: {} })),
  delete: vi.fn(async () => ({ data: {} })),
}))
vi.mock('../api', () => ({ http }))
vi.mock('../api/schoolApi', () => ({
  studentsBulkApi: { remove: vi.fn() },
  studentAccountApi: { get: vi.fn(), issue: vi.fn(), classLinks: vi.fn() },
}))
vi.mock('../api/accessApi', () => ({ accessApi: {} }))

import { App as AntdApp } from 'antd'
import ChildrenPage from './ChildrenPage'
import { studentsBulkApi } from '../api/schoolApi'
import { useAuthStore } from '../store/authStore'
import { useDataStore } from '../store/dataStore'
import { useSyncTrigger } from '../hooks/useTenantSync'
import type { Child, Group, Role } from '../types'

// antd-таблица и окна в jsdom рисуются небыстро
vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

// Широкий экран: иначе страница рисует карточки для телефона, а не таблицу
beforeEach(() => {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    return {
      matches: min ? Number(min[1]) <= 1600 : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }
  }) as typeof window.matchMedia
})

const group = (id: string, name: string): Group => ({
  id,
  name,
  ageRange: '',
  monthlyFee: 0,
  fixedMonthlyExpense: 0,
  color: '#3B8FBF',
  createdAt: '2026-01-01',
})

const kid = (n: number, groupId: string, surname = 'Фамилия'): Child => ({
  id: `s${n}`,
  firstName: `Имя${n}`,
  lastName: `${surname}${n}`,
  birthDate: '2015-01-01',
  gender: 'male',
  groupId,
  createdAt: '2026-01-01',
  address: n === 1 ? 'ул. Тестовая, 1' : undefined,
})

/** 12 учеников 5А («Фамилия1…12») и 4 ученика 6Б («Другой13…16»). */
const seed = () => {
  useDataStore.setState({
    groups: [group('g5', '5А'), group('g6', '6Б')],
    children: [
      ...Array.from({ length: 12 }, (_, i) => kid(i + 1, 'g5')),
      ...Array.from({ length: 4 }, (_, i) => kid(i + 13, 'g6', 'Другой')),
    ],
  })
}

const signIn = (role: Role) =>
  useAuthStore.setState({
    user: { id: 'u1', fullName: 'Тест', email: 't@x.tj', role, kindergartenId: 'k1' } as never,
    token: 'tok',
  })

const renderPage = () =>
  render(
    <AntdApp>
      <ChildrenPage />
    </AntdApp>,
  )

const search = async (text: string) => {
  const input = await screen.findByPlaceholderText(/Поиск по имени/)
  fireEvent.change(input, { target: { value: text } })
}
const headerBox = () => screen.getByRole('checkbox', { name: 'Выбрать всех найденных' })
const rowBox = (n: number, surname = 'Фамилия') => screen.getByRole('checkbox', { name: `Выбрать: ${surname}${n} Имя${n}` })

describe('Ученики: пакетное выделение и удаление', () => {
  beforeEach(() => {
    seed()
    vi.mocked(studentsBulkApi.remove).mockReset()
    http.delete.mockClear()
  })

  describe('кому показывать', () => {
    it('учителю чекбоксов и панели удаления нет', async () => {
      signIn('TEACHER')
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
      expect(screen.queryByText(/Выбрано:/)).not.toBeInTheDocument()
      expect(screen.queryByText('Удалить выбранных')).not.toBeInTheDocument()
    })

    it.each<Role>(['admin', 'SUPER_ADMIN'])('%s: у каждой строки есть чекбокс и галочка «выбрать всех» в шапке', async (role) => {
      signIn(role)
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      expect(headerBox()).toBeInTheDocument()
      // на странице 10 строк из 12 — у каждой свой чекбокс
      for (let n = 1; n <= 10; n++) expect(rowBox(n)).toBeInTheDocument()
      // пока никто не выбран, панели нет
      expect(screen.queryByText(/Выбрано:/)).not.toBeInTheDocument()
    })
  })

  describe('выделение', () => {
    beforeEach(() => signIn('admin'))

    it('выбрать одного: панель «Выбрано: 1 из 12», кнопки «Удалить выбранных» и «Снять выделение»', async () => {
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      fireEvent.click(rowBox(2))
      expect(await screen.findByText('Выбрано: 1 из 12')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Удалить выбранных/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Снять выделение' })).toBeInTheDocument()
      expect(rowBox(2)).toBeChecked()
      expect(rowBox(3)).not.toBeChecked()
    })

    it('«выбрать всех» берёт всех найденных по фильтру, а не только страницу и не скрытых фильтром', async () => {
      renderPage()
      await search('Фамилия') // 12 из 16: «Другой…» фильтр прячет
      await screen.findByText('Фамилия1 Имя1')
      fireEvent.click(headerBox())
      // на странице видно 10, но выбраны все 12 найденных; 4 скрытых фильтром в счёт не идут
      expect(await screen.findByText('Выбрано: 12 из 12')).toBeInTheDocument()
      expect(headerBox()).toBeChecked()
    })

    it('«Снять выделение» убирает панель и все галочки', async () => {
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      fireEvent.click(headerBox())
      await screen.findByText('Выбрано: 12 из 12')
      fireEvent.click(screen.getByRole('button', { name: 'Снять выделение' }))
      await waitFor(() => expect(screen.queryByText(/Выбрано:/)).not.toBeInTheDocument())
      expect(rowBox(1)).not.toBeChecked()
      expect(headerBox()).not.toBeChecked()
    })

    it('галочка в шапке повторно: снимает всех', async () => {
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      fireEvent.click(headerBox())
      await screen.findByText('Выбрано: 12 из 12')
      fireEvent.click(headerBox())
      await waitFor(() => expect(screen.queryByText(/Выбрано:/)).not.toBeInTheDocument())
    })

    it('«Выбрать всех найденных: N» в панели добирает остальных после выбора одного', async () => {
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      fireEvent.click(rowBox(1))
      await screen.findByText('Выбрано: 1 из 12')
      fireEvent.click(screen.getByRole('button', { name: 'Выбрать всех найденных: 12' }))
      expect(await screen.findByText('Выбрано: 12 из 12')).toBeInTheDocument()
    })

    it('смена поиска сбрасывает выделение: скрытые строки не остаются выбранными', async () => {
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      fireEvent.click(headerBox())
      await screen.findByText('Выбрано: 12 из 12')

      await search('Другой')
      await screen.findByText('Другой13 Имя13')
      await waitFor(() => expect(screen.queryByText(/Выбрано:/)).not.toBeInTheDocument())
      expect(rowBox(13, 'Другой')).not.toBeChecked()
    })

    it('кнопка «Сбросить» (фильтры) тоже сбрасывает выделение', async () => {
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      fireEvent.click(rowBox(1))
      await screen.findByText('Выбрано: 1 из 12')
      fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }))
      await waitFor(() => expect(screen.queryByText(/Выбрано:/)).not.toBeInTheDocument())
    })

    it('колонка с чекбоксами не ломает раскрытие строки: «+» работает, адрес виден', async () => {
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      expect(screen.queryByText('ул. Тестовая, 1')).not.toBeInTheDocument()
      fireEvent.click(screen.getAllByRole('button', { name: /expand row/i })[0])
      expect(await screen.findByText('ул. Тестовая, 1')).toBeInTheDocument()
      // выбор строки при этом работает
      fireEvent.click(rowBox(1))
      expect(await screen.findByText('Выбрано: 1 из 12')).toBeInTheDocument()
    })
  })

  describe('телефон (карточки вместо таблицы)', () => {
    // узкий экран: ни одно условие min-width не выполняется
    beforeEach(() => {
      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia
    })

    it('админ: у каждой карточки чекбокс, «выбрать всех найденных» берёт всех, панель с удалением', async () => {
      signIn('admin')
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      // все 12 карточек на одном экране, у каждой свой чекбокс
      for (let n = 1; n <= 12; n++) expect(rowBox(n)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать всех найденных: 12' }))
      expect(await screen.findByText('Выбрано: 12 из 12')).toBeInTheDocument()
      expect(rowBox(7)).toBeChecked()
      expect(screen.getByRole('button', { name: /Удалить выбранных/ })).toBeInTheDocument()

      // снять одного: счётчик уменьшается
      fireEvent.click(rowBox(7))
      expect(await screen.findByText('Выбрано: 11 из 12')).toBeInTheDocument()
    })

    it('учителю на телефоне чекбоксов нет', async () => {
      signIn('TEACHER')
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    })
  })

  describe('удаление', () => {
    beforeEach(() => signIn('admin'))

    it('больше 5: окно просит слово «УДАЛИТЬ»; с ним уходит один запрос на все выбранные id и список обновляется', async () => {
      vi.mocked(studentsBulkApi.remove).mockResolvedValue({ deleted: 12, failed: [] })
      const tick0 = useSyncTrigger.getState().tick
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      fireEvent.click(headerBox())
      await screen.findByText('Выбрано: 12 из 12')
      fireEvent.click(screen.getByRole('button', { name: /Удалить выбранных/ }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Удалить учеников: 12')).toBeInTheDocument()
      expect(within(dialog).getByText('Удаление необратимо')).toBeInTheDocument()
      const confirmBtn = within(dialog).getByRole('button', { name: /Удалить навсегда: 12/ })
      expect(confirmBtn).toBeDisabled()
      expect(studentsBulkApi.remove).not.toHaveBeenCalled()

      fireEvent.change(within(dialog).getByLabelText('Слово для подтверждения'), { target: { value: 'УДАЛИТЬ' } })
      await waitFor(() => expect(confirmBtn).toBeEnabled())
      fireEvent.click(confirmBtn)

      await waitFor(() => expect(studentsBulkApi.remove).toHaveBeenCalledTimes(1))
      // ушли id только тех двенадцати, что найдены (без скрытых «Другой…»)
      expect(vi.mocked(studentsBulkApi.remove).mock.calls[0][0].sort()).toEqual(
        Array.from({ length: 12 }, (_, i) => `s${i + 1}`).sort(),
      )
      expect(await within(dialog).findByText('Удалено: 12')).toBeInTheDocument()
      // страница перечитала данные и сняла выделение
      expect(useSyncTrigger.getState().tick).toBeGreaterThan(tick0)
      await waitFor(() => expect(screen.queryByText(/Выбрано:/)).not.toBeInTheDocument())
      // одиночное удаление не использовалось
      expect(http.delete).not.toHaveBeenCalled()
    })

    it('до 5: слово не нужно, удаляются только выбранные', async () => {
      vi.mocked(studentsBulkApi.remove).mockResolvedValue({ deleted: 2, failed: [] })
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      fireEvent.click(rowBox(2))
      fireEvent.click(rowBox(4))
      await screen.findByText('Выбрано: 2 из 12')
      fireEvent.click(screen.getByRole('button', { name: /Удалить выбранных/ }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).queryByLabelText('Слово для подтверждения')).not.toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('button', { name: /Удалить навсегда: 2/ }))
      await waitFor(() => expect(studentsBulkApi.remove).toHaveBeenCalledWith(['s2', 's4']))
    })

    it('отмена в окне ничего не удаляет и выделение остаётся', async () => {
      renderPage()
      await search('Фамилия')
      await screen.findByText('Фамилия1 Имя1')
      fireEvent.click(rowBox(1))
      await screen.findByText('Выбрано: 1 из 12')
      fireEvent.click(screen.getByRole('button', { name: /Удалить выбранных/ }))
      const dialog = await screen.findByRole('dialog')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }))
      expect(studentsBulkApi.remove).not.toHaveBeenCalled()
      expect(screen.getByText('Выбрано: 1 из 12')).toBeInTheDocument()
    })
  })
})
