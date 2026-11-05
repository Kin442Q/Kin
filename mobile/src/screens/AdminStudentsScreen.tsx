import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native'
import { Text, TextInput } from '../components/Text'
import { useNavigation } from '@react-navigation/native'
import { ChevronLeft, Phone, Users } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Avatar from '../components/Avatar'
import ClassFilter, { EMPTY_SELECTION, selectedGroupIds, type ClassSelection } from '../components/ClassFilter'
import { colors, radius } from '../theme/colors'
import { useLabels } from '../theme/useLabels'
import { cap } from '../theme/labels'
import {
  adminApi,
  type AdminStudentDto,
  type GroupDto,
} from '../api/admin'

import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
export default function AdminStudentsScreen() {
  const navigation = useNavigation()
  const L = useLabels()
  const [students, setStudents] = useState<AdminStudentDto[]>([])
  const [groups, setGroups] = useState<GroupDto[]>([])
  // Класс выбирается двумя шагами (параллель → буква); пока нет фильтра или поиска, список пуст
  const [sel, setSel] = useState<ClassSelection>(EMPTY_SELECTION)
  const [query, setQuery] = useState('')
  const activeGroup = sel.groupId
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const reload = useCallback(async () => {
    try {
      const gs = await adminApi.groups()
      setGroups(gs)
      // Учеников грузим, только когда выбран класс/параллель или введено имя
      if (activeGroup || sel.grade !== null || query.trim()) {
        setStudents(await adminApi.students({ groupId: activeGroup ?? undefined, status }))
      } else {
        setStudents([])
      }
    } catch (e: any) {
      notifyError(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeGroup, sel.grade, query, status])

  useEffect(() => {
    reload()
  }, [reload])

  const groupsById = useMemo(() => {
    const m: Record<string, GroupDto> = {}
    for (const g of groups) m[g.id] = g
    return m
  }, [groups])

  const hasFilter = sel.grade !== null || query.trim().length > 0
  const visible = useMemo(() => {
    if (!hasFilter) return []
    const ids = new Set(selectedGroupIds(groups, sel))
    const q = query.trim().toLowerCase()
    return students.filter((st) => {
      if (ids.size > 0 && !ids.has(st.groupId)) return false
      if (q && !`${st.lastName} ${st.firstName}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [students, groups, sel, query, hasFilter])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const g of groups) m[g.id] = g._count?.students ?? 0
    return m
  }, [groups])

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
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>{L.students}</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(s) => s.id}
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
          <View>
            <View style={styles.tabs}>
              {(['ACTIVE', 'ARCHIVED'] as const).map((s) => {
                const on = status === s
                return (
                  <Pressable
                    key={s}
                    onPress={() => setStatus(s)}
                    style={[
                      styles.tab,
                      {
                        backgroundColor: on ? colors.primary : colors.surfaceAlt,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: on ? '#fff' : colors.text,
                        fontWeight: '700',
                        fontSize: 12,
                      }}
                    >
                      {s === 'ACTIVE' ? 'Активные' : 'В архиве'}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Поиск по имени ${L.student}`}
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              style={styles.search}
            />
            <ClassFilter groups={groups} value={sel} onChange={setSel} allowAllLetters counts={counts} />
            <View style={{ height: 10 }} />

            <View style={styles.summary}>
              <Users size={14} color={colors.muted} />
              <Text style={styles.summaryText}>
                {hasFilter
                  ? `${visible.length} ${pluralizeStudent(visible.length, L.student)}`
                  : 'Выберите класс или введите имя'}
              </Text>
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const name = `${item.firstName} ${item.lastName}`.trim()
          const g = item.group ?? groupsById[item.groupId]
          const age = (() => {
            const b = new Date(item.birthDate)
            const ms = Date.now() - b.getTime()
            const years = Math.floor(ms / (365.25 * 24 * 3600 * 1000))
            return years
          })()
          return (
            <Card padding={12}>
              <View style={styles.row}>
                <Avatar name={name} size={42} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.meta}>
                    {age} {age === 1 ? 'год' : age < 5 ? 'года' : 'лет'}
                    {g ? ` · ${g.name}` : ''}
                  </Text>
                </View>
                {g?.color && (
                  <View style={[styles.groupDot, { backgroundColor: g.color }]} />
                )}
              </View>

              {(item.motherPhone || item.fatherPhone) && (
                <View style={styles.phones}>
                  {item.motherPhone && (
                    <View style={styles.phoneRow}>
                      <Phone size={12} color={colors.muted} />
                      <Text style={styles.phoneText}>
                        Мама · {item.motherPhone}
                      </Text>
                    </View>
                  )}
                  {item.fatherPhone && (
                    <View style={styles.phoneRow}>
                      <Phone size={12} color={colors.muted} />
                      <Text style={styles.phoneText}>
                        Папа · {item.fatherPhone}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Card>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {!hasFilter
                ? 'Список появится после выбора класса или поиска'
                : status === 'ARCHIVED'
                  ? 'В архиве пусто'
                  : 'Никого не нашли. Измените имя или класс.'}
            </Text>
          </View>
        }
      />
    </Screen>
  )
}

function pluralizeStudent(n: number, base: string): string {
  // «ребёнок» / «ученик» с согласованием падежей.
  if (base === 'ребёнок') {
    if (n === 1) return 'ребёнок'
    if (n < 5) return 'ребёнка'
    return 'детей'
  }
  if (base === 'ученик') {
    if (n === 1) return 'ученик'
    if (n < 5) return 'ученика'
    return 'учеников'
  }
  return base
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
  list: { padding: 16, paddingBottom: 40 },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  search: {
    backgroundColor: colors.surfaceSolid,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
  },
  groupChips: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
    marginLeft: 4,
  },
  summaryText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  groupDot: { width: 10, height: 10, borderRadius: 5 },
  phones: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: 4,
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneText: { fontSize: 12, color: colors.textMid },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
}))
