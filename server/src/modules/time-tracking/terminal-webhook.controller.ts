import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Get,
  Param,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator'
import { randomBytes } from 'crypto'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

// ─── DTO ────────────────────────────────────────────────────────────

class WebhookEventBody {
  @IsString() employeeCode!: string
  @IsOptional() @IsDateString() eventTime?: string
  /**
   * Тип события. Если 'auto' — система сама определит:
   * если есть открытая смена → check-out, иначе → check-in.
   */
  @IsOptional() @IsIn(['check-in', 'check-out', 'auto']) eventType?:
    | 'check-in'
    | 'check-out'
    | 'auto'
  @IsOptional() @IsString() deviceId?: string
  @IsOptional() @IsString() note?: string
}

class SetTeacherCodeBody {
  @IsOptional() @IsString() terminalCode?: string | null
}

// ─── Controller ─────────────────────────────────────────────────────

@ApiTags('time-tracking-terminal')
@Controller({ path: 'time/terminal', version: '1' })
export class TerminalWebhookController {
  private readonly logger = new Logger(TerminalWebhookController.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Webhook от внешнего терминала (Hikvision/ZKTeco/etc).
   * Аутентификация — через заголовок X-Terminal-Api-Key, который
   * сопоставляется с Kindergarten.terminalApiKey.
   *
   * Пример вызова от Hikvision:
   * POST /api/v1/time/terminal/webhook
   * X-Terminal-Api-Key: kg_xxxxx
   * { "employeeCode": "T001", "eventType": "auto", "eventTime": "2026-05-17T08:05:00Z" }
   */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Webhook от внешнего терминала контроля доступа',
  })
  async webhook(
    @Headers('x-terminal-api-key') apiKey: string | undefined,
    @Body() body: WebhookEventBody,
  ) {
    if (!apiKey) {
      throw new UnauthorizedException('Заголовок X-Terminal-Api-Key обязателен')
    }
    if (!body.employeeCode) {
      throw new BadRequestException('employeeCode обязателен')
    }

    // Находим садик по ключу
    const kindergarten = await this.prisma.kindergarten.findUnique({
      where: { terminalApiKey: apiKey },
    })
    if (!kindergarten) {
      throw new UnauthorizedException('Неверный API-ключ терминала')
    }

    // Находим учителя по коду (только в этом садике)
    const user = await this.prisma.user.findFirst({
      where: {
        terminalCode: body.employeeCode,
        kindergartenId: kindergarten.id,
      },
    })
    if (!user) {
      throw new NotFoundException(
        `Сотрудник с кодом ${body.employeeCode} не найден в саду ${kindergarten.name}`,
      )
    }
    if (user.role !== 'TEACHER' && user.role !== 'ADMIN') {
      throw new BadRequestException('Этот пользователь не учитель/админ')
    }

    const eventTime = body.eventTime ? new Date(body.eventTime) : new Date()
    if (Number.isNaN(eventTime.getTime())) {
      throw new BadRequestException('eventTime должен быть валидной датой')
    }

    // Определяем тип события
    const openEntry = await this.prisma.timeEntry.findFirst({
      where: { userId: user.id, checkOut: null },
      orderBy: { checkIn: 'desc' },
    })

    let action: 'check-in' | 'check-out'
    if (body.eventType === 'auto' || !body.eventType) {
      action = openEntry ? 'check-out' : 'check-in'
    } else {
      action = body.eventType
    }

    // Выполняем действие
    if (action === 'check-in') {
      if (openEntry) {
        // У учителя уже есть открытая смена — игнорируем (терминал мог сработать дважды)
        this.logger.warn(
          `[terminal] ${user.fullName} уже на работе, игнорируем повторный check-in`,
        )
        return {
          success: true,
          action: 'ignored',
          reason: 'already-checked-in',
          entry: openEntry,
        }
      }

      const date = startOfDay(eventTime)
      const entry = await this.prisma.timeEntry.create({
        data: {
          userId: user.id,
          date,
          checkIn: eventTime,
          verifyMethod: 'TERMINAL',
          note: body.note ?? null,
        },
      })

      this.logger.log(
        `[terminal] CHECK-IN: ${user.fullName} (${body.employeeCode}) в ${eventTime.toISOString()}`,
      )
      return { success: true, action: 'check-in', entry }
    }

    // check-out
    if (!openEntry) {
      throw new ConflictException(
        `Нет открытой смены для ${user.fullName} — невозможно отметить уход`,
      )
    }

    const minutes = Math.max(
      0,
      Math.floor((eventTime.getTime() - openEntry.checkIn.getTime()) / 60000),
    )

    const updated = await this.prisma.timeEntry.update({
      where: { id: openEntry.id },
      data: {
        checkOut: eventTime,
        minutesWorked: minutes,
        verifyMethod: 'TERMINAL', // помечаем что закрыто терминалом
      },
    })

    this.logger.log(
      `[terminal] CHECK-OUT: ${user.fullName} (${body.employeeCode}) в ${eventTime.toISOString()} (${minutes}м)`,
    )
    return { success: true, action: 'check-out', entry: updated }
  }
}

