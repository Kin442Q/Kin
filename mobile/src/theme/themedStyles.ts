import { StyleSheet } from 'react-native'

import { getScheme, type Scheme } from './colors'

/**
 * Стили, зависящие от темы. Работает как `StyleSheet.create`, но объект собирается заново
 * для каждой темы (светлой и тёмной) и кэшируется: экран пишет `styles.card` как раньше,
 * а цвет из `colors.*` берётся у активной палитры в момент чтения.
 *
 *   const styles = themedStyles(() => ({ card: { backgroundColor: colors.surface } }))
 *
 * Тема меняется целиком (дерево перемонтируется), поэтому читать стили «вживую» безопасно.
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: () => T,
): T {
  const cache: Partial<Record<Scheme, T>> = {}
  const current = (): T => {
    const scheme = getScheme()
    return (cache[scheme] ??= StyleSheet.create(factory()) as T)
  }
  return new Proxy({} as T, {
    get: (_t, key) => (current() as Record<PropertyKey, unknown>)[key],
    has: (_t, key) => key in (current() as object),
    ownKeys: () => Reflect.ownKeys(current() as object),
    getOwnPropertyDescriptor: (_t, key) => {
      const d = Reflect.getOwnPropertyDescriptor(current() as object, key)
      return d ? { ...d, configurable: true } : undefined
    },
  })
}

/**
 * Значение, зависящее от темы и считаемое один раз на каждую тему: таблица цветов статусов,
 * список разделов с цветами. Это функция: `const STATUS = themedValue(() => ({...}))`, читать как `STATUS()`.
 */
export function themedValue<T>(factory: () => T): () => T {
  const cache: Partial<Record<Scheme, { v: T }>> = {}
  return () => {
    const scheme = getScheme()
    return (cache[scheme] ??= { v: factory() }).v
  }
}
