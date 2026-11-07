import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native'
import { Text } from '../components/Text'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { ChevronLeft, ClipboardList, Plus, Trash2, BookOpen } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import BottomModal from '../components/BottomModal'
import ClassPicker from '../components/ClassPicker'
import { Field, Select } from '../components/Field'
import { colors, radius } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { schoolApi, type HomeworkDto, type SubjectDto } from '../api/school'
import { useMyClasses } from '../lib/useMyClasses'
import { dueLabel, splitHomework, submittedShare, type HomeworkTab } from '../lib/homework'

import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'

const EMPTY: Record<HomeworkTab, string> = {
  active: 'Нет активных заданий. Нажмите «Задать ДЗ».',
  check: 'Нечего проверять: все сдачи проверены.',
  archive: 'Архив пока пуст.',
}

/** Домашние задания по всем классам учителя: вкладки «Активные · Проверить · Архив» и сколько учеников сдали. */
export default function TeacherHomeworkScreen() {
  const navigation = useNavigation<any>()
  const user = useAuthStore((s) => s.user)
  const { classes, loading: classesLoading } = useMyClasses()

  const [items, setItems] = useState<HomeworkDto[]>([])
  const [subjects, setSubjects] = useState<SubjectDto[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<HomeworkTab>('active')
  // фильтр списка по классу: null — все классы
  const [classFilter, setClassFilter] = useState<string | null>(null)
  const [modal, setModal] = useState(false)

  // form
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const [createGroupId, setCreateGroupId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'))
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    try {
      // сервер сам отдаёт учителю только ДЗ его классов и выданных предметов
      const [hws, subs] = await Promise.all([schoolApi.listHomework({}), schoolApi.listSubjects()])
      setItems(hws)
      setSubjects(subs)
      setSubjectId((cur) => cur ?? subs[0]?.id ?? null)
    } catch (e: any) {
      notifyError(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const visible = useMemo(
    () => (classFilter ? items.filter((h) => h.groupId === classFilter) : items),
    [items, classFilter],
  )
  const tabs = useMemo(() => splitHomework(visible), [visible])
  const data = tabs[tab]

  const openCreate = () => {
    // класс по умолчанию: выбранный в фильтре, единственный, либо свой классный
    setCreateGroupId(
      classFilter ?? (classes.length === 1 ? classes[0].id : classes.find((c) => c.id === user?.groupId)?.id ?? null),
    )
    setModal(true)
  }

  const submit = async () => {
    if (!subjectId || !title.trim() || !createGroupId) {
      Alert.alert('Заполните', 'Нужны класс, предмет, заголовок и срок')
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
        groupId: createGroupId,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
      })
      setModal(false)
      setTitle('')
      setDescription('')
      setTab('active')
      reload()
    } catch (e: any) {
      notifyError(e)
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
            notifyError(e)
          }
        },
      },
    ])
  }

  if (loading || classesLoading) {
    return (
      <Screen>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  if (classes.length === 0) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Вам пока не открыт доступ ни к одному классу. Обратитесь к администратору школы.</Text>
        </View>
      </Screen>
    )
  }

  const tabButtons: { key: HomeworkTab; label: string; count?: number }[] = [
    { key: 'active', label: 'Активные', count: tabs.active.length },
    { key: 'check', label: 'Проверить', count: tabs.toCheckTotal },
    { key: 'archive', label: 'Архив' },
  ]

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Назад">
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Домашние задания</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={data}
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
          <View style={{ gap: 12, marginBottom: 12 }}>
            <View style={styles.tabs} accessibilityRole="tablist">
              {tabButtons.map((t) => {
                const on = t.key === tab
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setTab(t.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[styles.tab, on && styles.tabOn]}
                  >
                    <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                      {t.label}
                      {t.count ? ` · ${t.count}` : ''}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            {classes.length > 1 && <ClassPicker classes={classes} value={classFilter} onChange={setClassFilter} />}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const share = submittedShare(item)
          const toCheck = item.stats?.toCheck ?? 0
          const soon = tab !== 'archive' && ['сегодня', 'завтра'].includes(dueLabel(item))
          return (
            <Card padding={14} style={tab === 'archive' ? { opacity: 0.7 } : undefined}>
              <View style={styles.row}>
                <View style={[styles.dot, { backgroundColor: item.subject?.color ?? colors.primary }]} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.meta}>
                    {item.group?.name ?? '—'} · {item.subject?.name ?? '—'}
                  </Text>
                  <Text style={styles.title}>{item.title}</Text>
                  {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
                </View>
                <Pressable onPress={() => remove(item)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Удалить задание">
                  <Trash2 size={16} color={colors.muted} />
                </Pressable>
              </View>

              {item.stats ? (
                <View style={styles.progressRow}>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${Math.round(share * 100)}%` }]} />
                  </View>
                  <Text style={styles.count}>
                    {item.stats.submitted} / {item.stats.total}
                  </Text>
                </View>
              ) : null}

              <View style={styles.footer}>
                <View style={[styles.duePill, soon && styles.duePillSoon]}>
                  <Text style={[styles.dueText, soon && styles.dueTextSoon]}>{dueLabel(item)}</Text>
                </View>
                {toCheck > 0 && <Text style={styles.toCheck}>ждут проверки: {toCheck}</Text>}
                <View style={{ flex: 1 }} />
                <Btn
                  size="sm"
                  variant="secondary"
                  icon={<ClipboardList size={14} color={colors.primaryDeep} />}
                  onPress={() => navigation.navigate('TeacherHomeworkRoster', { homeworkId: item.id })}
                >
                  Кто сделал
                </Btn>
              </View>
            </Card>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <BookOpen size={36} color={colors.muted} />
            <Text style={styles.emptyText}>{EMPTY[tab]}</Text>
          </View>
        }
      />

      <View style={styles.bottom}>
        <Btn block size="lg" icon={<Plus size={20} color="#fff" strokeWidth={2.5} />} onPress={openCreate}>
          Задать ДЗ
        </Btn>
      </View>

      <BottomModal visible={modal} onClose={() => setModal(false)} title="Новое задание">
        <Text style={styles.formLabel}>Класс</Text>
        <ClassPicker classes={classes} value={createGroupId} onChange={setCreateGroupId} />

        {subjects.length > 0 && (
          <Select<string>
            label="Предмет"
            value={subjectId ?? subjects[0]?.id ?? ''}
            onChange={setSubjectId}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            columns={2}
          />
        )}

        <Field label="Заголовок" value={title} onChangeText={setTitle} placeholder="Упр. 23, стр. 45" />

        <Field
          label="Описание"
          value={description}
          onChangeText={setDescription}
          placeholder="(подробности)"
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <Field label="Срок (YYYY-MM-DD)" value={dueDate} onChangeText={setDueDate} placeholder="2026-05-20" />

        <Btn block size="lg" loading={saving} onPress={submit}>
          Задать
        </Btn>
      </BottomModal>
    </Screen>
  )
}

const styles = themedStyles(() => ({
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
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  tab: { flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tabOn: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMid },
  tabTextOn: { color: colors.onPrimary, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  meta: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  title: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 2 },
  desc: { fontSize: 13, color: colors.textMid, marginTop: 4, lineHeight: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  count: { fontSize: 13, fontWeight: '800', color: colors.text, minWidth: 48, textAlign: 'right' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  duePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  duePillSoon: { backgroundColor: colors.roseSoft },
  dueText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  dueTextSoon: { color: colors.roseDeep },
  toCheck: { fontSize: 12, fontWeight: '700', color: colors.primaryDeep },
  empty: { paddingVertical: 60, paddingHorizontal: 24, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  bottom: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '700', color: colors.textMid, marginBottom: 8 },
}))
