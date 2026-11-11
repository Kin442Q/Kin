import messages from './uiMessages.json'
import { useLangStore } from './index'
import type { Lang } from './types'
const dictionary: Record<string, { en: string; tg: string }> = Object.fromEntries(Object.entries(messages).map(([key, value]) => [key.trim().replace(/\s+/g, ' '), value]))
export const uiLanguage = () => useLangStore.getState().lang
/** Live labels for module-level UI option lists; backend identifiers stay untouched. */
export function localizeCopy<T extends object>(source: T): T {
  const cache = new WeakMap<object, object>()
  const wrap = (value: object): object => {
    // React elements, dates and immutable library values must keep their identity.
    if ('$$typeof' in value || Object.isFrozen(value) || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)) return value
    if (cache.has(value)) return cache.get(value)!
    const proxy = new Proxy(value, {
      get(target, key, receiver) {
        const item = Reflect.get(target, key, receiver)
        if (typeof item === 'string' && !['value', 'key', 'id', 'code'].includes(String(key))) return uiText(item)
        if (item && typeof item === 'object') return wrap(item)
        return item
      },
    })
    cache.set(value, proxy)
    return proxy
  }
  return wrap(source) as T
}
/** Translate interface copy only; names and user content are never passed here. */
export function uiText(source: string, ...values: unknown[]): string {
  return uiTextFor(useLangStore.getState().lang, source, ...values)
}
export function uiTextFor(lang: Lang, source: string, ...values: unknown[]): string {
  if (typeof source !== 'string') return String(source ?? '')
  const key = source.trim().replace(/\s+/g, ' ')
  const translated = lang === 'ru' ? source : dictionary[key]?.[lang] ?? source
  return translated.replace(/\{(\d+)\}/g, (match, index: string) => Number(index) < values.length ? String(values[Number(index)] ?? '') : match)
}
