// 코스 지도: 경로선, 출발·도착, 경유 장소 번호 마커 (#5). 코스 상세(#9)·러닝(#7)에서도 같은 지도를 써요.
// T map을 불러오지 못하면(앱 키 없음, 네트워크 오류) 경로 모양만 그린 그림으로 대신 보여줘요.
import { useEffect, useId, useState } from 'react'
import type { CoursePlace, CourseType, LatLng, PathPoint } from '../api/types'
import { loadTmap, type TmapMap } from './tmap'

const ROUTE_COLOR = '#2f5e48' // --color-accent
const START_COLOR = '#10241b' // --color-text

interface CourseMapProps {
  path: PathPoint[]
  places: CoursePlace[]
  start: LatLng
  end: LatLng
  type: CourseType
  /** 장소 마커를 누르면 불러요 (장소 카드 열기) */
  onPlaceClick?: (placeId: string) => void
}

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

const numberIcon = (n: number) =>
  svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">` +
      `<circle cx="15" cy="15" r="13" fill="${ROUTE_COLOR}" stroke="#fff" stroke-width="3"/>` +
      `<text x="15" y="20" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="#fff">${n}</text>` +
      `</svg>`,
  )

const pillIcon = (text: string) =>
  svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="26" viewBox="0 0 44 26">` +
      `<rect x="1.5" y="1.5" width="41" height="23" rx="11.5" fill="${START_COLOR}" stroke="#fff" stroke-width="3"/>` +
      `<text x="22" y="17.5" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#fff">${text}</text>` +
      `</svg>`,
  )

export function CourseMap({ path, places, start, end, type, onPlaceClick }: CourseMapProps) {
  const mapId = `course-map-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let map: TmapMap | null = null
    loadTmap()
      .then((T) => {
        if (cancelled) return
        const toLatLng = ([lat, lng]: PathPoint) => new T.LatLng(lat, lng)
        map = new T.Map(mapId, {
          center: new T.LatLng(start.lat, start.lng),
          width: '100%',
          height: '100%',
          zoom: 15,
          zoomControl: false,
        })

        const line = path.map(toLatLng)
        new T.Polyline({ path: line, strokeColor: ROUTE_COLOR, strokeWeight: 6, strokeOpacity: 0.9, map })

        new T.Marker({
          position: new T.LatLng(start.lat, start.lng),
          icon: pillIcon('출발'),
          iconSize: new T.Size(44, 26),
          title: '출발',
          map,
        })
        if (type === 'ONE_WAY') {
          new T.Marker({
            position: new T.LatLng(end.lat, end.lng),
            icon: pillIcon('도착'),
            iconSize: new T.Size(44, 26),
            title: '도착',
            map,
          })
        }
        places.forEach((p) => {
          const marker = new T.Marker({
            position: new T.LatLng(p.lat, p.lng),
            icon: numberIcon(p.order),
            iconSize: new T.Size(30, 30),
            title: p.name,
            map: map!,
          }) as unknown as { addListener?: (event: string, fn: () => void) => void }
          if (onPlaceClick) {
            marker.addListener?.('click', () => onPlaceClick(p.placeId))
            marker.addListener?.('touchend', () => onPlaceClick(p.placeId))
          }
        })

        const bounds = new T.LatLngBounds()
        line.forEach((point) => bounds.extend(point))
        places.forEach((p) => bounds.extend(new T.LatLng(p.lat, p.lng)))
        map.fitBounds(bounds)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      map?.destroy()
    }
    // 코스가 바뀔 때만 다시 그려요 (onPlaceClick은 매번 새 함수라 제외)
  }, [mapId, path, places, start, end, type])

  if (failed) return <RouteSketch path={path} places={places} start={start} end={end} type={type} />
  return <div id={mapId} className="course-map" role="img" aria-label="코스 지도" />
}

/** T map 없이 경로 모양만 그려요. 지도를 못 불러와도 코스 모양과 장소 순서는 볼 수 있어요. */
function RouteSketch({ path, places, start, end, type }: Omit<CourseMapProps, 'onPlaceClick'>) {
  const W = 360
  const H = 240
  const PAD = 28
  const points: LatLng[] = [...path.map(([lat, lng]) => ({ lat, lng })), ...places, start, end]
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180)) // 경도 1도는 위도 1도보다 짧아요
  const spanX = Math.max((maxLng - minLng) * kx, 1e-6)
  const spanY = Math.max(maxLat - minLat, 1e-6)
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY)
  const offX = (W - spanX * scale) / 2
  const offY = (H - spanY * scale) / 2
  const xy = (p: LatLng) => [offX + (p.lng - minLng) * kx * scale, H - offY - (p.lat - minLat) * scale] as const

  const line = path.map(([lat, lng]) => xy({ lat, lng }).join(',')).join(' ')
  const [sx, sy] = xy(start)
  const [ex, ey] = xy(end)

  return (
    <div className="course-map course-map-sketch">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="코스 모양 (지도를 불러오지 못했어요)">
        <polyline points={line} fill="none" stroke={ROUTE_COLOR} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
        {type === 'ONE_WAY' && <circle cx={ex} cy={ey} r="7" fill="#fff" stroke={START_COLOR} strokeWidth="3" />}
        <circle cx={sx} cy={sy} r="7" fill={START_COLOR} stroke="#fff" strokeWidth="3" />
        {places.map((p) => {
          const [x, y] = xy(p)
          return (
            <g key={p.placeId}>
              <circle cx={x} cy={y} r="11" fill={ROUTE_COLOR} stroke="#fff" strokeWidth="2.5" />
              <text x={x} y={y + 4.5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
                {p.order}
              </text>
            </g>
          )
        })}
      </svg>
      <span className="course-map-note">지도를 불러오지 못해 코스 모양만 보여드려요</span>
    </div>
  )
}
