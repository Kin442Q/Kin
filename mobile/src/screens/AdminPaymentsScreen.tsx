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
import dayjs from 'dayjs'
import { CheckCircle2, AlertCircle, Wallet } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Avatar from '../components/Avatar'
import { colors, radius, shadow } from '../theme/colors'
import { adminApi, type AdminPaymentDto } from '../api/admin'

type Filter = 'all' | 'paid' | 'unpaid'

export default function AdminPaymentsScreen() {
  const month = useMemo(() => dayjs().format('YYYY-MM'), [])
  const [items, setItems] = useState<AdminPaymentDto[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const reload = useCallback(async () => {
    try {
      const list = await adminApi.payments({ month })
      setItems(list)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [month])

  useEffect(() => {
    reload()
  }, [reload])

  const stats = useMemo(() => {
    const paid = items
      .filter((p) => p.paid)
      .reduce((sum, p) => sum + Number(p.amount), 0)
    const due = items
      .filter((p) => !p.paid)
      .reduce((sum, p) => sum + Number(p.amount), 0)
    return { paid, due, paidCount: items.filter((p) => p.paid).length }
  }, [items])

  const visible = useMemo(() => {
    if (filter === 'paid') return items.filter((p) => p.paid)
    if (filter === 'unpaid') return items.filter((p) => !p.paid)
    return items
  }, [items, filter])

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
      <FlatList
        data={visible}
        keyExtractor={(p) => p.id}
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
            <Text style={styles.title}>Оплаты</Text>
            <Text style={styles.subtitle}>
              {dayjs(month + '-01').format('MMMM YYYY')}
            </Text>

            <View style={styles.kpiRow}>
              <Card padding={16} style={[
                { flex: 1, backgroundColor: colors.primarySoft },
                shadow.sm,
              ]}>
                <View style={styles.kpiHead}>
                  <CheckCircle2 size={16} color={colors.primaryDeep} />
                  <Text style={[styles.kpiLabel, { color: colors.primaryDeep }]}>
                    Оплачено
                  </Text>
                </View>
                <Text style={[styles.kpiValue, { color: colors.primaryDeep }]}>
                  {Math.round(stats.paid).toLocaleString('ru-RU')}
                  <Text style={styles.kpiUnit}> с</Text>
                </Text>
                <Text style={styles.kpiSub}>{stats.paidCount} платежей</Text>
              </Card>
              <Card padding={16} style={[
                {
                  flex: 1,
                  backgroundColor: stats.due > 0 ? colors.roseSoft : colors.surface,
                },
                shadow.sm,
              ]}>
                <View style={styles.kpiHead}>
                  <AlertCircle
                    size={16}
                    color={stats.due > 0 ? colors.roseDeep : colors.muted}
                  />
                  <Text
                    style={[
                      styles.kpiLabel,
                      { color: stats.due > 0 ? colors.roseDeep : colors.muted },
                    ]}
                  >
                    Долг
                  </Text>
                </View>
                <Text
                  style={[
                    styles.kpiValue,
                    { color: stats.due > 0 ? colors.roseDeep : colors.muted },
                  ]}
                >
                  {Math.round(stats.due).toLocaleString('ru-RU')}
                  <Text style={styles.kpiUnit}> с</Text>
                </Text>
                <Text style={styles.kpiSub}>
                  {items.length - stats.paidCount} не оплатили
                </Text>
              </Card>
            </View>

            <View style={styles.tabs}>
              {(['all', 'unpaid', 'paid'] as Filter[]).map((f) => {
                const on = filter === f
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
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
                      {f === 'all' ? 'Все' : f === 'paid' ? 'Оплачено' : 'Не оплатили'}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const name = item.student
            ? `${item.student.firstName} ${item.student.lastName}`
            : '—'
          return (
            <Card padding={12}>
              <View style={styles.row}>
                <Avatar name={name} size={40} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.meta}>
                    {item.paid
                      ? `Оплачено${item.paidAt ? ' · ' + dayjs(item.paidAt).format('D MMM') : ''}`
                      : 'Не оплачено'}
                    {item.method ? ` · ${methodLabel(item.method)}` : ''}
                  </Text>
                </View>
                <View style={styles.amountCol}>
                  <Text
                    style={[
                      styles.amount,
                      { color: item.paid ? colors.text : colors.roseDeep },
                    ]}
                  >
                    {Math.round(Number(item.amount)).toLocaleString('ru-RU')} с
                  </Text>
                  {item.paid ? (
                    <CheckCircle2 size={16} color={colors.primaryDeep} />
                  ) : (
                    <Wallet size={16} color={colors.roseDeep} />
                  )}
                </View>
              </View>
            </Card>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {filter === 'paid'
                ? 'Оплат за этот месяц пока нет.'
                : filter === 'unpaid'
                  ? 'Все оплатили 🎉'
                  : 'Платежей за этот месяц нет.'}
            </Text>
          </View>
        }
      />
    </Screen>
  )
}

function methodLabel(m: string): string {
  if (m === 'CASH') return 'Наличные'
  if (m === 'CARD') return 'Карта'
  if (m === 'TRANSFER') return 'Перевод'
  return m
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
  kpiRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kpiLabel: { fontSize: 11, fontWeight: '700' },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  kpiUnit: { fontSize: 13, fontWeight: '600', opacity: 0.6 },
  kpiSub: { fontSize: 11, opacity: 0.7, marginTop: 2, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 6, marginTop: 16 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amountCol: { alignItems: 'flex-end', gap: 4 },
  amount: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
})
