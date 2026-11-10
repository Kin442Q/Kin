import { localizeCopy, uiLanguage, uiText } from '../i18n/uiText'
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
import { BookOpen, CalendarDays, Clock, Plus } from 'lucide-react-native'

import Screen from '../components/Screen'
import Btn from '../components/Btn'
import BottomModal from '../components/BottomModal'
import ClassPicker from '../components/ClassPicker'
import IconTile from '../components/IconTile'
import { Field, Select } from '../components/Field'
import { colors, shadow } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { schoolApi, type HomeworkDto, type SubjectDto } from '../api/school'
import { useMyClasses } from '../lib/useMyClasses'
import { dueLabel, splitHomework, submittedShare, type HomeworkTab } from '../lib/homework'
import { subjectIcon } from '../lib/subjectIcon'

import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'

const EMPTY: Record<HomeworkTab, string> = localizeCopy({
  active: 'Нет активных заданий. Нажмите «Задать ДЗ».',
  check: 'Нечего проверять: все сдачи проверены.',
  archive: 'Архив пока пуст.',
})

/**
 * Домашние задания по всем классам учителя: вкладки «Активные · Проверить · Архив», у каждого задания полоса
 * «сдали 18 / 24» и срок. Нажатие на карточку — кто сделал, долгое нажатие — удалить.
 */
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
    [items, classFilter, uiLanguage()],
  )
  const tabs = useMemo(() => splitHomework(visible), [visible, uiLanguage()])
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
      Alert.alert(uiText("Заполните"), uiText("Нужны класс, предмет, заголовок и срок"))
      return
    }
    if (!dayjs(dueDate).isValid()) {
      Alert.alert(uiText("Дата"), uiText("Неверный формат: YYYY-MM-DD"))
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
    Alert.alert(uiText("Удалить?"), h.title, [
      { text: uiText("Отмена"), style: 'cancel' },
      {
        text: uiText("Удалить"),
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
          <Text style={styles.emptyText}>{uiText("Вам пока не открыт доступ ни к одному классу. Обратитесь к администратору школы.")}</Text>
        </View>
      </Screen>
    )
  }

  const tabButtons: { key: HomeworkTab; label: string; count?: number }[] = [
    { key: 'active', label: uiText("Активные"), count: tabs.active.length },
    { key: 'check', label: uiText("Проверить"), count: tabs.toCheckTotal },
    { key: 'archive', label: uiText("Архив") },
  ]
  const subjectNames = [...new Set(items.map((h) => h.subject?.name).filter(Boolean))]
  const eyebrow = [subjectNames.length === 1 ? subjectNames[0] : null, `${classes.length} ${classes.length === 1 ? uiText("класс") : classes.length < 5 ? uiText("класса") : uiText("классов")}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <Screen>
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
          <View style={{ gap: 10, marginBottom: 10 }}>
            <View style={{ gap: 4 }}>
              <Text style={styles.eyebrow}>{eyebrow}</Text>
              <Text style={styles.title}>{uiText("Домашние задания")}</Text>
            </View>
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
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const share = submittedShare(item)
          const label = dueLabel(item)
          const soon = tab !== 'archive' && (label === 'сегодня' || label === 'завтра')
          const name = item.subject?.name ?? '—'
          return (
            <Pressable
              onPress={() => navigation.navigate('TeacherHomeworkRoster', { homeworkId: item.id })}
              onLongPress={() => remove(item)}
              accessibilityRole="button"
              accessibilityHint={uiText("Нажмите: кто сделал. Долгое нажатие: удалить")}
              style={[styles.card, tab === 'archive' && { opacity: 0.7 }]}
            >
              <View style={styles.cardTop}>
                <IconTile icon={subjectIcon(name) ?? BookOpen} bg="rgba(13,122,124,0.13)" fg={colors.primary} size={40} style={{ borderRadius: 14 }} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.meta}>
                    {item.group?.name ?? '—'} · {name}
                  </Text>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
              </View>
              <View style={styles.progressRow}>
                <View style={styles.bar}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.round(share * 100)}%`, backgroundColor: share >= 0.5 ? '#0D7A7C' : '#FF8A65' },
                    ]}
                  />
                </View>
                {item.stats ? (
                  <Text style={styles.count}>
                    {item.stats.submitted} / {item.stats.total}
                  </Text>
                ) : null}
                <View style={[styles.duePill, soon && styles.duePillSoon]}>
                  {soon ? <Clock size={13} color="#B23E1A" /> : <CalendarDays size={13} color={colors.muted} />}
                  <Text style={[styles.dueText, soon && { color: '#B23E1A' }]}>{label}</Text>
                </View>
              </View>
            </Pressable>
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
        <Pressable
          onPress={openCreate}
          accessibilityRole="button"
          style={({ pressed }) => [styles.create, shadow.lg, pressed && { opacity: 0.9 }]}
        >
          <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.createText}>{uiText("Задать ДЗ")}</Text>
        </Pressable>
      </View>

      <BottomModal visible={modal} onClose={() => setModal(false)} title={uiText("Новое задание")}>
        <Text style={styles.formLabel}>{uiText("Класс")}</Text>
        <ClassPicker classes={classes} value={createGroupId} onChange={setCreateGroupId} />

        {subjects.length > 0 && (
          <Select<string>
            label={uiText("Предмет")}
            value={subjectId ?? subjects[0]?.id ?? ''}
            onChange={setSubjectId}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            columns={2}
          />
        )}

        <Field label={uiText("Заголовок")} value={title} onChangeText={setTitle} placeholder={uiText("Упр. 23, стр. 45")} />

        <Field
          label={uiText("Описание")}
          value={description}
          onChangeText={setDescription}
          placeholder={uiText("(подробности)")}
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <Field label={uiText("Срок (YYYY-MM-DD)")} value={dueDate} onChangeText={setDueDate} placeholder="2026-05-20" />

        <Btn block size="lg" loading={saving} onPress={submit}>
          {" " + uiText("Задать") + " "}</Btn>
      </BottomModal>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 130 },
  eyebrow: { fontSize: 13, fontWeight: '600', color: colors.muted },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: colors.text },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tab: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tabOn: {
    backgroundColor: colors.surfaceSolid,
    shadowColor: '#10282A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  tabTextOn: { color: colors.text, fontWeight: '800' },
  card: {
    padding: 14,
    borderRadius: 22,
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meta: { fontSize: 12, fontWeight: '700', color: colors.muted },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(16,40,42,0.07)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  count: { fontSize: 12, fontWeight: '800', color: colors.text },
  duePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(16,40,42,0.06)',
  },
  duePillSoon: { backgroundColor: 'rgba(255,138,101,0.22)' },
  dueText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  empty: { paddingVertical: 60, paddingHorizontal: 24, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  bottom: { position: 'absolute', left: 16, right: 16, bottom: 12 },
  create: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#0D7A7C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  formLabel: { fontSize: 13, fontWeight: '700', color: colors.textMid, marginBottom: 8 },
}))
