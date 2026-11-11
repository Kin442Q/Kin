import { uiLanguage, uiText } from '../i18n/uiText'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native'
import dayjs from 'dayjs'
import { AlertTriangle, Search, User, Users } from 'lucide-react-native'

import { Text, TextInput } from '../components/Text'
import Screen from '../components/Screen'
import { ScreenHeading } from '../components/ui'
import { colors, shadow } from '../theme/colors'
import { compareClassNames, plural } from '../lib/classes'
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

/** Классы школы для директора: поиск по классу или учителю, фильтры по параллелям, посещаемость сегодня. */
export default function AdminGroupsScreen() {
  const user = useAuthStore((s) => s.user)
  const [groups, setGroups] = useState<GroupDto[]>([])
  // Отметки посещаемости за сегодня: из них считается процент по каждому классу
  const [marks, setMarks] = useState<AttendanceDto[]>([])
  const [filter, setFilter] = useState<ClassFilterKey>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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

  const percents = useMemo(() => attendancePercents(marks), [marks, uiLanguage()])
  const attentionCount = useMemo(
    () => groups.filter((g) => needsAttention(g, percents.get(g.id))).length,
    [groups, percents, uiLanguage()],
  )
  const shown = useMemo(
    () =>
      groups
        .filter((g) => g.isActive !== false)
        .filter((g) => matchesClassFilter(g, filter, percents.get(g.id)))
        .filter(
          (g) =>
            matchesClassQuery(g.name, query) ||
            (g.homeroomTeacher?.fullName ?? '').toLowerCase().includes(query.trim().toLowerCase()),
        )
        .sort((a, b) => compareClassNames(a.name, b.name)),
    [groups, filter, query, percents, uiLanguage()],
  )

  if (loading) {
    return (
      <Screen>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  const totalKids = groups.reduce((sum, g) => sum + (g._count?.students ?? 0), 0)
  const classWord = plural(groups.length, [uiText("класс"), uiText("класса"), uiText("классов")])
  const kidsWord = plural(totalKids, [uiText("ученик"), uiText("ученика"), uiText("учеников")])

  return (
    <Screen>
      <FlatList
        data={shown}
        keyExtractor={(g) => g.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
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
            <ScreenHeading eyebrow={`${groups.length} ${classWord} · ${totalKids} ${kidsWord}`} title={uiText("Классы")} size={28} />
            <View style={styles.search}>
              <Search size={20} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={uiText("Найти класс или учителя")}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={uiText("Поиск класса")}
                style={styles.searchInput}
              />
            </View>
            <View style={styles.filters}>
              {CLASS_FILTERS.map((f) => {
                const on = filter === f.key
                const attention = f.key === 'attention'
                const label = f.key === 'all' ? `${f.label} · ${groups.length}` : f.label
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(on || f.key === 'all' ? 'all' : f.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[
                      styles.chip,
                      { backgroundColor: on ? '#0D7A7C' : attention ? 'rgba(255,138,101,0.2)' : 'rgba(255,255,255,0.7)' },
                    ]}
                  >
                    {attention && <AlertTriangle size={14} color={on ? '#FFFFFF' : '#B23E1A'} />}
                    <Text style={[styles.chipText, { color: on ? '#FFFFFF' : attention ? '#B23E1A' : colors.text }]}>
                      {label}
                      {attention && attentionCount > 0 ? ` · ${attentionCount}` : ''}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const kids = item._count?.students ?? 0
          const pct = percents.get(item.id)
          const low = pct != null && pct < ATTENTION_BELOW_PERCENT
          return (
            <View style={[styles.card, shadow.md]}>
              <View style={styles.cardTop}>
                <Text style={styles.className}>{item.name}</Text>
                {pct != null && (
                  <View style={[styles.pct, low && { backgroundColor: 'rgba(255,138,101,0.2)' }]}>
                    <Text style={[styles.pctText, low && { color: '#B23E1A' }]}>{pct}%</Text>
                  </View>
                )}
              </View>
              <View style={styles.line}>
                <User size={14} color={item.homeroomTeacher === null ? '#B23E1A' : colors.muted} />
                <Text
                  style={[styles.lineText, item.homeroomTeacher === null && { color: '#B23E1A' }]}
                  numberOfLines={1}
                >
                  {item.homeroomTeacher ? item.homeroomTeacher.fullName : item.homeroomTeacher === null ? uiText("нет руководителя") : '—'}
                </Text>
              </View>
              {pct != null && (
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: low ? '#FF8A65' : '#0D7A7C' }]} />
                </View>
              )}
              <View style={styles.line}>
                <Users size={14} color={colors.muted} />
                <Text style={styles.lineText}>
                  {kids} {plural(kids, [uiText("ученик"), uiText("ученика"), uiText("учеников")])}
                </Text>
              </View>
            </View>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {groups.length === 0 ? uiText("Классов пока нет. Добавьте первый в веб-версии.") : uiText("Ничего не найдено")}
            </Text>
          </View>
        }
      />
    </Screen>
  )
}

const styles = themedStyles(() => ({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', color: '#10282A', paddingVertical: 14 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: '700' },
  card: {
    flex: 1,
    padding: 14,
    borderRadius: 22,
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  className: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: colors.text },
  pct: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(13,122,124,0.12)' },
  pctText: { fontSize: 12, fontWeight: '700', color: '#0D7A7C' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lineText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.muted },
  bar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(16,40,42,0.07)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
}))
