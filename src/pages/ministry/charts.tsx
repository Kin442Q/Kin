import { Column, Line, Pie } from '@ant-design/charts'
import { Empty } from 'antd'
import dayjs from 'dayjs'

import { uiText } from '../../i18n/uiText'
import { useChartTheme } from '../../theme/chartTheme'
import type { SchoolRow, TrendPoint } from '../../api/ministryApi'

/* ============================================================
   Диаграммы сводки министерства. Данные для них готовят чистые функции
   (trendData, schoolBands, compareData): их проверяют тестами без отрисовки.
   ============================================================ */

export interface TrendDatum {
  week: string
  metric: string
  value: number
}

/** Недели → точки линий: средний балл, качество знаний и посещаемость. Пустое значение — точки нет (не ноль). */
export function trendData(weeks: TrendPoint[]): TrendDatum[] {
  const out: TrendDatum[] = []
  for (const w of weeks) {
    const label = dayjs(w.weekStart).format('DD.MM')
    if (w.avgPercent != null) out.push({ week: label, metric: uiText('Средний балл'), value: w.avgPercent })
    if (w.quality != null) out.push({ week: label, metric: uiText('Качество знаний'), value: w.quality })
    if (w.attendanceRate != null) out.push({ week: label, metric: uiText('Посещаемость'), value: w.attendanceRate })
  }
  return out
}

export interface BandDatum {
  type: string
  value: number
}

/**
 * Школы по среднему баллу (в процентах от шкалы). Школы, у которых оценки выше максимума шкалы,
 * в диапазоны не попадают: их средний балл недостоверен, их надо проверить отдельно.
 */
export function schoolBands(schools: Array<Pick<SchoolRow, 'avgPercent'> & { flags: Pick<SchoolRow['flags'], 'scaleMismatch'> }>): BandDatum[] {
  const counts = { high: 0, good: 0, mid: 0, low: 0, none: 0, scale: 0 }
  for (const s of schools) {
    if (s.flags.scaleMismatch) counts.scale++
    else if (s.avgPercent == null) counts.none++
    else if (s.avgPercent >= 90) counts.high++
    else if (s.avgPercent >= 75) counts.good++
    else if (s.avgPercent >= 60) counts.mid++
    else counts.low++
  }
  return [
    { type: uiText('90 % и выше'), value: counts.high },
    { type: uiText('75–89 %'), value: counts.good },
    { type: uiText('60–74 %'), value: counts.mid },
    { type: uiText('Ниже 60 %'), value: counts.low },
    { type: uiText('Нет оценок'), value: counts.none },
    { type: uiText('Проверить шкалу'), value: counts.scale },
  ].filter((b) => b.value > 0)
}

export interface CompareItem {
  id: string
  name: string
  quality: number | null
  success: number | null
  attendanceRate: number | null
}

export interface CompareDatum {
  place: string
  metric: string
  value: number
}

/** Сколько мест показываем на одной диаграмме: больше — подписи сливаются. */
export const COMPARE_LIMIT = 20

/** Места → столбцы по трём показателям; нет данных — столбца нет. */
export function compareData(items: CompareItem[]): CompareDatum[] {
  const out: CompareDatum[] = []
  for (const it of items.slice(0, COMPARE_LIMIT)) {
    if (it.quality != null) out.push({ place: it.name, metric: uiText('Качество знаний'), value: it.quality })
    if (it.success != null) out.push({ place: it.name, metric: uiText('Успеваемость'), value: it.success })
    if (it.attendanceRate != null) out.push({ place: it.name, metric: uiText('Посещаемость'), value: it.attendanceRate })
  }
  return out
}

const empty = (text: string) => <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text} style={{ margin: '40px 0' }} />

/** Динамика по неделям: три линии в процентах. */
export function TrendChart({ weeks }: { weeks: TrendPoint[] }) {
  const theme = useChartTheme()
  const data = trendData(weeks)
  if (!data.length) return empty(uiText('За период нет оценок и отметок посещаемости.'))
  return (
    <Line
      theme={theme}
      data={data}
      xField="week"
      yField="value"
      colorField="metric"
      height={300}
      scale={{ y: { domainMin: 0, domainMax: 100 } }}
      axis={{ y: { title: '%' }, x: { title: uiText('Неделя с') } }}
      point={{ shapeField: 'circle', sizeField: 3 }}
      legend={{ color: { position: 'top' } }}
    />
  )
}

/** Распределение школ по среднему баллу: кольцевая диаграмма. */
export function BandsChart({ schools }: { schools: SchoolRow[] }) {
  const theme = useChartTheme()
  const data = schoolBands(schools)
  if (!data.length) return empty(uiText('Школ нет.'))
  return (
    <Pie
      theme={theme}
      data={data}
      angleField="value"
      colorField="type"
      innerRadius={0.6}
      height={300}
      label={{ text: 'value', style: { fontWeight: 600 } }}
      legend={{ color: { position: 'bottom' } }}
    />
  )
}

/** Сравнение областей, районов или школ: сгруппированные столбцы. */
export function CompareChart({ items }: { items: CompareItem[] }) {
  const theme = useChartTheme()
  const data = compareData(items)
  if (!data.length) return empty(uiText('Нет данных для сравнения.'))
  return (
    <Column
      theme={theme}
      data={data}
      xField="place"
      yField="value"
      colorField="metric"
      group
      height={320}
      scale={{ y: { domainMin: 0, domainMax: 100 } }}
      axis={{ y: { title: '%' }, x: { labelAutoRotate: true } }}
      legend={{ color: { position: 'top' } }}
    />
  )
}
