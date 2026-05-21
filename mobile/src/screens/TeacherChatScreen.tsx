import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import dayjs from 'dayjs'
import { Send, ChevronLeft, MessageCircle } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Avatar from '../components/Avatar'
import { colors, radius } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { chatApi, type ChatMessage, type StaffConversation } from '../api/chat'

export default function TeacherChatScreen() {
  const user = useAuthStore((s) => s.user)
  const [conversations, setConversations] = useState<StaffConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Открытый тред
  const [active, setActive] = useState<StaffConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList<ChatMessage>>(null)

  const loadList = useCallback(async () => {
    try {
      setConversations(await chatApi.conversations())
    } catch {
      /* */
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  useFocusEffect(
    useCallback(() => {
      if (!active) loadList()
    }, [active, loadList]),
  )

  const openThread = async (c: StaffConversation) => {
    setActive(c)
    setMsgLoading(true)
    try {
      const r = await chatApi.messages(c.id)
      setMessages(r.messages)
    } catch {
      setMessages([])
    } finally {
      setMsgLoading(false)
    }
  }

  const send = async () => {
    const t = text.trim()
    if (!t || !active || sending) return
    setSending(true)
    setText('')
    try {
      const msg = await chatApi.staffSend(active.id, t)
      setMessages((prev) => [...prev, msg])
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
    } catch {
      setText(t)
    } finally {
      setSending(false)
    }
  }

  // ─── Тред ────────────────────────────────────────────────────────
  if (active) {
    return (
      <Screen>
        <View style={styles.threadHeader}>
          <Pressable onPress={() => { setActive(null); loadList() }} hitSlop={12} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <View>
            <Text style={styles.threadName}>{active.parentName}</Text>
            <Text style={styles.threadSub}>Класс «{active.groupName}»</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          {msgLoading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.list}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => {
                const mine = item.senderId === user?.id
                return (
                  <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                      <Text style={[styles.msgText, mine && { color: '#fff' }]}>{item.text}</Text>
                      <Text style={[styles.msgTime, mine && { color: 'rgba(255,255,255,0.7)' }]}>
                        {dayjs(item.createdAt).format('HH:mm')}
                      </Text>
                    </View>
                  </View>
                )
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>Сообщений пока нет</Text>
                </View>
              }
            />
          )}

          <View style={styles.inputBar}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Ответить..."
              placeholderTextColor={colors.muted}
              style={styles.input}
              multiline
            />
            <Pressable
              onPress={send}
              disabled={!text.trim() || sending}
              style={[styles.sendBtn, { opacity: !text.trim() || sending ? 0.5 : 1 }]}
            >
              <Send size={20} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Screen>
    )
  }

  // ─── Список переписок ────────────────────────────────────────────
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Чат с родителями</Text>
      </View>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadList() }}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => openThread(item)}>
              <Card padding={12}>
                <View style={styles.convRow}>
                  <Avatar name={item.parentName} size={42} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.convTop}>
                      <Text style={styles.convName}>{item.parentName}</Text>
                      <Text style={styles.convTime}>
                        {dayjs(item.lastMessageAt).format('D MMM')}
                      </Text>
                    </View>
                    <Text style={styles.convLast} numberOfLines={1}>
                      {item.lastText ?? 'Нет сообщений'}
                    </Text>
                    <Text style={styles.convGroup}>Класс «{item.groupName}»</Text>
                  </View>
                  {item.unread && <View style={styles.unreadDot} />}
                </View>
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MessageCircle size={36} color={colors.muted} />
              <Text style={styles.emptyText}>
                Переписок пока нет. Они появятся когда родитель напишет.
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  convRow: { flexDirection: 'row', alignItems: 'center' },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontSize: 15, fontWeight: '700', color: colors.text },
  convTime: { fontSize: 11, color: colors.muted },
  convLast: { fontSize: 13, color: colors.textMid, marginTop: 2 },
  convGroup: { fontSize: 11, color: colors.muted, marginTop: 2 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginLeft: 8 },
  // thread
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  threadName: { fontSize: 16, fontWeight: '800', color: colors.text },
  threadSub: { fontSize: 12, color: colors.muted },
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
  msgText: { fontSize: 14, color: colors.text, lineHeight: 19 },
  msgTime: { fontSize: 10, color: colors.muted, marginTop: 3, alignSelf: 'flex-end' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
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
