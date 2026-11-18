/**
 * Текст вердикта для родителя из готовых фраз (шаблоны), на русском и таджикском.
 * ЧИСТЫЕ функции. Никакой «творческой» части: каждое число в тексте берётся из сигналов, а язык
 * простой. Позже ИИ сможет только переписывать этот же набор фактов, а `groundedNumbers` /
 * `numbersIn` проверят, что он не выдумал цифру.
 *
 * Правила тона: факты и один совет, без ярлыков («слабый ученик») и без обвинений. Предложения
 * безличные («не сдано 4 из 10»), чтобы не зависеть от рода ребёнка.
 *
 * ВАЖНО: таджикские фразы — ЧЕРНОВИК ПЕРЕВОДА, их должен проверить носитель языка
 * (TG_TEMPLATES_REVIEWED). Пока флаг false, публиковать таджикский текст родителям нельзя
 * (проверка — на этапе публикации).
 */

import { monthEnd } from './verdict-dates'
import { PROBLEM_PRIORITY, type Signal, type StudentResult, type SubjectResult } from './verdict-rules'

export type VerdictLang = 'ru' | 'tg'

/** Носитель таджикского проверил фразы шаблонов. Поменять на true только после проверки. */
export const TG_TEMPLATES_REVIEWED = false

export interface VerdictTextInput {
  /** Месяц вердикта, YYYY-MM. */
  month: string
  /** Последний учтённый день; раньше конца месяца — вердикт «на сегодня», это видно в заголовке. */
  asOf: string
  /** Имя ребёнка (одно имя, без фамилии). */
  studentName: string
  scaleMax: number
  /** Длина окна правила «нет оценок», дней. */
  noGradesDays: number
  subjects: SubjectResult[]
  focus: StudentResult['focus']
}

const MONTHS: Record<VerdictLang, string[]> = {
  ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
  tg: ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'],
}

/** Русское склонение после числа: 1 урок, 2–4 урока, 5+ уроков (11–14 — «уроков»). */
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

/** Число с одним знаком после запятой: 4 → «4,0», 3.9 → «3,9». */
const num1 = (value: number) => value.toFixed(1).replace('.', ',')

interface Ctx {
  scaleMax: number
  noGradesDays: number
}

interface Phrases {
  header(monthName: string, name: string, partial: string | null): string
  focusTitle(subject: string): string
  focusAdvice: string
  praiseTitle: string
  otherTitle: string
  more: string
  allGood: string
  footer: string
  /** Предложения по одному сигналу (у «слабого предмета» их может быть два). */
  signal(signal: Signal, subject: string, ctx: Ctx): string[]
}

/** «3 недели» или «21 день»: недели, если окно кратно неделе. */
function ruPeriod(days: number): string {
  if (days % 7 === 0 && days >= 14) {
    const weeks = days / 7
    return `${weeks} ${ruPlural(weeks, 'неделя', 'недели', 'недель')}`
  }
  return `${days} ${ruPlural(days, 'день', 'дня', 'дней')}`
}

function tgPeriod(days: number): string {
  return days % 7 === 0 && days >= 14 ? `${days / 7} ҳафтаи охир` : `${days} рӯзи охир`
}

const RU: Phrases = {
  header: (monthName, name, partial) => `Итоги за ${monthName}: ${name}${partial ? ` (на ${partial})` : ''}`,
  focusTitle: (s) => `Сделайте акцент на предмет «${s}»:`,
  focusAdvice: 'Рекомендуем уделить этому предмету больше внимания дома.',
  praiseTitle: 'Что идёт хорошо:',
  otherTitle: 'Ещё заметили:',
  more: 'Подробности — у классного руководителя.',
  allGood: 'По журналу, посещаемости и домашним заданиям поводов для беспокойства не заметили.',
  footer: 'Если есть вопросы, напишите классному руководителю.',
  signal(signal, s, ctx) {
    switch (signal.code) {
      case 'WEAK': {
        const out: string[] = []
        if (signal.reasons.includes('AVERAGE')) {
          const n = signal.gradesCount
          out.push(`По предмету «${s}» средний балл за месяц — ${num1(signal.average)} из ${ctx.scaleMax} (${n} ${ruPlural(n, 'оценка', 'оценки', 'оценок')}).`)
        }
        if (signal.reasons.includes('BAD_MARKS_IN_ROW')) out.push(`По предмету «${s}» были две низкие оценки подряд.`)
        return out
      }
      case 'DROP':
        return [`По предмету «${s}» средний балл снизился с ${num1(signal.from)} до ${num1(signal.to)}.`]
      case 'HOMEWORK': {
        // «из 21 задания», но «из 10 заданий»
        const word = signal.assessed % 10 === 1 && signal.assessed % 100 !== 11 ? 'задания' : 'заданий'
        return [`По предмету «${s}» не сдано ${signal.notDone} из ${signal.assessed} ${word}.`]
      }
      case 'ABSENCES':
        return [`По предмету «${s}» в дни, когда ребёнка не было в школе, по расписанию было ${signal.lessons} ${ruPlural(signal.lessons, 'урок', 'урока', 'уроков')}.`]
      case 'NO_GRADES':
        return signal.scope === 'class'
          ? [`По предмету «${s}» за последние ${ruPeriod(ctx.noGradesDays)} в журнале нет оценок: это касается всего класса. Можно уточнить у учителя.`]
          : [`По предмету «${s}» за последние ${ruPeriod(ctx.noGradesDays)} нет оценок — спросите учителя.`]
      case 'STRONG':
        return [`Отлично идёт предмет «${s}»: средний балл ${num1(signal.average)} из ${ctx.scaleMax} уже два месяца подряд. Похвалите ребёнка.`]
    }
  },
}

