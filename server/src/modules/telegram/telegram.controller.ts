import { Controller, Logger } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { TelegramService } from './telegram.service'

/**
 * Telegram контроллер для отправки уведомлений об оплате
 * На текущий момент используется только для отправки уведомлений,
 * не для приема сообщений
 */
@ApiTags('telegram')
@Controller({ path: 'telegram', version: '1' })
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name)

  constructor(private readonly telegram: TelegramService) {}

  // Контроллер создан для возможного расширения в будущем
  // Сейчас используется только сервис для отправки уведомлений
}
