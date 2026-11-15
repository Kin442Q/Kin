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
  /** GENERAL — личная переписка с этим учителем; ADMIN — всегда null. */
  teacherId?: string | null
  teacherName?: string | null
  groupName?: string
}

/** Учитель класса ребёнка, которому родитель может написать. */
export interface ChatTeacher {
  id: string
  fullName: string
  isHomeroom: boolean
  subjects: string[]
  lastMessageAt: string | null
  /** Учитель ответил, а родитель ещё не открыл эту переписку. */
  unread: boolean
}

export interface ChatTeachers {
  groupName: string | null
  /** С кем открыть чат, если родитель ещё никого не выбирал. null — у класса нет учителей. */
  defaultTeacherId: string | null
  teachers: ChatTeacher[]
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

/**
 * Кому из учителей класса пишет родитель. Не ломается на пустом или устаревшем списке:
 * если выбранного учителя уже нет, берём того, кого предложил сервер.
 */
export function pickTeacherId(
  list: Pick<ChatTeachers, 'teachers' | 'defaultTeacherId'> | null | undefined,
  preferredId?: string | null,
): string | null {
  const teachers = list?.teachers ?? []
  if (teachers.length === 0) return null
  if (preferredId && teachers.some((t) => t.id === preferredId)) return preferredId
  const byServer = teachers.find((t) => t.id === list?.defaultTeacherId)
  return (byServer ?? teachers[0]).id
}

export const chatApi = {
  // Родитель
  /** teacherId — с каким учителем личная переписка (только для GENERAL). */
  my: (scope: ChatScope = 'GENERAL', teacherId?: string) =>
    http
      .get<{ conversation: ChatConversationInfo; messages: ChatMessage[] }>(
        '/v1/chat/my',
        { params: teacherId ? { scope, teacherId } : { scope } },
      )
      .then((r) => r.data),
  teachers: () =>
    http.get<ChatTeachers>('/v1/chat/teachers').then((r) => r.data),
  parentSend: (text: string, scope: ChatScope = 'GENERAL', teacherId?: string) =>
    http
      .post<ChatMessage>(
        '/v1/chat/my/messages',
        teacherId ? { text, scope, teacherId } : { text, scope },
      )
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
