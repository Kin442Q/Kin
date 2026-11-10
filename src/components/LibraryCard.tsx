import { uiText } from '../i18n/uiText'
import type { ReactNode } from 'react'
import { Button, Tag } from 'antd'

import { SP, SproutCard } from './sprout'
import { libraryTypeInfo, type LibraryItem } from '../api/learningApi'

/** Карточка материала: тип, предмет, описание и кнопка «Открыть» (в новой вкладке). */
export default function LibraryCard({ item, actions }: { item: LibraryItem; actions?: ReactNode }) {
  const t = libraryTypeInfo(item.type)
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
            {item.gradeNumber && <Tag style={{ margin: 0 }}>{item.gradeNumber} {" " + uiText("класс")}</Tag>}
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
          {item.author && <div style={{ fontSize: 11, color: SP.muted, marginTop: 6 }}>{uiText("Добавил(а):") + " "}{item.author.fullName}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
            <Button type="primary" size="small" href={item.url} target="_blank" rel="noopener noreferrer">
              {" " + uiText("Открыть") + " "}</Button>
            {actions}
          </div>
        </div>
      </div>
    </SproutCard>
  )
}