// ЧЕРНОВИК ПЕРЕВОДА: проверить носителем (см. TG_TEMPLATES_REVIEWED).
const TG: Phrases = {
  header: (monthName, name, partial) => `Натиҷаҳои моҳи ${monthName}: ${name}${partial ? ` (то ${partial})` : ''}`,
  focusTitle: (s) => `Ба фанни «${s}» таваҷҷуҳи бештар диҳед:`,
  focusAdvice: 'Тавсия медиҳем, ки дар хона ба ин фан бештар диққат диҳед.',
  praiseTitle: 'Чӣ хуб аст:',
  otherTitle: 'Боз чиро қайд кардем:',
  more: 'Тафсилот назди роҳбари синф.',
  allGood: 'Аз рӯи журнал, ҳозиршавӣ ва вазифаҳои хонагӣ ҷои нигаронӣ ба назар нарасид.',
  footer: 'Агар савол дошта бошед, ба роҳбари синф нависед.',
  signal(signal, s, ctx) {
    switch (signal.code) {
      case 'WEAK': {
        const out: string[] = []
        if (signal.reasons.includes('AVERAGE')) {
          out.push(`Аз фанни «${s}» баҳои миёнаи моҳ — ${num1(signal.average)} аз ${ctx.scaleMax} (${signal.gradesCount} баҳо).`)
        }
        if (signal.reasons.includes('BAD_MARKS_IN_ROW')) out.push(`Аз фанни «${s}» ду баҳои паст паси ҳам гирифта шудааст.`)
        return out
      }
      case 'DROP':
        return [`Баҳои миёна аз фанни «${s}» аз ${num1(signal.from)} то ${num1(signal.to)} паст шуд.`]
      case 'HOMEWORK':
        return [`Аз фанни «${s}» ${signal.notDone} аз ${signal.assessed} вазифаи хонагӣ супорида нашудааст.`]
      case 'ABSENCES':
        return [`Аз фанни «${s}» дар рӯзҳое, ки хонанда дар мактаб набуд, тибқи ҷадвал ${signal.lessons} дарс буд.`]
      case 'NO_GRADES':
        return signal.scope === 'class'
          ? [`Аз фанни «${s}» дар ${tgPeriod(ctx.noGradesDays)} дар журнал баҳо нест: ин ба тамоми синф дахл дорад. Аз омӯзгор пурсида метавонед.`]
          : [`Аз фанни «${s}» дар ${tgPeriod(ctx.noGradesDays)} баҳо гузошта нашудааст — аз омӯзгор пурсед.`]
      case 'STRONG':
        return [`Фанни «${s}» хуб пеш меравад: баҳои миёна ${num1(signal.average)} аз ${ctx.scaleMax} аллакай ду моҳ пай дар пай. Кӯдакро ташвиқ кунед.`]
    }
  },
}

const PHRASES: Record<VerdictLang, Phrases> = { ru: RU, tg: TG }

const FOCUS_LIMIT = 3
const PRAISE_LIMIT = 2
const OTHER_LIMIT = 2

const priorityOf = (signal: Signal) => PROBLEM_PRIORITY.indexOf(signal.code)

/** Есть ли что сказать родителю: сигналы или хотя бы одна оценка за месяц. Иначе вердикт не строим. */
export function hasSomethingToSay(student: Pick<StudentResult, 'subjects'>): boolean {
  return student.subjects.some((s) => s.signals.length > 0 || s.gradesCount > 0)
}

