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
import { ChevronLeft, Plus, Trash2, BookMarked } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Avatar from '../components/Avatar'
import Btn from '../components/Btn'
import BottomModal from '../components/BottomModal'
import { Field, Select } from '../components/Field'
import { colors, radius, shadow } from '../theme/colors'
import { studentsApi, type StudentDto } from '../api/students'
import {
  schoolApi,
  type GradeDto,
  type GradeType,
  type SubjectDto,
} from '../api/school'

export default function TeacherGradesScreen() {
  const navigation = useNavigation()
  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), [])

  const [students, setStudents] = useState<StudentDto[]>([])
  const [subjects, setSubjects] = useState<SubjectDto[]>([])
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null)
  const [grades, setGrades] = useState<GradeDto[]>([])
  const [date, setDate] = useState(today)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal: add grade
  const [editingStudent, setEditingStudent] = useState<StudentDto | null>(null)
  const [valueStr, setValueStr] = useState('')
  const [type, setType] = useState<GradeType>('CLASSWORK')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    try {
      const [list, subs] = await Promise.all([
        studentsApi.list({ status: 'ACTIVE' }),
        schoolApi.listSubjects(),
      ])
      setStudents(list)
      setSubjects(subs)
      if (subs.length && !activeSubjectId) setActiveSubjectId(subs[0].id)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeSubjectId])

  const reloadGrades = useCallback(async () => {
    if (!activeSubjectId) return
    try {
      const g = await schoolApi.listGrades({
        subjectId: activeSubjectId,
        from: date,
        to: date,
      })
      setGrades(g)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    }
  }, [activeSubjectId, date])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    reloadGrades()
  }, [reloadGrades])

  const gradesByStudent = useMemo(() => {
    const map: Record<string, GradeDto[]> = {}
    for (const g of grades) {
      if (!map[g.studentId]) map[g.studentId] = []
      map[g.studentId].push(g)
    }
    return map
  }, [grades])

  const submit = async () => {
    if (!editingStudent || !activeSubjectId) return
    const v = Number(valueStr)
    if (!v || v < 1 || v > 10) {
      Alert.alert('Оценка', 'Введите от 1 до 10')
      return
    }
    setSaving(true)
    try {
      await schoolApi.createGrade({
        studentId: editingStudent.id,
        subjectId: activeSubjectId,
        value: v,
        type,
        date,
        comment: comment.trim() || undefined,
      })
      setEditingStudent(null)
      setValueStr('')
      setComment('')
      reloadGrades()
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  const removeGrade = (g: GradeDto) => {
    Alert.alert('Удалить оценку?', `${g.value} балл(а)?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await schoolApi.deleteGrade(g.id)
            reloadGrades()
          } catch (e: any) {
            Alert.alert('Ошибка', e?.response?.data?.message || String(e))
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
        <Text style={styles.topTitle}>Журнал оценок</Text>
        <View style={{ width: 36 }} />
      </View>

      {subjects.length === 0 ? (
        <View style={styles.empty}>
          <BookMarked size={36} color={colors.muted} />
          <Text style={styles.emptyText}>
            Сначала администратор должен добавить предметы в веб-версии.
          </Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                Promise.all([reload(), reloadGrades()])
              }}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.section}>Предмет</Text>
              <View style={styles.chipRow}>
                {subjects.map((s) => {
                  const on = activeSubjectId === s.id
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setActiveSubjectId(s.id)}
                      style={[
                        styles.subjectChip,
                        {
                          backgroundColor: on ? s.color : colors.surface,
                          borderColor: on ? s.color : colors.borderSoft,
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
                        {s.name}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              <Text style={styles.section}>Дата</Text>
              <View style={styles.dayBar}>
                <Pressable
                  onPress={() =>
                    setDate(dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'))
                  }
                  hitSlop={10}
                  style={styles.dayBtn}
                >
                  <ChevronLeft size={20} color={colors.text} />
                </Pressable>
                <Text style={styles.dayLabel}>
                  {dayjs(date).format('dd, D MMMM')}
                </Text>
                <Pressable
                  onPress={() =>
                    setDate(dayjs(date).add(1, 'day').format('YYYY-MM-DD'))
                  }
                  hitSlop={10}
                  style={styles.dayBtn}
                >
                  <ChevronLeft
                    size={20}
                    color={colors.text}
                    style={{ transform: [{ rotate: '180deg' }] }}
                  />
                </Pressable>
              </View>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const fullName = `${item.firstName} ${item.lastName}`.trim()
            const stuGrades = gradesByStudent[item.id] ?? []
            return (
              <Card padding={12}>
                <View style={styles.row}>
                  <Avatar name={fullName} size={38} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.name}>{fullName}</Text>
                    <View style={styles.gradeStrip}>
                      {stuGrades.map((g) => (
                        <Pressable
                          key={g.id}
                          onLongPress={() => removeGrade(g)}
                        >
                          <View
                            style={[
                              styles.gradeBubble,
                              {
                                backgroundColor: gradeColor(g.value),
                              },
                            ]}
                          >
                            <Text style={styles.gradeBubbleText}>
                              {g.value}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                      {stuGrades.length === 0 && (
                        <Text style={styles.noGrade}>—</Text>
                      )}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => {
                      setEditingStudent(item)
                      setValueStr('')
                      setType('CLASSWORK')
                      setComment('')
                    }}
                    style={styles.addBtn}
                  >
                    <Plus size={18} color={colors.primaryDeep} />
                  </Pressable>
                </View>
              </Card>
            )
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>В вашем классе пока никого нет.</Text>
            </View>
          }
        />
      )}

      <BottomModal
        visible={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title={
          editingStudent
            ? `${editingStudent.firstName} ${editingStudent.lastName}`
            : 'Оценка'
        }
      >
        <Field
          label="Оценка"
          value={valueStr}
          onChangeText={setValueStr}
          keyboardType="numeric"
          placeholder="5"
        />

        <Select<GradeType>
          label="Тип"
          value={type}
          onChange={setType}
          options={[
            { value: 'CLASSWORK', label: 'Урок' },
            { value: 'HOMEWORK', label: 'Дом. задание' },
            { value: 'CONTROL', label: 'Контрольная' },
            { value: 'EXAM', label: 'Экзамен' },
            { value: 'PROJECT', label: 'Проект' },
            { value: 'OTHER', label: 'Другое' },
          ]}
          columns={3}
        />

        <Field
          label="Комментарий"
          value={comment}
          onChangeText={setComment}
          placeholder="За что (необязательно)"
          multiline
        />

        <Btn block size="lg" loading={saving} onPress={submit}>
          Поставить оценку
        </Btn>
        <Text style={styles.hint}>
          Долгий тап на оценку в списке — удалить
        </Text>
      </BottomModal>
    </Screen>
  )
}

function gradeColor(v: number): string {
  if (v >= 9) return colors.primaryDeep
  if (v >= 7) return colors.primary
  if (v >= 5) return colors.yellowDeep
  if (v >= 4) return colors.yellowDeep
  return colors.roseDeep
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
  list: { padding: 16, paddingBottom: 40 },
  section: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 2,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  subjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...shadow.sm,
  },
  dayBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  dayLabel: { fontSize: 14, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  gradeStrip: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  gradeBubble: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeBubbleText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  noGrade: { fontSize: 12, color: colors.muted },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  hint: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 4 },
})
