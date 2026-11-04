import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native'
import { Text } from '../components/Text'
import { ChevronDown, ChevronRight, Users, GraduationCap } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import { colors, radius } from '../theme/colors'
import { useLabels } from '../theme/useLabels'
import { classLetterOf, groupByGrade, plural } from '../lib/classes'
import { adminApi, type GroupDto } from '../api/admin'

export default function AdminGroupsScreen() {
  const L = useLabels()
  const [groups, setGroups] = useState<GroupDto[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // Раскрытые параллели: по умолчанию все свёрнуты (если параллель одна — раскрыта)
  const [open, setOpen] = useState<string[] | null>(null)

  const reload = useCallback(async () => {
    try {
      const list = await adminApi.groups()
      setGroups(list)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const grades = useMemo(() => groupByGrade(groups, (g) => g.name), [groups])
  const openKeys = open ?? (grades.length === 1 ? [String(grades[0].key)] : [])
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
              {groups.length} · {totalKids} {L.students.toLowerCase() === 'дети' ? 'детей' : 'учеников'}
            </Text>
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
                  <Text style={styles.meta}>
                    {item.ageRange} · до {item.capacity} мест
                  </Text>
                </View>
                <Text
                  style={[
                    styles.fee,
                    { color: item.isActive ? colors.text : colors.muted },
                  ]}
                >
                  {Math.round(Number(item.monthlyFee)).toLocaleString('ru-RU')} с
                </Text>
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

const styles = StyleSheet.create({
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
})
