import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import dayjs from 'dayjs'
import {
  Coffee,
  Soup,
  Cookie,
  Sparkles,
  StickyNote,
  ChevronLeft,
  ChevronRight,
  Save,
} from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import { Field } from '../components/Field'
import { colors, radius, shadow } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { useLabels } from '../theme/useLabels'
import { cap } from '../theme/labels'
import { diaryApi, type DiaryEntryDto } from '../api/diary'

export default function TeacherDiaryScreen() {
  const user = useAuthStore((s) => s.user)
  const L = useLabels()
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [entry, setEntry] = useState<DiaryEntryDto | null>(null)

  const [breakfast, setBreakfast] = useState('')
  const [lunch, setLunch] = useState('')
  const [snack, setSnack] = useState('')
  const [activities, setActivities] = useState('')
  const [note, setNote] = useState('')

  const groupId = user?.groupId
  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), [])

  const reload = useCallback(async () => {
    if (!groupId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const e = await diaryApi.groupDiary(groupId, date)
      setEntry(e)
      setBreakfast(e?.breakfast ?? '')
      setLunch(e?.lunch ?? '')
      setSnack(e?.snack ?? '')
      setActivities(e?.activities ?? '')
      setNote(e?.note ?? '')
    } catch (err: any) {
      Alert.alert('Ошибка', err?.response?.data?.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [groupId, date])

  useEffect(() => {
    reload()
  }, [reload])

  const save = async () => {
    if (!groupId) {
      Alert.alert('Нет группы', `У вашего профиля не назначена ${L.group}`)
      return
    }
    setSaving(true)
    try {
      await diaryApi.upsertGroupDiary({
        groupId,
        date,
        breakfast: breakfast.trim() || undefined,
        lunch: lunch.trim() || undefined,
        snack: snack.trim() || undefined,
        activities: activities.trim() || undefined,
        note: note.trim() || undefined,
      })
      Alert.alert('Сохранено', 'Родители увидят запись в своём приложении.')
      reload()
    } catch (err: any) {
      Alert.alert('Ошибка', err?.response?.data?.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  const isToday = date === today
  const dateLabel = dayjs(date).format('dddd, D MMMM')

  if (!groupId) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            У вашего профиля не назначена {L.group}. Обратитесь к
            администратору.
          </Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Дневник {L.group === 'класс' ? 'класса' : 'группы'}</Text>

        {/* Day picker */}
        <Card padding={10} style={styles.dayBar}>
          <Pressable
            onPress={() =>
              setDate(dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'))
            }
            hitSlop={10}
            style={styles.dayBtn}
          >
            <ChevronLeft size={20} color={colors.text} />
          </Pressable>
          <View style={styles.dayMiddle}>
            <Text style={styles.dayLabel}>{cap(dateLabel)}</Text>
            {isToday && <Text style={styles.dayHint}>сегодня</Text>}
            {!isToday && (
              <Pressable onPress={() => setDate(today)}>
                <Text style={styles.dayTodayLink}>Перейти к сегодня</Text>
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() =>
              setDate(dayjs(date).add(1, 'day').format('YYYY-MM-DD'))
            }
            hitSlop={10}
            style={styles.dayBtn}
          >
            <ChevronRight size={20} color={colors.text} />
          </Pressable>
        </Card>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <Text style={styles.section}>Меню дня</Text>

            <Card padding={16} style={shadow.sm}>
              <FieldRow
                icon={<Coffee size={16} color={colors.primaryDeep} />}
                bg={colors.primarySoft}
                label="Завтрак"
                value={breakfast}
                onChange={setBreakfast}
                placeholder="Каша манная, чай, бутерброд"
              />
              <Divider />
              <FieldRow
                icon={<Soup size={16} color={colors.yellowDeep} />}
                bg={colors.yellowSoft}
                label="Обед"
                value={lunch}
                onChange={setLunch}
                placeholder="Суп, котлета с пюре, компот"
              />
              <Divider />
              <FieldRow
                icon={<Cookie size={16} color={colors.roseDeep} />}
                bg={colors.roseSoft}
                label="Полдник"
                value={snack}
                onChange={setSnack}
                placeholder="Кефир и булочка"
              />
            </Card>

            <Text style={styles.section}>Активности</Text>
            <Card padding={16}>
              <View style={styles.actHead}>
                <View style={[styles.actIcon, { backgroundColor: colors.blueSoft }]}>
                  <Sparkles size={16} color={colors.blueDeep} />
                </View>
                <Text style={styles.actLabel}>Чем занимались</Text>
              </View>
              <Field
                label=""
                value={activities}
                onChangeText={setActivities}
                placeholder="Развитие речи, музыка, прогулка, лепка"
                multiline
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
            </Card>

            <Text style={styles.section}>Заметка</Text>
            <Card padding={16}>
              <View style={styles.actHead}>
                <View style={[styles.actIcon, { backgroundColor: colors.lilacSoft }]}>
                  <StickyNote size={16} color={colors.lilacDeep} />
                </View>
                <Text style={styles.actLabel}>Общее по {L.group === 'класс' ? 'классу' : 'группе'}</Text>
              </View>
              <Field
                label=""
                value={note}
                onChangeText={setNote}
                placeholder="Все были активны, отметили день рождения Айши"
                multiline
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
            </Card>

            <Btn
              block
              size="lg"
              loading={saving}
              icon={<Save size={18} color="#fff" />}
              onPress={save}
              style={{ marginTop: 8 }}
            >
              Сохранить
            </Btn>
            {entry?.author && (
              <Text style={styles.lastEditor}>
                Последнее изменение: {entry.author.fullName} ·{' '}
                {dayjs(entry.updatedAt).format('D MMM, HH:mm')}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

interface FieldRowProps {
  icon: React.ReactNode
  bg: string
  label: string
  value: string
  onChange: (s: string) => void
  placeholder: string
}
function FieldRow({ icon, bg, label, value, onChange, placeholder }: FieldRowProps) {
  return (
    <View>
      <View style={styles.actHead}>
        <View style={[styles.actIcon, { backgroundColor: bg }]}>{icon}</View>
        <Text style={styles.actLabel}>{label}</Text>
      </View>
      <Field
        label=""
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
      />
    </View>
  )
}

function Divider() {
  return <View style={styles.divider} />
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60, gap: 12 },
  loader: { padding: 40, alignItems: 'center' },
  empty: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  dayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  dayBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  dayMiddle: { flex: 1, alignItems: 'center' },
  dayLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  dayHint: {
    fontSize: 11,
    color: colors.primaryDeep,
    fontWeight: '700',
    marginTop: 2,
  },
  dayTodayLink: {
    fontSize: 11,
    color: colors.primaryDeep,
    fontWeight: '700',
    marginTop: 2,
  },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    marginLeft: 4,
  },
  actHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  actIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actLabel: { fontSize: 13, fontWeight: '700', color: colors.textMid },
  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: 10,
  },
  lastEditor: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
  },
})