export function renderVerdictText(lang: VerdictLang, input: VerdictTextInput): string {
  const p = PHRASES[lang]
  const ctx: Ctx = { scaleMax: input.scaleMax, noGradesDays: input.noGradesDays }
  const monthIndex = Number(input.month.slice(5, 7)) - 1
  const partial = input.asOf < monthEnd(input.month) ? `${input.asOf.slice(8, 10)}.${input.asOf.slice(5, 7)}` : null
  const name = input.studentName.trim() || (lang === 'ru' ? 'ученик' : 'хонанда')

  const subjectName = new Map(input.subjects.map((s) => [s.subjectId, s.subjectName]))
  const sentences = (signal: Signal) => p.signal(signal, subjectName.get(signal.subjectId) ?? '', ctx)

  // сигнал опознаём по содержанию, а не по ссылке: снимок мог пройти через JSON
  const keyOf = (s: Signal) => `${s.code}|${s.subjectId}|${s.code === 'NO_GRADES' ? s.scope : ''}`
  const focusKeys = new Set((input.focus?.signals ?? []).map(keyOf))
  const all = input.subjects.flatMap((s) => s.signals)
  const byName = (a: Signal, b: Signal) =>
    (subjectName.get(a.subjectId) ?? '').localeCompare(subjectName.get(b.subjectId) ?? '', 'ru')

  const praise = all.filter((s) => s.code === 'STRONG').sort(byName)
  const others = all
    .filter((s) => s.code !== 'STRONG' && !focusKeys.has(keyOf(s)))
    .sort((a, b) => priorityOf(a) - priorityOf(b) || byName(a, b))
  const hasProblems = all.some((s) => s.code !== 'STRONG')

  const blocks: string[][] = [[p.header(MONTHS[lang][monthIndex], name, partial)]]

  if (input.focus) {
    const focusSignals = [...input.focus.signals].sort((a, b) => priorityOf(a) - priorityOf(b))
    const lines = focusSignals.flatMap(sentences).slice(0, FOCUS_LIMIT)
    const advice = focusSignals.some((s) => s.code === 'WEAK' || s.code === 'DROP' || s.code === 'HOMEWORK')
    blocks.push([p.focusTitle(input.focus.subjectName), ...lines.map((l) => `• ${l}`), ...(advice ? [p.focusAdvice] : [])])
  }
  if (praise.length) {
    blocks.push([p.praiseTitle, ...praise.slice(0, PRAISE_LIMIT).flatMap(sentences).map((l) => `• ${l}`)])
  }
  if (others.length) {
    const shown = others.slice(0, OTHER_LIMIT)
    blocks.push([
      p.otherTitle,
      ...shown.flatMap(sentences).map((l) => `• ${l}`),
      ...(others.length > shown.length ? [p.more] : []),
    ])
  }
  if (!hasProblems) blocks.push([p.allGood])
  blocks.push([p.footer])

  return blocks.map((b) => b.join('\n')).join('\n\n')
}

/** Числа в тексте в виде «3.9», «21»: десятичная запятая приводится к точке. */
export function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.'))
}

/**
 * Числа, которые вправе встретиться в тексте: только из сигналов (и максимум шкалы, длина окна,
 * день и месяц в заголовке). Любое другое число — выдумка. Нужна для проверки текста от ИИ.
 */
export function groundedNumbers(input: VerdictTextInput): Set<string> {
  const allowed = new Set<string>()
  const add = (n: number) => {
    allowed.add(String(n))
    allowed.add(n.toFixed(1))
  }
  add(input.scaleMax)
  const days = input.noGradesDays
  add(days % 7 === 0 && days >= 14 ? days / 7 : days)
  if (input.asOf < monthEnd(input.month)) {
    // дата в заголовке «18.11» для numbersIn выглядит как одно число
    allowed.add(`${input.asOf.slice(8, 10)}.${input.asOf.slice(5, 7)}`)
  }
  for (const signal of input.subjects.flatMap((s) => s.signals)) {
    switch (signal.code) {
      case 'WEAK': add(signal.average); add(signal.gradesCount); break
      case 'DROP': add(signal.from); add(signal.to); break
      case 'HOMEWORK': add(signal.notDone); add(signal.assessed); break
      case 'ABSENCES': add(signal.lessons); break
      case 'STRONG': add(signal.average); break
      case 'NO_GRADES': break
    }
  }
  return allowed
}
