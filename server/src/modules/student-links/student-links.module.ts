import { Module } from '@nestjs/common'

import { StudentLinkService } from './student-link.service'

/** Личные ссылки учеников. ConfigService глобальный, своих зависимостей нет. */
@Module({
  providers: [StudentLinkService],
  exports: [StudentLinkService],
})
export class StudentLinksModule {}
