import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { makeStudentToken, parseStudentToken, verifyStudentToken } from './student-link'

/**
 * Личные ссылки учеников: сборка URL и проверка подписи. Секрет — отдельная
 * переменная STUDENT_LINK_SECRET; не задана — берётся производная от секрета
 * refresh-токенов. Смена секрета гасит ВСЕ ссылки (их придётся выдать заново).
 */
@Injectable()
export class StudentLinkService {
  constructor(private readonly config: ConfigService) {}

  private secret(): string {
    return (
      this.config.get<string>('jwt.studentLinkSecret') ||
      `${this.config.get<string>('jwt.refreshSecret')}:student-link`
    )
  }

  token(userId: string, version: number): string {
    return makeStudentToken(this.secret(), userId, version)
  }

  /** Полная ссылка для ученика: `${APP_URL}/s/<токен>`. */
  link(userId: string, version: number): string {
    const base = this.config.get<string>('mail.appUrl') || 'https://tahlilgar.cyou'
    return `${base}/s/${this.token(userId, version)}`
  }

  parse(token: string) {
    return parseStudentToken(token)
  }

  verify(token: string, version: number | null | undefined): boolean {
    return verifyStudentToken(this.secret(), token, version)
  }
}
