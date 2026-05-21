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
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { IsString, MaxLength, MinLength } from 'class-validator'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { PushService } from '../push/push.module'
import { ChatGateway } from './chat.gateway'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

class SendMessageDto {
  @IsString() @MinLength(1) @MaxLength(2000) text!: string
}

@Injectable()
class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly gateway: ChatGateway,
  ) {}

  // ─── Родитель ───────────────────────────────────────────────────────

  /**
   * Получить (или создать) переписку родителя. Привязывается к группе
   * его ребёнка (берём первого активного ребёнка).
   */
  async myConversation(user: AuthUser) {
    if (user.role !== 'PARENT') {
      throw new ForbiddenException('Только для родителя')
    }
    const kid = await this.prisma.student.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [
          { id: user.childId ?? '__none__' },
          { parents: { some: { id: user.sub } } },
        ],
      },
      select: { id: true, groupId: true, kindergartenId: true, group: { select: { name: true } } },
    })
    if (!kid) throw new NotFoundException('Нет привязанного ребёнка')

    const conv = await this.prisma.conversation.upsert({
      where: { groupId_parentId: { groupId: kid.groupId, parentId: user.sub } },
      create: {
        groupId: kid.groupId,
        parentId: user.sub,
        kindergartenId: kid.kindergartenId,
      },
      update: {},
    })

    const messages = await this.prisma.message.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, fullName: true, role: true } } },
    })

    // Помечаем прочитанным родителем
    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: { parentReadAt: new Date() },
    })

    return { conversation: { ...conv, groupName: kid.group?.name }, messages }
  }

  // ─── Учитель / админ ────────────────────────────────────────────────

  /** Список переписок: учитель — своей группы, админ — всего учреждения. */
  async listConversations(user: AuthUser) {
    if (user.role === 'PARENT') throw new ForbiddenException()

    const where: Record<string, unknown> = {}
    if (user.role === 'TEACHER') {
      if (!user.groupId) return []
      where.groupId = user.groupId
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

  /** Родитель пишет в свою переписку. */
  async parentSend(user: AuthUser, text: string) {
    const { conversation } = await this.myConversation(user)
    return this.send(user, conversation.id, text)
  }

  /** Сотрудник пишет в переписку. */
  async staffSend(user: AuthUser, conversationId: string, text: string) {
    await this.assertStaffAccess(user, conversationId)
    return this.send(user, conversationId, text)
  }

  private async send(user: AuthUser, conversationId: string, text: string) {
    const t = text.trim()
    if (!t) throw new BadRequestException('Пустое сообщение')

    const msg = await this.prisma.message.create({
      data: { conversationId, senderId: user.sub, text: t },
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
      // уведомляем учителей группы + админов учреждения
      this.notifyStaff(conv.groupId, conv.kindergartenId, user.sub, t).catch(() => {})
    } else {
      this.push
        .sendToUser(conv.parentId, {
          title: `Сообщение от ${msg.sender.fullName}`,
          body: t.slice(0, 120),
          data: { kind: 'chat', conversationId },
        })
        .catch(() => {})
    }

    return msg
  }

  private async notifyStaff(
    groupId: string,
    kindergartenId: string | null,
    senderId: string,
    text: string,
  ) {
    const staff = await this.prisma.user.findMany({
      where: {
        isActive: true,
        expoPushToken: { not: null },
        id: { not: senderId },
        OR: [
          { role: 'TEACHER', groupId },
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
    if (user.role === 'TEACHER' && conv.groupId !== user.groupId) {
      throw new ForbiddenException('Не ваша группа')
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
  @ApiOperation({ summary: 'Переписка родителя (создаётся автоматически)' })
  my(@CurrentUser() user: AuthUser) {
    return this.service.myConversation(user)
  }

  @Post('my/messages')
  @Roles('PARENT')
  parentSend(@CurrentUser() user: AuthUser, @Body() dto: SendMessageDto) {
    return this.service.parentSend(user, dto.text)
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
