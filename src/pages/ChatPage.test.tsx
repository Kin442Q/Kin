import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react'
import { App as AntdApp } from 'antd'

vi.mock('../api/chatApi', () => ({
  chatApi: {
    my: vi.fn(),
    teachers: vi.fn(),
    parentSend: vi.fn(),
    conversations: vi.fn(),
    messages: vi.fn(),
    staffSend: vi.fn(),
  },
}))
vi.mock('../lib/socket', () => ({
  getSocket: () => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn() }),
}))

import { chatApi } from '../api/chatApi'
import { useAuthStore } from '../store/authStore'
import ChatPage from './ChatPage'

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

const api = vi.mocked(chatApi)

const teacherA = { id: 'tA', fullName: 'Алиев А.', isHomeroom: true, subjects: [], lastMessageAt: null, unread: false }
const teacherB = { id: 'tB', fullName: 'Бобоев Б.', isHomeroom: false, subjects: ['Физика'], lastMessageAt: null, unread: false }

const msg = (id: string, conversationId: string, text: string) => ({
  id,
  conversationId,
  senderId: 'tX',
  text,
  kind: 'TEXT' as const,
  createdAt: '2026-11-01T08:00:00.000Z',
})

function renderPage() {
  return render(
    <AntdApp>
      <ChatPage />
    </AntdApp>,
  )
}

function signIn(role: 'PARENT' | 'TEACHER') {
  useAuthStore.setState({ user: { id: 'me', role, fullName: 'Я' } as never, token: 't' })
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  // jsdom не умеет прокручивать — страница вызывает это после загрузки сообщений
  Element.prototype.scrollIntoView = vi.fn()
})

describe('ChatPage: родитель', () => {
  it('открывает переписку с тем учителем, которого предложил сервер, и пишет именно ему', async () => {
    signIn('PARENT')
    api.teachers.mockResolvedValue({
      groupName: '5А',
      defaultTeacherId: 'tB',
      teachers: [teacherA, teacherB],
    })
    api.my.mockResolvedValue({
      conversation: { id: 'c2', groupId: 'g1', parentId: 'me', scope: 'GENERAL', teacherId: 'tB', teacherName: 'Бобоев Б.', groupName: '5А' },
      messages: [msg('m1', 'c2', 'Здравствуйте от Бобоева')],
    })
    api.parentSend.mockResolvedValue(msg('m2', 'c2', 'привет'))

    renderPage()

    expect(await screen.findByText('Здравствуйте от Бобоева')).toBeInTheDocument()
    expect(api.my).toHaveBeenCalledWith('GENERAL', 'tB')
    // заголовок переписки — имя учителя, а не абстрактное «Учитель»
    expect(screen.getByText('Бобоев Б.', { selector: 'strong' })).toBeInTheDocument()
    // выбор учителя показан, потому что их несколько
    expect(screen.getByRole('combobox')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Сообщение...'), { target: { value: 'привет' } })
    fireEvent.click(document.querySelector('button.ant-btn-primary')!)
    await waitFor(() => expect(api.parentSend).toHaveBeenCalledWith('привет', 'GENERAL', 'tB'))
  })

  it('один учитель в классе: переписка открывается без выбора', async () => {
    signIn('PARENT')
    api.teachers.mockResolvedValue({ groupName: '5А', defaultTeacherId: 'tA', teachers: [teacherA] })
    api.my.mockResolvedValue({
      conversation: { id: 'c1', groupId: 'g1', parentId: 'me', scope: 'GENERAL', teacherId: 'tA', teacherName: 'Алиев А.', groupName: '5А' },
      messages: [],
    })

    renderPage()

    expect(await screen.findByText('Напишите учителю первое сообщение')).toBeInTheDocument()
    expect(api.my).toHaveBeenCalledWith('GENERAL', 'tA')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('у класса нет учителей: пустой чат с пояснением, писать нельзя, запросов переписки нет', async () => {
    signIn('PARENT')
    api.teachers.mockResolvedValue({ groupName: '5А', defaultTeacherId: null, teachers: [] })

    renderPage()

    expect(await screen.findByText('У класса пока нет учителей — писать некому')).toBeInTheDocument()
    expect(api.my).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('Сообщение...')).toBeDisabled()
    expect(document.querySelector('button.ant-btn-primary')).toBeDisabled()
  })
})

describe('ChatPage: учитель', () => {
  it('показывает только переписки, которые вернул сервер, и открывает выбранную', async () => {
    signIn('TEACHER')
    api.conversations.mockResolvedValue([
      { id: 'c1', parentId: 'p1', parentName: 'Мама Айши', groupId: 'g1', groupName: '5А', scope: 'GENERAL', lastMessageAt: '2026-11-01T08:00:00.000Z', lastText: 'Добрый день', unread: true },
    ])
    api.messages.mockResolvedValue({ messages: [msg('m1', 'c1', 'Добрый день')] })

    renderPage()

    expect(await screen.findAllByText('Мама Айши')).not.toHaveLength(0)
    await waitFor(() => expect(api.messages).toHaveBeenCalledWith('c1'))
  })

  it('пустой список переписок не ломает страницу', async () => {
    signIn('TEACHER')
    api.conversations.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('Переписок пока нет')).toBeInTheDocument()
    expect(api.messages).not.toHaveBeenCalled()
    // треда нет — писать некуда
    expect(screen.queryByPlaceholderText('Сообщение...')).not.toBeInTheDocument()
  })

  it('отказ сервера открыть переписку (чужая/удалена) не роняет страницу: пустой тред', async () => {
    signIn('TEACHER')
    api.conversations.mockResolvedValue([
      { id: 'c9', parentId: 'p9', parentName: 'Мама Х', groupId: 'g1', groupName: '5А', scope: 'GENERAL', lastMessageAt: '2026-11-01T08:00:00.000Z', lastText: null, unread: false },
    ])
    api.messages.mockRejectedValue({ response: { status: 403 } })

    renderPage()

    expect(await screen.findAllByText('Мама Х')).not.toHaveLength(0)
    await waitFor(() => expect(api.messages).toHaveBeenCalledWith('c9'))
    expect(await screen.findByText('Сообщений пока нет')).toBeInTheDocument()
  })
})
