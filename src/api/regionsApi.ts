import { http } from './http'
import { uiLanguage } from '../i18n/uiText'

/** Район, город или район города Душанбе внутри области. */
export interface DistrictNode {
  id: string
  code: string
  kind: 'DISTRICT' | 'CITY' | 'CITY_DISTRICT'
  nameRu: string
  nameTg: string
  nameEn: string
}

/** Область (верхний уровень): Согдийская, Хатлонская, ГБАО, город Душанбе, районы республиканского подчинения. */
export interface RegionNode {
  id: string
  code: string
  nameRu: string
  nameTg: string
  nameEn: string
  centerRu: string | null
  districts: DistrictNode[]
}

export const regionsApi = {
  tree: () => http.get<RegionNode[]>('/v1/regions').then((r) => r.data),
}

/** Название на языке интерфейса (ru / tg / en). */
export function geoName(node: { nameRu: string; nameTg: string; nameEn: string }, lang = uiLanguage()): string {
  return lang === 'tg' ? node.nameTg : lang === 'en' ? node.nameEn : node.nameRu
}

/** Значение для каскада: [id области, id района]. */
export type AreaValue = [string, string]
