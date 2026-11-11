import { useCallback, useEffect, useState } from 'react'
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
import { useFocusEffect } from '@react-navigation/native'
import * as DocumentPicker from 'expo-document-picker'
import { FileText, Paperclip, Plus, Trash2, X } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import BottomModal from '../components/BottomModal'
import StackHeader from '../components/StackHeader'
import EmptyState from '../components/EmptyState'
import { Field, Select } from '../components/Field'
import { colors, radius, shadow } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { adminApi } from '../api/admin'
import { schoolApi, type SubjectDto } from '../api/school'
import {
  LIMITS_HINT,
  checkFile,
  formatSize,
  openExternalUrl,
  openFileLink,
  uploadErrorText,
  type StoredFileView,
} from '../api/files'
import {
  LESSON_MATERIAL_TTL_DAYS,
  buildMaterialInput,
  expiryText,
  lessonMaterialApi,
  type LessonMaterial,
} from '../api/lessonMaterials'

interface ClassRef {
  id: string
  name: string
}

/**
 * Материалы к уроку для учителя: выложить классу файл, ссылку или текст.
 * Материал живёт 30 дней и удаляется сам вместе с файлом.
 */
export default function TeacherMaterialsScreen() {
  const user = useAuthStore((s) => s.user)

  const [items, setItems] = useState<LessonMaterial[]>([])
  const [classes, setClasses] = useState<ClassRef[]>([])
  const [subjects, setSubjects] = useState<SubjectDto[]>([])
  const [filterGroup, setFilterGroup] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [modal, setModal] = useState(false)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<StoredFileView | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await lessonMaterialApi.list({ groupId: filterGroup ?? undefined }))
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось загрузить материалы')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filterGroup])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  // Классы и предметы нужны для формы; список классов сервер отдаёт учителю только его.
  useEffect(() => {
    adminApi
      .groups()
      .then((gs) => {
        const list = gs.map((g) => ({ id: g.id, name: g.name }))
        setClasses(list)
        if (list.length === 1) setGroupId(list[0].id)
      })
      .catch(() => setClasses([]))
    schoolApi.listSubjects().then(setSubjects).catch(() => setSubjects([]))
  }, [])

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setUrl('')
    setFile(null)
    setPercent(null)
    setSubjectId(null)
    setGroupId(classes.length === 1 ? classes[0].id : filterGroup)
  }

  const openCreate = () => {
    resetForm()
    setModal(true)
  }

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false })
    if (res.canceled || !res.assets?.length) return
    const a = res.assets[0]
    const problem = checkFile({ name: a.name, size: a.size })
    if (problem) {
      Alert.alert('Файл не подходит', problem)
      return
    }
    setPercent(0)
    try {
      setFile(await lessonMaterialApi.upload({ uri: a.uri, name: a.name, size: a.size, mimeType: a.mimeType }, setPercent))
    } catch (e) {
      Alert.alert('Не удалось загрузить файл', uploadErrorText(e))
    } finally {
      setPercent(null)
    }
  }

  const submit = async () => {
    if (!groupId) {
      Alert.alert('Выберите класс', 'Материал выкладывается для одного класса')
      return
    }
    if (!title.trim()) {
      Alert.alert('Название', 'Введите название материала')
      return
    }
    if (url.trim() && !/^https?:\/\/\S+$/i.test(url.trim())) {
      Alert.alert('Ссылка', 'Ссылка должна начинаться с http:// или https://')
      return
    }
    const built = buildMaterialInput({ groupId, subjectId, title, description, url, file })
    if ('error' in built) {
      Alert.alert('Пустой материал', built.error)
      return
    }
    setSaving(true)
    try {
      await lessonMaterialApi.create(built.body)
      setModal(false)
      load()
      Alert.alert('Материал выложен', `Он сам удалится через ${LESSON_MATERIAL_TTL_DAYS} дней`)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const remove = (m: LessonMaterial) => {
    Alert.alert('Удалить материал?', m.file ? `${m.title}\nФайл тоже удалится.` : m.title, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await lessonMaterialApi.remove(m.id)
            load()
          } catch (e: any) {
            Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось удалить')
          }
        },
      },
    ])
  }

  const uploading = percent !== null

  return (
    <Screen>
      <StackHeader title="Материалы к уроку" />

      {classes.length > 1 && (
        <View style={styles.chips}>
          {[{ id: null as string | null, name: 'Все классы' }, ...classes].map((c) => {
            const on = c.id === filterGroup
            return (
              <Pressable
                key={c.id ?? 'all'}
                onPress={() => {
                  setLoading(true)
                  setFilterGroup(c.id)
                }}
                style={[styles.chip, { backgroundColor: on ? colors.primary : colors.surfaceAlt }]}
              >
                <Text style={[styles.chipText, { color: on ? '#fff' : colors.text }]}>{c.name}</Text>
              </Pressable>
            )
          })}
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                load()
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<FileText size={34} color={colors.muted} />}
              title="Материалов пока нет"
              hint="Нажмите «+», чтобы выложить файл, ссылку или текст для класса"
            />
          }
          renderItem={({ item: m }) => (
            <Card padding={14} style={{ gap: 6 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{m.title}</Text>
                  <Text style={styles.meta}>
                    {m.group.name}
                    {m.subject ? ` · ${m.subject.name}` : ''}
                  </Text>
                </View>
                {m.author?.id === user?.id && (
                  <Pressable onPress={() => remove(m)} hitSlop={10} accessibilityLabel="Удалить материал">
                    <Trash2 size={18} color={colors.muted} />
                  </Pressable>
                )}
              </View>
              {m.description ? (
                <Text style={styles.desc} numberOfLines={3}>
                  {m.description}
                </Text>
              ) : null}
              <View style={styles.actions}>
                {m.file && (
                  <Btn size="sm" onPress={() => openFileLink(() => lessonMaterialApi.fileLink(m.id))}>
                    {`${m.file.name} · ${formatSize(m.file.size)}`}
                  </Btn>
                )}
                {m.url && (
                  <Btn size="sm" variant="secondary" onPress={() => openExternalUrl(m.url!)}>
                    Ссылка
                  </Btn>
                )}
              </View>
              <Text
                style={[
                  styles.badge,
                  m.daysLeft <= 3
                    ? { backgroundColor: colors.yellowSoft, color: colors.yellowDeep }
                    : { backgroundColor: colors.surfaceAlt, color: colors.muted },
                ]}
              >
                {expiryText(m.daysLeft)}
              </Text>
            </Card>
          )}
        />
      )}

      <Pressable onPress={openCreate} style={({ pressed }) => [styles.fab, shadow.lg, pressed && { opacity: 0.85 }]}>
        <Plus size={24} color="#fff" strokeWidth={2.5} />
      </Pressable>

      <BottomModal visible={modal} onClose={() => setModal(false)} title="Новый материал">
        <Text style={styles.note}>
          Материал увидят ученики и родители класса. Через {LESSON_MATERIAL_TTL_DAYS} дней он удалится сам вместе с
          файлом.
        </Text>

        {classes.length > 0 && (
          <Select<string>
            label="Класс"
            value={groupId}
            onChange={setGroupId}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
            columns={3}
          />
        )}
        {subjects.length > 0 && (
          <Select<string>
            label="Предмет (необязательно)"
            value={subjectId}
            onChange={setSubjectId}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            columns={2}
          />
        )}

        <Field label="Название" value={title} onChangeText={setTitle} placeholder="Тема 5 — дроби" maxLength={200} />
        <Field
          label="Текст (необязательно)"
          value={description}
          onChangeText={setDescription}
          placeholder="Что прочитать, что повторить к уроку"
          multiline
          maxLength={5000}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
        <Field
          label="Ссылка (необязательно)"
          value={url}
          onChangeText={setUrl}
          placeholder="https://…"
          autoCapitalize="none"
          keyboardType="url"
        />

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Файл (необязательно)</Text>
          {file && !uploading && (
            <View style={styles.fileChip}>
              <Paperclip size={16} color={colors.primaryDeep} />
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={styles.fileSize}>{formatSize(file.size)}</Text>
              <Pressable onPress={() => setFile(null)} hitSlop={10} accessibilityLabel="Убрать файл">
                <X size={16} color={colors.muted} />
              </Pressable>
            </View>
          )}
          {uploading && (
            <View>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${percent ?? 0}%` }]} />
              </View>
              <Text style={styles.fileSize}>Загружается… {percent}%</Text>
            </View>
          )}
          <Btn variant="secondary" disabled={uploading} onPress={pickFile}>
            {file ? 'Выбрать другой файл' : 'Выбрать файл'}
          </Btn>
          <Text style={styles.hint}>{LIMITS_HINT}</Text>
        </View>

        <Btn block size="lg" loading={saving} disabled={uploading} onPress={submit} style={{ marginTop: 14 }}>
          Выложить
        </Btn>
      </BottomModal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  chipText: { fontSize: 13, fontWeight: '700' },
  list: { padding: 16, paddingBottom: 120, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  desc: { fontSize: 13, color: colors.textMid, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: 4,
  },
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
  note: { fontSize: 12.5, color: colors.textMid, lineHeight: 18, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  hint: { fontSize: 11.5, color: colors.muted, lineHeight: 16 },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryGhost,
  },
  fileName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  fileSize: { fontSize: 11.5, color: colors.muted },
  bar: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginBottom: 4 },
  barFill: { height: 6, backgroundColor: colors.primary },
})