// ─── Управление настройками терминала (только админ) ───────────────

@ApiTags('time-tracking-terminal')
@ApiBearerAuth()
@Controller({ path: 'time/terminal/settings', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class TerminalSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Получить настройки терминала текущего садика (API ключ, инструкция).
   */
  @Get()
  @ApiOperation({ summary: 'Настройки терминала садика' })
  async getSettings(@CurrentUser() user: AuthUser) {
    if (!user.kindergartenId) {
      throw new BadRequestException('Не привязаны к садику')
    }
    const kg = await this.prisma.kindergarten.findUnique({
      where: { id: user.kindergartenId },
      select: { id: true, name: true, terminalApiKey: true },
    })
    if (!kg) throw new NotFoundException('Садик не найден')

    return {
      kindergartenId: kg.id,
      kindergartenName: kg.name,
      hasApiKey: !!kg.terminalApiKey,
      apiKey: kg.terminalApiKey,
      webhookUrl: '/api/v1/time/terminal/webhook',
    }
  }

  /**
   * Сгенерировать новый API ключ (или обновить существующий).
   */
  @Post('regenerate')
  @ApiOperation({ summary: 'Сгенерировать новый terminalApiKey' })
  async regenerate(@CurrentUser() user: AuthUser) {
    if (!user.kindergartenId) {
      throw new BadRequestException('Не привязаны к садику')
    }
    const apiKey = `kg_${randomBytes(24).toString('hex')}`
    const updated = await this.prisma.kindergarten.update({
      where: { id: user.kindergartenId },
      data: { terminalApiKey: apiKey },
      select: { terminalApiKey: true },
    })
    return { apiKey: updated.terminalApiKey }
  }

  /**
   * Отключить терминал (стереть API ключ).
   */
  @Post('disable')
  @ApiOperation({ summary: 'Отключить webhook терминала' })
  async disable(@CurrentUser() user: AuthUser) {
    if (!user.kindergartenId) {
      throw new BadRequestException('Не привязаны к садику')
    }
    await this.prisma.kindergarten.update({
      where: { id: user.kindergartenId },
      data: { terminalApiKey: null },
    })
    return { success: true }
  }

  /**
   * Привязать учителю код сотрудника на терминале.
   */
  @Post('teacher/:id/code')
  @ApiOperation({ summary: 'Установить terminalCode для учителя' })
  async setTeacherCode(
    @CurrentUser() user: AuthUser,
    @Param('id') teacherId: string,
    @Body() dto: SetTeacherCodeBody,
  ) {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
    })
    if (!teacher) throw new NotFoundException('Учитель не найден')
    if (
      user.kindergartenId &&
      teacher.kindergartenId !== user.kindergartenId
    ) {
      throw new BadRequestException('Учитель из другого садика')
    }

    return this.prisma.user.update({
      where: { id: teacherId },
      data: { terminalCode: dto.terminalCode || null },
      select: { id: true, fullName: true, terminalCode: true },
    })
  }
}

// ─── helpers ──────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const result = new Date(d)
  result.setHours(0, 0, 0, 0)
  return result
}
