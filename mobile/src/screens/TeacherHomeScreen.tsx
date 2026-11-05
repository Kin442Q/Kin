import { useEffect, useState, useCallback } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'

import { Text } from '../components/Text'
import Screen from '../components/Screen'
import Card from '../components/Card'
import { CardTitle, ScreenHeading, Tile } from '../components/ui'
import { colors, shadow } from '../theme/colors'
import { hasFeature } from '../lib/features'
import { useAuthStore } from '../store/authStore'
import { scheduleApi, type ScheduleLesson } from '../api/schedule'
import { notificationsApi, type NoticeDto } from '../api/notifications'
import { adminApi, type GroupDto } from '../api/admin'
import { attendanceApi } from '../api/attendance'

import { themedStyles } from '../theme/themedStyles'
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

const greeting = () => {
  const h = new Date().getHours()
  if (h < 6) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

const lessonsWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'урок' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'урока' : 'уроков')

/**
 * Кабинет учителя — информационная главная: текущий урок, уроки и классы на сегодня,
 * оповещения, мой класс. Учёта рабочего времени здесь нет.
 */
export default function TeacherHomeScreen() {
  const user = useAuthStore((s) => s.user)
  const navigation = useNavigation<any>()

  const [lessons, setLessons] = useState<ScheduleLesson[]>([])
  const [groups, setGroups] = useState<GroupDto[]>([])
  const [notices, setNotices] = useState<NoticeDto[]>([])
  const [classPresent, setClassPresent] = useState<{ here: number; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(new Date())

  const homeroomId = user?.homeroomGroups?.[0]?.id ?? user?.groupId ?? null

  const reload = useCallback(async () => {
    const day = dayjs().format('YYYY-MM-DD')
    const [sch, grp, nt, att] = await Promise.all([
      hasFeature(user, 'schedule') ? scheduleApi.list().catch(() => [] as ScheduleLesson[]) : Promise.resolve([] as ScheduleLesson[]),
      adminApi.groups().catch(() => [] as GroupDto[]),
      notificationsApi.list().catch(() => [] as NoticeDto[]),
      homeroomId && hasFeature(user, 'attendance')
        ? attendanceApi.listByDay(day, homeroomId).catch(() => null)
        : Promise.resolve(null),
    ])
    setLessons(sch)
    setGroups(grp)
    setNotices(Array.isArray(nt) ? nt.slice(0, 5) : [])
    setClassPresent(att && att.length ? { here: att.filter((a) => a.status === 'PRESENT').length, total: att.length } : null)
    setLoading(false)
    setRefreshing(false)
  }, [user, homeroomId])

  useEffect(() => {
    reload()
  }, [reload])

  // «Сейчас» для подсветки текущего урока
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  // Уроки на сегодня: если в расписании уроки закреплены за учителями — только мои, иначе все уроки моих классов.
  const todayDow = dayjs().day() === 0 ? 7 : dayjs().day()
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? ''
  const assigned = lessons.some((l) => l.teacherId)
  const todayLessons = lessons
    .filter((l) => l.dayOfWeek === todayDow && (!assigned || l.teacherId === user?.id))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const currentIdx = todayLessons.findIndex((l) => nowMin >= minutes(l.startTime) && nowMin < minutes(l.endTime))
  const nextIdx = todayLessons.findIndex((l) => nowMin < minutes(l.startTime))
  const focusIdx = currentIdx >= 0 ? currentIdx : nextIdx
  const focus = focusIdx >= 0 ? todayLessons[focusIdx] : null

  // Классы сегодня и число уроков в каждом
  const classCounts = new Map<string, number>()
  for (const l of todayLessons) classCounts.set(l.groupId, (classCounts.get(l.groupId) ?? 0) + 1)
  const classesToday = [...classCounts.entries()]

  const parts = (user?.fullName ?? '').split(' ').filter(Boolean)
  const first = parts[1] ?? parts[0] ?? ''
  const initials = parts
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Пустые блоки не показываем: если нечего показать, остаётся одна спокойная плашка
  const isQuiet =
    !loading && !focus && todayLessons.length === 0 && classesToday.length === 0 && !classPresent && notices.length === 0

  const markRead = () => {
    notificationsApi
      .markAllRead()
      .then(() => setNotices((l) => l.map((n) => ({ ...n, read: true }))))
      .catch(() => {})
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
              reload()
            }}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeading
          eyebrow={dayjs().format('dddd, D MMMM')}
          title={`${greeting()}, ${first}`}
          size={24}
          right={
            <View style={styles.avatar} accessibilityLabel="Профиль">
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          }
        />

        {focus && (
          <View style={[styles.nowCard, shadow.lg]}>
            <Text style={styles.nowEyebrow}>
              {currentIdx >= 0 ? `Сейчас · ${currentIdx + 1}-й урок` : `Дальше · ${nextIdx + 1}-й урок`}
            </Text>
            <Text style={styles.nowTitle} numberOfLines={2}>
              {focus.subject?.name ?? focus.activity}
              {groupName(focus.groupId) ? ` · ${groupName(focus.groupId)}` : ''}
            </Text>
            <Text style={styles.nowSub}>
              {focus.room ? `Кабинет ${focus.room} · ` : ''}
              {currentIdx >= 0 ? `до ${focus.endTime}` : `с ${focus.startTime}`}
            </Text>
            <View style={styles.nowActions}>
              {hasFeature(user, 'attendance') && (
                <Pressable
                  onPress={() => navigation.navigate('TeacherAttendance')}
                  accessibilityRole="button"
                  style={[styles.nowBtn, { backgroundColor: '#FFFFFF' }]}
                >
                  <Text style={[styles.nowBtnText, { color: '#075B5D' }]}>Отметить</Text>
                </Pressable>
              )}
              {hasFeature(user, 'grades') && (
                <Pressable
                  onPress={() => navigation.navigate('TeacherGrades')}
                  accessibilityRole="button"
                  style={[styles.nowBtn, { backgroundColor: 'rgba(255,255,255,0.16)' }]}
                >
                  <Text style={[styles.nowBtnText, { color: '#FFFFFF' }]}>Оценки</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {hasFeature(user, 'schedule') && todayLessons.length > 0 && (
          <Card padding={16}>
            <CardTitle title="Уроки сегодня" right={`${todayLessons.length} ${lessonsWord(todayLessons.length)}`} />
            {(
              <View style={{ gap: 10 }}>
                {todayLessons.map((l, i) => {
                  const done = nowMin >= minutes(l.endTime)
                  const cur = i === currentIdx
                  return (
                    <View key={l.id} style={[styles.lessonRow, done && { opacity: 0.55 }]}>
                      <Text style={[styles.lessonTime, cur && { color: colors.primary }]}>{l.startTime}</Text>
                      <Text style={[styles.lessonName, cur && { fontWeight: '700' }]} numberOfLines={1}>
                        {l.subject?.name ?? l.activity}
                        {groupName(l.groupId) ? ` · ${groupName(l.groupId)}` : ''}
                      </Text>
                      {cur ? (
                        <View style={styles.nowBadge}>
                          <Text style={styles.nowBadgeText}>сейчас</Text>
                        </View>
                      ) : (
                        <Text style={styles.lessonHint}>{done ? 'прошёл' : l.room ? `каб. ${l.room}` : ''}</Text>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </Card>
        )}

        {classesToday.length > 0 && (
          <Card padding={16}>
            <CardTitle title="Классы сегодня" />
            <View style={styles.chips}>
              {classesToday.map(([id, n]) => (
                <View key={id} style={styles.classChip}>
                  <Text style={styles.classChipName}>{groupName(id) || '—'}</Text>
                  <Text style={styles.classChipSub}>
                    {n} {lessonsWord(n)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {classPresent && (
          <View style={styles.tiles}>
            <Tile
              label={`Мой класс${groupName(homeroomId ?? '') ? ' ' + groupName(homeroomId ?? '') : ''}`}
              value={`${classPresent.here} / ${classPresent.total}`}
              hint="в школе сегодня"
              style={{ flex: 1 }}
            />
          </View>
        )}

        {notices.length > 0 && (
        <Card padding={16}>
          <CardTitle title="Оповещения" />
          {(
            <View style={{ gap: 10 }}>
              {notices.map((n) => (
                <View key={n.id} style={styles.noticeRow}>
                  <View style={[styles.dot, { backgroundColor: n.read ? colors.borderSoft : colors.coral }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.noticeTitle, !n.read && { fontWeight: '700' }]}>{n.title}</Text>
                    {n.description ? <Text style={styles.noticeText}>{n.description}</Text> : null}
                    <Text style={styles.noticeTime}>{dayjs(n.createdAt).format('DD.MM HH:mm')}</Text>
                  </View>
                </View>
              ))}
              {notices.some((n) => !n.read) && (
                <Pressable onPress={markRead} accessibilityRole="button">
                  <Text style={styles.link}>Прочитать все</Text>
                </Pressable>
              )}
            </View>
          )}
        </Card>
        )}

        {isQuiet && (
          <Card padding={20} style={{ alignItems: 'center', gap: 6 }}>
            <Text style={styles.quietTitle}>Сегодня спокойно</Text>
            <Text style={styles.muted}>Ни уроков, ни новых оповещений. Всё важное появится здесь.</Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  container: { padding: 16, gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  nowCard: { padding: 18, borderRadius: 24, backgroundColor: colors.primary, gap: 6 },
  nowEyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#BDEBE8' },
  nowTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  nowSub: { fontSize: 14, color: '#DDF1F0' },
  nowActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  nowBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 14 },
  nowBtnText: { fontSize: 14, fontWeight: '700' },
  muted: { fontSize: 14, color: colors.textMid, textAlign: 'center' },
  quietTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lessonTime: { width: 52, fontSize: 13, fontWeight: '700', color: colors.text },
  lessonName: { flex: 1, fontSize: 14, color: colors.text },
  lessonHint: { fontSize: 12, color: colors.textMid },
  nowBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.coral },
  nowBadgeText: { fontSize: 11, fontWeight: '700', color: '#10282A' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  classChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    gap: 1,
  },
  classChipName: { fontSize: 15, fontWeight: '800', color: colors.primaryDeep },
  classChipSub: { fontSize: 11, color: colors.textMid },
  tiles: { flexDirection: 'row', gap: 10 },
  noticeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  noticeTitle: { fontSize: 14, color: colors.text },
  noticeText: { fontSize: 13, color: colors.textMid, lineHeight: 18 },
  noticeTime: { fontSize: 11, color: colors.muted, marginTop: 2 },
  link: { fontSize: 13, fontWeight: '700', color: colors.primaryDeep, paddingVertical: 4 },
}))
