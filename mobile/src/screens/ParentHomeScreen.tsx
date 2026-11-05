import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { AlertCircle, ChevronDown, MessageCircle, School } from 'lucide-react-native'

import { Text } from '../components/Text'
import Screen from '../components/Screen'
import Card from '../components/Card'
import { CardTitle, ScreenHeading } from '../components/ui'
import { colors, radius, shadow } from '../theme/colors'
import { gradeTone } from '../lib/gradeStyle'
import { hasFeature } from '../lib/features'
import { useAuthStore } from '../store/authStore'
import {
  parentApi,
  type KidDto,
  type KidTodayDto,
  type ParentGradeDto,
  type ParentHomeworkDto,
} from '../api/parent'
import type { AttendanceStatus } from '../api/attendance'

/** Карточка-статус «Малика в школе»: цвет и подпись по отметке посещаемости. */
const STATUS: Record<AttendanceStatus | 'NONE', { title: string; bg: string; fg: string; sub: string }> = {
  PRESENT: { title: 'в школе', bg: colors.primary, fg: '#FFFFFF', sub: '#DDF1F0' },
  ABSENT: { title: 'нет в школе', bg: colors.coral, fg: colors.text, sub: '#4A2A20' },
  SICK: { title: 'болеет', bg: '#F6C46A', fg: colors.text, sub: '#4A2A20' },
  VACATION: { title: 'в отпуске', bg: '#CFC6F2', fg: colors.text, sub: '#3F3478' },
  NONE: { title: 'пока не отмечен', bg: 'rgba(255,255,255,0.84)', fg: colors.text, sub: colors.textMid },
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return 'Доброй ночи!'
  if (h < 12) return 'Доброе утро!'
  if (h < 18) return 'Добрый день!'
  return 'Добрый вечер!'
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** «до завтра», «до пт», «до 12.11» — срок домашнего задания. */
function dueLabel(due: string): string {
  const d = dayjs(due).startOf('day')
  const diff = d.diff(dayjs().startOf('day'), 'day')
  if (diff <= 0) return 'на сегодня'
  if (diff === 1) return 'до завтра'
  return `до ${d.format('DD.MM')}`
}

export default function ParentHomeScreen() {
  const nav = useNavigation<any>()
  const user = useAuthStore((s) => s.user)
  const chatOn = hasFeature(user, 'chat')

  const [kids, setKids] = useState<KidDto[]>([])
  const [activeKidId, setActiveKidId] = useState<string | null>(null)
  const [today, setToday] = useState<KidTodayDto | null>(null)
  const [grades, setGrades] = useState<ParentGradeDto[]>([])
  const [homework, setHomework] = useState<ParentHomeworkDto[]>([])
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
    const day = dayjs().format('YYYY-MM-DD')
    try {
      const [t, g, hw] = await Promise.all([
        parentApi.today(activeKidId),
        hasFeature(user, 'grades') ? parentApi.grades(activeKidId, day, day).catch(() => []) : Promise.resolve([]),
        hasFeature(user, 'homework') ? parentApi.homework(activeKidId).catch(() => []) : Promise.resolve([]),
      ])
      setToday(t)
      setGrades(g)
      setHomework(hw)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeKidId, user])

  useEffect(() => {
    loadKids()
  }, [loadKids])

  useEffect(() => {
    if (activeKidId) loadToday()
  }, [activeKidId, loadToday])

  if (loading) {
    return (
      <Screen variant="home">
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  if (!kids.length) {
    return (
      <Screen variant="home">
        <View style={styles.center}>
          <AlertCircle size={40} color={colors.muted} />
          <Text style={styles.emptyText}>
            К вашему аккаунту пока не привязан ни один ученик. Обратитесь к администратору школы.
          </Text>
        </View>
      </Screen>
    )
  }

  const kid = today?.kid ?? kids.find((k) => k.id === activeKidId) ?? kids[0]
  const status = STATUS[today?.today.attendance?.status ?? 'NONE']
  const lessons = [...(today?.today.schedule ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime))
  const nowMin = dayjs().hour() * 60 + dayjs().minute()
  const nextHomework = [...homework]
    .filter((h) => !dayjs(h.dueDate).isBefore(dayjs().startOf('day')))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  const kidChip = `${kid.firstName}${kid.group?.name ? ' · ' + kid.group.name : ''}`
  const initials = `${kid.firstName[0] ?? ''}${kid.lastName[0] ?? ''}`.toUpperCase()

  const cycleKid = () => {
    if (kids.length < 2) return
    const i = kids.findIndex((k) => k.id === kid.id)
    setActiveKidId(kids[(i + 1) % kids.length].id)
  }

  return (
    <Screen variant="home">
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
        <ScreenHeading
          title={greeting()}
          size={24}
          right={
            <Pressable
              onPress={cycleKid}
              disabled={kids.length < 2}
              accessibilityRole="button"
              accessibilityLabel={kids.length > 1 ? `Ребёнок: ${kidChip}. Сменить` : `Ребёнок: ${kidChip}`}
              style={styles.kidChip}
            >
              <View style={styles.kidAvatar}>
                <Text style={styles.kidAvatarText}>{initials}</Text>
              </View>
              <Text style={styles.kidChipText} numberOfLines={1}>
                {kidChip}
              </Text>
              {kids.length > 1 && <ChevronDown size={15} color={colors.textMid} />}
            </Pressable>
          }
        />

        <View style={[styles.statusCard, { backgroundColor: status.bg }, shadow.lg]}>
          <View style={styles.statusIcon}>
            <School size={26} color={status.fg} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.statusTitle, { color: status.fg }]} numberOfLines={2}>
              {kid.firstName} {status.title}
            </Text>
            <Text style={[styles.statusSub, { color: status.sub }]}>
              {lessons.length
                ? `Уроки сегодня: ${lessons[0].startTime}–${lessons[lessons.length - 1].endTime}`
                : dayjs().format('dddd, D MMMM')}
            </Text>
          </View>
        </View>

        <Card padding={16}>
          <CardTitle
            title="Дневник за сегодня"
            right={lessons.length ? `${lessons.length} ${lessons.length === 1 ? 'урок' : lessons.length < 5 ? 'урока' : 'уроков'}` : undefined}
          />
          {lessons.length === 0 ? (
            <Text style={styles.muted}>На сегодня уроков нет</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {lessons.map((l, i) => {
                const grade = grades.find((g) => g.subject?.name.toLowerCase() === l.activity.toLowerCase())
                const start = minutes(l.startTime)
                const end = minutes(l.endTime)
                const now = nowMin >= start && nowMin < end
                const future = nowMin < start
                const tone = gradeTone(grade?.value)
                return (
                  <View key={l.id} style={[styles.lessonRow, future && { opacity: 0.6 }]}>
                    <Text style={styles.lessonNo}>{i + 1}</Text>
                    <Text style={styles.lessonName} numberOfLines={1}>
                      {l.activity}
                    </Text>
                    {grade ? (
                      <View style={[styles.gradeBox, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.gradeText, { color: tone.fg }]}>{grade.value}</Text>
                      </View>
                    ) : (
                      <Text style={styles.lessonHint}>{now ? 'идёт сейчас' : future ? l.startTime : ''}</Text>
                    )}
                  </View>
                )
              })}
            </View>
          )}
        </Card>

        {nextHomework && (
          <Card padding={16} style={{ gap: 6 }}>
            <CardTitle title="Домашнее задание" right={dueLabel(nextHomework.dueDate)} rightTone="warn" />
            <Text style={styles.hwText}>
              {nextHomework.subject?.name ? `${nextHomework.subject.name}: ` : ''}
              {nextHomework.title}
            </Text>
          </Card>
        )}

        {today?.lastPayment && !today.lastPayment.paid && (
          <Card padding={16}>
            <CardTitle title="К оплате" right={today.lastPayment.month} rightTone="warn" />
            <Text style={styles.hwText}>
              {Math.round(Number(today.lastPayment.amount)).toLocaleString('ru-RU')} с
            </Text>
          </Card>
        )}

        {chatOn && (
          <Pressable
            onPress={() => nav.navigate('ParentChat')}
            accessibilityRole="button"
            style={styles.chatBtn}
          >
            <MessageCircle size={20} color={colors.primaryDeep} />
            <Text style={styles.chatBtnText}>Написать классному руководителю</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  container: { padding: 16, gap: 12 },
  kidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 190,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  kidAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#9EDDD9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kidAvatarText: { fontSize: 12, fontWeight: '700', color: colors.text },
  kidChipText: { fontSize: 14, fontWeight: '600', color: colors.text, flexShrink: 1 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 24,
  },
  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  statusSub: { fontSize: 14 },
  muted: { fontSize: 14, color: colors.textMid },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 },
  lessonNo: { width: 22, fontSize: 13, color: colors.textMid },
  lessonName: { flex: 1, fontSize: 14, color: colors.text },
  lessonHint: { fontSize: 12, color: colors.textMid },
  gradeBox: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  gradeText: { fontSize: 15, fontWeight: '800' },
  hwText: { fontSize: 14, color: colors.textMid, lineHeight: 20 },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  chatBtnText: { fontSize: 15, fontWeight: '700', color: colors.primaryDeep },
})
