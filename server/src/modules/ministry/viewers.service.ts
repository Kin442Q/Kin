import type { Prisma } from '@prisma/client'
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'
import { AccessService, assertNoPassword, requireInviteEmail, type AccessGrant } from '../access/access.service'

export interface CreateViewerDto {
  fullName: string
  /** На этот адрес уходит приглашение: пароль человек задаёт сам по ссылке из письма. */
  email: string
  /** Название организации для шапки кабинета: «Министерство образования», «Отдел образования района Ашт». */
  organization: string
  /** true — все школы страны (министерство). Иначе нужны области и/или районы. */
  allSchools?: boolean
  regionIds?: string[]
  districtIds?: string[]
}

export interface UpdateViewerDto {
  fullName?: string
  organization?: string
  allSchools?: boolean
  regionIds?: string[]
  districtIds?: string[]
  /** false — отключить доступ (сессии закрываются сразу). */
  isActive?: boolean
}

const NAME_MAX = 200

const scopeInclude = {
  viewerScope: {
    include: {
      regions: { select: { id: true, nameRu: true, nameTg: true, nameEn: true } },
      districts: { select: { id: true, nameRu: true, nameTg: true, nameEn: true, regionId: true } },
    },
  },
} as const

type ViewerRecord = Prisma.UserGetPayload<{ include: typeof scopeInclude }>

function toView(v: ViewerRecord) {
  return {
    id: v.id,
    email: v.email,
    fullName: v.fullName,
    isActive: v.isActive,
    lastLoginAt: v.lastLoginAt,
    createdAt: v.createdAt,
    organization: v.viewerScope?.organization ?? null,
    allSchools: v.viewerScope?.allSchools ?? false,
    regions: v.viewerScope?.regions ?? [],
    districts: v.viewerScope?.districts ?? [],
  }
}

export type ViewerView = ReturnType<typeof toView>

/**
 * Учётные записи наблюдателей (министерство, районные отделы образования). Заводит и меняет их
 * только владелец платформы: школа и её директор в этом не участвуют.
 */
