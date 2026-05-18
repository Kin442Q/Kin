import { useCallback, useEffect, useState } from 'react'
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
import dayjs from 'dayjs'
import { Clock, AlertCircle, CheckCircle2, Wallet } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Avatar from '../components/Avatar'
import { colors, radius, shadow } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { useLabels } from '../theme/useLabels'
import { cap } from '../theme/labels'
import { parentApi, type KidDto, type KidTodayDto } from '../api/parent'
import type { AttendanceStatus } from '../api/attendance'

function statusMeta(type: 'KINDERGARTEN' | 'SCHOOL' | null | undefined): Record<
  AttendanceStatus,
  { label: string; bg: string; fg: string; emoji: string }
> {
  const place = type === 'SCHOOL' ? 'в школе' : 'в саду'
  const placeNeg = type === 'SCHOOL' ? 'Нет в школе' : 'Нет в саду'
  return {
    PRESENT: { label: `В ${place === 'в школе' ? 'школе' : 'саду'}`, bg: colors.primarySoft, fg: colors.primaryDeep, emoji: '🟢' },
    ABSENT: { label: placeNeg, bg: colors.roseSoft, fg: colors.roseDeep, emoji: '🔴' },
    SICK: { label: 'Болеет', bg: colors.yellowSoft, fg: colors.yellowDeep, emoji: '🤒' },
    VACATION: { label: 'В отпуске', bg: colors.lilacSoft, fg: colors.lilacDeep, emoji: '🌴' },
  }
}

export default function ParentHomeScreen() {
  const user = useAuthStore((s) => s.user)
  const L = useLabels()
  const STATUS_META = statusMeta(user?.institution?.type)

  const [kids, setKids] = useState<KidDto[]>([])
  const [activeKidId, setActiveKidId] = useState<string | null>(null)
  const [today, setToday] = useState<KidTodayDto | null>(null)
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

  const loadToday = useCallback(async () => {
    if (!activeKidId) return
    try {
      const t = await parentApi.today(activeKidId)
      setToday(t)
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
    if (activeKidId) loadToday()
  }, [activeKidId, loadToday])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 6) return 'Доброй ночи'
    if (h < 12) return 'Доброе утро'
    if (h < 18) return 'Добрый день'
    return 'Добрый вечер'
  })()

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
          <AlertCircle size={40} color={colors.muted} />
          <Text style={styles.emptyText}>
            К вашему аккаунту пока не привязан ни один {L.student.toLowerCase()}. Обратитесь к
            администратору {L.institution === 'школа' ? 'школы' : 'сада'}.
          </Text>
        </View>
      </Screen>
    )
  }

  const kid = today?.kid ?? kids.find((k) => k.id === activeKidId) ?? kids[0]
  const fullName = `${kid.firstName} ${kid.lastName}`.trim()
  const status = today?.today.attendance?.status ?? null
  const meta = status ? STATUS_META[status] : null
  const nextLesson = today?.today.schedule?.[0]
  const upcoming = (today?.today.schedule ?? []).slice(0, 4)

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              loadToday()
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.name}>{user?.fullName}</Text>
        <Text style={styles.date}>{dayjs().format('dddd, D MMMM')}</Text>

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

        <Card padding={20} style={[styles.heroCard, shadow.md]}>
          <View style={styles.heroTop}>
            <Avatar name={fullName} size={56} />
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={styles.childName}>{kid.firstName}</Text>
              <Text style={styles.childSub}>
                {cap(L.group)} «{kid.group?.name ?? '—'}»
                {kid.group?.ageRange ? ` · ${kid.group.ageRange}` : ''}
              </Text>
            </View>
          </View>

          {meta ? (
            <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.statusText, { color: meta.fg }]}>
                {meta.emoji} {meta.label}
              </Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.statusText, { color: colors.muted }]}>
                ⚪ Воспитатель ещё не отметил
              </Text>
            </View>
          )}
        </Card>

        {today?.lastPayment && (
          <Card padding={14} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.kpiIcon, { backgroundColor: colors.yellowSoft }]}>
              <Wallet size={18} color={colors.yellowDeep} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.kpiLabel}>
                {today.lastPayment.paid ? 'Оплачено' : 'К оплате'}
                {' · '}
                {today.lastPayment.month}
              </Text>
              <Text style={styles.kpiValue}>
                {Math.round(Number(today.lastPayment.amount)).toLocaleString('ru-RU')}{' '}
                <Text style={{ fontSize: 13, color: colors.muted }}>с</Text>
              </Text>
            </View>
            {today.lastPayment.paid ? (
              <CheckCircle2 size={22} color={colors.primaryDeep} />
            ) : (
              <AlertCircle size={22} color={colors.roseDeep} />
            )}
          </Card>
        )}

        <Text style={styles.section}>
          Сегодня {L.institution === 'школа' ? 'в школе' : 'в саду'}
        </Text>

        {upcoming.length === 0 ? (
          <Card padding={20}>
            <Text style={styles.emptyMini}>На сегодня занятий нет</Text>
          </Card>
        ) : (
          upcoming.map((item, i) => (
            <Card key={item.id} style={i ? { marginTop: 10 } : undefined}>
              <View style={styles.itemRow}>
                <View style={styles.timeCol}>
                  <Clock size={14} color={colors.primaryDeep} />
                  <Text style={styles.time}>{item.startTime}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.activity}</Text>
                  <Text style={styles.itemSub}>
                    до {item.endTime}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyMini: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  container: { padding: 20, gap: 14 },
  greeting: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  date: { fontSize: 13, color: colors.textMid, marginBottom: 4 },
  kidTabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  kidChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  heroCard: { marginTop: 2 },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  childName: { fontSize: 18, fontWeight: '800', color: colors.text },
  childSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  statusBadge: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  statusText: { fontWeight: '700', fontSize: 13 },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  section: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 4,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  timeCol: {
    width: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  time: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDeep,
    fontVariant: ['tabular-nums'],
  },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
})
