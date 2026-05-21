import { http } from './http'

export type ChatScope = 'GENERAL' | 'ADMIN'

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  text: string
  kind: 'TEXT' | 'PAYMENT'
  createdAt: string
  sender?: { id: string; fullName: string; role: string }
}

export interface ChatConversationInfo {
  id: string
  groupId: string
  parentId: string
  scope: ChatScope
  groupName?: string
}

export interface StaffConversation {
  id: string
  parentId: string
  parentName: string
  groupId: string
  groupName: string
  scope: ChatScope
  lastMessageAt: string
  lastText: string | null
  unread: boolean
}

export const chatApi = {
  // Родитель
  my: (scope: ChatScope = 'GENERAL') =>
    http
      .get<{ conversation: ChatConversationInfo; messages: ChatMessage[] }>(
        '/v1/chat/my',
        { params: { scope } },
      )
      .then((r) => r.data),
  parentSend: (text: string, scope: ChatScope = 'GENERAL') =>
    http
      .post<ChatMessage>('/v1/chat/my/messages', { text, scope })
      .then((r) => r.data),
  paymentReminder: (studentId: string, month: string, amount: number) =>
    http
      .post<{ sent: number }>('/v1/chat/payment-reminder', {
        studentId,
        month,
        amount,
      })
      .then((r) => r.data),

  // Учитель / админ
  conversations: () =>
    http.get<StaffConversation[]>('/v1/chat/conversations').then((r) => r.data),
  messages: (conversationId: string) =>
    http
      .get<{ conversation: unknown; messages: ChatMessage[] }>(
        `/v1/chat/conversations/${conversationId}/messages`,
      )
      .then((r) => r.data),
  staffSend: (conversationId: string, text: string) =>
    http
      .post<ChatMessage>(`/v1/chat/conversations/${conversationId}/messages`, {
        text,
      })
      .then((r) => r.data),
}
