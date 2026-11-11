import { uiText } from '../i18n/uiText'
import dayjs from 'dayjs'

import type { HomeworkDto } from '../api/school'

export type HomeworkTab = 'active' | 'check' | 'archive'

/** Календарный день срока: `2026-11-06`. Сервер отдаёт дату без времени, поэтому режем строку, без часовых поясов. */
export const dueDay = (h: Pick<HomeworkDto, 'dueDate'>) => h.dueDate.slice(0, 10)

export interface HomeworkTabs {
  /** Срок ещё не прошёл (сегодняшний день считается): ближайшие сроки первыми. */
  active: HomeworkDto[]
  /** Есть сдачи, которые учитель ещё не проверил (в том числе в прошедших заданиях). */
  check: HomeworkDto[]
  /** Срок прошёл: свежие первыми. */
  archive: HomeworkDto[]
  /** Сколько всего сдач ждут проверки — число на вкладке «Проверить». */
  toCheckTotal: number
}

export function splitHomework(list: HomeworkDto[], today: string = dayjs().format('YYYY-MM-DD')): HomeworkTabs {
  const byDueAsc = (a: HomeworkDto, b: HomeworkDto) => dueDay(a).localeCompare(dueDay(b))
  const active = list.filter((h) => dueDay(h) >= today).sort(byDueAsc)
  const archive = list.filter((h) => dueDay(h) < today).sort((a, b) => byDueAsc(b, a))
  const check = list.filter((h) => (h.stats?.toCheck ?? 0) > 0).sort(byDueAsc)
  return { active, check, archive, toCheckTotal: check.reduce((sum, h) => sum + (h.stats?.toCheck ?? 0), 0) }
}

/** Срок словами: «сегодня», «завтра», иначе «до 6.11». */
export function dueLabel(h: Pick<HomeworkDto, 'dueDate'>, today: string = dayjs().format('YYYY-MM-DD')): string {
  const day = dueDay(h)
  if (day === today) return uiText("сегодня")
  if (day === dayjs(today).add(1, 'day').format('YYYY-MM-DD')) return uiText("завтра")
  return uiText("до {0}", dayjs(day).format('D.M'))
}

/** Доля сдавших в классе от 0 до 1 (0, если класс пуст или данных нет). */
export function submittedShare(h: Pick<HomeworkDto, 'stats'>): number {
  const total = h.stats?.total ?? 0
  return total > 0 ? Math.min(1, (h.stats?.submitted ?? 0) / total) : 0
}
