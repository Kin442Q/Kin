import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Фикс иконок маркера для Webpack/Vite — Leaflet ищет sprite, который Vite не отдаёт.
// Используем CDN-урлы официальных иконок.
const DEFAULT_ICON = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = DEFAULT_ICON

interface Props {
  /** Текущая широта/долгота. null = центр карты по умолчанию (Душанбе). */
  latitude: number | null
  longitude: number | null
  /** Радиус check-in в метрах */
  radiusMeters: number
  /** Когда пользователь кликает или перетаскивает маркер — отдаём новые координаты */
  onChange: (lat: number, lon: number) => void
  height?: number
}

function ClickHandler({ onChange }: { onChange: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(
        Number(e.latlng.lat.toFixed(6)),
        Number(e.latlng.lng.toFixed(6)),
      )
    },
  })
  return null
}

/** Пересчитывает центр карты, когда координаты меняются извне (например, "Взять текущие"). */
function FlyTo({ lat, lon }: { lat: number | null; lon: number | null }) {
  const map = useMap()
  const prev = useRef<{ lat: number | null; lon: number | null }>({ lat: null, lon: null })
  useEffect(() => {
    if (lat == null || lon == null) return
    if (prev.current.lat === lat && prev.current.lon === lon) return
    prev.current = { lat, lon }
    map.flyTo([lat, lon], Math.max(map.getZoom(), 17), { duration: 0.6 })
  }, [lat, lon, map])
  return null
}

const DEFAULT_CENTER: [number, number] = [38.5598, 68.787] // Душанбе

export default function InstitutionMap({
  latitude,
  longitude,
  radiusMeters,
  onChange,
  height = 320,
}: Props) {
  const hasCoords = latitude != null && longitude != null
  const center: [number, number] = hasCoords
    ? [latitude!, longitude!]
    : DEFAULT_CENTER

  return (
    <div style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden', border: '1px solid #E8E4DA' }}>
      <MapContainer
        center={center}
        zoom={hasCoords ? 17 : 12}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <ClickHandler onChange={onChange} />
        <FlyTo lat={latitude} lon={longitude} />
        {hasCoords && (
          <>
            <Marker
              position={[latitude!, longitude!]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const pos = (e.target as L.Marker).getLatLng()
                  onChange(
                    Number(pos.lat.toFixed(6)),
                    Number(pos.lng.toFixed(6)),
                  )
                },
              }}
            />
            <Circle
              center={[latitude!, longitude!]}
              radius={Math.max(20, radiusMeters)}
              pathOptions={{
                color: '#4FB286',
                fillColor: '#4FB286',
                fillOpacity: 0.15,
                weight: 2,
              }}
            />
          </>
        )}
      </MapContainer>
    </div>
  )
}
