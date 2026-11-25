import { uiText } from '../i18n/uiText'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native'
import { Text, TextInput } from '../components/Text'
import { useFocusEffect } from '@react-navigation/native'
import dayjs from 'dayjs'
import { Send } from 'lucide-react-native'

import Screen from '../components/Screen'
import { colors, radius } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { connectSocket } from '../lib/socket'
import { useScrollToEndOnKeyboard } from '../lib/useKeyboardScroll'
import {
  chatApi,
  pickTeacherId,
  type ChatMessage,
  type ChatScope,
  type ChatTeacher,
} from '../api/chat'

import { themedStyles } from '../theme/themedStyles'
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
  useScrollToEndOnKeyboard(listRef)

  // Личная переписка у родителя с каждым учителем класса своя
  const [teachers, setTeachers] = useState<ChatTeacher[]>([])
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [teacherName, setTeacherName] = useState<string | null>(null)
  const [noTeachers, setNoTeachers] = useState(false)
  // ref, чтобы load не пересоздавался при выборе учителя (иначе useEffect/useFocusEffect зациклятся)
  const teacherIdRef = useRef<string | null>(null)

  const load = useCallback(
    async (s: ChatScope = scope, preferredTeacherId: string | null = teacherIdRef.current) => {
      try {
        let teacherForScope: string | undefined
        if (s === 'GENERAL') {
          const list = await chatApi.teachers()
          setTeachers(list.teachers)
          setGroupName(list.groupName ?? undefined)
          const id = pickTeacherId(list, preferredTeacherId)
          if (!id) {
            // У класса нет учителей: пустой чат, писать некому
            teacherIdRef.current = null
            setTeacherId(null)
            setTeacherName(null)
            setNoTeachers(true)
            setMessages([])
            setConvId(null)
            return
          }
          teacherIdRef.current = id
          setTeacherId(id)
          teacherForScope = id
        }
        setNoTeachers(false)
        const r = await chatApi.my(s, teacherForScope)
        setMessages(r.messages)
        setGroupName(r.conversation.groupName)
        setTeacherName(s === 'GENERAL' ? r.conversation.teacherName ?? null : null)
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
      const msg = await chatApi.parentSend(
        t,
        scope,
        scope === 'GENERAL' ? teacherIdRef.current ?? undefined : undefined,
      )
      // Дедуп: socket эхо-возвращает сообщение отправителю — не дублируем.
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      )
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
          {scope === 'ADMIN' ? uiText("Чат с администрацией") : uiText("Чат с учителем")}
        </Text>
        {(groupName || (scope === 'GENERAL' && teacherName)) && (
          <Text style={styles.sub}>
            {scope === 'GENERAL' && teacherName ? teacherName : ''}
            {scope === 'GENERAL' && teacherName && groupName ? ' · ' : ''}
            {groupName ? `${uiText("Класс «")}${groupName}»` : ''}
          </Text>
        )}
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
                  {s === 'ADMIN' ? uiText("Администрация") : uiText("Учитель")}
                </Text>
              </Pressable>
            )
          })}
        </View>
        {/* Личная переписка с каждым учителем класса — своя */}
        {scope === 'GENERAL' && teachers.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.teacherRow}
          >
            {teachers.map((t) => {
              const active = t.id === teacherId
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    if (active) return
                    setLoading(true)
                    load('GENERAL', t.id)
                  }}
                  style={[styles.teacherChip, active && styles.teacherChipActive]}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.teacherChipText, active && styles.teacherChipTextActive]}
                  >
                    {t.fullName}
                  </Text>
                  {t.unread && !active && <View style={styles.teacherDot} />}
                </Pressable>
              )
            })}
          </ScrollView>
        )}
      </View>

      {/*
        padding и на Android тоже: в приложении включён edge-to-edge, окно при показе клавиатуры больше не
        сжимается само, поэтому без padding клавиатура закрывала поле ввода и кнопку «Отправить»
        (как на экране входа, где padding уже стоит).
      */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
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
                  <Text style={styles.payTitle}>{uiText("💰 Напоминание об оплате")}</Text>
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
                  ? uiText("Здесь администрация присылает напоминания об оплате. Можно написать первым 👇")
                  : noTeachers
                  ? uiText("У класса пока нет учителей — писать некому")
                  : uiText("Здесь можно написать учителю. Напишите первое сообщение 👇")}
              </Text>
            </View>
          }
        />

        <View style={styles.inputBar}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={uiText("Сообщение...")}
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            editable={!(scope === 'GENERAL' && noTeachers)}
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending || (scope === 'GENERAL' && noTeachers)}
            accessibilityRole="button"
            accessibilityLabel={uiText("Отправить")}
            style={[
              styles.sendBtn,
              {
                opacity:
                  !text.trim() || sending || (scope === 'GENERAL' && noTeachers) ? 0.5 : 1,
              },
            ]}
          >
            <Send size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = themedStyles(() => ({
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
  teacherRow: { gap: 8, paddingTop: 10 },
  teacherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  teacherChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  teacherChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  teacherChipTextActive: { color: '#fff' },
  teacherDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
    backgroundColor: colors.primary,
  },
  payCard: {
    alignSelf: 'center',
    maxWidth: '90%',
    // тёплая «оплатная» карточка из токенов темы: текст внутри светлый в тёмной теме, на светло-кремовом он бы пропал
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  payTitle: { fontSize: 12, fontWeight: '800', color: colors.yellowDeep, marginBottom: 4 },
  payText: { fontSize: 14, color: colors.text, lineHeight: 19 },
  payTime: { fontSize: 12, color: colors.muted, marginTop: 4, alignSelf: 'flex-end' },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: colors.surfaceSolid,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderBottomLeftRadius: 4,
  },
  senderName: { fontSize: 12, fontWeight: '700', color: colors.primaryDeep, marginBottom: 2 },
  msgText: { fontSize: 14, color: colors.text, lineHeight: 19 },
  msgTime: { fontSize: 12, color: colors.muted, marginTop: 3, alignSelf: 'flex-end' },
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
    backgroundColor: colors.surfaceSolid,
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
}))
