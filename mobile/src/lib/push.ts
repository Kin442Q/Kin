import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

import { http } from '../api/http'

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
 * Запрашивает разрешение и возвращает Expo push token, если всё ок.
 * На симуляторе/web просто возвращает null без ошибок.
 */
export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  if (!Device.isDevice) {
    // На симуляторах нет реального push.
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    return null
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
    const token = tokenResponse.data
    if (!token) return null

    // Android требует канал, чтобы уведомления отображались.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'redi',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4FB286',
      })
    }

    return token
  } catch {
    return null
  }
}

/** Отправить токен на бэкенд для текущего пользователя. */
export async function registerPushTokenOnServer(token: string): Promise<void> {
  try {
    await http.post('/v1/push/register', { token })
  } catch {
    // не критично — при следующем логине попробуем снова
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
