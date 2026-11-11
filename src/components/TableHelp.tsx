import type { ReactNode } from 'react'
import { Tooltip } from 'antd'
import type { ColumnType, ColumnsType } from 'antd/es/table'
import { Info } from 'lucide-react'

import { uiText } from '../i18n/uiText'

/* ============================================================
   Пояснения в таблицах отчётов: что это за таблица, что значит колонка и из чего сложилось число.
   Три уровня:
   - TableTitle: название таблицы со значком; по наведению — что это и как считаются данные;
   - HelpLabel: заголовок колонки со значком; по наведению — что значит колонка;
   - CellTip / helpColumns: подсказка на самой ячейке — строка, колонка и на чём основано значение.
   Подсказки открываются и по наведению мыши, и по фокусу с клавиатуры.
   ============================================================ */

const TIP_STYLE = { maxWidth: 400 } as const
const TRIGGERS: Array<'hover' | 'focus'> = ['hover', 'focus']

/** Подпись со значком «i»: наведите курсор или перейдите на неё клавишей Tab. */
export function HelpLabel({ title, help }: { title: ReactNode; help: ReactNode }) {
  return (
    <Tooltip title={help} overlayStyle={TIP_STYLE} mouseEnterDelay={0.2} trigger={TRIGGERS}>
      <span tabIndex={0} style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {title}
        <Info size={13} aria-hidden style={{ opacity: 0.6, flexShrink: 0 }} />
      </span>
    </Tooltip>
  )
}

/** Название таблицы: по наведению — что это за таблица и как в ней считаются данные. */
export function TableTitle({ title, what, how }: { title: ReactNode; what: ReactNode; how: ReactNode }) {
  return (
    <HelpLabel
      title={title}
      help={
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
          <div style={{ marginBottom: 6 }}>{what}</div>
          <div>
            <b>{uiText('Как считается')}:</b> {how}
          </div>
        </div>
      }
    />
  )
}

/** Подсказка на ячейке: наведите курсор на значение. */
export function CellTip({ tip, children }: { tip: ReactNode; children: ReactNode }) {
  return (
    <Tooltip title={tip} overlayStyle={TIP_STYLE} mouseEnterDelay={0.25}>
      <span style={{ display: 'block' }}>{children}</span>
    </Tooltip>
  )
}

/** Пояснение к колонке и, если нужно, «на чём основано» для конкретной строки. */
export interface ColumnHelp<T> {
  /** Что значит колонка и как считается значение. */
  help: string
  /** Для строки: сколько оценок/отметок/учеников лежит в основе значения. null — не показывать. */
  basis?: (row: T) => string | null | undefined
  /** false — подсказка только на заголовке (в ячейке уже есть своя, две подряд мешали бы друг другу). */
  cell?: boolean
}

export type HelpMap<T> = Record<string, ColumnHelp<T>>

/**
 * Добавляет колонкам подсказки: на заголовке (что значит колонка) и на каждой ячейке (строка, колонка,
 * на чём основано значение). Колонки подбираются по заголовку: ключ карты — исходный русский заголовок,
 * он сравнивается с переводом на текущем языке, поэтому код колонок можно не менять. Колонки без
 * пояснения остаются как были. Сортировка, ширины и отрисовка значений не затрагиваются.
 */
export function helpColumns<T>(
  columns: ColumnsType<T>,
  options: { rowLabel: (row: T) => string; help: HelpMap<T> },
): ColumnsType<T> {
  const byTitle = new Map(Object.entries(options.help).map(([source, entry]) => [uiText(source), entry]))
  return columns.map((column) => {
    const title = column.title
    const entry = typeof title === 'string' ? byTitle.get(title) : undefined
    if (!entry || typeof title !== 'string') return column
    if (entry.cell === false) return { ...column, title: <HelpLabel title={title} help={entry.help} /> } as ColumnType<T>
    const original = (column as ColumnType<T>).render
    const render: ColumnType<T>['render'] = (value, row, index) => {
      const content = (original ? original(value, row, index) : value) as ReactNode
      const basis = entry.basis?.(row)
      return (
        <CellTip
          tip={
            <div>
              <div style={{ fontWeight: 700 }}>{options.rowLabel(row)}</div>
              <div>{title}</div>
              {basis ? <div style={{ marginTop: 4 }}>{basis}</div> : null}
              <div style={{ marginTop: 6, opacity: 0.85 }}>{entry.help}</div>
            </div>
          }
        >
          {content}
        </CellTip>
      )
    }
    return { ...column, title: <HelpLabel title={title} help={entry.help} />, render } as ColumnType<T>
  })
}
