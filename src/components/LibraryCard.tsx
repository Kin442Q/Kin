import { useState, type ReactNode } from 'react'
import { App as AntdApp, Button, Tag } from 'antd'

import { SP, SproutCard } from './sprout'
import { libraryApi, libraryTypeInfo, type LibraryItem } from '../api/learningApi'
import { formatSize, openFileLink } from '../api/filesApi'

/** Карточка материала: тип, предмет, описание и кнопка «Открыть» (в новой вкладке). */
export default function LibraryCard({ item, actions }: { item: LibraryItem; actions?: ReactNode }) {
  const { message } = AntdApp.useApp()
  const [opening, setOpening] = useState(false)
  const t = libraryTypeInfo(item.type)

  // Файл открывается по короткой ссылке, которую выдаёт сервер после проверки прав.
  const openFile = async () => {
    setOpening(true)
    try {
      await openFileLink(() => libraryApi.fileLink(item.id))
    } catch (e) {
      message.error((e as any)?.response?.data?.message || 'Не удалось открыть файл')
    } finally {
      setOpening(false)
    }
  }

  return (
    <SproutCard padding={16}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ fontSize: 34, lineHeight: 1 }} aria-hidden>
          {t.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <Tag style={{ margin: 0 }}>{t.label}</Tag>
            {item.subject && (
              <Tag style={{ margin: 0, background: item.subject.color, color: '#fff', border: 'none' }}>
                {item.subject.name}
              </Tag>
            )}
            {item.gradeNumber && <Tag style={{ margin: 0 }}>{item.gradeNumber} класс</Tag>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: SP.text }}>{item.title}</div>
          {item.description && (
            <div
              style={{
                fontSize: 13,
                color: SP.textMid,
                marginTop: 4,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.description}
            </div>
          )}
          {item.author && <div style={{ fontSize: 11, color: SP.muted, marginTop: 6 }}>Добавил(а): {item.author.fullName}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
            {item.file ? (
              <Button type="primary" size="small" loading={opening} onClick={openFile}>
                Открыть
              </Button>
            ) : (
              <Button type="primary" size="small" href={item.url ?? undefined} target="_blank" rel="noopener noreferrer">
                Открыть
              </Button>
            )}
            {item.file && (
              <span style={{ fontSize: 11, color: SP.muted }}>
                {item.file.name} · {formatSize(item.file.size)}
              </span>
            )}
            {actions}
          </div>
        </div>
      </div>
    </SproutCard>
  )
}
