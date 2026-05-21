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
import { chatApi, type ChatMessage } from '../api/chat'

export default function ParentChatScreen() {
  const user = useAuthStore((s) => s.user)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [groupName, setGroupName] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList<ChatMessage>>(null)

  const load = useCallback(async () => {
    try {
      const r = await chatApi.my()
      setMessages(r.messages)
      setGroupName(r.conversation.groupName)
    } catch {
      // нет ребёнка / ошибка — оставляем пусто
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

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
      const msg = await chatApi.parentSend(t)
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
        <Text style={styles.title}>Чат с учителем</Text>
        {groupName && <Text style={styles.sub}>Класс «{groupName}»</Text>}
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
                Здесь можно написать учителю. Напишите первое сообщение 👇
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
