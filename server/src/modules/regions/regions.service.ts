import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'

export interface DistrictNode {
  id: string
  code: string
  kind: 'DISTRICT' | 'CITY' | 'CITY_DISTRICT'
  nameRu: string
  nameTg: string
  nameEn: string
}

export interface RegionNode {
  id: string
  code: string
  nameRu: string
  nameTg: string
  nameEn: string
  centerRu: string | null
  districts: DistrictNode[]
}

/** Справочник «область → район/город» для форм и фильтров. Меняется только миграцией, поэтому кэш. */
@Injectable()
export class RegionsService {
  private cache: RegionNode[] | null = null

  constructor(private readonly prisma: PrismaService) {}

  async tree(): Promise<RegionNode[]> {
    if (this.cache) return this.cache
    const regions = await this.prisma.region.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { districts: { orderBy: { sortOrder: 'asc' } } },
    })
    this.cache = regions.map((r) => ({
      id: r.id,
      code: r.code,
      nameRu: r.nameRu,
      nameTg: r.nameTg,
      nameEn: r.nameEn,
      centerRu: r.centerRu,
      districts: r.districts.map((d) => ({
        id: d.id,
        code: d.code,
        kind: d.kind,
        nameRu: d.nameRu,
        nameTg: d.nameTg,
        nameEn: d.nameEn,
      })),
    }))
    return this.cache
  }
}
