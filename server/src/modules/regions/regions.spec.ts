import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { RegionsService } from './regions.service'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'

const PRISMA_DIR = join(__dirname, '..', '..', '..', 'prisma')

interface Entry { slug: string; kind: 'DISTRICT' | 'CITY' | 'CITY_DISTRICT'; nameRu: string; nameTg: string; nameEn: string }
interface Region { code: string; nameRu: string; nameTg: string; nameEn: string; centerRu: string; districts: Entry[] }
const data: { regions: Region[] } = JSON.parse(readFileSync(join(PRISMA_DIR, 'data', 'tajikistan-regions.json'), 'utf8'))

describe('справочник областей и районов Таджикистана', () => {
  const count = (code: string, kind: Entry['kind']) => data.regions.find((r) => r.code === code)!.districts.filter((d) => d.kind === kind).length

  it('пять верхних единиц: Душанбе, ГБАО, Согдийская, Хатлонская, районы республиканского подчинения', () => {
    expect(data.regions.map((r) => r.code)).toEqual(['DUSHANBE', 'GBAO', 'SUGHD', 'KHATLON', 'DRS'])
  })

  it('число районов и городов совпадает с источниками (ru/en Википедия, структура 2022 г.)', () => {
    expect(count('DUSHANBE', 'CITY_DISTRICT')).toBe(4)
    expect([count('GBAO', 'DISTRICT'), count('GBAO', 'CITY')]).toEqual([7, 1])
    expect([count('SUGHD', 'DISTRICT'), count('SUGHD', 'CITY')]).toEqual([10, 8])
    expect([count('KHATLON', 'DISTRICT'), count('KHATLON', 'CITY')]).toEqual([21, 4])
    // 9 «чистых» районов + 4 одноимённых городам (источники расходятся, держим оба варианта) и 4 города
    expect([count('DRS', 'DISTRICT'), count('DRS', 'CITY')]).toEqual([13, 4])
  })

  it('у каждой единицы есть названия на трёх языках, код уникален, город помечен суффиксом -CITY', () => {
    const codes: string[] = []
    for (const r of data.regions) {
      expect([r.nameRu, r.nameTg, r.nameEn, r.centerRu].every((s) => s && s.trim() === s)).toBe(true)
      for (const d of r.districts) {
        expect([d.nameRu, d.nameTg, d.nameEn].every((s) => s && s.trim() === s)).toBe(true)
        expect(d.slug).toMatch(/^[A-Z]+(-[A-Z]+)*$/)
        expect(d.slug.endsWith('-CITY')).toBe(d.kind === 'CITY')
        codes.push(`${r.code}-${d.slug}`)
      }
    }
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.length).toBe(72)
  })

  it('таджикские названия районов начинаются с «ноҳияи», городов — с «шаҳри» (так их пишут сами источники)', () => {
    for (const r of data.regions) {
      for (const d of r.districts) {
        expect(d.nameTg.startsWith(d.kind === 'CITY' ? 'шаҳри ' : 'ноҳияи ')).toBe(true)
      }
    }
  })

  it('миграция создаёт ровно те же записи, что лежат в JSON', () => {
    const migration = readFileSync(join(PRISMA_DIR, 'migrations', '20261110090000_regions_viewer_role', 'migration.sql'), 'utf8')
    const quoted = (s: string) => "'" + s.replace(/'/g, "''") + "'"
    for (const r of data.regions) {
      expect(migration).toContain(quoted(r.code))
      expect(migration).toContain(quoted(r.nameTg))
      for (const d of r.districts) {
        expect(migration).toContain(quoted(`${r.code}-${d.slug}`))
        expect(migration).toContain(quoted(d.nameRu))
        expect(migration).toContain(quoted(d.nameEn))
      }
    }
    expect((migration.match(/INSERT INTO "District"/g) ?? []).length).toBe(1)
    expect((migration.match(/INSERT INTO "Region"/g) ?? []).length).toBe(1)
  })
})

describe('RegionsService', () => {
  let prisma: PrismaMock
  let service: RegionsService

  beforeEach(() => {
    prisma = createPrismaMock()
    service = new RegionsService(prisma as unknown as PrismaService)
    prisma.region.findMany.mockResolvedValue([
      {
        id: 'rg_sughd', code: 'SUGHD', nameRu: 'Согдийская область', nameTg: 'Вилояти Суғд', nameEn: 'Sughd Region', centerRu: 'Худжанд', sortOrder: 30,
        districts: [{ id: 'ds_sughd_asht', code: 'SUGHD-ASHT', kind: 'DISTRICT', nameRu: 'Аштский район', nameTg: 'ноҳияи Ашт', nameEn: 'Asht district', sortOrder: 1, regionId: 'rg_sughd' }],
      },
    ])
  })

  it('отдаёт дерево «область → районы» без служебных полей', async () => {
    const tree = await service.tree()
    expect(tree).toEqual([
      {
        id: 'rg_sughd', code: 'SUGHD', nameRu: 'Согдийская область', nameTg: 'Вилояти Суғд', nameEn: 'Sughd Region', centerRu: 'Худжанд',
        districts: [{ id: 'ds_sughd_asht', code: 'SUGHD-ASHT', kind: 'DISTRICT', nameRu: 'Аштский район', nameTg: 'ноҳияи Ашт', nameEn: 'Asht district' }],
      },
    ])
    expect(prisma.region.findMany.mock.calls[0][0].orderBy).toEqual({ sortOrder: 'asc' })
    expect(prisma.region.findMany.mock.calls[0][0].include.districts.orderBy).toEqual({ sortOrder: 'asc' })
  })

  it('справочник меняется только миграцией, поэтому второй запрос идёт из кэша', async () => {
    await service.tree()
    await service.tree()
    expect(prisma.region.findMany).toHaveBeenCalledTimes(1)
  })
})
