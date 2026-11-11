import { ForbiddenException, Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'

/** Что видит этот пользователь в кабинете министерства. */
export interface ViewerAccess {
  /** Название для шапки кабинета: «Министерство образования», «Отдел образования района Ашт». */
  organization: string
  /** true — все школы страны. */
  allSchools: boolean
  /** Условие на школы, которые входят в охват (всегда только действующие школы, без демо). */
  where: Prisma.KindergartenWhereInput
  /** Охват по областям и районам — для списка фильтров. Пусто при allSchools. */
  regionIds: string[]
  districtIds: string[]
}

/** Только действующие школы: демо-учреждение и неактивные в статистику не попадают. */
const BASE_WHERE: Prisma.KindergartenWhereInput = { isActive: true, isDemo: false, type: 'SCHOOL' }

/**
 * Определяет охват пользователя: какие школы он вправе видеть. Это единственное место, откуда
 * ведомственная статистика берёт список школ, поэтому «лишнюю» школу в сводке можно получить только
 * ошибкой здесь.
 */
@Injectable()
export class MinistryScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(user: AuthUser): Promise<ViewerAccess> {
    // Владелец платформы (не директор школы!) видит всё — для проверки и поддержки.
    if (user.role === 'SUPER_ADMIN' && !user.kindergartenId) {
      return { organization: 'Владелец платформы', allSchools: true, where: BASE_WHERE, regionIds: [], districtIds: [] }
    }
    if (user.role !== 'VIEWER') {
      throw new ForbiddenException('Раздел министерства доступен только наблюдателям')
    }

    // Активность и охват читаем из базы на каждый запрос: отключённый наблюдатель теряет доступ сразу,
    // а не через 15 минут, пока живёт его токен.
    const account = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        isActive: true,
        role: true,
        viewerScope: {
          select: {
            organization: true,
            allSchools: true,
            regions: { select: { id: true } },
            districts: { select: { id: true } },
          },
        },
      },
    })
    if (!account || !account.isActive || account.role !== 'VIEWER') {
      throw new ForbiddenException('Доступ отключён. Обратитесь к владельцу платформы')
    }
    const scope = account.viewerScope
    if (!scope) throw new ForbiddenException('Для вашей учётной записи не задан охват школ')

    if (scope.allSchools) {
      return { organization: scope.organization, allSchools: true, where: BASE_WHERE, regionIds: [], districtIds: [] }
    }
    const regionIds = scope.regions.map((r) => r.id)
    const districtIds = scope.districts.map((d) => d.id)
    return {
      organization: scope.organization,
      allSchools: false,
      // Пустой охват даёт пустой список, а не «все школы»: `in: []` в Prisma ничего не находит.
      where: {
        ...BASE_WHERE,
        OR: [{ districtId: { in: districtIds } }, { district: { regionId: { in: regionIds } } }],
      },
      regionIds,
      districtIds,
    }
  }
}
