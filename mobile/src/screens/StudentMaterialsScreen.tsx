import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { FileText } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import StackHeader from '../components/StackHeader'
import EmptyState from '../components/EmptyState'
import { colors, radius } from '../theme/colors'
import { formatSize, openExternalUrl, openFileLink } from '../api/files'
import { expiryText, lessonMaterialApi, type LessonMaterial } from '../api/lessonMaterials'

const NO_SUBJECT = 'Без предмета'

/** Материалы к урокам от учителей моего класса: файлы, ссылки и тексты. */
export default function StudentMaterialsScreen() {
  const [items, setItems] = useState<LessonMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await lessonMaterialApi.list())
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось загрузить материалы')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  // по предметам; внутри — свежие сверху (сервер уже отдаёт по дате)
  const groups = useMemo(() => {
    const map = new Map<string, { color?: string; items: LessonMaterial[] }>()
    for (const m of items) {
      const key = m.subject?.name ?? NO_SUBJECT
      if (!map.has(key)) map.set(key, { color: m.subject?.color, items: [] })
      map.get(key)!.items.push(m)
    }
    return [...map.entries()]
  }, [items])

  return (
    <Screen>
      <StackHeader title="Материалы к урокам" />
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
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
        >
          {groups.length === 0 ? (
            <EmptyState
              icon={<FileText size={34} color={colors.muted} />}
              title="Материалов пока нет"
              hint="Когда учитель выложит материал к уроку, он появится здесь"
            />
          ) : (
            groups.map(([subject, g]) => (
              <View key={subject} style={{ gap: 8 }}>
                <View style={styles.subjectRow}>
                  <View style={[styles.dot, { backgroundColor: g.color ?? colors.muted }]} />
                  <Text style={styles.subject}>{subject}</Text>
                </View>
                {g.items.map((m) => (
                  <Card key={m.id} padding={14} style={{ gap: 6 }}>
                    <Text style={styles.title}>{m.title}</Text>
                    {m.description ? <Text style={styles.desc}>{m.description}</Text> : null}
                    <View style={styles.actions}>
                      {m.file && (
                        <Btn
                          size="sm"
                          onPress={() => openFileLink(() => lessonMaterialApi.fileLink(m.id))}
                        >
                          {`Открыть файл · ${formatSize(m.file.size)}`}
                        </Btn>
                      )}
                      {m.url && (
                        <Btn size="sm" variant="secondary" onPress={() => openExternalUrl(m.url!)}>
                          Ссылка
                        </Btn>
                      )}
                    </View>
                    <View style={styles.meta}>
                      {m.author ? <Text style={styles.metaText}>{m.author.fullName}</Text> : null}
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
                    </View>
                  </Card>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 40, gap: 16, flexGrow: 1 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  subject: { fontSize: 15, fontWeight: '800', color: colors.text },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  desc: { fontSize: 13, color: colors.textMid, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
  metaText: { fontSize: 11.5, color: colors.muted },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
})
