import { uiText } from '../i18n/uiText'
/**
 * Классы школы устроены по параллелям: «1 А», «1 Б», «1 В» — это параллель 1,
 * буквы А, Б, В. Названия вводят свободно («1А», «1 А», «1a», «11b», «3 V»),
 * поэтому здесь — разбор названия, группировка по параллелям и сопоставление
 * названий из файлов (импорт Excel) с уже созданными классами.
 */

export interface ParsedClass {
  /** Номер параллели (1–11) или null, если название не начинается с цифры */
  grade: number | null
  /** Буква класса в верхнем регистре: «А», «Б», «V»; пусто, если её нет */
  letter: string
}

/** Параллель в фильтре: число или 'other' для классов без номера. */
export type GradeKey = number | 'other'

export interface GradeGroup<T> {
  key: GradeKey
  grade: number | null
  label: string
  items: T[]
}

/** «1 А» → { grade: 1, letter: 'А' }; «Кружок» → { grade: null, letter: 'КРУЖОК' }. */
export function parseClassName(name: string): ParsedClass {
  const s = (name ?? '').trim()
  const m = s.match(/^(\d{1,2})\s*[-–.]?\s*(.*)$/)
  if (!m) return { grade: null, letter: s.toUpperCase() }
  return { grade: Number(m[1]), letter: m[2].trim().toUpperCase() }
}

export function gradeKeyOf(name: string): GradeKey {
  const g = parseClassName(name).grade
  return g === null ? 'other' : g
}

export function gradeLabel(key: GradeKey): string {
  return key === 'other' ? uiText("Другие классы") : uiText("{0} класс", key)
}

/** Порядок: параллели по возрастанию, «другие» в конце; внутри — по букве. */
export function compareClassNames(a: string, b: string): number {
  const pa = parseClassName(a)
  const pb = parseClassName(b)
  if (pa.grade !== pb.grade) {
    if (pa.grade === null) return 1
    if (pb.grade === null) return -1
    return pa.grade - pb.grade
  }
  return pa.letter.localeCompare(pb.letter, 'ru')
}

/** Группирует по параллелям; параллели и классы внутри уже отсортированы. */
export function groupByGrade<T>(items: T[], nameOf: (item: T) => string): GradeGroup<T>[] {
  const map = new Map<GradeKey, T[]>()
  for (const it of items) {
    const key = gradeKeyOf(nameOf(it))
    const list = map.get(key)
    if (list) list.push(it)
    else map.set(key, [it])
  }
  const groups: GradeGroup<T>[] = []
  for (const [key, list] of map) {
    list.sort((x, y) => compareClassNames(nameOf(x), nameOf(y)))
    groups.push({ key, grade: key === 'other' ? null : key, label: gradeLabel(key), items: list })
  }
  groups.sort((x, y) => {
    if (x.grade === y.grade) return 0
    if (x.grade === null) return 1
    if (y.grade === null) return -1
    return x.grade - y.grade
  })
  return groups
}

/** Короткая подпись буквы для плашки: «А»; если буквы нет — название целиком. */
export function classLetterOf(name: string): string {
  const p = parseClassName(name)
  return p.letter || (name ?? '').trim()
}

/** «1 А» → «1А»: единый вид для создаваемых классов. */
export function compactClassName(name: string): string {
  const p = parseClassName(name)
  if (p.grade === null) return (name ?? '').trim()
  // Букву берём из исходной строки (с её регистром), без пробелов
  const raw = (name ?? '').trim().match(/^\d{1,2}\s*[-–.]?\s*(.*)$/)
  const letter = (raw?.[1] ?? '').trim().toUpperCase()
  return `${p.grade}${letter}`
}

// ─── Сопоставление названий (импорт) ────────────────────────────────────────

/** Транслитерация: в школах пишут «1 В» кириллицей и «1 V» латиницей — это один класс. */
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

/** «Похожие по написанию» кириллические буквы → латинские (А≈A, В≈B, С≈C…). */
const LOOKALIKE: Record<string, string> = {
  а: 'a', в: 'b', с: 'c', е: 'e', н: 'h', к: 'k', м: 'm', о: 'o', р: 'p', т: 't', х: 'x', у: 'y',
}

function normalizeWith(name: string, table: Record<string, string>): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/[\s\-–.«»"'()]/g, '')
    .split('')
    .map((ch) => (table[ch] !== undefined ? table[ch] : ch))
    .join('')
}

/** Ключ по транслитерации: «1 В» и «1V» совпадают. */
export function classKey(name: string): string {
  return normalizeWith(name, TRANSLIT)
}

/** Запасной ключ по написанию: «1 В» (кириллица) и «1B» (латиница) совпадают. */
export function classKeyVisual(name: string): string {
  return normalizeWith(name, LOOKALIKE)
}

/** Находит класс по названию из файла: сначала по транслитерации, затем по написанию. */
export function findClassByName<T extends { name: string }>(
  groups: T[],
  name: string | undefined,
): T | undefined {
  if (!name || !name.trim()) return undefined
  const k = classKey(name)
  const byTranslit = groups.find((g) => classKey(g.name) === k)
  if (byTranslit) return byTranslit
  const v = classKeyVisual(name)
  return groups.find((g) => classKeyVisual(g.name) === v)
}

/** Склонение: plural(5, ['класс', 'класса', 'классов']) → «классов». */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}
