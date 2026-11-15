/**
 * Кто имеет право видеть и писать в переписку. Единое правило для REST (ChatService)
 * и для websocket-шлюза: раньше они расходились, и через сокет можно было
 * присоединиться к чужой комнате.
 *
 *  - PARENT — только свои переписки (conv.parentId = он), оба канала;
 *  - TEACHER — только GENERAL, где он собеседник (conv.teacherId = он), своей школы.
 *    Другие учителя того же класса переписку не видят;
 *  - ADMIN / SUPER_ADMIN — только канал ADMIN (оплата, финансы) своей школы.
 *    Личные переписки учителя с родителем директору не показываются;
 *  - остальные роли (STUDENT, VIEWER) — никогда.
 */
export interface ChatActor {
  id: string
  role: string
  kindergartenId: string | null | undefined
}

export interface ChatConvRef {
  parentId: string
  teacherId: string | null
  scope: 'GENERAL' | 'ADMIN'
  kindergartenId: string | null
}

export type ChatDenyReason =
  | 'FINANCE_FOR_TEACHER' // учитель и финансовый канал
  | 'PRIVATE_FOR_ADMIN' // администрация и личная переписка
  | 'NOT_PARTICIPANT' // не участник
  | 'OTHER_SCHOOL' // другая школа
  | 'ROLE'

/** null — доступ есть, иначе причина отказа. */
export function chatDenyReason(actor: ChatActor, conv: ChatConvRef): ChatDenyReason | null {
  switch (actor.role) {
    case 'PARENT':
      return conv.parentId === actor.id ? null : 'NOT_PARTICIPANT'

    case 'TEACHER':
      if (conv.scope === 'ADMIN') return 'FINANCE_FOR_TEACHER'
      if (actor.kindergartenId && conv.kindergartenId !== actor.kindergartenId) {
        return 'OTHER_SCHOOL'
      }
      return conv.teacherId !== null && conv.teacherId === actor.id ? null : 'NOT_PARTICIPANT'

    case 'ADMIN':
    case 'SUPER_ADMIN':
      if (conv.scope !== 'ADMIN') return 'PRIVATE_FOR_ADMIN'
      // SUPER_ADMIN без школы — владелец платформы: канал администрации всех школ
      if (actor.kindergartenId && conv.kindergartenId !== actor.kindergartenId) {
        return 'OTHER_SCHOOL'
      }
      return null

    default:
      return 'ROLE'
  }
}

export function canAccessConversation(actor: ChatActor, conv: ChatConvRef): boolean {
  return chatDenyReason(actor, conv) === null
}
