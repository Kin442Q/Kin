import { uiLanguage, uiText } from '../i18n/uiText'
import { useMemo } from 'react'
import { classLetterOf, gradeKeyOf, groupByGrade, gradeLabel, type GradeKey } from '../lib/classes'

export interface ClassItem {
  id: string
  name: string
}

/** Выбор в фильтре: параллель и (необязательно) конкретная буква. */
export interface ClassSelection {
  grade: GradeKey | null
  groupId: string | null
}

export const EMPTY_SELECTION: ClassSelection = { grade: null, groupId: null }

/** Выбор по id класса (например, класс учителя по умолчанию). */
export function selectionFor(groups: ClassItem[], groupId: string | null | undefined): ClassSelection {
  const g = groups.find((x) => x.id === groupId)
  return g ? { grade: gradeKeyOf(g.name), groupId: g.id } : EMPTY_SELECTION
}

/** id классов, попавших под выбор: конкретный класс, вся параллель или ничего. */
export function selectedGroupIds(groups: ClassItem[], sel: ClassSelection): string[] {
  if (sel.groupId) return [sel.groupId]
  if (sel.grade !== null) return groups.filter((g) => gradeKeyOf(g.name) === sel.grade).map((g) => g.id)
  return []
}

/** Класс по умолчанию: если класс в школе один (или у учителя один) — выбираем сразу. */
export function defaultSelection(groups: ClassItem[], preferredId?: string | null): ClassSelection {
  if (preferredId && groups.some((g) => g.id === preferredId)) return selectionFor(groups, preferredId)
  if (groups.length === 1) return selectionFor(groups, groups[0].id)
  return EMPTY_SELECTION
}

interface Props {
  groups: ClassItem[]
  value: ClassSelection
  onChange: (next: ClassSelection) => void
  /**
   * true — можно выбрать всю параллель целиком («Все буквы»), как на странице учеников.
   * false — после параллели обязательно выбирается буква (посещаемость, сводка класса).
   */
  allowAllLetters?: boolean
  /** Сколько учеников в каждом классе — показывается мелким числом на плашках. */
  counts?: Record<string, number>
  /** Подпись над плашками параллелей */
  gradeLabelText?: string
}

/**
 * Двухуровневый выбор класса: сначала параллель (1, 2 … 11), затем буква (А, Б, В).
 * Вместо длинного списка всех классов сразу — так фильтр остаётся коротким
 * даже в большой школе.
 */
export default function ClassFilter({
  groups,
  value,
  onChange,
  allowAllLetters = false,
  counts,
  gradeLabelText = uiText("Параллель"),
}: Props) {
  const grades = useMemo(() => groupByGrade(groups, (g) => g.name), [groups, uiLanguage()])
  const active = grades.find((g) => g.key === value.grade) ?? null

  const countOf = (ids: string[]) =>
    counts ? ids.reduce((sum, id) => sum + (counts[id] ?? 0), 0) : undefined

  const pickGrade = (key: GradeKey) => {
    if (value.grade === key) {
      onChange(EMPTY_SELECTION)
      return
    }
    const g = grades.find((x) => x.key === key)
    // В параллели один класс — выбирать букву не из чего
    if (g && g.items.length === 1) onChange({ grade: key, groupId: g.items[0].id })
    else onChange({ grade: key, groupId: null })
  }

  if (groups.length === 0) return null

  return (
    <div className="cf" role="group" aria-label={uiText("Выбор класса")}>
      <div className="cf-row">
        <span className="cf-label">{gradeLabelText}</span>
        <div className="cf-chips">
          {grades.map((g) => {
            const on = value.grade === g.key
            const n = countOf(g.items.map((i) => i.id))
            return (
              <button
                key={String(g.key)}
                type="button"
                className={`cf-chip${on ? ' is-on' : ''}`}
                aria-pressed={on}
                title={`${g.label}: ${g.items.length}`}
                onClick={() => pickGrade(g.key)}
              >
                {g.key === 'other' ? uiText("Другие") : g.grade}
                {n !== undefined && <span className="cf-count">{n}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {active && active.items.length > 1 && (
        <div className="cf-row">
          <span className="cf-label">{uiText("Класс")}</span>
          <div className="cf-chips" aria-label={gradeLabel(active.key)}>
            {allowAllLetters && (
              <button
                type="button"
                className={`cf-chip${value.groupId === null ? ' is-on' : ''}`}
                aria-pressed={value.groupId === null}
                onClick={() => onChange({ grade: active.key, groupId: null })}
              >
                {" " + uiText("Все") + " "}</button>
            )}
            {active.items.map((g) => {
              const on = value.groupId === g.id
              const n = countOf([g.id])
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`cf-chip${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  title={g.name}
                  onClick={() => onChange({ grade: active.key, groupId: g.id })}
                >
                  {classLetterOf(g.name)}
                  {n !== undefined && <span className="cf-count">{n}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
