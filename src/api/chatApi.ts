import { http } from './http'

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  text: string
  createdAt: string
  sender?: { id: string; fullName: string; role: string }
}

export interface ChatConversationInfo {
  id: string
  groupId: string
  parentId: string
  groupName?: string
}

export interface StaffConversation {
  id: string
  parentId: string
  parentName: string
  groupId: string
  groupName: string
  lastMessageAt: string
  lastText: string | null
  unread: boolean
}

export const chatApi = {
  // Родитель
  my: () =>
    http
      .get<{ conversation: ChatConversationInfo; messages: ChatMessage[] }>(
        '/v1/chat/my',
      )
      .then((r) => r.data),
  parentSend: (text: string) =>
    http.post<ChatMessage>('/v1/chat/my/messages', { text }).then((r) => r.data),

  // Учитель / админ
  conversations: () =>
    http.get<StaffConversation[]>('/v1/chat/conversations').then((r) => r.data),
  messages: (conversationId: string) =>
    http
      .get<{ messages: ChatMessage[] }>(
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
