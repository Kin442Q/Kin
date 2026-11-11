import { useMemo } from 'react'
import { Cascader, DatePicker, Segmented } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'

import { uiText } from '../../i18n/uiText'
import { useLangStore } from '../../i18n'
import { geoName } from '../../api/regionsApi'
import { ministryApi, type GeoName, type MinistryFilters, type MinistryQuery } from '../../api/ministryApi'
import { SP } from '../../components/sprout'

/* ============================================================
   Общее для экранов кабинета министерства: период, фильтр «область → район»,
   подсветка значений и подписи.
   ============================================================ */

export type Preset = '30' | '90' | 'year' | 'custom'

const DAY = 'YYYY-MM-DD'

/** Учебный год начинается 1 сентября: с января по август он начался в сентябре прошлого года. */
export function schoolYearStart(now: dayjs.Dayjs): dayjs.Dayjs {
  const year = now.month() >= 8 ? now.year() : now.year() - 1
  return dayjs(`${year}-09-01`)
}

/** Границы периода по выбранной кнопке. «Свой период» берёт даты из адресной строки. */
export function periodFor(preset: Preset, now: dayjs.Dayjs, custom?: { from?: string | null; to?: string | null }) {
  const to = now.format(DAY)
  if (preset === '90') return { from: now.subtract(89, 'day').format(DAY), to }
  if (preset === 'year') return { from: schoolYearStart(now).format(DAY), to }
  if (preset === 'custom' && custom?.from && custom?.to) return { from: custom.from, to: custom.to }
  return { from: now.subtract(29, 'day').format(DAY), to }
}

/**
 * Фильтры кабинета живут в адресной строке (?regionId=…&preset=90): ссылкой на сводку можно
 * поделиться, а при переходе между вкладками выбор не сбрасывается.
 */
export function useMinistryQuery() {
  const [params, setParams] = useSearchParams()
  const regionId = params.get('regionId') ?? undefined
  const districtId = params.get('districtId') ?? undefined
  const presetParam = params.get('preset')
  const preset: Preset = presetParam === '90' || presetParam === 'year' || presetParam === 'custom' ? presetParam : '30'

  const period = periodFor(preset, dayjs(), { from: params.get('from'), to: params.get('to') })
  const query: MinistryQuery = { regionId, districtId, from: period.from, to: period.to }

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '') next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }
  return { query, preset, period, update, search: params.toString() }
}

export function useMinistryFilters() {
  return useQuery<MinistryFilters>({ queryKey: ['ministry', 'filters'], queryFn: ministryApi.filters, staleTime: 5 * 60_000 })
}

interface FilterBarProps {
  state: ReturnType<typeof useMinistryQuery>
  /** Фильтр по району не нужен там, где экран сам сравнивает районы. */
  hideArea?: boolean
}

/** Полоса фильтров: область → район (каскад) и период. */
export function MinistryFilterBar({ state, hideArea }: FilterBarProps) {
  const lang = useLangStore((s) => s.lang)
  const filters = useMinistryFilters()
  const { query, preset, period, update } = state

  const options = useMemo(
    () =>
      (filters.data?.regions ?? []).map((r) => ({
        value: r.id,
        label: geoName(r, lang),
        children: r.districts.map((d) => ({ value: d.id, label: geoName(d, lang) })),
      })),
    [filters.data, lang],
  )
  const value = query.districtId && query.regionId ? [query.regionId, query.districtId] : query.regionId ? [query.regionId] : undefined

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      {!hideArea && (
        <Cascader
          allowClear
          showSearch
          changeOnSelect
          style={{ minWidth: 260, maxWidth: '100%' }}
          placeholder={uiText('Вся страна: область и район')}
          options={options}
          value={value}
          onChange={(v) => update({ regionId: v?.[0] as string | undefined, districtId: v?.[1] as string | undefined })}
          aria-label={uiText('Область и район')}
        />
      )}
      <Segmented
        value={preset}
        onChange={(v) => update({ preset: String(v), from: undefined, to: undefined })}
        options={[
          { value: '30', label: uiText('30 дней') },
          { value: '90', label: uiText('90 дней') },
          { value: 'year', label: uiText('Учебный год') },
          { value: 'custom', label: uiText('Свой период') },
        ]}
      />
      {preset === 'custom' && (
        <DatePicker.RangePicker
          allowClear={false}
          value={[dayjs(period.from), dayjs(period.to)]}
          onChange={(range) => {
            if (range?.[0] && range?.[1]) update({ preset: 'custom', from: range[0].format(DAY), to: range[1].format(DAY) })
          }}
        />
      )}
    </div>
  )
}

/** «12,3 %» либо «—», если данных нет. */
export function pct(value: number | null | undefined): string {
  return value == null ? '—' : `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} %`
}

export function num(value: number | null | undefined): string {
  return value == null ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}

/**
 * Цвет подсветки: от красного (низкое) через жёлтый к зелёному (высокое). Полупрозрачный, чтобы
 * одинаково читался в светлой и тёмной теме. Нет данных — без заливки.
 */
export function heat(value: number | null | undefined, low: number, high: number, invert = false): string | undefined {
  if (value == null || high <= low) return undefined
  let t = Math.min(1, Math.max(0, (value - low) / (high - low)))
  if (invert) t = 1 - t
  return `hsla(${Math.round(t * 130)}, 70%, 45%, 0.22)`
}

/** Ячейка таблицы с подсветкой значения. */
export function HeatCell({ value, low, high, invert, text }: { value: number | null | undefined; low: number; high: number; invert?: boolean; text?: string }) {
  return (
    <div style={{ background: heat(value, low, high, invert), padding: '6px 12px', borderRadius: 10, textAlign: 'right', minWidth: 76, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
      {text ?? pct(value)}
    </div>
  )
}

/** Подпись географической единицы на языке интерфейса; нет района — «Не указан». */
export function placeName(g: GeoName | null | undefined): string {
  return g ? geoName(g) : uiText('Не указан')
}

export const MUTED = { color: SP.muted } as const
