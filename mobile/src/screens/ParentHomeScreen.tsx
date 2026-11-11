import { uiText, uiLanguage } from '../i18n/uiText'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { ChevronDown, MessageCircle, School, ClipboardList, Wallet, AlertCircle } from 'lucide-react-native'

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

import GradientView from '../components/GradientView'
import IconTile from '../components/IconTile'
import { subjectIcon } from '../lib/subjectIcon'
import { themedStyles, themedValue } from '../theme/themedStyles'

/** Цвета плиток предметов в дневнике: по кругу, как в макете. */
const TILE_ACCENTS = themedValue<Array<{ bg: string; fg: string }>>(() => ([
  { bg: 'rgba(255,138,101,0.2)', fg: colors.roseDeep },
  { bg: 'rgba(13,122,124,0.13)', fg: colors.primary },
  { bg: 'rgba(246,196,106,0.3)', fg: colors.yellowDeep },
  { bg: 'rgba(140,120,230,0.16)', fg: colors.lilacDeep },
]))
import { notifyError } from '../lib/notify'
/** Карточка-статус «Малика в школе»: цвет и подпись по отметке посещаемости. */
const STATUS = themedValue<Record<AttendanceStatus | 'NONE', { title: string; bg: string; fg: string; sub: string }>>(() => ({
  PRESENT: { title: uiText("в школе"), bg: colors.primary, fg: '#FFFFFF', sub: '#DDF1F0' },
  ABSENT: { title: uiText("нет в школе"), bg: colors.coral, fg: '#10282A', sub: '#4A2A20' },
  SICK: { title: uiText("болеет"), bg: '#F6C46A', fg: '#10282A', sub: '#4A2A20' },
  VACATION: { title: uiText("в отпуске"), bg: '#CFC6F2', fg: '#10282A', sub: '#3F3478' },
  NONE: { title: uiText("пока не отмечен"), bg: colors.surface, fg: colors.text, sub: colors.textMid },
}))

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return uiText("Доброй ночи!")
  if (h < 12) return uiText("Доброе утро!")
  if (h < 18) return uiText("Добрый день!")
  return uiText("Добрый вечер!")
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** «до завтра», «до пт», «до 12.11» — срок домашнего задания. */
function dueLabel(due: string): string {
  const d = dayjs(due).startOf('day')
  const diff = d.diff(dayjs().startOf('day'), 'day')
  if (diff <= 0) return uiText("на сегодня")
  if (diff === 1) return uiText("до завтра")
  return uiText("до {0}", d.format('DD.MM'))
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
      notifyError(e)
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
      notifyError(e)
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
            {" " + uiText("К вашему аккаунту пока не привязан ни один ученик. Обратитесь к администратору школы.") + " "}</Text>
        </View>
      </Screen>
    )
  }

  const kid = today?.kid ?? kids.find((k) => k.id === activeKidId) ?? kids[0]
  const status = STATUS()[today?.today.attendance?.status ?? 'NONE']
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
        <View style={styles.headRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.eyebrow}>
              {dayjs().format('dddd, D MMMM')}
              {kid.group?.name ? ` · ${kid.group.name}` : ''}
            </Text>
            <Text style={styles.title}>{greeting()}</Text>
          </View>
          <Pressable
            onPress={cycleKid}
            disabled={kids.length < 2}
            accessibilityRole="button"
            accessibilityLabel={kids.length > 1 ? uiText("Ребёнок: {0}. Сменить", kidChip) : uiText("Ребёнок: {0}", kidChip)}
            style={styles.kidChip}
          >
            <GradientView from="#9EDDD9" to="#5FD0CB" style={styles.kidAvatar}>
              <Text style={styles.kidAvatarText}>{initials}</Text>
            </GradientView>
            <Text style={styles.kidChipText} numberOfLines={1}>
              {kid.firstName}
            </Text>
            {kids.length > 1 && <ChevronDown size={16} color={colors.textMid} />}
          </Pressable>
        </View>

        <GradientView
          from={status.bg === colors.primary ? '#12898A' : status.bg}
          to={status.bg === colors.primary ? '#075B5D' : status.bg}
          style={[styles.statusCard, shadow.lg]}
        >
          <View style={styles.statusIcon}>
            <School size={26} color={status.fg} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.statusTitle, { color: status.fg }]} numberOfLines={2}>
              {kid.firstName} {status.title}
            </Text>
            <Text style={[styles.statusSub, { color: status.sub }]}>
              {lessons.length
                ? uiText("Уроки сегодня: {0}–{1}", lessons[0].startTime, lessons[lessons.length - 1].endTime)
                : dayjs().format('dddd, D MMMM')}
            </Text>
          </View>
        </GradientView>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{uiText("Дневник за сегодня")}</Text>
            {hasFeature(user, 'grades') && (
              <Pressable onPress={() => nav.navigate('ParentGrades')} accessibilityRole="link" hitSlop={8}>
                <Text style={styles.cardLink}>{uiText("Все →")}</Text>
              </Pressable>
            )}
          </View>
          {lessons.length === 0 ? (
            <Text style={styles.muted}>{uiText("На сегодня уроков нет")}</Text>
          ) : (
            lessons.map((l, i) => {
              const grade = grades.find((g) => g.subject?.name.toLowerCase() === l.activity.toLowerCase())
              const start = minutes(l.startTime)
              const end = minutes(l.endTime)
              const now = nowMin >= start && nowMin < end
              const future = nowMin < start
              const tone = gradeTone(grade?.value)
              const accent = TILE_ACCENTS()[i % TILE_ACCENTS().length]
              return (
                <View key={l.id} style={styles.lessonRow}>
                  <Text style={styles.lessonNo}>{i + 1}</Text>
                  <IconTile icon={subjectIcon(l.activity)} bg={accent.bg} fg={accent.fg} size={36} style={{ borderRadius: 14 }} />
                  <Text style={styles.lessonName} numberOfLines={1}>
                    {l.activity}
                  </Text>
                  {grade ? (
                    <View style={[styles.gradeBox, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.gradeText, { color: tone.fg }]}>{grade.value}</Text>
                    </View>
                  ) : now ? (
                    <View style={styles.nowBadge}>
                      <Text style={styles.nowBadgeText}>{uiText("идёт сейчас")}</Text>
                    </View>
                  ) : future ? (
                    <Text style={styles.lessonHint}>{l.startTime}</Text>
                  ) : null}
                </View>
              )
            })
          )}
        </View>

        {nextHomework && (
          <View style={[styles.card, { padding: 14 }]}>
            <View style={styles.hwRow}>
              <IconTile icon={ClipboardList} bg="rgba(255,138,101,0.2)" fg={colors.roseDeep} size={40} style={{ borderRadius: 14 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.hwEyebrow}>{uiText("ДЗ") + " "}{dueLabel(nextHomework.dueDate)}</Text>
                <Text style={styles.hwText}>
                  {nextHomework.subject?.name ? `${nextHomework.subject.name}: ` : ''}
                  {nextHomework.title}
                </Text>
              </View>
            </View>
          </View>
        )}

        {today?.lastPayment && !today.lastPayment.paid && (
          <View style={[styles.card, { padding: 14 }]}>
            <View style={styles.hwRow}>
              <IconTile icon={Wallet} bg="rgba(246,196,106,0.3)" fg={colors.yellowDeep} size={40} style={{ borderRadius: 14 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.hwEyebrow}>{uiText("К оплате ·") + " "}{today.lastPayment.month}</Text>
                <Text style={styles.hwText}>{Math.round(Number(today.lastPayment.amount)).toLocaleString(uiLanguage() === 'en' ? 'en-US' : uiLanguage() === 'tg' ? 'tg-TJ' : 'ru-RU')} {" " + uiText("сомони")}</Text>
              </View>
            </View>
          </View>
        )}

        {chatOn && (
          <Pressable
            onPress={() => nav.navigate('ParentChat')}
            accessibilityRole="button"
            style={[styles.chatBtn, shadow.md]}
          >
            <MessageCircle size={20} color="#075B5D" />
            <Text style={styles.chatBtnText}>{uiText("Написать классному руководителю")}</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  container: { padding: 16, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { fontSize: 13, fontWeight: '600', color: colors.muted },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.9, lineHeight: 31, color: colors.text },
  kidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    maxWidth: 190,
    paddingLeft: 4,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  kidAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  kidAvatarText: { fontSize: 13, fontWeight: '800', color: '#0B3A3B' },
  kidChipText: { fontSize: 14, fontWeight: '800', color: colors.text, flexShrink: 1 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 24 },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { fontSize: 17, fontWeight: '800' },
  statusSub: { fontSize: 13, fontWeight: '600' },
  card: {
    padding: 16,
    borderRadius: 24,
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, color: colors.text },
  cardLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  muted: { fontSize: 14, color: colors.textMid },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lessonNo: { width: 18, fontSize: 13, fontWeight: '800', color: '#7A8C8E' },
  lessonName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  lessonHint: { fontSize: 13, fontWeight: '700', color: colors.muted },
  gradeBox: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gradeText: { fontSize: 15, fontWeight: '800' },
  nowBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FF8A65' },
  nowBadgeText: { fontSize: 12, fontWeight: '700', color: '#10282A' },
  hwRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hwEyebrow: { fontSize: 12, fontWeight: '700', color: '#B23E1A' },
  hwText: { fontSize: 14, fontWeight: '700', color: colors.text },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  chatBtnText: { fontSize: 15, fontWeight: '800', color: '#075B5D' },
}))
