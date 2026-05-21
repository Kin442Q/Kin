import { useEffect, useRef, useState } from 'react'
import {
  App as AntdApp,
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Segmented,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { MessageCircle } from 'lucide-react'
import dayjs from 'dayjs'

import { SP, SproutPageHeader } from '../components/sprout'
import { useAuthStore } from '../store/authStore'
import { getSocket } from '../lib/socket'
import {
  chatApi,
  type ChatMessage,
  type ChatScope,
  type StaffConversation,
} from '../api/chatApi'

const { Text } = Typography

export default function ChatPage() {
  const { message } = AntdApp.useApp()
  const user = useAuthStore((s) => s.user)
  const isParent = user?.role === 'PARENT'

  // staff: список переписок
  const [conversations, setConversations] = useState<StaffConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeMeta, setActiveMeta] = useState<{
    name: string
    group: string
  } | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // id текущей открытой переписки (для socket-комнаты)
  const [convId, setConvId] = useState<string | null>(null)

  // Родитель: канал переписки (учитель / администрация-финансы)
  const [parentScope, setParentScope] = useState<ChatScope>('GENERAL')

  const scrollDown = () =>
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

  // ─── Родитель: одна переписка ──────────────────────────────────────
  const loadParent = async (scope: ChatScope = parentScope) => {
    setLoading(true)
    try {
      const r = await chatApi.my(scope)
      setMessages(r.messages)
      setConvId(r.conversation.id)
      setActiveMeta({
        name: scope === 'ADMIN' ? 'Администрация' : 'Учитель',
        group: r.conversation.groupName ?? '',
      })
      scrollDown()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не удалось загрузить чат')
    } finally {
      setLoading(false)
    }
  }

  // ─── Сотрудник: список + тред ──────────────────────────────────────
  const loadStaffList = async () => {
    setLoading(true)
    try {
      const list = await chatApi.conversations()
      setConversations(list)
      if (list.length && !activeId) {
        openThread(list[0])
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не удалось загрузить переписки')
    } finally {
      setLoading(false)
    }
  }

  const openThread = async (c: StaffConversation) => {
    setActiveId(c.id)
    setConvId(c.id)
    setActiveMeta({ name: c.parentName, group: c.groupName })
    try {
      const r = await chatApi.messages(c.id)
      setMessages(r.messages)
      scrollDown()
    } catch {
      setMessages([])
    }
  }

  useEffect(() => {
    if (isParent) loadParent()
    else loadStaffList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime: входим в комнату текущей переписки и слушаем новые сообщения
  useEffect(() => {
    if (!convId) return
    const socket = getSocket()
    socket.emit('join', { conversationId: convId })

    const onMessage = (msg: ChatMessage) => {
      if (msg.conversationId !== convId) return
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev // не дублируем свои
        return [...prev, msg]
      })
      scrollDown()
    }
    socket.on('message', onMessage)

    // обновление списка переписок у сотрудника
    const onConversation = () => {
      if (!isParent) loadStaffList()
    }
    socket.on('conversation', onConversation)

    return () => {
      socket.emit('leave', { conversationId: convId })
      socket.off('message', onMessage)
      socket.off('conversation', onConversation)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId])

  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    setText('')
    try {
      const msg = isParent
        ? await chatApi.parentSend(t, parentScope)
        : await chatApi.staffSend(activeId!, t)
      setMessages((prev) => [...prev, msg])
      scrollDown()
    } catch (e: any) {
      setText(t)
      message.error(e?.response?.data?.message || 'Не удалось отправить')
    } finally {
      setSending(false)
    }
  }

  const MessagesView = (
    <Card
      className="glass"
      bordered={false}
      style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}
      bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 0 }}
    >
      {activeMeta && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${SP.borderSoft}`,
          }}
        >
          <Text strong>{activeMeta.name}</Text>
          {activeMeta.group && (
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              Класс «{activeMeta.group}»
            </Text>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.length === 0 ? (
          <Empty
            description={
              isParent
                ? 'Напишите учителю первое сообщение'
                : 'Сообщений пока нет'
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id
            const isPayment = m.kind === 'PAYMENT'
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: isPayment
                    ? 'center'
                    : mine
                    ? 'flex-end'
                    : 'flex-start',
                  marginBottom: 8,
                }}
              >
                {isPayment ? (
                  <div
                    style={{
                      maxWidth: '85%',
                      background: '#fff7e6',
                      border: '1px solid #ffd591',
                      borderRadius: 14,
                      padding: '10px 14px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#d46b08',
                        marginBottom: 4,
                      }}
                    >
                      💰 Напоминание об оплате
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.4, color: SP.text }}>
                      {m.text}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 4,
                        textAlign: 'right',
                        color: SP.muted,
                      }}
                    >
                      {dayjs(m.createdAt).format('DD.MM HH:mm')}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      maxWidth: '70%',
                      background: mine ? SP.primary : SP.surface,
                      color: mine ? '#fff' : SP.text,
                      border: mine ? 'none' : `1px solid ${SP.borderSoft}`,
                      borderRadius: 14,
                      borderBottomRightRadius: mine ? 4 : 14,
                      borderBottomLeftRadius: mine ? 14 : 4,
                      padding: '8px 12px',
                    }}
                  >
                    {!mine && m.sender && (
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: SP.primaryDeep,
                          marginBottom: 2,
                        }}
                      >
                        {m.sender.fullName}
                      </div>
                    )}
                    <div style={{ fontSize: 14, lineHeight: 1.4 }}>{m.text}</div>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 3,
                        textAlign: 'right',
                        color: mine ? 'rgba(255,255,255,0.7)' : SP.muted,
                      }}
                    >
                      {dayjs(m.createdAt).format('HH:mm')}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          borderTop: `1px solid ${SP.borderSoft}`,
        }}
      >
        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Сообщение..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          disabled={!isParent && !activeId}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={send}
          loading={sending}
          disabled={!text.trim() || (!isParent && !activeId)}
        />
      </div>
    </Card>
  )

  return (
    <div>
      <SproutPageHeader
        title="Чат"
        icon={<MessageCircle size={22} strokeWidth={2} />}
        iconAccent="blue"
        description={
          isParent
            ? 'Переписка с учителем класса'
            : 'Переписки с родителями'
        }
      />

      {isParent && (
        <Segmented
          value={parentScope}
          onChange={(v) => {
            const s = v as ChatScope
            setParentScope(s)
            loadParent(s)
          }}
          options={[
            { label: 'Учитель', value: 'GENERAL' },
            { label: 'Администрация', value: 'ADMIN' },
          ]}
          style={{ marginBottom: 12 }}
        />
      )}

      {loading ? (
        <Card className="glass" bordered={false}>
          <Spin />
        </Card>
      ) : isParent ? (
        MessagesView
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Список переписок */}
          <Card
            className="glass"
            bordered={false}
            style={{ width: 320, flexShrink: 0, height: '70vh', overflowY: 'auto' }}
            bodyStyle={{ padding: 8 }}
          >
            {conversations.length === 0 ? (
              <Empty
                description="Переписок пока нет"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => openThread(c)}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    padding: 10,
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: activeId === c.id ? SP.primaryGhost : 'transparent',
                    marginBottom: 4,
                  }}
                >
                  <Avatar style={{ background: SP.primarySoft, color: SP.primaryDeep }}>
                    {c.parentName[0]}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong style={{ fontSize: 14 }}>
                        {c.parentName}
                      </Text>
                      {c.unread && <Badge color={SP.primary} />}
                    </div>
                    <Text
                      type="secondary"
                      style={{ fontSize: 12, display: 'block' }}
                      ellipsis
                    >
                      {c.lastText ?? 'Нет сообщений'}
                    </Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Класс «{c.groupName}»
                      </Text>
                      {c.scope === 'ADMIN' && (
                        <Tag color="gold" style={{ margin: 0, lineHeight: '16px', fontSize: 10 }}>
                          Финансы
                        </Tag>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </Card>

          {/* Тред */}
          <div style={{ flex: 1 }}>
            {activeId ? MessagesView : (
              <Card className="glass" bordered={false} style={{ height: '70vh' }}>
                <Empty description="Выберите переписку слева" />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
