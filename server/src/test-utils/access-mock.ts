/// <reference types="jest" />
/**
 * Мок AccessService для unit-тестов сервисов, которые выдают доступ новым людям.
 * По умолчанию письмо-приглашение «ушло». Пароль никто не вводит и не видит.
 */

export interface AccessMock {
  newSecret: jest.Mock
  deliver: jest.Mock
  sendLink: jest.Mock
}

export const SECRET_HASH = 'secret-hash'

export function createAccessMock(): AccessMock {
  return {
    newSecret: jest.fn().mockResolvedValue({ hash: SECRET_HASH }),
    deliver: jest.fn().mockImplementation(async (account: { email: string }) => ({ sent: true, email: account.email })),
    sendLink: jest.fn(),
  }
}
