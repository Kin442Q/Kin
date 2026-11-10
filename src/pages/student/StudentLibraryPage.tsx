import { uiText } from '../../i18n/uiText'
import { useEffect, useState } from 'react'
import { App as AntdApp, Input, Segmented, Spin } from 'antd'
import { Library } from 'lucide-react'

import { SproutCard, SproutEmpty, SproutPageHeader } from '../../components/sprout'
import LibraryCard from '../../components/LibraryCard'
import { LIBRARY_TYPES, libraryApi, type LibraryItem, type LibraryType } from '../../api/learningApi'

/** Библиотека школы: книги, статьи, видео и ссылки от учителей. */
export default function StudentLibraryPage() {
  const { message } = AntdApp.useApp()
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<LibraryType | 'ALL'>('ALL')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')

  // поиск отправляем с небольшой задержкой, чтобы не дёргать сервер на каждую букву
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    setLoading(true)
    libraryApi
      .list({ type: type === 'ALL' ? undefined : type, q: query || undefined })
      .then(setItems)
      .catch((e) => message.error(e?.response?.data?.message || uiText("Не удалось загрузить библиотеку")))
      .finally(() => setLoading(false))
  }, [type, query, message])

  return (
    <div>
      <SproutPageHeader
        title={uiText("Библиотека")}
        icon={<Library size={22} strokeWidth={2} />}
        iconAccent="blue"
        description={uiText("Книги, статьи, видео и полезные ссылки от ваших учителей")}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <Input.Search
          allowClear
          placeholder={uiText("Поиск по названию и описанию")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 340 }}
        />
        <Segmented
          value={type}
          onChange={(v) => setType(v as LibraryType | 'ALL')}
          options={[{ value: 'ALL', label: uiText("Все") }, ...LIBRARY_TYPES.map((t) => ({ value: t.value, label: `${t.emoji} ${t.label}` }))]}
        />
      </div>

      <Spin spinning={loading}>
        {items.length === 0 ? (
          <SproutCard>
            <SproutEmpty
              icon={<Library size={32} strokeWidth={1.8} />}
              title={query || type !== 'ALL' ? uiText("Ничего не найдено") : uiText("Библиотека пока пуста")}
              description={query || type !== 'ALL' ? uiText("Попробуйте другой запрос") : uiText("Учителя скоро добавят материалы")}
              minHeight={200}
            />
          </SproutCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {items.map((i) => (
              <LibraryCard key={i.id} item={i} />
            ))}
          </div>
        )}
      </Spin>
    </div>
  )
}
