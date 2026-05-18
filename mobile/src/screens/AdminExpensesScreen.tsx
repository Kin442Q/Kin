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
  Trash2,
  Briefcase,
  Receipt,
  HomeIcon,
  Zap,
  Utensils,
  Puzzle,
  PencilLine,
  Wifi,
  SprayCan,
  Hammer,
  BookOpen,
  CircleDashed,
} from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import BottomModal from '../components/BottomModal'
import { Field, Select } from '../components/Field'
import { colors, radius, shadow } from '../theme/colors'
import {
  adminApi,
  type ExpenseDto,
  type ExpenseCategory,
  type GroupDto,
} from '../api/admin'

const CATEGORIES: Array<{
  value: ExpenseCategory
  label: string
  icon: typeof Briefcase
  color: string
}> = [
  { value: 'SALARIES', label: 'Зарплаты', icon: Briefcase, color: colors.primaryDeep },
  { value: 'TAXES', label: 'Налоги', icon: Receipt, color: colors.roseDeep },
  { value: 'RENT', label: 'Аренда', icon: HomeIcon, color: colors.lilacDeep },
  { value: 'UTILITIES', label: 'Коммуналка', icon: Zap, color: colors.yellowDeep },
  { value: 'FOOD', label: 'Питание', icon: Utensils, color: colors.primary },
  { value: 'TOYS', label: 'Игрушки', icon: Puzzle, color: colors.blueDeep },
  { value: 'STATIONERY', label: 'Канцелярия', icon: PencilLine, color: colors.muted },
  { value: 'INTERNET', label: 'Интернет', icon: Wifi, color: colors.blueDeep },
  { value: 'CLEANING', label: 'Уборка', icon: SprayCan, color: colors.muted },
  { value: 'REPAIRS', label: 'Ремонт', icon: Hammer, color: colors.yellowDeep },
  { value: 'EDUCATION', label: 'Обучение', icon: BookOpen, color: colors.primary },
  { value: 'OTHER', label: 'Прочее', icon: CircleDashed, color: colors.muted },
]

const CAT_META = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c]),
) as Record<ExpenseCategory, (typeof CATEGORIES)[number]>

export default function AdminExpensesScreen() {
  const navigation = useNavigation()
  const month = useMemo(() => dayjs().format('YYYY-MM'), [])

  const [items, setItems] = useState<ExpenseDto[]>([])
  const [groups, setGroups] = useState<GroupDto[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState(false)

  // form
  const [category, setCategory] = useState<ExpenseCategory>('FOOD')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    try {
      const [list, gs] = await Promise.all([
        adminApi.expenses({ month }),
        adminApi.groups(),
      ])
      setItems(list)
      setGroups(gs)
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

  const total = items.reduce((s, e) => s + Number(e.amount), 0)
  const groupsById = useMemo(() => {
    const m: Record<string, GroupDto> = {}
    for (const g of groups) m[g.id] = g
    return m
  }, [groups])

  const submit = async () => {
    const n = Number(amount.replace(',', '.'))
    if (!description.trim() || !n || n <= 0) {
      Alert.alert('Заполните', 'Нужны описание и сумма > 0')
      return
    }
    setSaving(true)
    try {
      await adminApi.createExpense({
        category,
        description: description.trim(),
        amount: n,
        month,
        groupId,
      })
      setModal(false)
      setDescription('')
      setAmount('')
      setGroupId(null)
      reload()
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = (e: ExpenseDto) => {
    Alert.alert('Удалить расход?', e.description, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminApi.deleteExpense(e.id)
            reload()
          } catch (err: any) {
            Alert.alert('Ошибка', err?.response?.data?.message || String(err))
          }
        },
      },
    ])
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
        <Text style={styles.topTitle}>Расходы</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
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
          <Card padding={16} style={[styles.summary, shadow.sm]}>
            <Text style={styles.summaryLabel}>
              {dayjs(month + '-01').format('MMMM YYYY')}
            </Text>
            <Text style={styles.summaryValue}>
              {Math.round(total).toLocaleString('ru-RU')}
              <Text style={styles.summaryUnit}> с</Text>
            </Text>
            <Text style={styles.summarySub}>
              {items.length} записей
            </Text>
          </Card>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const meta = CAT_META[item.category]
          const Icon = meta?.icon ?? CircleDashed
          const g = item.groupId ? groupsById[item.groupId] : null
          return (
            <Card padding={12}>
              <View style={styles.row}>
                <View
                  style={[
                    styles.catIcon,
                    { backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  <Icon size={18} color={meta?.color ?? colors.muted} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.desc}>{item.description}</Text>
                  <Text style={styles.metaRow}>
                    {meta?.label ?? item.category}
                    {g ? ` · ${g.name}` : ' · общая'}
                  </Text>
                </View>
                <View style={styles.amountCol}>
                  <Text style={styles.amount}>
                    −{Math.round(Number(item.amount)).toLocaleString('ru-RU')} с
                  </Text>
                  <Pressable onPress={() => remove(item)} hitSlop={8}>
                    <Trash2 size={16} color={colors.muted} />
                  </Pressable>
                </View>
              </View>
            </Card>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              За {dayjs(month + '-01').format('MMMM').toLowerCase()} расходов
              ещё нет
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
        title="Новый расход"
      >
        <Select<ExpenseCategory>
          label="Категория"
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          columns={3}
        />

        <Field
          label="Описание"
          value={description}
          onChangeText={setDescription}
          placeholder="За что"
        />

        <Field
          label="Сумма (сом)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="0"
        />

        {groups.length > 0 && (
          <Select<string>
            label="Группа (необязательно)"
            value={groupId ?? ('' as string)}
            onChange={(v) => setGroupId(v === '' ? null : v)}
            options={[
              { value: '', label: 'Общий' },
              ...groups.map((g) => ({ value: g.id, label: g.name })),
            ]}
            columns={3}
          />
        )}

        <Btn block size="lg" loading={saving} onPress={submit}>
          Добавить расход
        </Btn>
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
  summary: { marginBottom: 14, backgroundColor: colors.roseSoft },
  summaryLabel: { fontSize: 12, color: colors.roseDeep, fontWeight: '700' },
  summaryValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.roseDeep,
    letterSpacing: -1,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  summaryUnit: { fontSize: 16, fontWeight: '600', opacity: 0.6 },
  summarySub: { fontSize: 12, color: colors.roseDeep, marginTop: 2, opacity: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  catIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desc: { fontSize: 14, fontWeight: '700', color: colors.text },
  metaRow: { fontSize: 11, color: colors.muted, marginTop: 2 },
  amountCol: { alignItems: 'flex-end', gap: 6 },
  amount: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.roseDeep,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
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
})
