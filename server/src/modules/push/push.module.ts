import {
  Body,
  Controller,
  Global,
  Injectable,
  Logger,
  Module,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

export interface PushPayload {
  to: string
  title: string
  body: string
  /** Произвольные данные, попадают в notification.request.content.data в мобайле */
  data?: Record<string, unknown>
  /** Звук, по умолчанию default */
  sound?: 'default' | null
}

/**
 * Высокоуровневый сервис рассылки push через Expo Push API
 * (https://docs.expo.dev/push-notifications/sending-notifications/).
 *
 * - Не падает при ошибках сети — логирует и продолжает.
 * - Поддерживает массовую отправку: разбивает на батчи по 100 (лимит Expo).
 * - Игнорирует пустые токены.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name)
  private readonly endpoint =
    process.env.EXPO_PUSH_ENDPOINT ?? 'https://exp.host/--/api/v2/push/send'
  /** Дополнительный токен (если включён в Expo «push security») */
  private readonly accessToken = process.env.EXPO_ACCESS_TOKEN

  constructor(private readonly prisma: PrismaService) {}

  /** Отправить уведомление одному пользователю по id (если есть push-токен). */
  async sendToUser(userId: string, payload: Omit<PushPayload, 'to'>) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true, isActive: true },
    })
    if (!u || !u.isActive || !u.expoPushToken) return
    await this.send([{ ...payload, to: u.expoPushToken }])
  }

  /** Отправить нескольким пользователям сразу. */
  async sendToUsers(userIds: string[], payload: Omit<PushPayload, 'to'>) {
    if (!userIds.length) return
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, isActive: true, expoPushToken: { not: null } },
      select: { expoPushToken: true },
    })
    const messages = users
      .filter((u) => u.expoPushToken)
      .map((u) => ({ ...payload, to: u.expoPushToken as string }))
    if (!messages.length) return
    await this.send(messages)
  }

  /** Отправить родителям заданной группы. Учитель и админы не получают. */
  async sendToGroupParents(
    groupId: string,
    payload: Omit<PushPayload, 'to'>,
  ): Promise<void> {
    // Парент-аккаунты, у которых childId — ребёнок этой группы, или
    // которые M:N привязаны как parents к ребёнку этой группы.
    const students = await this.prisma.student.findMany({
      where: { groupId, status: 'ACTIVE' },
      select: {
        id: true,
        parents: {
          where: {
            isActive: true,
            expoPushToken: { not: null },
          },
          select: { expoPushToken: true },
        },
      },
    })
    const tokens = new Set<string>()
    for (const s of students) {
      for (const p of s.parents) if (p.expoPushToken) tokens.add(p.expoPushToken)
    }
    // Плюс родители через legacy childId
    const legacyParents = await this.prisma.user.findMany({
      where: {
        role: 'PARENT',
        isActive: true,
        expoPushToken: { not: null },
        child: { groupId },
      },
      select: { expoPushToken: true },
    })
    for (const p of legacyParents) if (p.expoPushToken) tokens.add(p.expoPushToken)

    if (!tokens.size) return
    await this.send([...tokens].map((to) => ({ ...payload, to })))
  }

  /** Отправить родителям конкретного ученика. */
  async sendToStudentParents(
    studentId: string,
    payload: Omit<PushPayload, 'to'>,
  ): Promise<void> {
    const tokens = new Set<string>()
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        parents: {
          where: { isActive: true, expoPushToken: { not: null } },
          select: { expoPushToken: true },
        },
      },
    })
    if (student) {
      for (const p of student.parents) {
        if (p.expoPushToken) tokens.add(p.expoPushToken)
      }
    }
    const legacy = await this.prisma.user.findMany({
      where: {
        role: 'PARENT',
        isActive: true,
        expoPushToken: { not: null },
        childId: studentId,
      },
      select: { expoPushToken: true },
    })
    for (const p of legacy) if (p.expoPushToken) tokens.add(p.expoPushToken)

    if (!tokens.size) return
    await this.send([...tokens].map((to) => ({ ...payload, to })))
  }

  /** Низкоуровневая отправка пачкой. Не пробрасывает ошибки наверх. */
  private async send(messages: PushPayload[]): Promise<void> {
    // Фильтруем «не Expo» токены — на всякий случай.
    const valid = messages.filter(
      (m) => m.to && (m.to.startsWith('ExponentPushToken[') || m.to.startsWith('ExpoPushToken[')),
    )
    if (!valid.length) return

    // Бьём на батчи по 100.
    for (let i = 0; i < valid.length; i += 100) {
      const batch = valid.slice(i, i + 100).map((m) => ({
        ...m,
        sound: m.sound ?? 'default',
      }))
      try {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            ...(this.accessToken
              ? { Authorization: `Bearer ${this.accessToken}` }
              : {}),
          },
          body: JSON.stringify(batch),
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          this.logger.warn(
            `Expo push HTTP ${res.status}: ${text.slice(0, 200)}`,
          )
        }
      } catch (e) {
        this.logger.warn(`Expo push failed: ${(e as Error).message}`)
      }
    }
  }
}

@ApiTags('push')
@ApiBearerAuth()
@Controller({ path: 'push', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'PARENT')
class PushController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Зарегистрировать Expo push-токен текущего пользователя',
  })
  async register(
    @CurrentUser() user: AuthUser,
    @Body() dto: { token: string },
  ) {
    if (!dto.token) return { ok: false }
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { expoPushToken: dto.token },
    })
    return { ok: true }
  }

  @Post('unregister')
  @ApiOperation({
    summary:
      'Удалить push-токен (например, при logout, чтобы не получать уведомления на другом устройстве)',
  })
  async unregister(@CurrentUser() user: AuthUser) {
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { expoPushToken: null },
    })
    return { ok: true }
  }
}

@Global()
@Module({
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
