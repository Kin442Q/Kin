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
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import {
  ChevronLeft,
  Plus,
  MapPin,
  Users,
  Calendar,
} from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import BottomModal from '../components/BottomModal'
import { Field, Select } from '../components/Field'
import { colors, radius, shadow } from '../theme/colors'
import { useLabels } from '../theme/useLabels'
import { cap } from '../theme/labels'
import { adminApi, type MeetingDto, type GroupDto } from '../api/admin'

export default function AdminMeetingsScreen() {
  const navigation = useNavigation()
  const L = useLabels()
  const [items, setItems] = useState<MeetingDto[]>([])
  const [groups, setGroups] = useState<GroupDto[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState(false)

  // form
  const [groupId, setGroupId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [dateStr, setDateStr] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'))
  const [timeStr, setTimeStr] = useState('18:00')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    try {
      const [list, gs] = await Promise.all([
        adminApi.meetings(),
        adminApi.groups(),
      ])
      setItems(list)
      setGroups(gs)
      if (gs.length && !groupId) setGroupId(gs[0].id)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [groupId])

  useEffect(() => {
    reload()
  }, [reload])

  const groupsById = useMemo(() => {
    const m: Record<string, GroupDto> = {}
    for (const g of groups) m[g.id] = g
    return m
  }, [groups])

  const upcoming = items.filter(
    (m) => new Date(m.scheduledAt).getTime() >= Date.now() - 24 * 3600 * 1000,
  )
  const past = items.filter(
    (m) => new Date(m.scheduledAt).getTime() < Date.now() - 24 * 3600 * 1000,
  )

  const submit = async () => {
    if (!groupId || !title.trim()) {
      Alert.alert('Заполните', `Нужны ${L.group} и заголовок`)
      return
    }
    const scheduledAt = `${dateStr}T${timeStr}:00`
    if (!dayjs(scheduledAt).isValid()) {
      Alert.alert('Дата', 'Неверный формат даты или времени')
      return
    }
    setSaving(true)
    try {
      await adminApi.createMeeting({
        groupId,
        title: title.trim(),
        scheduledAt: dayjs(scheduledAt).toISOString(),
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      })
      setModal(false)
      setTitle('')
      setLocation('')
      setDescription('')
      reload()
      Alert.alert(
        'Создано',
        `Родителям ${L.group === 'класс' ? 'класса' : 'группы'} будет отправлено уведомление в Telegram.`,
      )
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

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
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Собрания</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={[...upcoming, ...past]}
        keyExtractor={(m) => m.id}
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
          <View style={styles.header}>
            <Text style={styles.headerLabel}>Ближайшие</Text>
            <Text style={styles.headerCount}>{upcoming.length}</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item, index }) => {
          const past = new Date(item.scheduledAt).getTime() < Date.now()
          const g = item.group ?? groupsById[item.groupId]
          const showDivider =
            index === upcoming.length && upcoming.length > 0 && past
          return (
            <View>
              {showDivider && (
                <Text style={styles.divider}>Прошедшие</Text>
              )}
              <Card padding={14} style={past ? { opacity: 0.6 } : undefined}>
                <View style={styles.cardTop}>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateDay}>
                      {dayjs(item.scheduledAt).format('DD')}
                    </Text>
                    <Text style={styles.dateMonth}>
                      {dayjs(item.scheduledAt).format('MMM')}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.title}>{item.title}</Text>
                    <View style={styles.metaRow}>
                      <Calendar size={12} color={colors.muted} />
                      <Text style={styles.metaText}>
                        {dayjs(item.scheduledAt).format('HH:mm · dd')}
                      </Text>
                    </View>
                    {g && (
                      <View style={styles.metaRow}>
                        <Users size={12} color={colors.muted} />
                        <Text style={styles.metaText}>{g.name}</Text>
                      </View>
                    )}
                    {item.location && (
                      <View style={styles.metaRow}>
                        <MapPin size={12} color={colors.muted} />
                        <Text style={styles.metaText}>{item.location}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {item.description && (
                  <Text style={styles.description}>{item.description}</Text>
                )}
              </Card>
            </View>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Собраний ещё нет. Нажмите «+» чтобы создать.
            </Text>
          </View>
        }
      />

      <Pressable
        onPress={() => setModal(true)}
        style={({ pressed }) => [
          styles.fab,
          shadow.lg,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Plus size={24} color="#fff" strokeWidth={2.5} />
      </Pressable>

      <BottomModal
        visible={modal}
        onClose={() => setModal(false)}
        title="Новое собрание"
      >
        {groups.length > 0 && (
          <Select<string>
            label={cap(L.group)}
            value={groupId ?? groups[0]?.id ?? ''}
            onChange={setGroupId}
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
            columns={2}
          />
        )}

        <Field
          label="Тема"
          value={title}
          onChangeText={setTitle}
          placeholder="Например: Итоги осени"
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Дата"
              value={dateStr}
              onChangeText={setDateStr}
              placeholder="YYYY-MM-DD"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Время"
              value={timeStr}
              onChangeText={setTimeStr}
              placeholder="HH:mm"
            />
          </View>
        </View>

        <Field
          label="Место"
          value={location}
          onChangeText={setLocation}
          placeholder="Например: группа 2 этаж"
        />

        <Field
          label="Описание"
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="(необязательно)"
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <Btn block size="lg" loading={saving} onPress={submit}>
          Создать и оповестить
        </Btn>
        <Text style={styles.hint}>
          Родителям {L.group === 'класс' ? 'класса' : 'группы'} отправится сообщение в Telegram (если настроен бот).
        </Text>
      </BottomModal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  topTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  list: { padding: 16, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginLeft: 4,
  },
  headerLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  headerCount: { fontSize: 13, color: colors.muted, fontWeight: '700' },
  divider: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTop: { flexDirection: 'row' },
  dateBox: {
    width: 54,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDeep,
    letterSpacing: -0.5,
  },
  dateMonth: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: -2,
  },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  metaText: { fontSize: 12, color: colors.muted },
  description: {
    fontSize: 13,
    color: colors.textMid,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    lineHeight: 18,
  },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
})
