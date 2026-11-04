import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { ExternalLink, Library } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import StackHeader from '../components/StackHeader'
import EmptyState from '../components/EmptyState'
import { colors, radius } from '../theme/colors'
import {
  LIBRARY_TYPES,
  libraryApi,
  libraryTypeInfo,
  type LibraryItem,
  type LibraryType,
} from '../api/learning'

/** Открываем только http(s): ссылку вводит учитель, но схему всё равно проверяем. */
async function openLink(url: string) {
  if (!/^https?:\/\//i.test(url)) {
    Alert.alert('Ссылка не открывается', 'Адрес должен начинаться с http:// или https://')
    return
  }
  try {
    await Linking.openURL(url)
  } catch {
    Alert.alert('Не удалось открыть', url)
  }
}

/** Библиотека школы: поиск и фильтр по типу, ссылка открывается в браузере. */
export default function StudentLibraryScreen() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [type, setType] = useState<LibraryType | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(
        await libraryApi.list({
          type: type ?? undefined,
          q: query.trim() || undefined,
        }),
      )
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось загрузить библиотеку')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [type, query])

  // Поиск с небольшой задержкой, чтобы не слать запрос на каждую букву.
  useEffect(() => {
    const t = setTimeout(load, query ? 350 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  return (
    <Screen>
      <StackHeader title="Библиотека" />

      <View style={styles.tools}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по названию"
          placeholderTextColor={colors.muted}
          style={styles.search}
          returnKeyType="search"
        />
        <View style={styles.chips}>
          {[{ value: null, label: 'Все', emoji: '' }, ...LIBRARY_TYPES].map((t) => {
            const on = t.value === type
            return (
              <Pressable
                key={t.value ?? 'all'}
                onPress={() => setType(t.value)}
                style={[styles.chip, { backgroundColor: on ? colors.primary : colors.surfaceAlt }]}
              >
                <Text style={[styles.chipText, { color: on ? '#fff' : colors.text }]}>
                  {t.emoji ? `${t.emoji} ` : ''}
                  {t.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
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
              icon={<Library size={34} color={colors.muted} />}
              title="Ничего не найдено"
              hint="Учителя пока ничего не добавили или фильтр слишком узкий"
            />
          }
          renderItem={({ item }) => {
            const info = libraryTypeInfo(item.type)
            return (
              <Pressable onPress={() => openLink(item.url)}>
                <Card padding={14} style={styles.row}>
                  <Text style={styles.emoji}>{info.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {item.description ? (
                      <Text style={styles.desc} numberOfLines={3}>
                        {item.description}
                      </Text>
                    ) : null}
                    <Text style={styles.meta}>
                      {info.label}
                      {item.subject ? ` · ${item.subject.name}` : ''}
                      {item.gradeNumber ? ` · ${item.gradeNumber} класс` : ''}
                    </Text>
                  </View>
                  <ExternalLink size={18} color={colors.muted} />
                </Card>
              </Pressable>
            )
          }}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tools: { paddingHorizontal: 16, gap: 10 },
  search: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  chipText: { fontSize: 12.5, fontWeight: '700' },
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 28 },
  itemTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  desc: { fontSize: 13, color: colors.textMid, marginTop: 3, lineHeight: 18 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4 },
})
