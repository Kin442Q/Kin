import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'

interface AuthedSocket extends Socket {
  userId?: string
  role?: string
  kindergartenId?: string | null
  groupId?: string | null
}

/**
 * Realtime-чат через Socket.io.
 *
 * Подключение: клиент передаёт JWT в handshake.auth.token.
 * Комнаты:
 *   conv:<conversationId> — конкретная переписка (кто в ней сейчас)
 *   user:<userId>         — личная комната (для бейджей/списка)
 *
 * События ОТ сервера:
 *   message      — новое сообщение { conversationId, ...message }
 *   conversation — обновление переписки (для списка у сотрудника)
 */
@Injectable()
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  // тот же путь по умолчанию /socket.io
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name)

  @WebSocketServer()
  server!: Server

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        (client.handshake.headers.authorization || '').replace('Bearer ', '')
      if (!token) {
        client.disconnect()
        return
      }
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      })
      client.userId = payload.sub
      client.role = payload.role
      client.kindergartenId = payload.kindergartenId ?? null
      client.groupId = payload.groupId ?? null
      // личная комната — для списка/бейджей
      client.join(`user:${payload.sub}`)
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(_client: AuthedSocket) {
    // socket.io сам убирает из комнат
  }

  /** Клиент входит в комнату переписки (с проверкой доступа). */
  @SubscribeMessage('join')
  async onJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId || !data?.conversationId) return
    const conv = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
    })
    if (!conv) return
    // доступ: родитель-владелец, учитель группы, админ учреждения
    const ok =
      conv.parentId === client.userId ||
      (client.role === 'TEACHER' && conv.groupId === client.groupId) ||
      ((client.role === 'ADMIN' || client.role === 'SUPER_ADMIN') &&
        (!client.kindergartenId ||
          conv.kindergartenId === client.kindergartenId))
    if (ok) {
      client.join(`conv:${data.conversationId}`)
    }
  }

  @SubscribeMessage('leave')
  onLeave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) client.leave(`conv:${data.conversationId}`)
  }

  // ─── Вызывается из ChatService после сохранения сообщения ────────────

  emitMessage(conversationId: string, message: unknown) {
    this.server?.to(`conv:${conversationId}`).emit('message', message)
  }

  /** Уведомить пользователя об обновлении переписки (для списка/бейджа). */
  emitConversationUpdate(userId: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit('conversation', payload)
  }
}
