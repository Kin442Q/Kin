import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native'
import { Text } from '../components/Text'
import { Check, MessageCircle, Users } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import Avatar from '../components/Avatar'
import BottomModal from '../components/BottomModal'
import StackHeader from '../components/StackHeader'
import EmptyState from '../components/EmptyState'
import { Field } from '../components/Field'
import { colors, radius } from '../theme/colors'
import {
  homeroomApi,
  type HomeroomClass,
  type HomeroomOverview,
  type HomeroomRow,
} from '../api/homeroom'

import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
/** Быстрые заготовки — текст можно править перед отправкой. */
const QUICK_TEXTS = [
  'Здравствуйте! Ваш ребёнок в последнее время не выполняет домашние задания. Просим обратить внимание.',
  'Здравствуйте! Ваш ребёнок пропускает уроки. Просим сообщить причину и помочь наверстать материал.',
  'Здравствуйте! Просим вас зайти в школу — нужно обсудить успеваемость вашего ребёнка.',
]

const PERIODS = [7, 14, 30]

/** «Проблемный» ученик: есть невыполненные ДЗ или пропуски без причины. */
const needsAttention = (r: HomeroomRow) =>
  (r.homework?.notDone ?? 0) > 0 || (r.attendance?.absent ?? 0) > 0

/**
 * Сводка по классу для классного руководителя: кто не делает домашние задания,
 * пропускает уроки, какой средний балл — и сообщение родителям выбранных учеников.
 */
