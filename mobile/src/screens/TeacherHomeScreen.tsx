import { uiText } from '../i18n/uiText'
import { useEffect, useState, useCallback } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { Bell, CalendarCheck, Check, ClipboardList, Clock, MapPin, NotebookPen, Users } from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'

import { Text } from '../components/Text'
import Screen from '../components/Screen'
import BottomModal from '../components/BottomModal'
import GradientView from '../components/GradientView'
import IconTile from '../components/IconTile'
import { subjectIcon } from '../lib/subjectIcon'
import { colors, shadow } from '../theme/colors'
import { hasFeature } from '../lib/features'
import { useAuthStore } from '../store/authStore'
import { scheduleApi, type ScheduleLesson } from '../api/schedule'
import { notificationsApi, type NoticeDto } from '../api/notifications'
import { adminApi, type GroupDto } from '../api/admin'
import { attendanceApi } from '../api/attendance'
import { schoolApi, type HomeworkDto } from '../api/school'

import { themedStyles } from '../theme/themedStyles'
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

const greeting = () => {
  const h = new Date().getHours()
  if (h < 6) return uiText("Доброй ночи")
  if (h < 12) return uiText("Доброе утро")
  if (h < 18) return uiText("Добрый день")
  return uiText("Добрый вечер")
}

const lessonsWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? uiText("урок") : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? uiText("урока") : uiText("уроков"))

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
  // Ближайшее ДЗ моего класса: сколько учеников его уже сдали
  const [classHomework, setClassHomework] = useState<HomeworkDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(new Date())
  const [noticesOpen, setNoticesOpen] = useState(false)

  const homeroomId = user?.homeroomGroups?.[0]?.id ?? user?.groupId ?? null

  const reload = useCallback(async () => {
    const day = dayjs().format('YYYY-MM-DD')
    const [sch, grp, nt, att, hw] = await Promise.all([
      hasFeature(user, 'schedule') ? scheduleApi.list().catch(() => [] as ScheduleLesson[]) : Promise.resolve([] as ScheduleLesson[]),
      adminApi.groups().catch(() => [] as GroupDto[]),
      notificationsApi.list().catch(() => [] as NoticeDto[]),
      homeroomId && hasFeature(user, 'attendance')
        ? attendanceApi.listByDay(day, homeroomId).catch(() => null)
        : Promise.resolve(null),
      homeroomId && hasFeature(user, 'homework')
        ? schoolApi.listHomework({ groupId: homeroomId, from: day }).catch(() => [] as HomeworkDto[])
        : Promise.resolve([] as HomeworkDto[]),
    ])
    setLessons(sch)
    setGroups(grp)
    setNotices(Array.isArray(nt) ? nt.slice(0, 5) : [])
    setClassPresent(att && att.length ? { here: att.filter((a) => a.status === 'PRESENT').length, total: att.length } : null)
    // сервер отдаёт ДЗ по возрастанию срока: первое с данными о классе — ближайшее
    setClassHomework(hw.find((h) => h.stats && h.stats.total > 0) ?? null)
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
    !loading &&
    !focus &&
    todayLessons.length === 0 &&
    classesToday.length === 0 &&
    !classPresent &&
    !classHomework &&
    notices.length === 0

  const markRead = () => {
    notificationsApi
      .markAllRead()
      .then(() => setNotices((l) => l.map((n) => ({ ...n, read: true }))))
      .catch(() => {})
  }

  const unread = notices.some((n) => !n.read)
  const hwGroup = classHomework ? (classHomework.group?.name ?? groupName(classHomework.groupId)) : ''

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
        <View style={styles.headRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.eyebrow}>{dayjs().format('dddd, D MMMM')}</Text>
            <Text style={styles.title}>
              {greeting()},{'\n'}
              {first}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setNoticesOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={unread ? uiText("Оповещения: есть непрочитанные") : uiText("Оповещения")}
              style={styles.bell}
            >
              <Bell size={22} color={colors.text} />
              {unread && <View style={styles.bellDot} />}
            </Pressable>
            <GradientView from="#0D7A7C" to="#2FB3AC" style={[styles.avatar, shadow.sm]}>
              <Text style={styles.avatarText} accessibilityLabel={uiText("Профиль")}>
                {initials}
              </Text>
            </GradientView>
          </View>
        </View>

        {focus && (
          <GradientView from="#12898A" via="#0D7A7C" viaAt={0.45} to="#075B5D" style={[styles.nowCard, shadow.lg]}>
            <View style={styles.nowCircle} />
            <View style={styles.nowHead}>
              <IconTile icon={subjectIcon(focus.subject?.name ?? focus.activity)} bg="rgba(255,255,255,0.16)" fg="#FFFFFF" size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.nowEyebrow}>
                  {currentIdx >= 0 ? uiText("СЕЙЧАС · {0}-Й УРОК", currentIdx + 1) : uiText("ДАЛЬШЕ · {0}-Й УРОК", nextIdx + 1)}
                </Text>
                <Text style={styles.nowTitle} numberOfLines={2}>
                  {focus.subject?.name ?? focus.activity}
                  {groupName(focus.groupId) ? ` · ${groupName(focus.groupId)}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.nowMeta}>
              {focus.room ? (
                <View style={styles.nowMetaItem}>
                  <MapPin size={15} color="#DDF1F0" />
                  <Text style={styles.nowMetaText}>{uiText("Кабинет") + " "}{focus.room}</Text>
                </View>
              ) : null}
              <View style={styles.nowMetaItem}>
                <Clock size={15} color="#DDF1F0" />
                <Text style={styles.nowMetaText}>{currentIdx >= 0 ? uiText("до {0}", focus.endTime) : uiText("с {0}", focus.startTime)}</Text>
              </View>
            </View>
            <View style={styles.nowActions}>
              {hasFeature(user, 'attendance') && (
                <Pressable
                  onPress={() => navigation.navigate('TeacherAttendance')}
                  accessibilityRole="button"
                  style={[styles.nowBtn, { backgroundColor: '#FFFFFF' }]}
                >
                  <CalendarCheck size={18} color="#075B5D" />
                  <Text style={[styles.nowBtnText, { color: '#075B5D' }]}>{uiText("Отметить")}</Text>
                </Pressable>
              )}
              {hasFeature(user, 'grades') && (
                <Pressable
                  onPress={() => navigation.navigate('TeacherGrades')}
                  accessibilityRole="button"
                  style={[styles.nowBtn, { backgroundColor: 'rgba(255,255,255,0.16)' }]}
                >
                  <NotebookPen size={18} color="#FFFFFF" />
                  <Text style={[styles.nowBtnText, { color: '#FFFFFF' }]}>{uiText("Оценки")}</Text>
                </Pressable>
              )}
            </View>
          </GradientView>
        )}

        {hasFeature(user, 'schedule') && todayLessons.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{uiText("Уроки сегодня")}</Text>
              <Text style={styles.cardCount}>
                {todayLessons.length} {lessonsWord(todayLessons.length)}
              </Text>
            </View>
            {todayLessons.map((l, i) => {
              const done = nowMin >= minutes(l.endTime)
              const cur = i === currentIdx
              const name = (l.subject?.name ?? l.activity) + (groupName(l.groupId) ? ` · ${groupName(l.groupId)}` : '')
              return (
                <View key={l.id} style={[styles.lessonRow, cur && styles.lessonRowNow, done && { opacity: 0.5 }]}>
                  <Text style={[styles.lessonTime, cur && { color: colors.primary }]}>{l.startTime}</Text>
                  <IconTile icon={subjectIcon(l.subject?.name ?? l.activity)} bg="rgba(13,122,124,0.13)" fg={colors.primary} size={34} />
                  <Text style={[styles.lessonName, cur && { fontWeight: '800' }]} numberOfLines={1}>
                    {name}
                  </Text>
                  {cur ? (
                    <View style={styles.nowBadge}>
                      <Text style={styles.nowBadgeText}>{uiText("сейчас")}</Text>
                    </View>
                  ) : done ? (
                    <Check size={18} color={colors.primary} />
                  ) : l.room ? (
                    <Text style={styles.lessonHint}>{uiText("каб.") + " "}{l.room}</Text>
                  ) : null}
                </View>
              )
            })}
          </View>
        )}

        {(classPresent || classHomework) && (
          <View style={styles.tiles}>
            {classPresent && (
              <View style={[styles.tile, { flex: 1 }]}>
                <View style={styles.tileHead}>
                  <IconTile icon={Users} bg="rgba(13,122,124,0.13)" fg={colors.primary} size={32} />
                  <Text style={styles.tileLabel} numberOfLines={1}>
                    {" " + uiText("Мой класс")}{groupName(homeroomId ?? '') ? ' ' + groupName(homeroomId ?? '') : ''}
                  </Text>
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={styles.tileValue}>
                    {classPresent.here} / {classPresent.total}
                  </Text>
                  <Text style={[styles.tileHint, { color: colors.primary }]}>{uiText("в школе сегодня")}</Text>
                </View>
              </View>
            )}
            {classHomework?.stats && (
              <Pressable
                style={{ flex: 1 }}
                onPress={() => navigation.navigate('TeacherHomework')}
                accessibilityRole="button"
                accessibilityLabel={uiText("Домашние задания: {0} из {1} сдали", classHomework.stats.submitted, classHomework.stats.total)}
              >
                <View style={styles.tile}>
                  <View style={styles.tileHead}>
                    <IconTile icon={ClipboardList} bg="rgba(255,138,101,0.2)" fg={colors.roseDeep} size={32} />
                    <Text style={styles.tileLabel} numberOfLines={1}>
                      {" " + uiText("ДЗ ·") + " "}{hwGroup}
                    </Text>
                  </View>
                  <View style={{ gap: 2 }}>
                    <Text style={styles.tileValue}>
                      {classHomework.stats.submitted} / {classHomework.stats.total}
                    </Text>
                    <Text style={[styles.tileHint, { color: colors.roseDeep }]}>{uiText("сдали к сроку")}</Text>
                  </View>
                </View>
              </Pressable>
            )}
          </View>
        )}

        {isQuiet && (
          <View style={[styles.card, { alignItems: 'center', gap: 6 }]}>
            <Text style={styles.quietTitle}>{uiText("Сегодня спокойно")}</Text>
            <Text style={styles.muted}>{uiText("Ни уроков, ни новых оповещений. Всё важное появится здесь.")}</Text>
          </View>
        )}
      </ScrollView>

      <BottomModal visible={noticesOpen} onClose={() => setNoticesOpen(false)} title={uiText("Оповещения")}>
        {notices.length === 0 ? (
          <Text style={styles.muted}>{uiText("Новых оповещений нет")}</Text>
        ) : (
          <View style={{ gap: 12 }}>
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
            {unread && (
              <Pressable onPress={markRead} accessibilityRole="button">
                <Text style={styles.link}>{uiText("Прочитать все")}</Text>
              </Pressable>
            )}
          </View>
        )}
      </BottomModal>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  container: { padding: 16, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { fontSize: 13, fontWeight: '600', color: colors.muted },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, lineHeight: 29, color: colors.text },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: { position: 'absolute', right: 9, top: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF8A65' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  nowCard: { padding: 18, borderRadius: 26, gap: 14 },
  nowCircle: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  nowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nowEyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: '#BDEBE8' },
  nowTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, color: '#FFFFFF' },
  nowMeta: { flexDirection: 'row', gap: 14 },
  nowMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nowMetaText: { fontSize: 13, fontWeight: '600', color: '#DDF1F0' },
  nowActions: { flexDirection: 'row', gap: 8 },
  nowBtn: { flex: 1, height: 46, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  nowBtnText: { fontSize: 14, fontWeight: '800' },
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
  cardCount: { fontSize: 13, fontWeight: '700', color: colors.primary },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lessonRowNow: { marginHorizontal: -8, padding: 8, borderRadius: 16, backgroundColor: 'rgba(13,122,124,0.09)' },
  lessonTime: { width: 44, fontSize: 13, fontWeight: '800', color: colors.text },
  lessonName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  lessonHint: { fontSize: 12, fontWeight: '600', color: colors.muted },
  nowBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FF8A65' },
  nowBadgeText: { fontSize: 12, fontWeight: '700', color: '#10282A' },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 22,
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.muted },
  tileValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.7, color: colors.text },
  tileHint: { fontSize: 12, fontWeight: '700' },
  muted: { fontSize: 14, color: colors.textMid, textAlign: 'center' },
  quietTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  noticeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  noticeTitle: { fontSize: 14, color: colors.text },
  noticeText: { fontSize: 13, color: colors.textMid, lineHeight: 18 },
  noticeTime: { fontSize: 11, color: colors.muted, marginTop: 2 },
  link: { fontSize: 13, fontWeight: '700', color: colors.primaryDeep, paddingVertical: 4 },
}))
