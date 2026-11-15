import {
  canAccessConversation,
  chatDenyReason,
  type ChatActor,
  type ChatConvRef,
} from './chat-access'

const personal: ChatConvRef = {
  parentId: 'p1',
  teacherId: 'tA',
  scope: 'GENERAL',
  kindergartenId: 'k1',
}
const finance: ChatConvRef = { parentId: 'p1', teacherId: null, scope: 'ADMIN', kindergartenId: 'k1' }
const orphan: ChatConvRef = { ...personal, teacherId: null } // старая переписка без собеседника

const actor = (id: string, role: string, kindergartenId: string | null = 'k1'): ChatActor => ({
  id,
  role,
  kindergartenId,
})

describe('chat-access: правило видимости переписки', () => {
  describe('личная переписка (GENERAL)', () => {
    it('видят только родитель и учитель-собеседник', () => {
      expect(canAccessConversation(actor('p1', 'PARENT'), personal)).toBe(true)
      expect(canAccessConversation(actor('tA', 'TEACHER'), personal)).toBe(true)
    })

    it('другой учитель того же класса и школы — нет', () => {
      expect(chatDenyReason(actor('tB', 'TEACHER'), personal)).toBe('NOT_PARTICIPANT')
    })

    it('другой родитель — нет', () => {
      expect(chatDenyReason(actor('p2', 'PARENT'), personal)).toBe('NOT_PARTICIPANT')
    })

    it('директор и администратор — нет, даже своей школы', () => {
      expect(chatDenyReason(actor('dir', 'SUPER_ADMIN'), personal)).toBe('PRIVATE_FOR_ADMIN')
      expect(chatDenyReason(actor('adm', 'ADMIN'), personal)).toBe('PRIVATE_FOR_ADMIN')
    })

    it('владелец платформы (без школы) тоже не читает личные переписки', () => {
      expect(chatDenyReason(actor('owner', 'SUPER_ADMIN', null), personal)).toBe('PRIVATE_FOR_ADMIN')
    })

    it('учитель с тем же id из другой школы — нет', () => {
      expect(chatDenyReason(actor('tA', 'TEACHER', 'k2'), personal)).toBe('OTHER_SCHOOL')
    })

    it('старая переписка без собеседника не видна ни одному учителю', () => {
      expect(canAccessConversation(actor('tA', 'TEACHER'), orphan)).toBe(false)
      expect(canAccessConversation(actor('tB', 'TEACHER'), orphan)).toBe(false)
      // а родитель свою историю видит
      expect(canAccessConversation(actor('p1', 'PARENT'), orphan)).toBe(true)
    })
  })

  describe('канал с администрацией (ADMIN)', () => {
    it('видят родитель и администрация своей школы', () => {
      expect(canAccessConversation(actor('p1', 'PARENT'), finance)).toBe(true)
      expect(canAccessConversation(actor('adm', 'ADMIN'), finance)).toBe(true)
      expect(canAccessConversation(actor('dir', 'SUPER_ADMIN'), finance)).toBe(true)
    })

    it('учитель — нет, ни один', () => {
      expect(chatDenyReason(actor('tA', 'TEACHER'), finance)).toBe('FINANCE_FOR_TEACHER')
    })

    it('администрация другой школы — нет', () => {
      expect(chatDenyReason(actor('admX', 'ADMIN', 'k2'), finance)).toBe('OTHER_SCHOOL')
    })

    it('другой родитель — нет', () => {
      expect(canAccessConversation(actor('p2', 'PARENT'), finance)).toBe(false)
    })
  })

  describe('прочие роли', () => {
    it.each(['STUDENT', 'VIEWER', 'WHATEVER', ''])('%s — никогда', (role) => {
      expect(canAccessConversation(actor('u', role), personal)).toBe(false)
      expect(canAccessConversation(actor('u', role), finance)).toBe(false)
    })
  })
})
