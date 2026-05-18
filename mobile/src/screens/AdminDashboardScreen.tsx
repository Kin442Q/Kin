import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import {
  Users,
  LayoutGrid,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowDownCircle,
  Baby,
  Receipt,
  CalendarHeart,
  ChevronRight,
} from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import { colors, radius, shadow } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { adminApi, type DashboardDto } from '../api/admin'

export default function AdminDashboardScreen() {
  const user = useAuthStore((s) => s.user)
  const navigation = useNavigation<any>()
  const month = useMemo(() => dayjs().format('YYYY-MM'), [])

  const [data, setData] = useState<DashboardDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const reload = useCallback(async () => {
    try {
      const d = await adminApi.dashboard(month)
      setData(d)
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
      <ScrollView
        contentContainerStyle={styles.container}
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
      >
        <Text style={styles.greeting}>Привет,</Text>
        <Text style={styles.name}>{user?.fullName}</Text>
        <Text style={styles.date}>
          {dayjs().format('MMMM YYYY')} · сводка по садику
        </Text>

        <View style={styles.kpiRow}>
          <KpiCard
            icon={<Users size={18} color={colors.primaryDeep} />}
            bg={colors.primaryGhost}
            label="Активных детей"
            value={String(data?.activeStudents ?? 0)}
            sub={data ? `из ${data.totalStudents} всего` : ''}
          />
          <KpiCard
            icon={<LayoutGrid size={18} color={colors.blueDeep} />}
            bg={colors.blueSoft}
            label="Групп"
            value={String(data?.groups ?? 0)}
            sub="активных"
          />
        </View>

        <Card padding={20} style={[styles.profit, shadow.md]}>
          <Text style={styles.profitLabel}>Прибыль месяца</Text>
          <View style={styles.profitRow}>
            <Text
              style={[
                styles.profitValue,
                {
                  color:
                    (data?.profit ?? 0) >= 0
                      ? colors.primaryDeep
                      : colors.roseDeep,
                },
              ]}
            >
              {Math.round(data?.profit ?? 0).toLocaleString('ru-RU')}
              <Text style={styles.profitUnit}> с</Text>
            </Text>
            {(data?.profit ?? 0) >= 0 ? (
              <TrendingUp size={28} color={colors.primaryDeep} />
            ) : (
              <TrendingDown size={28} color={colors.roseDeep} />
            )}
          </View>
          {data && (
            <Text style={styles.profitMargin}>
              Маржа {(data.margin * 100).toFixed(1)}%
            </Text>
          )}
        </Card>

        <Text style={styles.section}>Быстрые действия</Text>
        <View style={styles.quickRow}>
          <QuickAction
            icon={<Baby size={20} color={colors.primaryDeep} />}
            bg={colors.primarySoft}
            label="Дети"
            onPress={() => navigation.navigate('AdminStudents')}
          />
          <QuickAction
            icon={<Receipt size={20} color={colors.roseDeep} />}
            bg={colors.roseSoft}
            label="Расходы"
            onPress={() => navigation.navigate('AdminExpenses')}
          />
          <QuickAction
            icon={<CalendarHeart size={20} color={colors.lilacDeep} />}
            bg={colors.lilacSoft}
            label="Собрания"
            onPress={() => navigation.navigate('AdminMeetings')}
          />
        </View>

        <Text style={styles.section}>Доходы и расходы</Text>

        <Card padding={16}>
          <Row
            icon={<Wallet size={18} color={colors.primaryDeep} />}
            bg={colors.primarySoft}
            label="Поступления по оплате"
            value={data?.income ?? 0}
          />
          <Divider />
          <Row
            icon={<TrendingUp size={18} color={colors.yellowDeep} />}
            bg={colors.yellowSoft}
            label="Доп. доходы"
            value={data?.extraIncome ?? 0}
          />
        </Card>

        <Card padding={16}>
          <Row
            icon={<ArrowDownCircle size={18} color={colors.roseDeep} />}
            bg={colors.roseSoft}
            label="Текущие расходы"
            value={data?.expenses ?? 0}
            negative
          />
          <Divider />
          <Row
            icon={<ArrowDownCircle size={18} color={colors.lilacDeep} />}
            bg={colors.lilacSoft}
            label="Фикс. расходы"
            value={data?.fixedExpenses ?? 0}
            negative
          />
          <Divider />
          <Row
            icon={<ArrowDownCircle size={18} color={colors.muted} />}
            bg={colors.surfaceAlt}
            label="Зарплаты"
            value={data?.salaries ?? 0}
            negative
          />
          <Divider />
          <Row
            icon={<ArrowDownCircle size={18} color={colors.muted} />}
            bg={colors.surfaceAlt}
            label="Налоги"
            value={data?.taxes ?? 0}
            negative
          />
        </Card>
      </ScrollView>
    </Screen>
  )
}

interface KpiProps {
  icon: React.ReactNode
  bg: string
  label: string
  value: string
  sub?: string
}
function KpiCard({ icon, bg, label, value, sub }: KpiProps) {
  return (
    <Card style={{ flex: 1, ...shadow.sm }}>
      <View style={[styles.kpiIconBox, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </Card>
  )
}

interface RowProps {
  icon: React.ReactNode
  bg: string
  label: string
  value: number
  negative?: boolean
}
function Row({ icon, bg, label, value, negative }: RowProps) {
  return (
    <View style={styles.rowItem}>
      <View style={[styles.rowIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          { color: negative ? colors.roseDeep : colors.text },
        ]}
      >
        {negative ? '−' : ''}
        {Math.round(value).toLocaleString('ru-RU')}
        <Text style={styles.rowUnit}> с</Text>
      </Text>
    </View>
  )
}
function Divider() {
  return <View style={styles.divider} />
}

interface QuickProps {
  icon: React.ReactNode
  bg: string
  label: string
  onPress: () => void
}
function QuickAction({ icon, bg, label, onPress }: QuickProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickCard,
        pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.quickLabel}>{label}</Text>
      <ChevronRight size={14} color={colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 20, gap: 14 },
  greeting: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  date: { fontSize: 13, color: colors.textMid, marginBottom: 4 },
  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiLabel: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  kpiSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  profit: { marginTop: 4 },
  profitLabel: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  profitValue: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  profitUnit: { fontSize: 16, fontWeight: '600', opacity: 0.6 },
  profitMargin: { fontSize: 12, color: colors.muted, marginTop: 4 },
  section: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 10,
  },
  rowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowLabel: { flex: 1, fontSize: 14, color: colors.text },
  rowValue: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  rowUnit: { fontSize: 12, fontWeight: '600', opacity: 0.6 },
  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: 6,
    marginLeft: 46,
  },
  quickRow: { gap: 8 },
  quickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
})
