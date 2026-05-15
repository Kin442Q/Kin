import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { TelegramLinkService } from './telegram-link.service'

interface ReminderDto {
  phones: string[]
  studentName: string
  amount: number
  daysLeft: number
  groupName?: string
  month?: string
}

interface PaymentNotificationDto {
  phones: string[]
  studentName: string
  groupName?: string
  amount: number
  paid: boolean
  month?: string
}

@ApiTags('telegram')
@Controller({ path: 'telegram', version: '1' })
export class TelegramLinkController {
  constructor(private readonly telegramLinkService: TelegramLinkService) {}

  @Post('send-reminders')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Отправить напоминания об оплате (по телефонам родителей)',
    description:
      'Принимает список { phones: [], studentName, amount, daysLeft }. Бекенд ищет chat_id по телефонам и отправляет.',
  })
  async sendReminders(@Body() body: { items: ReminderDto[] }) {
    return this.telegramLinkService.sendBulkReminders(body.items || [])
  }

  @Post('send-payment-confirmation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Отправить подтверждение оплаты родителям (по телефонам)',
  })
  async sendPaymentConfirmation(@Body() body: PaymentNotificationDto) {
    return this.telegramLinkService.sendPaymentConfirmation(body)
  }
}
