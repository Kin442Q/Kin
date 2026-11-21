import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Выделение строк таблицы галочками.
 *
 * Выделенными считаются только строки из `rows`, то есть то, что сейчас показано на экране:
 * то, что спрятал фильтр, в выделении не остаётся и случайно не попадёт в удаление.
 * При смене `resetKey` (фильтры, поиск) выделение сбрасывается целиком.
 * `selectAll` выбирает все строки из `rows`, а не только текущую страницу таблицы.
 * При `enabled = false` (нет прав) выделения нет совсем.
 */
export function useRowPick<T extends { id: string }>(rows: readonly T[], resetKey: string, enabled = true) {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    setIds(new Set())
  }, [resetKey])

  const picked = useMemo(() => (enabled ? rows.filter((r) => ids.has(r.id)) : []), [rows, ids, enabled])
  const pickedIds = useMemo(() => picked.map((r) => r.id), [picked])

  const toggle = useCallback((id: string, on: boolean) => {
    setIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])
  const selectAll = useCallback(() => setIds(new Set(rows.map((r) => r.id))), [rows])
  const clear = useCallback(() => setIds(new Set()), [])

  const allPicked = rows.length > 0 && picked.length === rows.length
  return {
    picked,
    pickedIds,
    allPicked,
    somePicked: picked.length > 0 && !allPicked,
    toggle,
    selectAll,
    clear,
    /** Галочка «выбрать всех» в шапке: включить — все найденные, выключить — снять всё. */
    toggleAll: (on: boolean) => (on ? selectAll() : clear()),
  }
}
