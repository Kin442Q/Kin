import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native'
import dayjs from 'dayjs'
import { Text, TextInput } from '../components/Text'
import { ChevronDown, ChevronRight, Users, GraduationCap, Search } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import { Chip } from '../components/ui'
import { colors, radius } from '../theme/colors'
import { useLabels } from '../theme/useLabels'
import { classLetterOf, groupByGrade, plural } from '../lib/classes'
import {
  ATTENTION_BELOW_PERCENT,
  attendancePercents,
  CLASS_FILTERS,
  matchesClassFilter,
  matchesClassQuery,
  needsAttention,
  type ClassFilterKey,
} from '../lib/classFilters'
import { hasFeature } from '../lib/features'
import { useAuthStore } from '../store/authStore'
import { adminApi, type GroupDto } from '../api/admin'
import { attendanceApi, type AttendanceDto } from '../api/attendance'

import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
export default function AdminGroupsScreen() {
  const L = useLabels()
  const user = useAuthStore((s) => s.user)
  const [groups, setGroups] = useState<GroupDto[]>([])
  // Отметки посещаемости за сегодня: из них считается процент по каждому классу
  const [marks, setMarks] = useState<AttendanceDto[]>([])
  const [filter, setFilter] = useState<ClassFilterKey>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // Раскрытые параллели: по умолчанию все свёрнуты (если параллель одна — раскрыта)
  const [open, setOpen] = useState<string[] | null>(null)

  const reload = useCallback(async () => {
    try {
      const day = dayjs().format('YYYY-MM-DD')
      const [list, att] = await Promise.all([
        adminApi.groups(),
        // посещаемость — дополнение: если раздел выключен или запрос не прошёл, список классов всё равно показываем
        hasFeature(user, 'attendance') ? attendanceApi.listByDay(day).catch(() => [] as AttendanceDto[]) : Promise.resolve([] as AttendanceDto[]),
      ])
      setGroups(list)
      setMarks(att)
    } catch (e: any) {
      notifyError(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  const percents = useMemo(() => attendancePercents(marks), [marks])
  const shown = useMemo(
    () => groups.filter((g) => matchesClassFilter(g, filter, percents.get(g.id)) && matchesClassQuery(g.name, query)),
    [groups, filter, query, percents],
  )
  const attentionCount = useMemo(
    () => groups.filter((g) => needsAttention(g, percents.get(g.id))).length,
    [groups, percents],
  )
  const grades = useMemo(() => groupByGrade(shown, (g) => g.name), [shown])
  // С фильтром или поиском параллели раскрыты сразу: иначе найденный класс пришлось бы искать вручную
  const searching = filter !== 'all' || query.trim() !== ''
  const openKeys = searching
    ? grades.map((g) => String(g.key))
    : (open ?? (grades.length === 1 ? [String(grades[0].key)] : []))
  type Row =
    | { kind: 'head'; key: string; label: string; grade: number | null; classes: GroupDto[]; kids: number }
    | { kind: 'item'; key: string; item: GroupDto }
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = []
    for (const gr of grades) {
      const k = String(gr.key)
      list.push({
        kind: 'head',
        key: 'h' + k,
        label: gr.label,
        grade: gr.grade,
        classes: gr.items,
        kids: gr.items.reduce((sum, g) => sum + (g._count?.students ?? 0), 0),
      })
      if (openKeys.includes(k)) for (const g of gr.items) list.push({ kind: 'item', key: g.id, item: g })
    }
    return list
  }, [grades, openKeys.join(',')])

  const toggle = (k: string) =>
    setOpen((cur) => {
      const base = cur ?? openKeys
      return base.includes(k) ? base.filter((x) => x !== k) : [...base, k]
    })

  if (loading) {
    return (
      <Screen>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  const totalKids = groups.reduce(
    (sum, g) => sum + (g._count?.students ?? 0),
    0,
  )

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
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
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.title}>{L.groups}</Text>
            <Text style={styles.subtitle}>
              {searching ? `${shown.length} из ${groups.length}` : groups.length} · {totalKids}{' '}
              {L.students.toLowerCase() === 'дети' ? 'детей' : 'учеников'}
            </Text>
            <View style={styles.search}>
              <Search size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Поиск класса"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Поиск класса"
                style={styles.searchInput}
              />
            </View>
            <View style={styles.filters}>
              {CLASS_FILTERS.map((f) => (
                <Chip
                  key={f.key}
                  label={f.key === 'attention' && attentionCount > 0 ? `${f.label} · ${attentionCount}` : f.label}
                  tone={filter === f.key ? 'solid' : f.key === 'attention' && attentionCount > 0 ? 'coral' : 'glass'}
                  onPress={() => setFilter(filter === f.key ? 'all' : f.key)}
                />
              ))}
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item: row }) => {
          if (row.kind === 'head') {
            const k = row.key.slice(1)
            const on = openKeys.includes(k)
            return (
              <Pressable onPress={() => toggle(k)} accessibilityRole="button" accessibilityState={{ expanded: on }}>
                <Card padding={12} style={{ backgroundColor: colors.surfaceAlt }}>
                  <View style={styles.headerRow}>
                    <View style={styles.gradeBadge}>
                      <Text style={styles.gradeBadgeText}>{row.grade ?? '•'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{row.label}</Text>
                      <Text style={styles.meta}>
                        {row.classes.map((c) => classLetterOf(c.name)).join(' · ')} ·{' '}
                        {row.classes.length} {plural(row.classes.length, ['класс', 'класса', 'классов'])},{' '}
                        {row.kids} {plural(row.kids, ['ученик', 'ученика', 'учеников'])}
                      </Text>
                    </View>
                    {on ? <ChevronDown size={20} color={colors.muted} /> : <ChevronRight size={20} color={colors.muted} />}
                  </View>
                </Card>
              </Pressable>
            )
          }
          const item = row.item
          const kids = item._count?.students ?? 0
          const teachers = item._count?.teachers ?? 0
          const fill = item.capacity > 0
            ? Math.min(1, kids / item.capacity)
            : 0
          return (
            <Card padding={14}>
              <View style={styles.headerRow}>
                <View
                  style={[styles.dot, { backgroundColor: item.color }]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={[styles.meta, item.homeroomTeacher === null && { color: colors.roseDeep, fontWeight: '700' }]}>
                    {item.homeroomTeacher
                      ? item.homeroomTeacher.fullName
                      : item.homeroomTeacher === null
                        ? 'нет классного руководителя'
                        : `${item.ageRange} · до ${item.capacity} мест`}
                  </Text>
                </View>
                {percents.has(item.id) ? (
                  <View
                    style={[
                      styles.pct,
                      (percents.get(item.id) ?? 100) < ATTENTION_BELOW_PERCENT && { backgroundColor: colors.roseSoft },
                    ]}
                    accessibilityLabel={`В школе сегодня: ${percents.get(item.id)} процентов`}
                  >
                    <Text
                      style={[
                        styles.pctText,
                        (percents.get(item.id) ?? 100) < ATTENTION_BELOW_PERCENT && { color: colors.roseDeep },
                      ]}
                    >
                      {percents.get(item.id)}%
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.fee, { color: item.isActive ? colors.text : colors.muted }]}>
                    {Math.round(Number(item.monthlyFee)).toLocaleString('ru-RU')} с
                  </Text>
                )}
              </View>

              <View style={styles.bar}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${fill * 100}%`,
                      backgroundColor:
                        fill >= 0.95
                          ? colors.roseDeep
                          : fill >= 0.7
                            ? colors.primaryDeep
                            : colors.primary,
                    },
                  ]}
                />
              </View>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Users size={14} color={colors.primaryDeep} />
                  <Text style={styles.statText}>
                    {kids}/{item.capacity}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <GraduationCap size={14} color={colors.muted} />
                  <Text style={styles.statText}>
                    {teachers} {teachers === 1 ? L.teacher : pluralizeTeacher(teachers, L.teacher)}
                  </Text>
                </View>
                {!item.isActive && (
                  <View style={styles.archivedTag}>
                    <Text style={styles.archivedText}>в архиве</Text>
                  </View>
                )}
              </View>
            </Card>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {L.groups} пока нет. Добавьте первую в веб-версии.
            </Text>
          </View>
        }
      />
    </Screen>
  )
}

function pluralizeTeacher(n: number, base: string): string {
  // «воспитатель» → «воспитателя» (мн.ч.); «учитель» → «учителя».
  // Простое правило: чтобы не плодить кейсы, используем родительный падеж.
  if (base === 'воспитатель') return n < 5 ? 'воспитателя' : 'воспитателей'
  if (base === 'учитель') return n < 5 ? 'учителя' : 'учителей'
  return base
}

const styles = themedStyles(() => ({
  gradeBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gradeBadgeText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  fee: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  bar: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 14,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSolid,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 10 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pct: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  pctText: { fontSize: 13, fontWeight: '800', color: colors.primaryDeep },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: colors.textMid, fontWeight: '600' },
  archivedTag: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
  },
  archivedText: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
}))
