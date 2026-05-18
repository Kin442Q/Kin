import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Users, GraduationCap } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import { colors, radius } from '../theme/colors'
import { adminApi, type GroupDto } from '../api/admin'

export default function AdminGroupsScreen() {
  const [groups, setGroups] = useState<GroupDto[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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
        data={groups}
        keyExtractor={(g) => g.id}
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
            <Text style={styles.title}>Группы</Text>
            <Text style={styles.subtitle}>
              {groups.length} групп · {totalKids} детей
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
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
                    {teachers} {teachers === 1 ? 'воспитатель' : 'воспитателя'}
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
              Групп пока нет. Добавьте первую в веб-версии.
            </Text>
          </View>
        }
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
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
