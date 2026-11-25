import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import * as Notifications from 'expo-notifications'

import { notificationsApi, type NoticeDto } from '../api/notifications'

/**
 * Список «Оповещений» пользователя (колокольчик на главной и экран «Уведомления» в профиле).
 * Обновляется при открытии, при возврате в приложение и когда push приходит, пока приложение открыто.
 */
export function useNotices() {
  const [notices, setNotices] = useState<NoticeDto[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const reload = useCallback(async () => {
    try {
      const list = await notificationsApi.list()
      setNotices(Array.isArray(list) ? list : [])
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    // Не ждём перезапуска: пришло push при открытом приложении или человек вернулся в приложение
    const received = Notifications.addNotificationReceivedListener(() => {
      reload()
    })
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload()
    })
    return () => {
      received.remove()
      appState.remove()
    }
  }, [reload])

  const markAllRead = useCallback(() => {
    // Сразу гасим точку, запрос уходит фоном; если не дошёл, при следующей загрузке всё вернётся как на сервере
    setNotices((list) => (list.some((n) => !n.read) ? list.map((n) => ({ ...n, read: true })) : list))
    notificationsApi.markAllRead().catch(() => {})
  }, [])

  return {
    notices,
    unread: notices.some((n) => !n.read),
    loading,
    failed,
    reload,
    markAllRead,
  }
}