@Injectable()
export class ViewersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private assertPlatformOwner(user: AuthUser) {
    if (user.role !== 'SUPER_ADMIN' || user.kindergartenId) {
      throw new ForbiddenException('Наблюдателей заводит только владелец платформы')
    }
  }

  async list(user: AuthUser) {
    this.assertPlatformOwner(user)
    const viewers = await this.prisma.user.findMany({
      where: { role: 'VIEWER' },
      orderBy: { createdAt: 'desc' },
      include: scopeInclude,
    })
    return viewers.map((v) => toView(v))
  }

  async create(user: AuthUser, dto: CreateViewerDto): Promise<{ viewer: ViewerView; invite: AccessGrant }> {
    this.assertPlatformOwner(user)
    // Пароль не задаётся ни при каких условиях: старый клиент получает понятный отказ.
    assertNoPassword(dto)

    const fullName = this.requireText(dto.fullName, 'ФИО')
    const organization = this.requireText(dto.organization, 'Организация')
    const email = requireInviteEmail(dto.email)
    const scope = await this.parseScope(dto)

    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Этот email уже используется')
    }

    const { hash } = await this.access.newSecret()
    // Одна атомарная запись (аккаунт + охват) без интерактивной транзакции: у той есть таймаут,
    // и на нагруженной базе она обрывалась (P2028), оставляя администратора без ответа.
    const created = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        fullName,
        role: 'VIEWER',
        kindergartenId: null,
        isActive: true,
        viewerScope: {
          create: {
            organization,
            allSchools: scope.allSchools,
            regions: { connect: scope.regionIds.map((id) => ({ id })) },
            districts: { connect: scope.districtIds.map((id) => ({ id })) },
          },
        },
      },
      include: scopeInclude,
    })

    await this.audit(user, 'CREATE', created.id, { after: { email, organization, ...scope } })
    // Письмо — не критичный путь: аккаунт уже создан, при сбое владелец увидит причину и отправит ещё раз.
    const invite = await this.access.deliver(created, 'INVITE')
    return { viewer: toView(created), invite }
  }

  async update(user: AuthUser, id: string, dto: UpdateViewerDto) {
    this.assertPlatformOwner(user)
    assertNoPassword(dto)
    const existing = await this.findViewer(id)

    const userData: Record<string, unknown> = {}
    if (dto.fullName !== undefined) userData.fullName = this.requireText(dto.fullName, 'ФИО')
    if (dto.isActive !== undefined) userData.isActive = dto.isActive === true

    const scopeTouched = dto.allSchools !== undefined || dto.regionIds !== undefined || dto.districtIds !== undefined
    const current = existing.viewerScope
    const scope = scopeTouched
      ? await this.parseScope({
          allSchools: dto.allSchools ?? current?.allSchools,
          regionIds: dto.regionIds ?? current?.regions.map((r) => r.id),
          districtIds: dto.districtIds ?? current?.districts.map((d) => d.id),
        })
      : null
    const organization = dto.organization !== undefined ? this.requireText(dto.organization, 'Организация') : undefined

    // Пакет операций в одной транзакции (без интерактивной: у неё есть таймаут).
    const ops: Prisma.PrismaPromise<unknown>[] = []
    if (Object.keys(userData).length) ops.push(this.prisma.user.update({ where: { id }, data: userData }))
    if (scope || organization !== undefined) {
      if (current) {
        ops.push(
          this.prisma.viewerScope.update({
            where: { userId: id },
            data: {
              ...(organization !== undefined ? { organization } : {}),
              ...(scope
                ? {
                    allSchools: scope.allSchools,
                    regions: { set: scope.regionIds.map((rid) => ({ id: rid })) },
                    districts: { set: scope.districtIds.map((did) => ({ id: did })) },
                  }
                : {}),
            },
          }),
        )
      } else {
        // Записи охвата нет (не должно бывать, но не падаем): создаём с тем, что передали.
        ops.push(
          this.prisma.viewerScope.create({
            data: {
              userId: id,
              organization: organization ?? 'Наблюдатель',
              allSchools: scope?.allSchools ?? false,
              regions: { connect: (scope?.regionIds ?? []).map((rid) => ({ id: rid })) },
              districts: { connect: (scope?.districtIds ?? []).map((did) => ({ id: did })) },
            },
          }),
        )
      }
    }
    // Отключённый наблюдатель выходит сразу: его refresh-токены гасятся, а охват проверяется в базе на каждый запрос.
    if (dto.isActive === false) {
      ops.push(this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }))
    }
    if (ops.length) await this.prisma.$transaction(ops)

    const fresh = await this.prisma.user.findUniqueOrThrow({ where: { id }, include: scopeInclude })
    await this.audit(user, 'UPDATE', id, {
      before: this.snapshot(existing),
      after: this.snapshot(fresh),
    })
    return toView(fresh)
  }

  /** Письмо со ссылкой ещё раз: приглашение, если человек ещё не входил, иначе — ссылка для смены пароля. */
  async resendInvite(user: AuthUser, id: string): Promise<AccessGrant> {
    this.assertPlatformOwner(user)
    const viewer = await this.findViewer(id)
    if (!viewer.isActive) throw new BadRequestException('Доступ отключён: сначала включите его')
    return this.access.deliver(viewer, viewer.lastLoginAt ? 'RESET' : 'INVITE')
  }

  // ---------------------------------------------------------------------------------------------

  private async findViewer(id: string) {
    const viewer = await this.prisma.user.findUnique({ where: { id }, include: scopeInclude })
    if (!viewer || viewer.role !== 'VIEWER') throw new NotFoundException('Наблюдатель не найден')
    return viewer
  }

  private requireText(value: unknown, label: string): string {
    const text = typeof value === 'string' ? value.trim() : ''
    if (!text) throw new BadRequestException(`${label} обязательно`)
    if (text.length > NAME_MAX) throw new BadRequestException(`${label}: не длиннее ${NAME_MAX} символов`)
    return text
  }

  /**
   * Охват: все школы страны или выбранные области и районы (хотя бы один). Несуществующие id —
   * 400: молча отбросить значит выдать человеку другой охват, чем задумал владелец.
   */
  private async parseScope(input: { allSchools?: boolean; regionIds?: string[]; districtIds?: string[] }) {
    const allSchools = input.allSchools === true
    if (allSchools) return { allSchools: true, regionIds: [] as string[], districtIds: [] as string[] }

    const unique = (ids: unknown) =>
      Array.isArray(ids) ? [...new Set(ids.filter((x): x is string => typeof x === 'string' && x.length > 0))] : []
    const regionIds = unique(input.regionIds)
    const districtIds = unique(input.districtIds)
    if (!regionIds.length && !districtIds.length) {
      throw new BadRequestException('Выберите область или район, которые будет видеть наблюдатель, либо «Все школы страны»')
    }
    const [regions, districts] = await Promise.all([
      regionIds.length ? this.prisma.region.findMany({ where: { id: { in: regionIds } }, select: { id: true } }) : [],
      districtIds.length ? this.prisma.district.findMany({ where: { id: { in: districtIds } }, select: { id: true } }) : [],
    ])
    if (regions.length !== regionIds.length || districts.length !== districtIds.length) {
      throw new BadRequestException('Выбранной области или района нет в справочнике')
    }
    return { allSchools: false, regionIds, districtIds }
  }

  private snapshot(v: ViewerRecord) {
    return {
      fullName: v.fullName,
      isActive: v.isActive,
      organization: v.viewerScope?.organization ?? null,
      allSchools: v.viewerScope?.allSchools ?? false,
      regionIds: v.viewerScope?.regions.map((r) => r.id) ?? [],
      districtIds: v.viewerScope?.districts.map((d) => d.id) ?? [],
    }
  }

  private async audit(actor: AuthUser, action: 'CREATE' | 'UPDATE', entityId: string, diff: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({ data: { actorId: actor.sub, action, entity: 'Viewer', entityId, diff: diff as never } })
    } catch {
      // журнал не должен ронять уже сделанное действие
    }
  }
}
