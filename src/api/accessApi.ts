import { http } from './http'

/* ============================================================
   Выдача доступа без паролей от админа и смена своего пароля.
   Админ пароль не вводит и не видит: человек получает письмо со ссылкой
   и сам задаёт пароль. Не ушло письмо — аккаунт остаётся, приглашение
   можно отправить ещё раз.
   ============================================================ */

/** Почему письмо не ушло: почта не настроена, провайдер отклонил, нет связи. */
export type MailFailure = 'NOT_CONFIGURED' | 'REJECTED' | 'NETWORK'

export type AccessGrant =
  | { sent: true; email: string }
  | { sent: false; email: string; reason: MailFailure; detail?: string }

export const accessApi = {
  /**
   * Отправить учителю, администратору или родителю своей школы письмо со ссылкой:
   * приглашение (если ещё не входил) или смена пароля.
   */
  sendLink: (userId: string) => http.post<AccessGrant>(`/v1/access/users/${userId}/send-link`).then((r) => r.data),

  /** Сменить свой пароль. Остальные устройства выходят, это остаётся с новой сессией. */
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    http.post<{ accessToken: string }>('/v1/auth/change-password', body).then((r) => r.data),

  /** Сменить свой email (он же логин). Нужен текущий пароль. */
  changeEmail: (body: { currentPassword: string; newEmail: string }) =>
    http.post<{ accessToken: string; user: { email: string } }>('/v1/auth/change-email', body).then((r) => r.data),
}
