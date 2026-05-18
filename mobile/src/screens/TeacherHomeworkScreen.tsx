import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { ChevronLeft, Plus, Trash2, BookOpen } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import BottomModal from '../components/BottomModal'
import { Field, Select } from '../components/Field'
import { colors, radius, shadow } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { schoolApi, type HomeworkDto, type SubjectDto } from '../api/school'

export default function TeacherHomeworkScreen() {
  const navigation = useNavigation()
  const user = useAuthStore((s) => s.user)
  const groupId = user?.groupId

  const [items, setItems] = useState<HomeworkDto[]>([])
  const [subjects, setSubjects] = useState<SubjectDto[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState(false)

  // form
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState(
    dayjs().add(1, 'day').format('YYYY-MM-DD'),
  )
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!groupId) {
      setLoading(false)
      return
    }
    try {
      const [hws, subs] = await Promise.all([
        schoolApi.listHomework({ groupId }),
        schoolApi.listSubjects(),
      ])
      setItems(hws)
      setSubjects(subs)
      if (subs.length && !subjectId) setSubjectId(subs[0].id)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [groupId, subjectId])

  useEffect(() => {
    reload()
  }, [reload])

  const grouped = useMemo(() => {
    const now = Date.now()
    const upcoming = items.filter((h) => new Date(h.dueDate).getTime() >= now - 86400000)
    const past = items.filter((h) => new Date(h.dueDate).getTime() < now - 86400000)
    return { upcoming, past }
  }, [items])

  const submit = async () => {
    if (!subjectId || !title.trim() || !groupId) {
      Alert.alert('Заполните', 'Нужны предмет, заголовок и срок')
      return
    }
    if (!dayjs(dueDate).isValid()) {
      Alert.alert('Дата', 'Неверный формат: YYYY-MM-DD')
      return
    }
    setSaving(true)
    try {
      await schoolApi.createHomework({
        subjectId,
        groupId,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
      })
      setModal(false)
      setTitle('')
      setDescription('')
      reload()
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = (h: HomeworkDto) => {
    Alert.alert('Удалить?', h.title, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await schoolApi.deleteHomework(h.id)
            reload()
          } catch (e: any) {
            Alert.alert('Ошибка', e?.response?.data?.message || String(e))
          }
        },
      },
    ])
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

  if (!groupId) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Класс не назначен</Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Домашние задания</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={[...grouped.upcoming, ...grouped.past]}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              reload()
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.section}>
              Активных: {grouped.upcoming.length}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item, index }) => {
          const overdue = new Date(item.dueDate).getTime() < Date.now() - 86400000
          const showPastDivider =
            index === grouped.upcoming.length && grouped.upcoming.length > 0 && overdue
          return (
            <View>
              {showPastDivider && (
                <Text style={styles.divider}>Прошедшие</Text>
              )}
              <Card padding={14} style={overdue ? { opacity: 0.6 } : undefined}>
                <View style={styles.row}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: item.subject?.color ?? colors.primary },
                    ]}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.meta}>
                      {item.subject?.name ?? '—'} · до{' '}
                      {dayjs(item.dueDate).format('D MMM')}
                    </Text>
                    {item.description && (
                      <Text style={styles.desc}>{item.description}</Text>
                    )}
                  </View>
                  <Pressable onPress={() => remove(item)} hitSlop={8}>
                    <Trash2 size={16} color={colors.muted} />
                  </Pressable>
                </View>
              </Card>
            </View>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <BookOpen size={36} color={colors.muted} />
            <Text style={styles.emptyText}>
              Пока нет заданий. Нажмите «+» чтобы создать.
            </Text>
          </View>
        }
      />

      <Pressable
        onPress={() => setModal(true)}
        style={({ pressed }) => [
          styles.fab,
          shadow.lg,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Plus size={24} color="#fff" strokeWidth={2.5} />
      </Pressable>

      <BottomModal
        visible={modal}
        onClose={() => setModal(false)}
        title="Новое задание"
      >
        {subjects.length > 0 && (
          <Select<string>
            label="Предмет"
            value={subjectId ?? subjects[0]?.id ?? ''}
            onChange={setSubjectId}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            columns={2}
          />
        )}

        <Field
          label="Заголовок"
          value={title}
          onChangeText={setTitle}
          placeholder="Упр. 23, стр. 45"
        />

        <Field
          label="Описание"
          value={description}
          onChangeText={setDescription}
          placeholder="(подробности)"
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <Field
          label="Срок (YYYY-MM-DD)"
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="2026-05-20"
        />

        <Btn block size="lg" loading={saving} onPress={submit}>
          Задать
        </Btn>
      </BottomModal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
  topTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  list: { padding: 16, paddingBottom: 120 },
  section: { fontSize: 13, fontWeight: '700', color: colors.text },
  divider: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  desc: {
    fontSize: 13,
    color: colors.textMid,
    marginTop: 6,
    lineHeight: 18,
  },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
