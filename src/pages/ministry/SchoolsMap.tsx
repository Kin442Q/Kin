import { useEffect } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { uiText } from '../../i18n/uiText'
import type { SchoolRow } from '../../api/ministryApi'
import { num, pct, placeName } from './shared'

/** Центр Таджикистана: карта открывается на всю страну, пока нет школ с координатами. */
const TAJIKISTAN: [number, number] = [38.9, 71.0]

/** Цвет метки по среднему баллу: красный — низкий, зелёный — высокий, серый — оценок нет. */
export function markerColor(avgPercent: number | null): string {
  if (avgPercent == null) return '#94a3b8'
  const t = Math.min(1, Math.max(0, (avgPercent - 50) / 50))
  return `hsl(${Math.round(t * 130)}, 70%, 42%)`
}

function FitToSchools({ points }: { points: Array<[number, number]> }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 12 })
  }, [points, map])
  return null
}

/**
 * Карта школ: метка на каждую школу с координатами, цвет — средний балл. У школ без координат
 * метки нет (их число показано над картой): координаты школа задаёт в настройках.
 */
export default function SchoolsMap({ schools, height = 520 }: { schools: SchoolRow[]; height?: number }) {
  const located = schools.filter((s) => s.latitude != null && s.longitude != null)
  const points = located.map((s) => [s.latitude!, s.longitude!] as [number, number])

  return (
    <div style={{ height, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--sp-border)' }}>
      <MapContainer center={TAJIKISTAN} zoom={7} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FitToSchools points={points} />
        {located.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.latitude!, s.longitude!]}
            radius={8}
            pathOptions={{ color: '#fff', weight: 2, fillColor: markerColor(s.avgPercent), fillOpacity: 0.95 }}
          >
            <Popup>
              <strong>{s.name}</strong>
              <br />
              {[placeName(s.region), placeName(s.district)].join(' · ')}
              <br />
              {uiText('Средний балл')}: {pct(s.avgPercent)}
              <br />
              {uiText('Качество знаний')}: {pct(s.quality)}
              <br />
              {uiText('Посещаемость')}: {pct(s.attendanceRate)}
              <br />
              {uiText('Учеников на учителя')}: {num(s.studentsPerTeacher)}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
