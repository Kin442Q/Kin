import { createElement, Fragment, useMemo, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import 'dayjs/locale/en'
import 'dayjs/locale/tg'

import { ru } from './ru'
import { en } from './en'
import { tg } from './tg'
import { LANGS, type Lang, type Msg } from './types'

export { LANGS }
export type { Lang }

/** Ключи переводов — берутся из русского словаря. */
export type MsgKey = keyof typeof ru

type Params = Record<string, string | number>

const DICTS: Record<Lang, Record<MsgKey, Msg>> = { ru, en, tg }

const isLang = (v: unknown): v is Lang => v === 'ru' || v === 'en' || v === 'tg'

/** Категория числа для склонения: в русском one/few/many, в остальных — one/other. */
export function pluralCategory(lang: Lang, n: number): 'one' | 'few' | 'many' | 'other' {
  const a = Math.abs(n)
  if (lang === 'ru') {
    const m100 = a % 100
    const m10 = a % 10
    if (m10 === 1 && m100 !== 11) return 'one'
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'few'
    return 'many'
  }
  return a === 1 ? 'one' : 'other'
}

function pickForm(lang: Lang, msg: Msg, n: number): string {
  if (typeof msg === 'string') return msg
  return msg[pluralCategory(lang, n)] ?? msg.other
}

function rawMessage(lang: Lang, key: MsgKey, n: number): string {
  const msg = DICTS[lang][key] ?? ru[key] ?? key
  return pickForm(lang, msg as Msg, n)
}

/** Перевод строки: «{name}» подставляется из params, форма числа выбирается по params.n. */
export function translate(lang: Lang, key: MsgKey, params?: Params): string {
  const raw = rawMessage(lang, key, Number(params?.n ?? 0))
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => (params && k in params ? String(params[k]) : m))
}

/** То же, но подстановки — React-узлы (например, выделенное жирным число). */
export function translateRich(lang: Lang, key: MsgKey, nodes: Record<string, ReactNode>): ReactNode[] {
  return rawMessage(lang, key, 0)
    .split(/(\{\w+\})/g)
    .map((part, i) => {
      const m = part.match(/^\{(\w+)\}$/)
      return m && m[1] in nodes ? createElement(Fragment, { key: i }, nodes[m[1]]) : part
    })
}

/** Атрибут lang у <html> и язык дат (dayjs). */
function applyLang(lang: Lang) {
  const info = LANGS.find((l) => l.code === lang)
  document.documentElement.setAttribute('lang', info?.htmlLang ?? 'ru')
  dayjs.locale(lang)
}

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
}

/**
 * Язык интерфейса. Хранится в localStorage («kg_lang»); по умолчанию — русский,
 * чтобы у тех, кто язык не выбирал, ничего не менялось.
 */
export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: 'ru',
      setLang: (lang) => {
        applyLang(lang)
        set({ lang })
      },
    }),
    {
      name: 'kg_lang',
      partialize: (s) => ({ lang: s.lang }),
      merge: (persisted, current) => {
        const stored = (persisted as Partial<LangState> | undefined)?.lang
        return { ...current, lang: isLang(stored) ? stored : current.lang }
      },
      onRehydrateStorage: () => (state) => {
        applyLang(state?.lang ?? 'ru')
      },
    },
  ),
)

/** Текущий язык вне React-компонентов. */
export const currentLang = (): Lang => useLangStore.getState().lang

/** Перевод вне компонентов (подписи ролей, сообщения): читает язык из хранилища. */
export const t = (key: MsgKey, params?: Params): string => translate(currentLang(), key, params)

export type TFn = ((key: MsgKey, params?: Params) => string) & {
  /** Перевод с React-узлами вместо {подстановок} */
  rich: (key: MsgKey, nodes: Record<string, ReactNode>) => ReactNode[]
  lang: Lang
}

/** Хук для компонентов: перерисовывает компонент при смене языка. */
export function useT(): TFn {
  const lang = useLangStore((s) => s.lang)
  return useMemo(() => {
    const fn = ((key: MsgKey, params?: Params) => translate(lang, key, params)) as TFn
    fn.rich = (key, nodes) => translateRich(lang, key, nodes)
    fn.lang = lang
    return fn
  }, [lang])
}
