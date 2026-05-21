import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import dayjs from 'dayjs'
import { Send } from 'lucide-react-native'

import Screen from '../components/Screen'
import { colors, radius } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { connectSocket } from '../lib/socket'
import { chatApi, type ChatMessage, type ChatScope } from '../api/chat'

export default function ParentChatScreen() {
  const user = useAuthStore((s) => s.user)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [groupName, setGroupName] = useState<string | undefined>()
  const [convId, setConvId] = useState<string | null>(null)
  const [scope, setScope] = useState<ChatScope>('GENERAL')
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList<ChatMessage>>(null)

  const load = useCallback(
    async (s: ChatScope = scope) => {
      try {
        const r = await chatApi.my(s)
        setMessages(r.messages)
        setGroupName(r.conversation.groupName)
        setConvId(r.conversation.id)
      } catch {
        // нет ребёнка / ошибка — оставляем пусто
      } finally {
        setLoading(false)
      }
    },
    [scope],
  )

  useEffect(() => {
    load()
  }, [load])

  // Realtime через Socket.io
  useEffect(() => {
    if (!convId) return
    let cleanup = () => {}
    connectSocket().then((socket) => {
      socket.emit('join', { conversationId: convId })
      const onMessage = (msg: ChatMessage) => {
        if (msg.conversationId !== convId) return
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
        )
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
      }
      socket.on('message', onMessage)
      cleanup = () => {
        socket.emit('leave', { conversationId: convId })
        socket.off('message', onMessage)
      }
    })
    return () => cleanup()
  }, [convId])

  // Перезагружаем при возврате на экран (чтобы видеть ответы)
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    setText('')
    try {
      const msg = await chatApi.parentSend(t, scope)
      setMessages((prev) => [...prev, msg])
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
    } catch {
      setText(t) // вернуть текст при ошибке
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>
          {scope === 'ADMIN' ? 'Чат с администрацией' : 'Чат с учителем'}
        </Text>
        {groupName && <Text style={styles.sub}>Класс «{groupName}»</Text>}
        <View style={styles.switcher}>
          {(['GENERAL', 'ADMIN'] as ChatScope[]).map((s) => {
            const active = scope === s
            return (
              <Pressable
                key={s}
                onPress={() => {
                  if (active) return
                  setScope(s)
                  setLoading(true)
                  load(s)
                }}
                style={[styles.switchBtn, active && styles.switchBtnActive]}
              >
                <Text
                  style={[styles.switchText, active && styles.switchTextActive]}
                >
                  {s === 'ADMIN' ? 'Администрация' : 'Учитель'}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          renderItem={({ item }) => {
            const mine = item.senderId === user?.id
            if (item.kind === 'PAYMENT') {
              return (
                <View style={styles.payCard}>
                  <Text style={styles.payTitle}>💰 Напоминание об оплате</Text>
                  <Text style={styles.payText}>{item.text}</Text>
                  <Text style={styles.payTime}>
                    {dayjs(item.createdAt).format('DD.MM HH:mm')}
                  </Text>
                </View>
              )
            }
            return (
              <View
                style={[
                  styles.bubbleRow,
                  { justifyContent: mine ? 'flex-end' : 'flex-start' },
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleOther,
                  ]}
                >
                  {!mine && item.sender && (
                    <Text style={styles.senderName}>{item.sender.fullName}</Text>
                  )}
                  <Text style={[styles.msgText, mine && { color: '#fff' }]}>
                    {item.text}
                  </Text>
                  <Text
                    style={[
                      styles.msgTime,
                      mine && { color: 'rgba(255,255,255,0.7)' },
                    ]}
                  >
                    {dayjs(item.createdAt).format('HH:mm')}
                  </Text>
                </View>
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {scope === 'ADMIN'
                  ? 'Здесь администрация присылает напоминания об оплате. Можно написать первым 👇'
                  : 'Здесь можно написать учителю. Напишите первое сообщение 👇'}
              </Text>
            </View>
          }
        />

        <View style={styles.inputBar}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Сообщение..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            style={[
              styles.sendBtn,
              { opacity: !text.trim() || sending ? 0.5 : 1 },
            ]}
          >
            <Send size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  switcher: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: 4,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  switchBtnActive: { backgroundColor: colors.primary },
  switchText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  switchTextActive: { color: '#fff' },
  payCard: {
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: '#fff7e6',
    borderWidth: 1,
    borderColor: '#ffd591',
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  payTitle: { fontSize: 12, fontWeight: '800', color: '#d46b08', marginBottom: 4 },
  payText: { fontSize: 14, color: colors.text, lineHeight: 19 },
  payTime: { fontSize: 10, color: colors.muted, marginTop: 4, alignSelf: 'flex-end' },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderBottomLeftRadius: 4,
  },
  senderName: { fontSize: 11, fontWeight: '700', color: colors.primaryDeep, marginBottom: 2 },
  msgText: { fontSize: 14, color: colors.text, lineHeight: 19 },
  msgTime: { fontSize: 10, color: colors.muted, marginTop: 3, alignSelf: 'flex-end' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
