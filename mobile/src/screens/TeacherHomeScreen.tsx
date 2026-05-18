import { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as Location from 'expo-location'
import { Clock, LogIn, LogOut, Wallet, TrendingUp, MapPin } from 'lucide-react-native'
import dayjs from 'dayjs'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import Avatar from '../components/Avatar'
import { colors, radius, font, shadow } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { useLabels } from '../theme/useLabels'
import { timeApi, type TimeMonthSummary } from '../api/time'

export default function TeacherHomeScreen() {
  const user = useAuthStore((s) => s.user)

  const [isWorking, setIsWorking] = useState(false)
  const [activeCheckIn, setActiveCheckIn] = useState<string | null>(null)
  const [summary, setSummary] = useState<TimeMonthSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(new Date())
  const [geoStatus, setGeoStatus] = useState<
    'idle' | 'inside' | 'outside' | 'denied' | 'unknown' | 'no-fence'
  >('idle')
  const [distanceM, setDistanceM] = useState<number | null>(null)

  const month = dayjs().format('YYYY-MM')

  const reload = useCallback(async () => {
    try {
      const [status, summ] = await Promise.all([
        timeApi.status(),
        timeApi.myMonth(month),
      ])
      setIsWorking(status.isWorking)
      setActiveCheckIn(status.activeEntry?.checkIn || null)
      setSummary(summ)
    } catch (e: any) {
      Alert.alert('Ошибка загрузки', e?.response?.data?.message || String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [month])

  useEffect(() => {
    reload()
  }, [reload])

  // Геофенс-индикатор: показываем «в саду / вне / расстояние»
  useEffect(() => {
    let cancelled = false
    const inst = user?.institution
    if (!inst || inst.latitude == null || inst.longitude == null) {
      setGeoStatus('no-fence')
      return () => {
        cancelled = true
      }
    }
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (cancelled) return
      if (status !== 'granted') {
        setGeoStatus('denied')
        return
      }
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        if (cancelled) return
        const d = haversineMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          inst.latitude!,
          inst.longitude!,
        )
        setDistanceM(Math.round(d))
        setGeoStatus(d <= inst.checkInRadiusMeters ? 'inside' : 'outside')
      } catch {
        if (!cancelled) setGeoStatus('unknown')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.institution])

  // Тикающий таймер
  useEffect(() => {
    if (!isWorking) return
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [isWorking])

  const elapsed = (() => {
    if (!isWorking || !activeCheckIn) return null
    const sec = Math.max(
      0,
      Math.floor((now.getTime() - new Date(activeCheckIn).getTime()) / 1000),
    )
    return {
      h: Math.floor(sec / 3600),
      m: Math.floor((sec % 3600) / 60),
      s: sec % 60,
    }
  })()

  const handleCheck = async () => {
    // Face ID / Touch ID для подтверждения
    const hasHardware = await LocalAuthentication.hasHardwareAsync()
    const isEnrolled = await LocalAuthentication.isEnrolledAsync()

    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: isWorking
          ? 'Подтвердите уход с работы'
          : 'Подтвердите приход на работу',
        cancelLabel: 'Отмена',
        fallbackLabel: 'Использовать пароль',
      })
      if (!result.success) {
        Alert.alert('Не подтверждено', 'Face/Touch ID не сработал')
        return
      }
    }

    try {
      if (isWorking) {
        await timeApi.checkOut()
        Alert.alert('Хорошего отдыха! 👋', '')
      } else {
        // Перед check-in пробуем взять свежие координаты для геофенс-валидации.
        let coords: { lat: number; lon: number } | undefined
        const inst = user?.institution
        if (inst?.latitude != null && inst?.longitude != null) {
          const { status } = await Location.requestForegroundPermissionsAsync()
          if (status !== 'granted') {
            Alert.alert(
              'Нужна геолокация',
              'Включите доступ к геолокации в настройках, чтобы отметить приход.',
            )
            return
          }
          try {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            })
            coords = {
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            }
          } catch {
            Alert.alert(
              'Геолокация',
              'Не удалось получить координаты. Попробуйте ещё раз на открытом воздухе.',
            )
            return
          }
        }
        await timeApi.checkIn('FACE', coords)
        Alert.alert('Добро пожаловать! 🌿', '')
      }
      reload()
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    }
  }

  const initials = user?.fullName ?? '?'
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 6) return 'Доброй ночи'
    if (h < 12) return 'Доброе утро'
    if (h < 18) return 'Добрый день'
    return 'Добрый вечер'
  })()

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
        {/* Geo indicator */}
        {geoStatus !== 'idle' && geoStatus !== 'no-fence' && (
          <View
            style={[
              styles.geoBadge,
              {
                backgroundColor:
                  geoStatus === 'inside'
                    ? colors.primarySoft
                    : geoStatus === 'outside'
                      ? colors.roseSoft
                      : colors.surfaceAlt,
              },
            ]}
          >
            <MapPin
              size={12}
              color={
                geoStatus === 'inside'
                  ? colors.primaryDeep
                  : geoStatus === 'outside'
                    ? colors.roseDeep
                    : colors.muted
              }
            />
            <Text
              style={[
                styles.geoText,
                {
                  color:
                    geoStatus === 'inside'
                      ? colors.primaryDeep
                      : geoStatus === 'outside'
                        ? colors.roseDeep
                        : colors.muted,
                },
              ]}
            >
              {geoStatus === 'inside'
                ? `На территории${distanceM != null ? ' · ' + distanceM + ' м' : ''}`
                : geoStatus === 'outside'
                  ? `Вне территории${distanceM != null ? ' · ' + distanceM + ' м' : ''}`
                  : geoStatus === 'denied'
                    ? 'Геолокация выключена'
                    : 'Не удалось определить позицию'}
            </Text>
          </View>
        )}

        {/* Greeting */}
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.name}>{user?.fullName}</Text>
        <Text style={styles.date}>{dayjs().format('dddd, D MMMM')}</Text>

        {/* Главная карточка check-in/out */}
        <Card
          padding={24}
          style={[
            styles.mainCard,
            {
              backgroundColor: isWorking ? colors.primarySoft : colors.surface,
            },
          ]}
        >
          <View style={{ alignItems: 'center' }}>
            <Avatar name={initials} size={72} />

            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: isWorking
                    ? colors.primary
                    : colors.surfaceAlt,
                },
              ]}
            >
              <Text
                style={{
                  color: isWorking ? '#fff' : colors.muted,
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                {isWorking ? '🟢 На работе' : '⚪ Не на работе'}
              </Text>
            </View>

            {isWorking && elapsed && (
              <>
                <Text style={styles.timer}>
                  {String(elapsed.h).padStart(2, '0')}:
                  {String(elapsed.m).padStart(2, '0')}:
                  {String(elapsed.s).padStart(2, '0')}
                </Text>
                <Text style={styles.timerHint}>
                  Пришли в {dayjs(activeCheckIn).format('HH:mm')}
                </Text>
              </>
            )}

            <Btn
              block
              size="lg"
              variant={isWorking ? 'danger' : 'primary'}
              icon={
                isWorking ? (
                  <LogOut size={20} color="#fff" />
                ) : (
                  <LogIn size={20} color="#fff" />
                )
              }
              onPress={handleCheck}
              style={{ marginTop: 18 }}
            >
              {isWorking ? 'Я ухожу' : 'Я пришёл'}
            </Btn>
          </View>
        </Card>

        {/* KPI ряд */}
        <View style={styles.kpiRow}>
          <Card style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: colors.primaryGhost }]}>
              <Clock size={18} color={colors.primaryDeep} />
            </View>
            <Text style={styles.kpiLabel}>Часов</Text>
            <Text style={styles.kpiValue}>
              {summary?.totalHours ?? 0}
              <Text style={{ fontSize: 13, color: colors.muted }}>
                {' '}/ {summary?.workNorm ?? 176}ч
              </Text>
            </Text>
          </Card>
          <Card style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: colors.yellowSoft }]}>
              <Wallet size={18} color={colors.yellowDeep} />
            </View>
            <Text style={styles.kpiLabel}>К выплате</Text>
            <Text style={styles.kpiValue}>
              {Math.round(summary?.estimatedSalary ?? 0).toLocaleString('ru-RU')}
              <Text style={{ fontSize: 13, color: colors.muted }}> с</Text>
            </Text>
          </Card>
        </View>

        {/* Mode */}
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.kpiIcon, { backgroundColor: colors.blueSoft }]}>
            <TrendingUp size={18} color={colors.blueDeep} />
          </View>
          <View>
            <Text style={{ fontSize: 11, color: colors.muted }}>
              Режим оплаты
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
              {summary?.salaryMode === 'HOURLY'
                ? `Почасовая · ${summary.hourlyRate} сом/ч`
                : `Фикс. оклад · ${summary?.fixedSalary ?? 0} сом`}
            </Text>
          </View>
        </Card>

        {!loading && (summary?.entries.length ?? 0) === 0 && (
          <Text style={styles.empty}>
            Записей пока нет. Нажмите «Я пришёл» чтобы начать.
          </Text>
        )}
      </ScrollView>
    </Screen>
  )
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 14,
  },
  geoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  geoText: { fontSize: 11, fontWeight: '700' },
  greeting: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '500',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 13,
    color: colors.textMid,
    marginBottom: 8,
  },
  mainCard: {
    ...shadow.md,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginTop: 12,
  },
  timer: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.primaryDeep,
    marginTop: 14,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  timerHint: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  empty: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 12,
  },
})
