import { http } from './http'

/** Оповещение пользователя (/v1/notifications): последние 50, новые сверху. */
export interface NoticeDto {
  id: string
  title: string
  description: string | null
  read: boolean
  createdAt: string
}

export const notificationsApi = {
  list: () => http.get<NoticeDto[]>('/v1/notifications').then((r) => r.data),
  markAllRead: () => http.post('/v1/notifications/read-all', {}).then((r) => r.data),
}
