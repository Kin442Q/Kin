/**
 * Доступ учителя к классам: чистые функции выбора для страницы «Доступ учителей».
 * Учителю можно дать несколько классов; первый из сохранённых — основной (groupId).
 */

/** Добавить или убрать один класс. */
export function toggleId(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/** Вся группа классов (параллель): если выбраны все — снять, иначе выбрать все. */
export function toggleMany(selected: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const next = new Set(selected)
  const allOn = ids.length > 0 && ids.every((id) => next.has(id))
  for (const id of ids) {
    if (allOn) next.delete(id)
    else next.add(id)
  }
  return next
}

/** Одинаковый ли набор классов (порядок не важен). */
export function sameSelection(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

/**
 * Порядок для сохранения: основной класс (если он остался выбранным) идёт первым,
 * дальше — в порядке списка классов школы. Сервер делает первый основным.
 */
export function orderForSave(
  selected: ReadonlySet<string>,
  schoolOrder: readonly string[],
  mainId: string | null | undefined,
): string[] {
  const ordered = schoolOrder.filter((id) => selected.has(id))
  // выбранные классы, которых нет в списке школы (не должно быть, но не теряем)
  for (const id of selected) if (!ordered.includes(id)) ordered.push(id)
  if (mainId && selected.has(mainId)) return [mainId, ...ordered.filter((id) => id !== mainId)]
  return ordered
}
