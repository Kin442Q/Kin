import { uiText } from '../i18n/uiText'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { create } from 'zustand'

import { http } from '../api/http'

/** Должен совпадать с ANDROID_CHANNEL_ID на сервере (server/src/modules/push/push.service.ts). */
const CHANNEL_ID = 'default'

// Базовая конфигурация: показывать баннер/звук, когда уведомление пришло
// и приложение на переднем плане.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/**
 * Почему уведомления могут не приходить — это видно на экране «Уведомления» (Профиль). Раньше любая ошибка здесь
 * молча глоталась, и понять причину было нельзя.
 */
export type PushState =
  /** ещё не проверяли */
  | { kind: 'unknown' }
  /** эмулятор или web: настоящих push нет */
  | { kind: 'simulator' }
  /** в телефоне выключены уведомления для приложения */
  | { kind: 'denied'; canAskAgain: boolean }
  /** сборка без ключа Firebase (google-services.json): Android не выдаёт токен */
  | { kind: 'no-fcm' }
  /** другая ошибка получения токена */
  | { kind: 'error'; message: string }
  /** токен получен; serverOk — принял ли его сервер */
  | { kind: 'ready'; serverOk: boolean }

interface PushStore {
  state: PushState
  set: (state: PushState) => void
}

export const usePushStore = create<PushStore>((set) => ({
  state: { kind: 'unknown' },
  set: (state) => set({ state }),
}))

/** Ошибка Firebase при получении токена на Android: в сборку не попал google-services.json. */
export function isFcmMissing(message: string): boolean {
  return /firebase|fcm|google-services|FirebaseApp/i.test(message)
}

type TokenResult =
  | { ok: true; token: string }
  | { ok: false; state: PushState }

/**
 * Канал уведомлений Android. Создаётся ДО запроса разрешения: на Android 13+ системное окно «Разрешить
 * уведомления?» не появляется, пока у приложения нет ни одного канала (раньше канал создавался уже после, и
 * разрешение не запрашивалось вовсе).
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: uiText("Мактаби ман"),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0D7A7C',
  })
}

/**
 * Запрашивает разрешение и возвращает Expo push token либо причину, почему его нет.
 * На симуляторе/web ничего не делает.
 */
export async function getPushToken(): Promise<TokenResult> {
  if (!Device.isDevice) return { ok: false, state: { kind: 'simulator' } }

  try {
    await ensureAndroidChannel()
  } catch {
    // канал не создался — разрешение всё равно попробуем получить
  }

  const current = await Notifications.getPermissionsAsync()
  let granted = current.status === 'granted'
  let canAskAgain = current.canAskAgain
  if (!granted && current.canAskAgain) {
    const asked = await Notifications.requestPermissionsAsync()
    granted = asked.status === 'granted'
    canAskAgain = asked.canAskAgain
  }
  if (!granted) return { ok: false, state: { kind: 'denied', canAskAgain } }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
    const token = tokenResponse.data
    if (!token) return { ok: false, state: { kind: 'error', message: 'empty token' } }
    return { ok: true, token }
  } catch (e) {
    const message = String((e as Error)?.message ?? e)
    return {
      ok: false,
      state: isFcmMissing(message) ? { kind: 'no-fcm' } : { kind: 'error', message },
    }
  }
}

/** Старое имя: токен или null (без причины). Оставлено для совместимости. */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const r = await getPushToken()
  return r.ok ? r.token : null
}

/** Отправить токен на бэкенд для текущего пользователя. true — сервер принял. */
export async function registerPushTokenOnServer(token: string): Promise<boolean> {
  try {
    const { data } = await http.post<{ ok: boolean }>('/v1/push/register', { token })
    return data?.ok !== false
  } catch {
    // не критично — при следующем запуске/возврате в приложение попробуем снова
    return false
  }
}

/** Снять токен на бэке (при логауте). */
export async function unregisterPushTokenOnServer(): Promise<void> {
  try {
    await http.post('/v1/push/unregister', {})
  } catch {
    // ignore
  }
}

let setupRunning: Promise<void> | null = null

/**
 * Полная настройка push для вошедшего пользователя: канал, разрешение, токен, регистрация на сервере.
 * Результат пишется в usePushStore (его показывает экран «Уведомления»). Параллельные вызовы схлопываются.
 */
export function setupPush(): Promise<void> {
  if (setupRunning) return setupRunning
  setupRunning = (async () => {
    try {
      const r = await getPushToken()
      if (!r.ok) {
        usePushStore.getState().set(r.state)
        return
      }
      const serverOk = await registerPushTokenOnServer(r.token)
      usePushStore.getState().set({ kind: 'ready', serverOk })
    } catch (e) {
      usePushStore.getState().set({ kind: 'error', message: String((e as Error)?.message ?? e) })
    } finally {
      setupRunning = null
    }
  })()
  return setupRunning
}

export interface PushTestResult {
  registered: boolean
  accepted: number
  error: { code: string; message: string } | null
}

/** Сервер шлёт тестовое уведомление этому пользователю и сообщает, принял ли его Expo. */
export const sendTestPush = () =>
  http.post<PushTestResult>('/v1/push/test', {}).then((r) => r.data)
