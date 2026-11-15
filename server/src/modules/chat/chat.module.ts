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
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { PushService } from '../push/push.module'
import { TelegramModule } from '../telegram/telegram.module'
import { TelegramLinkService } from '../telegram/telegram-link.service'
import { ChatGateway } from './chat.gateway'
import { chatDenyReason, type ChatDenyReason } from './chat-access'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'
import { Feature } from '../../common/decorators/feature.decorator'

type Scope = 'GENERAL' | 'ADMIN'

class SendMessageDto {
  @IsString() @MinLength(1) @MaxLength(2000) text!: string
}

class ParentSendDto extends SendMessageDto {
  @IsOptional() @IsIn(['GENERAL', 'ADMIN']) scope?: Scope
  /** Кому из учителей класса пишет родитель (канал GENERAL). */
  @IsOptional() @IsString() teacherId?: string
}

/** Учитель класса, которому родитель может написать. */
interface ClassTeacher {
  id: string
  fullName: string
  isHomeroom: boolean
  subjects: string[]
}

const DENY_TEXT: Record<ChatDenyReason, string> = {
  FINANCE_FOR_TEACHER: 'Финансовый канал доступен только администрации',
  PRIVATE_FOR_ADMIN: 'Личная переписка учителя с родителем администрации недоступна',
  NOT_PARTICIPANT: 'Это не ваша переписка',
  OTHER_SCHOOL: 'Из другого учреждения',
  ROLE: 'Нет доступа к переписке',
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly gateway: ChatGateway,
    private readonly telegram: TelegramLinkService,
  ) {}

  // ─── Общие помощники ────────────────────────────────────────────────

  /**
   * Найти переписку или создать. Ключ: (класс, родитель, канал, учитель).
   * Для канала ADMIN teacherId = null — единственность держит частичный индекс,
   * для GENERAL — обычный уникальный. Гонку двух запросов разрешаем повторным поиском.
   */
  private async findOrCreateConversation(key: {
    groupId: string
    parentId: string
    scope: Scope
    teacherId: string | null
    kindergartenId: string | null
  }) {
    const where = {
      groupId: key.groupId,
      parentId: key.parentId,
      scope: key.scope,
      teacherId: key.teacherId,
    }
    const found = await this.prisma.conversation.findFirst({ where })
    if (found) return found
    try {
      return await this.prisma.conversation.create({
        data: { ...where, kindergartenId: key.kindergartenId },
      })
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') {
        const again = await this.prisma.conversation.findFirst({ where })
        if (again) return again
      }
      throw e
    }
  }

  /** Условие выборки переписок для сотрудника. null — этой роли список не положен. */
  private staffWhere(user: AuthUser): Record<string, unknown> | null {
    const school = user.kindergartenId ? { kindergartenId: user.kindergartenId } : {}
    if (user.role === 'TEACHER') {
      // Личные переписки: только те, где собеседник — сам учитель. Не «класс», а «пара».
      return { scope: 'GENERAL', teacherId: user.sub, ...school }
    }
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      // Администрация видит ТОЛЬКО финансовый канал.
      // Личные переписки учитель↔родитель (GENERAL) ей недоступны.
      return { scope: 'ADMIN', ...school }
    }
    return null
  }

  private unreadForStaff(
    user: AuthUser,
    c: { staffReadAt: Date | null; messages: Array<{ senderId: string; createdAt: Date }> },
  ) {
    const last = c.messages[0]
    return !!(
      last &&
      last.senderId !== user.sub &&
      (!c.staffReadAt || c.staffReadAt < last.createdAt)
    )
  }

  // ─── Родитель ───────────────────────────────────────────────────────

  /**
   * Ребёнок родителя и его класс. Доступ к ребёнку как в ParentService.ensureKidAccess —
   * БЕЗ строгого фильтра status, иначе чат 404-ит на детях, которых остальной кабинет
   * родителя (today/payments/...) показывает. Активных предпочитаем.
   */
  private async parentKid(user: AuthUser) {
    if (user.role !== 'PARENT') {
      throw new ForbiddenException('Только для родителя')
    }
    const kid = await this.prisma.student.findFirst({
      where: {
        OR: [
          { id: user.childId ?? '__none__' },
          { parents: { some: { id: user.sub } } },
        ],
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        groupId: true,
        kindergartenId: true,
        group: { select: { name: true, homeroomTeacherId: true } },
      },
    })
    if (!kid) throw new NotFoundException('Нет привязанного ребёнка')
    if (!kid.groupId) {
      throw new BadRequestException('Ребёнок не закреплён за группой — чат недоступен')
    }
    return { ...kid, groupId: kid.groupId }
  }

  /**
   * Учителя, которым родитель может написать: активные учителя школы, которые ведут класс
   * ребёнка (основная группа, M:N «ведёт классы» или классный руководитель).
   * Классный руководитель — первым, остальные по алфавиту.
   */
  private async classTeachers(kid: {
    groupId: string
    kindergartenId: string | null
    group: { homeroomTeacherId: string | null } | null
  }): Promise<ClassTeacher[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        role: 'TEACHER',
        isActive: true,
        ...(kid.kindergartenId ? { kindergartenId: kid.kindergartenId } : {}),
        OR: [
          { groupId: kid.groupId },
          { teachingGroups: { some: { id: kid.groupId } } },
          { homeroomGroups: { some: { id: kid.groupId } } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        teachingSubjects: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    })
    const homeroomId = kid.group?.homeroomTeacherId ?? null
    const teachers = rows.map((t) => ({
      id: t.id,
      fullName: t.fullName,
      isHomeroom: t.id === homeroomId,
      subjects: (t.teachingSubjects ?? []).map((s) => s.name),
    }))
    return [...teachers.filter((t) => t.isHomeroom), ...teachers.filter((t) => !t.isHomeroom)]
  }

  /**
   * С кем родитель пишет по умолчанию (старые клиенты не передают teacherId):
   * с тем, с кем переписка активнее всего шла, иначе классный руководитель, иначе первый.
   */
  private defaultTeacherId(
    teachers: ClassTeacher[],
    convs: Array<{ teacherId: string | null; lastMessageAt: Date; messages: unknown[] }>,
  ): string | null {
    const ids = new Set(teachers.map((t) => t.id))
    const recent = convs
      .filter((c) => c.teacherId && ids.has(c.teacherId) && c.messages.length > 0)
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())[0]
    return recent?.teacherId ?? teachers[0]?.id ?? null
  }

  /** Переписки родителя с учителями этого класса (+ последнее сообщение) — для выбора и бейджей. */
  private async parentTeacherConversations(
    parentId: string,
    groupId: string,
    teacherIds: string[],
  ) {
    if (teacherIds.length === 0) return []
    return this.prisma.conversation.findMany({
      where: { parentId, groupId, scope: 'GENERAL', teacherId: { in: teacherIds } },
      select: {
        teacherId: true,
        lastMessageAt: true,
        parentReadAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { senderId: true, createdAt: true },
        },
      },
    })
  }

  /** Учителя класса ребёнка для выбора в чате родителя. */
  async myTeachers(user: AuthUser) {
    const kid = await this.parentKid(user)
    const teachers = await this.classTeachers(kid)
    const convs = await this.parentTeacherConversations(
      user.sub,
      kid.groupId,
      teachers.map((t) => t.id),
    )
    const byTeacher = new Map(convs.map((c) => [c.teacherId, c]))
    return {
      groupName: kid.group?.name ?? null,
      defaultTeacherId: this.defaultTeacherId(teachers, convs),
      teachers: teachers.map((t) => {
        const c = byTeacher.get(t.id)
        const last = c?.messages[0]
        return {
          ...t,
          lastMessageAt: last ? c!.lastMessageAt : null,
          unread: !!(
            last &&
            last.senderId !== user.sub &&
            (!c!.parentReadAt || c!.parentReadAt < last.createdAt)
          ),
        }
      }),
    }
  }

  /** Находит (создаёт) переписку родителя: с администрацией или с выбранным учителем. */
  private async parentConversation(user: AuthUser, scope: Scope, teacherId?: string) {
    const kid = await this.parentKid(user)
    const base = {
      groupId: kid.groupId,
      parentId: user.sub,
      kindergartenId: kid.kindergartenId,
    }

    if (scope === 'ADMIN') {
      const conv = await this.findOrCreateConversation({ ...base, scope, teacherId: null })
      return { conv, kid, teacher: null as ClassTeacher | null }
    }

    const teachers = await this.classTeachers(kid)
    if (teachers.length === 0) {
      throw new BadRequestException('У класса нет учителей — чат недоступен')
    }
    let teacher: ClassTeacher | undefined
    if (teacherId) {
      teacher = teachers.find((t) => t.id === teacherId)
      // Писать можно только учителю своего класса — не любому учителю школы.
      if (!teacher) throw new ForbiddenException('Этот учитель не ведёт класс вашего ребёнка')
    } else {
      const convs = await this.parentTeacherConversations(
        user.sub,
        kid.groupId,
        teachers.map((t) => t.id),
      )
      const id = this.defaultTeacherId(teachers, convs)
      teacher = teachers.find((t) => t.id === id)
    }
    const conv = await this.findOrCreateConversation({
      ...base,
      scope,
      teacherId: teacher!.id,
    })
    return { conv, kid, teacher: teacher! }
  }

  /**
   * Получить (или создать) переписку родителя в заданном канале.
   *   GENERAL — личная, с одним учителем класса (teacherId; без него — по умолчанию);
   *   ADMIN   — с администрацией (финансы).
   */
  async myConversation(user: AuthUser, scope: Scope = 'GENERAL', teacherId?: string) {
    const { conv, kid, teacher } = await this.parentConversation(user, scope, teacherId)

    const messages = await this.prisma.message.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, fullName: true, role: true } } },
    })

    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: { parentReadAt: new Date() },
    })

    return {
      conversation: {
        ...conv,
        groupName: kid.group?.name,
        teacherName: teacher?.fullName ?? null,
      },
      messages,
    }
  }

  // ─── Учитель / админ ────────────────────────────────────────────────

  /**
   * Список переписок.
   *   TEACHER — только свои личные переписки с родителями (где он собеседник), и только
   *             начатые (хотя бы одно сообщение). Переписки коллег по классу не видит.
   *   ADMIN — только финансовый канал своей школы.
   */
  async listConversations(user: AuthUser) {
    if (user.role === 'PARENT') throw new ForbiddenException()
    const where = this.staffWhere(user)
    if (!where) return []
    if (user.role === 'TEACHER') where.messages = { some: {} }

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
      return {
        id: c.id,
        parentId: c.parentId,
        parentName: c.parent.fullName,
        groupId: c.groupId,
        groupName: c.group.name,
        scope: c.scope,
        lastMessageAt: c.lastMessageAt,
        lastText: last?.text ?? null,
        unread: this.unreadForStaff(user, c),
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
  async parentSend(user: AuthUser, text: string, scope: Scope = 'GENERAL', teacherId?: string) {
    const { conv } = await this.parentConversation(user, scope, teacherId)
    return this.send(user, conv.id, text)
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
      const conv = await this.findOrCreateConversation({
        groupId: student.groupId,
        parentId,
        scope: 'ADMIN',
        teacherId: null,
        kindergartenId: student.kindergartenId,
      })
      await this.send(user, conv.id, text, 'PAYMENT')
      sent++
    }
    return { sent }
  }

  /**
   * Сотрудник пишет всем активным родителям одного ученика, сообщение уходит с пушем
   * и в Telegram, как обычное. Доступ сотрудника к ученику проверяет вызывающий
   * (ClassAccessService).
   *   Учитель — в свою личную переписку с каждым родителем (видит только он и родитель);
   *   администрация — в канал «Администрация», который она сама видит и где родитель
   *   может ответить.
   */
  async sendToStudentParents(
    user: AuthUser,
    studentId: string,
    text: string,
  ): Promise<{ sent: number }> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        groupId: true,
        kindergartenId: true,
        parents: { where: { isActive: true }, select: { id: true } },
      },
    })
    if (!student) throw new NotFoundException('Ученик не найден')

    const legacy = await this.prisma.user.findMany({
      where: { role: 'PARENT', childId: studentId, isActive: true },
      select: { id: true },
    })
    const parentIds = Array.from(
      new Set([...student.parents.map((p) => p.id), ...legacy.map((l) => l.id)]),
    )

    const asTeacher = user.role === 'TEACHER'
    for (const parentId of parentIds) {
      const conv = await this.findOrCreateConversation({
        groupId: student.groupId,
        parentId,
        scope: asTeacher ? 'GENERAL' : 'ADMIN',
        teacherId: asTeacher ? user.sub : null,
        kindergartenId: student.kindergartenId,
      })
      await this.send(user, conv.id, text)
    }
    return { sent: parentIds.length }
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
    // (в комнату пускает только правило chat-access: участники и никто больше)
    this.gateway.emitMessage(conversationId, msg)
    // и обновление списка собеседникам (бейдж/последнее сообщение): родителю и,
    // для личной переписки, её учителю — больше никому
    const update = {
      conversationId,
      lastText: t,
      lastMessageAt: conv.lastMessageAt,
    }
    this.gateway.emitConversationUpdate(conv.parentId, update)
    if (conv.teacherId) this.gateway.emitConversationUpdate(conv.teacherId, update)

    // Push другой стороне
    if (user.role === 'PARENT') {
      this.notifyStaff(conv, user.sub, t).catch(() => {})
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

  /**
   * Пуш сотрудникам о сообщении родителя. Текст сообщения уходит в уведомление,
   * поэтому адресат строго тот, кто вправе читать переписку:
   *   GENERAL — только учитель-собеседник (ни другие учителя класса, ни администрация);
   *   ADMIN   — администраторы школы.
   */
  private async notifyStaff(
    conv: {
      scope: Scope
      groupId: string
      teacherId: string | null
      kindergartenId: string | null
    },
    senderId: string,
    text: string,
  ) {
    let audience: Record<string, unknown>
    if (conv.scope === 'GENERAL') {
      if (!conv.teacherId) return
      audience = { id: conv.teacherId, role: 'TEACHER' }
    } else {
      if (!conv.kindergartenId) return
      audience = {
        id: { not: senderId },
        role: 'ADMIN',
        kindergartenId: conv.kindergartenId,
      }
    }
    const staff = await this.prisma.user.findMany({
      where: { isActive: true, expoPushToken: { not: null }, ...audience },
      select: { id: true },
    })
    await this.push.sendToUsers(
      staff.map((s) => s.id),
      {
        title: 'Новое сообщение от родителя',
        body: text.slice(0, 120),
        data: { kind: 'chat', groupId: conv.groupId },
      },
    )
  }

  /** Кол-во непрочитанных переписок текущего пользователя (для бейджа в шапке). */
  async unreadCount(user: AuthUser): Promise<{ count: number }> {
    if (user.role === 'PARENT') {
      const convs = await this.prisma.conversation.findMany({
        where: { parentId: user.sub },
        select: {
          parentReadAt: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { senderId: true, createdAt: true },
          },
        },
      })
      const count = convs.filter((c) => {
        const last = c.messages[0]
        return (
          last &&
          last.senderId !== user.sub &&
          (!c.parentReadAt || c.parentReadAt < last.createdAt)
        )
      }).length
      return { count }
    }

    // Те же переписки, что и в списке: свои у учителя, финансовый канал у администрации.
    const where = this.staffWhere(user)
    if (!where) return { count: 0 }

    const convs = await this.prisma.conversation.findMany({
      where,
      select: {
        staffReadAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { senderId: true, createdAt: true },
        },
      },
    })
    return { count: convs.filter((c) => this.unreadForStaff(user, c)).length }
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
    // Родитель ходит по своим маршрутам (my), эти — только для сотрудников.
    if (user.role === 'PARENT') throw new ForbiddenException(DENY_TEXT.ROLE)
    const denied = chatDenyReason(
      { id: user.sub, role: user.role, kindergartenId: user.kindergartenId },
      conv,
    )
    if (denied) throw new ForbiddenException(DENY_TEXT[denied])
    return conv
  }
}

