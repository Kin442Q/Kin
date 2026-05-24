import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { IsString, MaxLength, MinLength } from 'class-validator'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { PushService } from '../push/push.module'
import { TelegramModule } from '../telegram/telegram.module'
import { TelegramLinkService } from '../telegram/telegram-link.service'
import { ChatGateway } from './chat.gateway'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

class SendMessageDto {
  @IsString() @MinLength(1) @MaxLength(2000) text!: string
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly gateway: ChatGateway,
    private readonly telegram: TelegramLinkService,
  ) {}

  /** Все классы, которые ведёт учитель: основная группа + M:N teachingGroups. */
  private async teacherGroupIds(user: AuthUser): Promise<string[]> {
    const me = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { groupId: true, teachingGroups: { select: { id: true } } },
    })
    return Array.from(
      new Set(
        [me?.groupId, ...(me?.teachingGroups.map((g) => g.id) ?? [])].filter(
          (x): x is string => !!x,
        ),
      ),
    )
  }

  // ─── Родитель ───────────────────────────────────────────────────────

  /**
   * Получить (или создать) переписку родителя в заданном канале.
   *   GENERAL — с учителем; ADMIN — с администрацией (финансы).
   */
  async myConversation(user: AuthUser, scope: 'GENERAL' | 'ADMIN' = 'GENERAL') {
    if (user.role !== 'PARENT') {
      throw new ForbiddenException('Только для родителя')
    }
    // Доступ к ребёнку как в ParentService.ensureKidAccess — БЕЗ строгого
    // фильтра status, иначе чат 404-ит на детях, которых остальной кабинет
    // родителя (today/payments/...) показывает. Активных предпочитаем.
    const kid = await this.prisma.student.findFirst({
      where: {
        OR: [
          { id: user.childId ?? '__none__' },
          { parents: { some: { id: user.sub } } },
        ],
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, groupId: true, kindergartenId: true, group: { select: { name: true } } },
    })
    if (!kid) throw new NotFoundException('Нет привязанного ребёнка')
    if (!kid.groupId) {
      throw new BadRequestException('Ребёнок не закреплён за группой — чат недоступен')
    }

    const conv = await this.prisma.conversation.upsert({
      where: {
        groupId_parentId_scope: {
          groupId: kid.groupId,
          parentId: user.sub,
          scope,
        },
      },
      create: {
        groupId: kid.groupId,
        parentId: user.sub,
        scope,
        kindergartenId: kid.kindergartenId,
      },
      update: {},
    })

    const messages = await this.prisma.message.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, fullName: true, role: true } } },
    })

    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: { parentReadAt: new Date() },
    })

    return { conversation: { ...conv, groupName: kid.group?.name }, messages }
  }

  // ─── Учитель / админ ────────────────────────────────────────────────

  /**
   * Список переписок.
   *   TEACHER — только GENERAL своей группы (финансы не видит).
   *   ADMIN — все переписки учреждения (оба канала).
   */
  async listConversations(user: AuthUser) {
    if (user.role === 'PARENT') throw new ForbiddenException()

    const where: Record<string, unknown> = {}
    if (user.role === 'TEACHER') {
      const allowed = await this.teacherGroupIds(user)
      if (allowed.length === 0) return []
      where.groupId = { in: allowed } // все классы, которые ведёт учитель
      where.scope = 'GENERAL' // учитель НЕ видит финансовый канал
    } else if (user.kindergartenId) {
      where.kindergartenId = user.kindergartenId
    }

    const convs = await this.prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        parent: { select: { id: true, fullName: true } },
        group: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    return convs.map((c) => {
      const last = c.messages[0]
      const unread = !!(
        last &&
        last.senderId !== user.sub &&
        (!c.staffReadAt || c.staffReadAt < last.createdAt)
      )
      return {
        id: c.id,
        parentId: c.parentId,
        parentName: c.parent.fullName,
        groupId: c.groupId,
        groupName: c.group.name,
        scope: c.scope,
        lastMessageAt: c.lastMessageAt,
        lastText: last?.text ?? null,
        unread,
      }
    })
  }

  /** Сообщения конкретной переписки (для сотрудника). */
  async conversationMessages(user: AuthUser, conversationId: string) {
    const conv = await this.assertStaffAccess(user, conversationId)
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, fullName: true, role: true } } },
    })
    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: { staffReadAt: new Date() },
    })
    return { conversation: conv, messages }
  }

  // ─── Отправка ───────────────────────────────────────────────────────

  /** Родитель пишет в свою переписку (канал по умолчанию — учитель). */
  async parentSend(user: AuthUser, text: string, scope: 'GENERAL' | 'ADMIN' = 'GENERAL') {
    const { conversation } = await this.myConversation(user, scope)
    return this.send(user, conversation.id, text)
  }

  /** Сотрудник пишет в переписку. */
  async staffSend(user: AuthUser, conversationId: string, text: string) {
    await this.assertStaffAccess(user, conversationId)
    return this.send(user, conversationId, text)
  }

  /**
   * Напоминание об оплате — ТОЛЬКО админ. Уходит в ADMIN-канал родителя
   * (учитель его не видит). Создаёт канал при необходимости.
   */
  async paymentReminder(
    user: AuthUser,
    studentId: string,
    month: string,
    amount: number,
  ) {
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Напоминание об оплате может отправить только администратор')
    }
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        firstName: true,
        groupId: true,
        kindergartenId: true,
        parents: { select: { id: true } },
        // через childId-legacy
      },
    })
    if (!student) throw new NotFoundException('Ученик не найден')
    if (user.kindergartenId && student.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Ученик из другого учреждения')
    }

    // Все привязанные родители (M:N) + legacy childId
    const legacy = await this.prisma.user.findMany({
      where: { role: 'PARENT', childId: studentId },
      select: { id: true },
    })
    const parentIds = Array.from(
      new Set([...student.parents.map((p) => p.id), ...legacy.map((l) => l.id)]),
    )
    if (parentIds.length === 0) {
      throw new BadRequestException('У ученика нет родительских аккаунтов')
    }

    const text = `💰 Напоминание об оплате за ${month}: ${Math.round(amount).toLocaleString('ru-RU')} сом. Просьба оплатить.`

    let sent = 0
    for (const parentId of parentIds) {
      const conv = await this.prisma.conversation.upsert({
        where: {
          groupId_parentId_scope: {
            groupId: student.groupId,
            parentId,
            scope: 'ADMIN',
          },
        },
        create: {
          groupId: student.groupId,
          parentId,
          scope: 'ADMIN',
          kindergartenId: student.kindergartenId,
        },
        update: {},
      })
      await this.send(user, conv.id, text, 'PAYMENT')
      sent++
    }
    return { sent }
  }

  private async send(
    user: AuthUser,
    conversationId: string,
    text: string,
    kind: 'TEXT' | 'PAYMENT' = 'TEXT',
  ) {
    const t = text.trim()
    if (!t) throw new BadRequestException('Пустое сообщение')

    const msg = await this.prisma.message.create({
      data: { conversationId, senderId: user.sub, text: t, kind },
      include: { sender: { select: { id: true, fullName: true, role: true } } },
    })
    const conv = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        // отправитель «прочитал» свою сторону
        ...(user.role === 'PARENT'
          ? { parentReadAt: new Date() }
          : { staffReadAt: new Date() }),
      },
    })

    // Realtime: рассылаем сообщение всем в комнате переписки
    this.gateway.emitMessage(conversationId, msg)
    // и обновление списка другой стороне (бейдж/последнее сообщение)
    this.gateway.emitConversationUpdate(conv.parentId, {
      conversationId,
      lastText: t,
      lastMessageAt: conv.lastMessageAt,
    })

    // Push другой стороне
    if (user.role === 'PARENT') {
      // В ADMIN-канале уведомляем только админов (учителя финансы не видят).
      this.notifyStaff(conv.groupId, conv.kindergartenId, user.sub, t, conv.scope).catch(() => {})
    } else {
      // Сотрудник → родитель: пуш в приложение + мгновенное уведомление в Telegram
      // (как напоминания об оплате), чтобы родитель увидел сразу, даже без приложения.
      this.push
        .sendToUser(conv.parentId, {
          title: `Сообщение от ${msg.sender.fullName}`,
          body: t.slice(0, 120),
          data: { kind: 'chat', conversationId },
        })
        .catch(() => {})

      const tgText =
        kind === 'PAYMENT' ? t : `💬 ${msg.sender.fullName}:\n${t}`
      this.parentPhones(conv.parentId)
        .then((phones) => this.telegram.notifyByPhones(phones, tgText))
        .catch(() => {})
    }

    return msg
  }

  /** Телефоны родителя для Telegram: личный + телефоны его детей. */
  private async parentPhones(parentId: string): Promise<string[]> {
    const [parent, kids] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: parentId },
        select: { phone: true, childId: true },
      }),
      this.prisma.student.findMany({
        where: { parents: { some: { id: parentId } } },
        select: { motherPhone: true, fatherPhone: true },
      }),
    ])
    const legacyKid = parent?.childId
      ? await this.prisma.student.findUnique({
          where: { id: parent.childId },
          select: { motherPhone: true, fatherPhone: true },
        })
      : null
    return [
      parent?.phone,
      ...kids.flatMap((k) => [k.motherPhone, k.fatherPhone]),
      legacyKid?.motherPhone,
      legacyKid?.fatherPhone,
    ].filter((p): p is string => !!p)
  }

  private async notifyStaff(
    groupId: string,
    kindergartenId: string | null,
    senderId: string,
    text: string,
    scope: 'GENERAL' | 'ADMIN',
  ) {
    const staff = await this.prisma.user.findMany({
      where: {
        isActive: true,
        expoPushToken: { not: null },
        id: { not: senderId },
        OR: [
          // Учителя получают уведомления только в общем канале
          ...(scope === 'GENERAL'
            ? [{ role: 'TEACHER' as const, groupId }]
            : []),
          ...(kindergartenId
            ? [{ role: 'ADMIN' as const, kindergartenId }]
            : []),
        ],
      },
      select: { id: true },
    })
    await this.push.sendToUsers(
      staff.map((s) => s.id),
      {
        title: 'Новое сообщение от родителя',
        body: text.slice(0, 120),
        data: { kind: 'chat', groupId },
      },
    )
  }

  private async assertStaffAccess(user: AuthUser, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        parent: { select: { id: true, fullName: true } },
        group: { select: { id: true, name: true } },
      },
    })
    if (!conv) throw new NotFoundException('Переписка не найдена')
    // Учитель не имеет доступа к финансовому (ADMIN) каналу
    if (user.role === 'TEACHER' && conv.scope === 'ADMIN') {
      throw new ForbiddenException('Финансовый канал доступен только администрации')
    }
    if (
      user.role === 'TEACHER' &&
      !(await this.teacherGroupIds(user)).includes(conv.groupId)
    ) {
      throw new ForbiddenException('Не ваш класс')
    }
    if (
      (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') &&
      user.kindergartenId &&
      conv.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Из другого учреждения')
    }
    return conv
  }
}

