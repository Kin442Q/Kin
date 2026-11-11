import { useEffect, useMemo, useState } from 'react'
import { App as AntdApp, Button, Spin, Tag } from 'antd'
import { FileOutlined, LinkOutlined } from '@ant-design/icons'
import { FileText } from 'lucide-react'

import { SP, SproutCard, SproutEmpty, SproutPageHeader } from '../../components/sprout'
import { formatSize, openFileLink } from '../../api/filesApi'
import { expiryText, lessonMaterialApi, type LessonMaterial } from '../../api/lessonMaterialApi'

const NO_SUBJECT = 'Без предмета'

/** Материалы к урокам от учителей моего класса: файлы, ссылки и тексты. */
export default function StudentMaterialsPage() {
  const { message } = AntdApp.useApp()
  const [items, setItems] = useState<LessonMaterial[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    lessonMaterialApi
      .list()
      .then(setItems)
      .catch((e) => message.error(e?.response?.data?.message || 'Не удалось загрузить материалы'))
      .finally(() => setLoading(false))
  }, [message])

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

  const openFile = (m: LessonMaterial) =>
    openFileLink(() => lessonMaterialApi.fileLink(m.id)).catch((e) =>
      message.error(e?.response?.data?.message || 'Не удалось открыть файл'),
    )

  return (
    <div>
      <SproutPageHeader
        title="Материалы к урокам"
        icon={<FileText size={22} strokeWidth={2} />}
        iconAccent="yellow"
        description="Файлы, ссылки и тексты, которые выложили учителя вашего класса"
      />

      <Spin spinning={loading}>
        {items.length === 0 ? (
          <SproutCard>
            <SproutEmpty
              icon={<FileText size={32} strokeWidth={1.8} />}
              title="Материалов пока нет"
              description="Когда учитель выложит материал к уроку, он появится здесь"
              minHeight={200}
            />
          </SproutCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {groups.map(([subject, g]) => (
              <section key={subject} aria-label={subject}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 4px 8px', fontWeight: 800, color: SP.text }}>
                  <span style={{ width: 10, height: 10, borderRadius: 5, background: g.color ?? SP.muted }} />
                  {subject}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                  {g.items.map((m) => (
                    <SproutCard key={m.id} padding={16}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: SP.text }}>{m.title}</div>
                      {m.description && (
                        <div style={{ fontSize: 13, color: SP.textMid, marginTop: 4, whiteSpace: 'pre-wrap' }}>{m.description}</div>
                      )}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                        {m.file && (
                          <Button type="primary" size="small" icon={<FileOutlined />} onClick={() => openFile(m)}>
                            Открыть файл · {formatSize(m.file.size)}
                          </Button>
                        )}
                        {m.url && (
                          <Button size="small" icon={<LinkOutlined />} href={m.url} target="_blank" rel="noopener noreferrer">
                            Ссылка
                          </Button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, fontSize: 11, color: SP.muted }}>
                        {m.author && <span>{m.author.fullName}</span>}
                        <Tag style={{ margin: 0 }} color={m.daysLeft <= 3 ? 'orange' : 'default'}>
                          {expiryText(m.daysLeft)}
                        </Tag>
                      </div>
                    </SproutCard>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Spin>
    </div>
  )
}