@ApiTags('chat')
@ApiBearerAuth()
@Feature('chat')
@Controller({ path: 'chat', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'PARENT')
class ChatController {
  constructor(private readonly service: ChatService) {}

  @Get('unread')
  @ApiOperation({ summary: 'Кол-во непрочитанных переписок (бейдж в шапке)' })
  unread(@CurrentUser() user: AuthUser) {
    return this.service.unreadCount(user)
  }

  @Get('teachers')
  @Roles('PARENT')
  @ApiOperation({
    summary: 'Учителя класса ребёнка — кому родитель может написать (с бейджем непрочитанного)',
  })
  teachers(@CurrentUser() user: AuthUser) {
    return this.service.myTeachers(user)
  }

  @Get('my')
  @ApiOperation({
    summary:
      'Переписка родителя. scope=GENERAL (личная с учителем, teacherId — с каким) | ADMIN (администрация/оплата)',
  })
  my(
    @CurrentUser() user: AuthUser,
    @Query('scope') scope?: Scope,
    @Query('teacherId') teacherId?: string,
  ) {
    return this.service.myConversation(
      user,
      scope === 'ADMIN' ? 'ADMIN' : 'GENERAL',
      teacherId || undefined,
    )
  }

  @Post('my/messages')
  @Roles('PARENT')
  parentSend(@CurrentUser() user: AuthUser, @Body() dto: ParentSendDto) {
    return this.service.parentSend(
      user,
      dto.text,
      dto.scope === 'ADMIN' ? 'ADMIN' : 'GENERAL',
      dto.teacherId || undefined,
    )
  }

  // Handler-level @Feature перекрывает class-level 'chat': напоминания об
  // оплате закрываются вместе с разделом «Оплата», а не с чатом целиком.
  @Feature('payments')
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
  exports: [ChatService],
})
export class ChatModule {}
