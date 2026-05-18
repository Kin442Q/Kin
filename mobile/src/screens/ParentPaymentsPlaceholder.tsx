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
import { CheckCircle2, AlertCircle, Wallet } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import { colors, radius, shadow } from '../theme/colors'
import {
  parentApi,
  type KidDto,
  type PaymentDto,
} from '../api/parent'

const MONTH_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  if (!y || !mo) return m
  return `${MONTH_RU[mo - 1]} ${y}`
}

export default function ParentPaymentsScreen() {
  const [kids, setKids] = useState<KidDto[]>([])
  const [activeKidId, setActiveKidId] = useState<string | null>(null)
  const [payments, setPayments] = useState<PaymentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadKids = useCallback(async () => {
    try {
      const list = await parentApi.myKids()
      setKids(list)
      if (list.length && !activeKidId) setActiveKidId(list[0].id)
      else if (!list.length) setLoading(false)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
      setLoading(false)
    }
  }, [activeKidId])

  const loadPayments = useCallback(async () => {
    if (!activeKidId) return
    try {
      const list = await parentApi.payments(activeKidId)
      setPayments(list)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeKidId])

  useEffect(() => {
    loadKids()
  }, [loadKids])

  useEffect(() => {
    if (activeKidId) loadPayments()
  }, [activeKidId, loadPayments])

  const stats = useMemo(() => {
    const totalPaid = payments
      .filter((p) => p.paid)
      .reduce((sum, p) => sum + Number(p.amount), 0)
    const totalDue = payments
      .filter((p) => !p.paid)
      .reduce((sum, p) => sum + Number(p.amount), 0)
    return { totalPaid, totalDue }
  }, [payments])

  if (loading) {
    return (
      <Screen>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  if (!kids.length) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Нет привязанных детей.</Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <FlatList
        data={payments}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              loadPayments()
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.title}>Оплата</Text>

            {kids.length > 1 && (
              <View style={styles.kidTabs}>
                {kids.map((k) => {
                  const on = k.id === activeKidId
                  return (
                    <Pressable
                      key={k.id}
                      onPress={() => setActiveKidId(k.id)}
                      style={[
                        styles.kidChip,
                        {
                          backgroundColor: on ? colors.primary : colors.surfaceAlt,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: on ? '#fff' : colors.text,
                          fontWeight: '700',
                          fontSize: 13,
                        }}
                      >
                        {k.firstName}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )}

            <View style={styles.kpiRow}>
              <Card padding={16} style={[styles.kpiCard, { backgroundColor: colors.primarySoft }, shadow.sm]}>
                <View style={styles.kpiHead}>
                  <CheckCircle2 size={16} color={colors.primaryDeep} />
                  <Text style={[styles.kpiLabel, { color: colors.primaryDeep }]}>
                    Оплачено
                  </Text>
                </View>
                <Text style={[styles.kpiValue, { color: colors.primaryDeep }]}>
                  {Math.round(stats.totalPaid).toLocaleString('ru-RU')}
                  <Text style={styles.kpiUnit}> с</Text>
                </Text>
              </Card>
              <Card padding={16} style={[
                styles.kpiCard,
                { backgroundColor: stats.totalDue > 0 ? colors.roseSoft : colors.surface },
                shadow.sm,
              ]}>
                <View style={styles.kpiHead}>
                  <AlertCircle
                    size={16}
                    color={stats.totalDue > 0 ? colors.roseDeep : colors.muted}
                  />
                  <Text
                    style={[
                      styles.kpiLabel,
                      { color: stats.totalDue > 0 ? colors.roseDeep : colors.muted },
                    ]}
                  >
                    К оплате
                  </Text>
                </View>
                <Text
                  style={[
                    styles.kpiValue,
                    { color: stats.totalDue > 0 ? colors.roseDeep : colors.muted },
                  ]}
                >
                  {Math.round(stats.totalDue).toLocaleString('ru-RU')}
                  <Text style={styles.kpiUnit}> с</Text>
                </Text>
              </Card>
            </View>

            <Text style={styles.section}>История оплат</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <Card padding={14}>
            <View style={styles.row}>
              <View
                style={[
                  styles.icon,
                  {
                    backgroundColor: item.paid
                      ? colors.primarySoft
                      : colors.roseSoft,
                  },
                ]}
              >
                <Wallet
                  size={18}
                  color={item.paid ? colors.primaryDeep : colors.roseDeep}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.month}>{monthLabel(item.month)}</Text>
                <Text style={styles.meta}>
                  {item.paid
                    ? `Оплачено${item.paidAt ? ' · ' + new Date(item.paidAt).toLocaleDateString('ru-RU') : ''}`
                    : 'Не оплачено'}
                  {item.method ? ` · ${methodLabel(item.method)}` : ''}
                </Text>
              </View>
              <Text
                style={[
                  styles.amount,
                  { color: item.paid ? colors.text : colors.roseDeep },
                ]}
              >
                {Math.round(Number(item.amount)).toLocaleString('ru-RU')} с
              </Text>
            </View>
            {item.comment && <Text style={styles.comment}>{item.comment}</Text>}
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Записей об оплате нет.</Text>
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
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  list: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  kidTabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  kidChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: { flex: 1 },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kpiLabel: { fontSize: 11, fontWeight: '700' },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  kpiUnit: { fontSize: 13, fontWeight: '600', opacity: 0.6 },
  section: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 22,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  month: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  comment: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    fontStyle: 'italic',
  },
})
