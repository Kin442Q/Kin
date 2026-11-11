import { uiText } from '../../i18n/uiText'
import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { SP } from './tokens'

interface Props {
  /** Иконка (по умолчанию Inbox) */
  icon?: ReactNode
  title?: ReactNode
  description?: ReactNode
  /** Кнопка действия (например «Добавить ребёнка») */
  action?: ReactNode
  /** Высота контейнера (по умолчанию занимает доступное пространство) */
  minHeight?: number | string
}

/**
 * Универсальный empty-state для пустых блоков, таблиц, карточек.
 * Бирюзовая иконка в круглой плашке + заголовок + описание + опц. кнопка.
 */
export default function SproutEmpty({
  icon,
  title = uiText("Пока ничего нет"),
  description,
  action,
  minHeight = 200,
}: Props) {
  return (
    <div
      style={{
        flex: 1,
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px 16px',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: SP.primaryGhost,
          color: SP.primaryDeep,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {icon ?? <Inbox size={28} strokeWidth={1.8} />}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          fontFamily: "'Inter', sans-serif",
          color: SP.text,
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: 13,
            color: SP.textMid,
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  )
}
