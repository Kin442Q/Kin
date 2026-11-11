import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import type { Kindergarten, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'
import { randomPassword } from '../../common/random-password'
import { assertNoPassword, requireInviteEmail } from '../access/access.service'
import { MailService, type MailResult } from '../mail/mail.service'
import { inviteEmail, resetEmail } from '../mail/mail-templates'
import { PasswordTokensService } from '../password-tokens/password-tokens.service'

export const GRADE_SCALES = ['FIVE', 'TEN'] as const
export type GradeScaleValue = (typeof GRADE_SCALES)[number]

export interface CreateKindergartenDto {
  name: string
  address?: string
  phone?: string
  /** Район или город из справочника (область выбирается в форме, на сервер уходит конечная единица). */
  districtId: string
  /** Шкала оценок школы; по умолчанию пятибалльная. */
  gradeScale?: GradeScaleValue
  owner: {
    fullName: string
    /** На этот адрес уходит приглашение со ссылкой, где директор сам задаёт пароль. */
    email: string
  }
}

/** Что произошло с приглашением директора. */
export interface OwnerInvite {
  sent: boolean
  email: string
  /** Почему не ушло: NOT_CONFIGURED | REJECTED | NETWORK. */
  reason?: 'NOT_CONFIGURED' | 'REJECTED' | 'NETWORK'
  /** Сообщение почтового сервиса (без секретов). */
  detail?: string
}

interface UpdateKindergartenDto {
  name?: string
  address?: string
  phone?: string
  /** null — снять привязку к району. */
  districtId?: string | null
  gradeScale?: GradeScaleValue
  isActive?: boolean
  latitude?: number | null
  longitude?: number | null
  checkInRadiusMeters?: number
}

/** Ответ POST /kindergartens. */
export interface CreateKindergartenResult {
  kindergarten: Kindergarten
  owner: { id: string; email: string; fullName: string; role: Role }
  /** Результат отправки приглашения директору; не ушло — можно повторить. */
  invite: OwnerInvite
}

@Injectable()
export class KindergartensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly passwordTokens: PasswordTokensService,
  ) {}

  /**
   * Только глобальный супер-админ (kindergartenId === null) может управлять
   * списком садиков.
   */
  private assertGlobalOwner(user: AuthUser) {
    if (user.kindergartenId) {
      throw new ForbiddenException(
        'Только владелец платформы может управлять садиками',
      )
    }
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Доступ запрещён')
    }
  }

  /** Список всех садиков + статистика. */
  async list(user: AuthUser) {
    this.assertGlobalOwner(user)
    const kindergartens = await this.prisma.kindergarten.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        district: { include: { region: true } },
        _count: {
          select: {
            users: true,
            groups: true,
            students: true,
          },
        },
      },
    })

    return kindergartens.map((k) => ({
      id: k.id,
      slug: k.slug,
      name: k.name,
      address: k.address,
      phone: k.phone,
      isActive: k.isActive,
      type: k.type,
      gradeScale: k.gradeScale,
      districtId: k.districtId,
      district: k.district
        ? { id: k.district.id, kind: k.district.kind, nameRu: k.district.nameRu, nameTg: k.district.nameTg, nameEn: k.district.nameEn }
        : null,
      region: k.district?.region
        ? { id: k.district.region.id, code: k.district.region.code, nameRu: k.district.region.nameRu, nameTg: k.district.region.nameTg, nameEn: k.district.region.nameEn }
        : null,
      latitude: k.latitude,
      longitude: k.longitude,
      checkInRadiusMeters: k.checkInRadiusMeters,
      createdAt: k.createdAt,
      stats: {
        usersCount: k._count.users,
        groupsCount: k._count.groups,
        studentsCount: k._count.students,
      },
    }))
  }

  /** Создать новый садик + первого SUPER_ADMIN. Атомарно. */
  async create(user: AuthUser, dto: CreateKindergartenDto): Promise<CreateKindergartenResult> {
    this.assertGlobalOwner(user)

    if (!dto.name?.trim()) {
      throw new BadRequestException('Название садика обязательно')
    }
    if (!dto.owner?.email?.trim()) {
      throw new BadRequestException('Email владельца обязателен')
    }
    // Пароль не задаётся: директор получает приглашение и придумывает его сам по ссылке из письма.
    assertNoPassword(dto.owner)
    if (!dto.owner?.fullName?.trim()) {
      throw new BadRequestException('ФИО владельца обязательно')
    }

    const ownerEmail = requireInviteEmail(dto.owner.email)

    // Район обязателен: по нему школа попадает в областную и районную статистику.
    if (!dto.districtId) throw new BadRequestException('Выберите область и район школы')
    await this.assertDistrictExists(dto.districtId)
    const gradeScale = this.parseGradeScale(dto.gradeScale) ?? 'FIVE'

    // Проверяем что email свободен
    const existing = await this.prisma.user.findUnique({
      where: { email: ownerEmail },
    })
    if (existing) {
      throw new ConflictException('Этот email уже используется')
    }

    // Генерируем уникальный slug из названия
    const slug = await this.generateUniqueSlug(dto.name)

    // Пока директор не задал свой, пароль случайный: его никто не знает и не увидит.
    const passwordHash = await bcrypt.hash(randomPassword(), 10)

    // Создаём в транзакции: садик + первый супер-админ
    const result = await this.prisma.$transaction(async (tx) => {
      const kindergarten = await tx.kindergarten.create({
        data: {
          name: dto.name.trim(),
          slug,
          address: dto.address?.trim() || null,
          phone: dto.phone?.trim() || null,
          isActive: true,
          // Платформа только для школ — тип не выбирается.
          type: 'SCHOOL',
          districtId: dto.districtId,
          gradeScale,
        },
      })

      const owner = await tx.user.create({
        data: {
          email: ownerEmail,
          passwordHash,
          fullName: dto.owner.fullName.trim(),
          role: 'SUPER_ADMIN',
          kindergartenId: kindergarten.id,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
        },
      })

      return { kindergarten, owner }
    })

    // Приглашение: ссылка на 48 часов, где директор сам задаёт пароль. Письмо — не
    // критичный путь: если оно не ушло, школа уже создана, а владелец платформы видит причину
    // и отправляет приглашение ещё раз (пароль никому не показывается).
    const invite = await this.sendOwnerInvite(result.owner, 'INVITE')
    return { ...result, invite }
  }

  private async assertDistrictExists(districtId: string) {
    const district = await this.prisma.district.findUnique({ where: { id: districtId }, select: { id: true } })
    if (!district) throw new BadRequestException('Такого района нет в справочнике. Выберите область и район из списка')
  }

  /** undefined — не передана; неверное значение — 400. */
  private parseGradeScale(value: unknown): GradeScaleValue | undefined {
    if (value === undefined || value === null) return undefined
    if (!(GRADE_SCALES as readonly unknown[]).includes(value)) {
      throw new BadRequestException('Шкала оценок: пятибалльная (FIVE) или десятибалльная (TEN)')
    }
    return value as GradeScaleValue
  }

  /** Письмо директору со ссылкой для пароля; результат — для окна «Приглашение отправлено». */
  private async sendOwnerInvite(
    owner: { id: string; email: string; fullName: string },
    purpose: 'INVITE' | 'RESET',
  ): Promise<OwnerInvite> {
    let sent: MailResult
    try {
      const { link, hours } = await this.passwordTokens.issue(owner.id, purpose)
      const template = purpose === 'INVITE' ? inviteEmail : resetEmail
      sent = await this.mail.send({ to: owner.email, ...template({ name: owner.fullName, link, hours }) })
    } catch {
      // сбой базы при выдаче ссылки не должен ронять уже созданную школу
      sent = { sent: false, reason: 'NETWORK' }
    }
    return sent.sent
      ? { sent: true, email: owner.email }
      : { sent: false, email: owner.email, reason: sent.reason, detail: sent.detail }
  }

  /**
   * Отправить директору школы приглашение ещё раз (или ссылку для смены пароля, если он уже входил).
   * Только владелец платформы.
   */
  async resendOwnerInvite(user: AuthUser, kindergartenId: string): Promise<OwnerInvite> {
    this.assertGlobalOwner(user)
    const owner = await this.prisma.user.findFirst({
      where: { kindergartenId, role: 'SUPER_ADMIN' },
      orderBy: { createdAt: 'asc' },
    })
    if (!owner) throw new NotFoundException('У школы нет директора')
    return this.sendOwnerInvite(owner, owner.lastLoginAt ? 'RESET' : 'INVITE')
  }

  async update(user: AuthUser, id: string, dto: UpdateKindergartenDto) {
    this.assertGlobalOwner(user)
    return this.applyUpdate(id, dto)
  }

  /**
   * Обновление текущего учреждения «своими» админами (без прав global-owner).
   * Админ школы может править только имя, адрес, телефон и геолокацию check-in.
   */
  async updateMine(user: AuthUser, dto: UpdateKindergartenDto) {
    if (!user.kindergartenId) {
      throw new ForbiddenException('Пользователь не привязан к учреждению')
    }
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Доступ только для администратора')
    }
    // Район школы назначает владелец платформы; директор правит остальное (и шкалу оценок).
    const { districtId: _ignored, ...own } = dto
    return this.applyUpdate(user.kindergartenId, own)
  }

  private async applyUpdate(id: string, dto: UpdateKindergartenDto) {
    const existing = await this.prisma.kindergarten.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Учреждение не найдено')

    const data: Record<string, unknown> = {}
    if (dto.name !== undefined) data.name = dto.name.trim()
    if (dto.address !== undefined) data.address = dto.address?.trim() || null
    if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null
    if (dto.isActive !== undefined) data.isActive = dto.isActive
    if (dto.districtId !== undefined) {
      if (dto.districtId !== null) await this.assertDistrictExists(dto.districtId)
      data.districtId = dto.districtId
    }
    const gradeScale = this.parseGradeScale(dto.gradeScale)
    if (gradeScale) data.gradeScale = gradeScale
    if (dto.latitude !== undefined) data.latitude = dto.latitude
    if (dto.longitude !== undefined) data.longitude = dto.longitude
    if (dto.checkInRadiusMeters !== undefined) {
      const r = Number(dto.checkInRadiusMeters)
      if (!Number.isFinite(r) || r < 20 || r > 5000) {
        throw new BadRequestException('Радиус должен быть от 20 до 5000 метров')
      }
      data.checkInRadiusMeters = Math.round(r)
    }

    return this.prisma.kindergarten.update({
      where: { id },
      data,
    })
  }

  async remove(user: AuthUser, id: string) {
    this.assertGlobalOwner(user)
    const existing = await this.prisma.kindergarten.findUnique({
      where: { id },
    })
    if (!existing) throw new NotFoundException('Школа не найдена')

    // Оценки, ДЗ, дневник, заметки и сообщения ссылаются на пользователей без
    // каскада — без этого школа с такими данными не удалялась (409 «Нарушение
    // связи»). Сначала убираем их, затем школу, всё в одной транзакции.
    await this.prisma.$transaction([
      this.prisma.message.deleteMany({ where: { conversation: { kindergartenId: id } } }),
      this.prisma.homework.deleteMany({ where: { group: { kindergartenId: id } } }),
      this.prisma.grade.deleteMany({ where: { student: { kindergartenId: id } } }),
      this.prisma.diaryEntry.deleteMany({ where: { group: { kindergartenId: id } } }),
      this.prisma.kidNote.deleteMany({ where: { student: { kindergartenId: id } } }),
      this.prisma.kindergarten.delete({ where: { id } }),
    ])
    return { success: true }
  }

  // ----------------------------------------------------------------
  private async generateUniqueSlug(name: string): Promise<string> {
    const base =
      this.transliterate(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30) || 'kg'

    let slug = base
    let i = 1
    while (
      await this.prisma.kindergarten.findUnique({ where: { slug } })
    ) {
      slug = `${base}-${i++}`
    }
    return slug
  }

  private transliterate(s: string): string {
    const map: Record<string, string> = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e',
      ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm',
      н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
      ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
      ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    }
    return s
      .split('')
      .map((c) => map[c.toLowerCase()] ?? c)
      .join('')
  }
}