export default function TeacherHomeroomScreen() {
  const [classes, setClasses] = useState<HomeroomClass[] | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [days, setDays] = useState(14)
  const [data, setData] = useState<HomeroomOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const [writeOpen, setWriteOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const errorText = (e: any, fallback: string) => e?.response?.data?.message || fallback

  useEffect(() => {
    homeroomApi
      .mine()
      .then((list) => {
        setClasses(list)
        if (list.length > 0) setGroupId((cur) => cur ?? list[0].id)
        else setLoading(false)
      })
      .catch((e) => {
        setClasses([])
        setLoading(false)
        notifyError(e, 'Не удалось загрузить классы')
      })
  }, [])

  const load = useCallback(async () => {
    if (!groupId) return
    try {
      setData(await homeroomApi.overview(groupId, days))
      setSelected([])
    } catch (e) {
      notifyError(e, 'Не удалось загрузить сводку')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [groupId, days])

  useEffect(() => {
    load()
  }, [load])

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const selectProblem = () =>
    setSelected((data?.students ?? []).filter(needsAttention).map((r) => r.student.id))

  const targets = (data?.students ?? []).filter((r) => selected.includes(r.student.id))

  const send = async () => {
    if (!groupId || targets.length === 0 || !text.trim()) return
    setSending(true)
    try {
      const r = await homeroomApi.notify(groupId, {
        studentIds: targets.map((t) => t.student.id),
        text: text.trim(),
      })
      const noParents = r.skipped.length
      Alert.alert(
        'Отправлено',
        `Сообщение получили родители ${r.notified} из ${targets.length} учеников` +
          (noParents ? `. У ${noParents} нет родителей в системе.` : ''),
      )
      setWriteOpen(false)
      setText('')
      setSelected([])
    } catch (e) {
      notifyError(e, 'Не удалось отправить')
    } finally {
      setSending(false)
    }
  }

  const sections = data?.sections

  return (
    <Screen>
      <StackHeader title="Мой класс" />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : classes && classes.length === 0 ? (
        <EmptyState
          icon={<Users size={34} color={colors.muted} />}
          title="Вы не классный руководитель"
          hint="Администратор может назначить вас классным руководителем в разделе «Классы»"
        />
      ) : (
        <>
          <View style={styles.head}>
            {classes && classes.length > 1 && (
              <View style={styles.chips}>
                {classes.map((c) => {
                  const on = c.id === groupId
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => {
                        setLoading(true)
                        setGroupId(c.id)
                      }}
                      style={[styles.chip, { backgroundColor: on ? colors.primary : colors.surfaceAlt }]}
                    >
                      <Text style={[styles.chipText, { color: on ? '#fff' : colors.text }]}>{c.name}</Text>
                    </Pressable>
                  )
                })}
              </View>
            )}
            <View style={styles.chips}>
              {PERIODS.map((d) => {
                const on = d === days
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDays(d)}
                    style={[styles.chip, { backgroundColor: on ? colors.blueDeep : colors.surfaceAlt }]}
                  >
                    <Text style={[styles.chipText, { color: on ? '#fff' : colors.text }]}>{d} дн.</Text>
                  </Pressable>
                )
              })}
            </View>
            <View style={styles.actions}>
              <Btn size="sm" variant="secondary" onPress={selectProblem}>
                Выбрать проблемных
              </Btn>
              <Btn
                size="sm"
                disabled={selected.length === 0}
                icon={<MessageCircle size={14} color="#fff" />}
                onPress={() => setWriteOpen(true)}
              >
                Родителям ({selected.length})
              </Btn>
            </View>
          </View>

          <FlatList
            data={data?.students ?? []}
            keyExtractor={(r) => r.student.id}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            extraData={selected}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true)
                  load()
                }}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={<EmptyState title="В классе пока нет учеников" />}
            renderItem={({ item: r }) => {
              const on = selected.includes(r.student.id)
              const hw = r.homework
              const att = r.attendance
              return (
                <Pressable onPress={() => toggle(r.student.id)}>
                  <Card padding={12} style={on ? { borderColor: colors.primary } : undefined}>
                    <View style={styles.row}>
                      <View style={[styles.check, on && styles.checkOn]}>
                        {on && <Check size={14} color="#fff" strokeWidth={3} />}
                      </View>
                      <Avatar name={`${r.student.firstName} ${r.student.lastName}`} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>
                          {r.student.lastName} {r.student.firstName}
                        </Text>
                        <Text style={styles.meta}>
                          {r.parentsCount > 0 ? `Родителей: ${r.parentsCount}` : 'Нет родителей в системе'}
                        </Text>
                      </View>
                      {sections?.grades && r.grades?.average != null && (
                        <View style={styles.avg}>
                          <Text style={styles.avgValue}>{r.grades.average.toFixed(1)}</Text>
                          <Text style={styles.avgLabel}>средний</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.stats}>
                      {sections?.homework && hw && (
                        <>
                          <Text style={[styles.pill, { backgroundColor: colors.primarySoft, color: colors.primaryDeep }]}>
                            ДЗ ✓ {hw.done}
                          </Text>
                          {hw.partial > 0 && (
                            <Text style={[styles.pill, { backgroundColor: colors.yellowSoft, color: colors.yellowDeep }]}>
                              частично {hw.partial}
                            </Text>
                          )}
                          {hw.notDone > 0 && (
                            <Text style={[styles.pill, { backgroundColor: colors.roseSoft, color: colors.roseDeep }]}>
                              не сделано {hw.notDone}
                            </Text>
                          )}
                        </>
                      )}
                      {sections?.attendance && att && (att.absent > 0 || att.sick > 0) && (
                        <Text style={[styles.pill, { backgroundColor: colors.roseSoft, color: colors.roseDeep }]}>
                          пропуски {att.absent}
                          {att.sick > 0 ? ` · болел(а) ${att.sick}` : ''}
                        </Text>
                      )}
                    </View>
                  </Card>
                </Pressable>
              )
            }}
          />
        </>
      )}

      <BottomModal
        visible={writeOpen}
        onClose={() => setWriteOpen(false)}
        title={`Родителям: ${targets.length} уч.`}
      >
        <View style={{ gap: 8, marginBottom: 12 }}>
          {QUICK_TEXTS.map((q) => (
            <Pressable key={q} onPress={() => setText(q)} style={styles.quick}>
              <Text style={styles.quickText}>{q}</Text>
            </Pressable>
          ))}
        </View>
        <Field
          label="Текст сообщения"
          value={text}
          onChangeText={setText}
          placeholder="Напишите сообщение родителям…"
          maxLength={1000}
          multiline
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />
        {targets.some((t) => t.parentsCount === 0) && (
          <Text style={styles.warn}>
            У некоторых выбранных учеников нет родителей в системе — им сообщение не уйдёт.
          </Text>
        )}
        <Btn block size="lg" loading={sending} disabled={!text.trim()} onPress={send}>
          Отправить
        </Btn>
      </BottomModal>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: 16, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  chipText: { fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  name: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  avg: { alignItems: 'center' },
  avgValue: { fontSize: 18, fontWeight: '800', color: colors.primaryDeep },
  avgLabel: { fontSize: 10, color: colors.muted },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pill: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  quick: { padding: 10, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  quickText: { fontSize: 12.5, color: colors.textMid, lineHeight: 17 },
  warn: { fontSize: 12.5, color: colors.yellowDeep, marginBottom: 12 },
}))