@ApiTags('chat')
@ApiBearerAuth()
@Controller({ path: 'chat', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'PARENT')
class ChatController {
  constructor(private readonly service: ChatService) {}

  @Get('my')
  @ApiOperation({
    summary:
      'Переписка родителя. scope=GENERAL (учитель) | ADMIN (администрация/оплата)',
  })
  my(
    @CurrentUser() user: AuthUser,
    @Query('scope') scope?: 'GENERAL' | 'ADMIN',
  ) {
    return this.service.myConversation(
      user,
      scope === 'ADMIN' ? 'ADMIN' : 'GENERAL',
    )
  }

  @Post('my/messages')
  @Roles('PARENT')
  parentSend(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendMessageDto & { scope?: 'GENERAL' | 'ADMIN' },
  ) {
    return this.service.parentSend(
      user,
      dto.text,
      dto.scope === 'ADMIN' ? 'ADMIN' : 'GENERAL',
    )
  }

  @Post('payment-reminder')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({
    summary: 'Отправить родителю напоминание об оплате в финансовый канал',
  })
  paymentReminder(
    @CurrentUser() user: AuthUser,
    @Body() dto: { studentId: string; month: string; amount: number },
  ) {
    return this.service.paymentReminder(user, dto.studentId, dto.month, dto.amount)
  }

  @Get('conversations')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  list(@CurrentUser() user: AuthUser) {
    return this.service.listConversations(user)
  }

  @Get('conversations/:id/messages')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  messages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.conversationMessages(user, id)
  }

  @Post('conversations/:id/messages')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  staffSend(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.staffSend(user, id, dto.text)
  }
}

@Module({
  imports: [
    ConfigModule,
    TelegramModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
      }),
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
