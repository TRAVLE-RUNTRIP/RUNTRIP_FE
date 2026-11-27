// 코스 지도: 경로선, 출발·도착, 경유 장소 번호 마커 (#5). 코스 상세(#9)·러닝(#7)에서도 같은 지도를 써요.
// T map을 불러오지 못하면(앱 키 없음, 네트워크 오류) 경로 모양만 그린 그림으로 대신 보여줘요.
// 경로선 위에 진행 방향 화살표(>)를 얹고, 지도를 누르면 전체 화면으로 크게 볼 수 있어요.
// 안전 조언(#11)의 [구간 색 보기]를 켜면 경로선을 등급별 색으로 바꿔 그려요.
import { useEffect, useId, useRef, useState } from 'react'
import type { CoursePlace, CourseType, LatLng, PathPoint, Safety } from '../api/types'
import { distanceM } from '../lib/geo'
import { gradesInUse, safetyGradeColor } from '../lib/safety'
import { loadTmap, type TmapMap, type TmapNamespace, type TmapOverlay } from './tmap'

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
  /** 있으면 경로선을 안전 등급 색으로 그려요 (#11). fromIndex·toIndex는 path 위치예요 */
  safetySegments?: Safety['segments'] | null
}

/** 안전 구간의 경로선 조각 (끝점은 다음 구간 시작점과 같아요) */
const segmentPath = (path: PathPoint[], seg: Safety['segments'][number]) =>
  path.slice(Math.max(seg.fromIndex, 0), Math.min(seg.toIndex, path.length - 1) + 1)

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

const numberIcon = (n: number, color: string) =>
  svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">` +
      `<circle cx="15" cy="15" r="13" fill="${color}" stroke="#fff" stroke-width="3"/>` +
      `<text x="15" y="20" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="#fff">${n}</text>` +
      `</svg>`,
  )

const pillIcon = (text: string, width: number) =>
  svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="26" viewBox="0 0 ${width} 26">` +
      `<rect x="1.5" y="1.5" width="${width - 3}" height="23" rx="11.5" fill="${START_COLOR}" stroke="#fff" stroke-width="3"/>` +
      `<text x="${width / 2}" y="17.5" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#fff">${text}</text>` +
      `</svg>`,
  )

/** 출발·도착이 같은 곳(순환 코스)이면 마커 하나에 "출발·도착"으로 보여줘요. */
const SAME_PLACE_M = 30
function endpointPills(start: LatLng, end: LatLng, type: CourseType) {
  const same = type !== 'ONE_WAY' || distanceM(start, end) <= SAME_PLACE_M
  return same
    ? [{ at: start, text: '출발·도착', width: 70 }]
    : [
        { at: start, text: '출발', width: 44 },
        { at: end, text: '도착', width: 44 },
      ]
}

/** 화살표 간격. 긴 코스는 화살표가 너무 많지 않게 간격을 늘려요(최대 약 60개). */
const ARROW_GAP_M = 150
const MAX_ARROWS = 60

/**
 * 경로선을 따라 일정 거리마다 진행 방향 화살표 위치와 각도를 구해요.
 * 각도는 화면 기준(북쪽 = 위, 시계 방향)이에요. 지도는 회전하지 않아서 그대로 써요.
 */
function directionArrows(path: PathPoint[]): { at: LatLng; deg: number }[] {
  const pts = path.map(([lat, lng]) => ({ lat, lng }))
  let total = 0
  for (let i = 1; i < pts.length; i++) total += distanceM(pts[i - 1], pts[i])
  const gap = Math.max(ARROW_GAP_M, total / MAX_ARROWS)

  const arrows: { at: LatLng; deg: number }[] = []
  let next = gap / 2 // 출발 마커와 겹치지 않게 반 간격 뒤에서 시작
  let walked = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const seg = distanceM(a, b)
    if (seg === 0) continue
    // 경도 1도는 위도 1도보다 짧아서 cos(위도)를 곱해 화면 방향을 맞춰요.
    const dx = (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180)
    const dy = b.lat - a.lat
    const deg = (Math.atan2(dx, dy) * 180) / Math.PI
    while (next <= walked + seg) {
      const t = (next - walked) / seg
      arrows.push({ at: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }, deg })
      next += gap
    }
    walked += seg
  }
  // 도착 바로 앞 화살표는 도착 마커와 겹쳐서 빼요.
  return arrows.filter((ar) => distanceM(ar.at, pts[pts.length - 1]) > gap / 3)
}

/** 위쪽(북쪽)을 가리키는 흰 화살표를 deg만큼 돌린 아이콘. 경로선(굵기 6) 안에 들어가는 크기예요. */
const ARROW_SIZE = 14
const arrowIcon = (deg: number) =>
  svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ARROW_SIZE}" height="${ARROW_SIZE}" viewBox="0 0 14 14">` +
      `<g transform="rotate(${deg.toFixed(0)} 7 7)">` +
      `<path d="M3.5 9 L7 5.2 L10.5 9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</g></svg>`,
  )

/** 마커를 누른 직후에는 지도 누르기(전체 화면 열기)를 무시해요. 같은 손가락 동작이 둘 다 부를 수 있어서요. */
const MARKER_TAP_GUARD_MS = 400

function TmapCanvas({
  path,
  places,
  start,
  end,
  type,
  onPlaceClick,
  onMapClick,
  onFailed,
  safetySegments,
}: CourseMapProps & { onMapClick?: () => void; onFailed: () => void }) {
  const mapId = `course-map-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  // 지도를 다시 그리지 않고 최신 함수를 부르도록 ref로 들고 있어요.
  const handlers = useRef({ onPlaceClick, onMapClick, onFailed })
  useEffect(() => {
    handlers.current = { onPlaceClick, onMapClick, onFailed }
  })

  // 구간 색을 켜고 끌 때 지도를 새로 만들지 않고 경로선만 바꿔요.
  // T map은 이미 올린 선을 다시 setMap 하면 두 번 등록돼서 지도를 없앨 때 오류가 나요. routeShown으로 실제로 바뀔 때만 불러요.
  const layers = useRef<{
    T: TmapNamespace
    map: TmapMap
    route: TmapOverlay
    routeShown: boolean
    safety: TmapOverlay[]
  } | null>(null)
  const safetyRef = useRef(safetySegments)
  useEffect(() => {
    safetyRef.current = safetySegments
    applySafety()
    // 구간 정보가 바뀔 때만 다시 그려요 (추천 이유 조회 같은 다른 렌더링에는 그대로 둬요)
  }, [safetySegments])
  function applySafety() {
    const l = layers.current
    if (!l) return
    l.safety.forEach((o) => o.setMap(null))
    l.safety = []
    const segments = safetyRef.current
    const showSafety = !!segments && segments.length > 0
    if (l.routeShown === showSafety) {
      l.route.setMap(showSafety ? null : l.map)
      l.routeShown = !showSafety
    }
    if (!showSafety) return
    l.safety = segments
      .map((seg) => segmentPath(path, seg))
      .map((line, i) =>
        new l.T.Polyline({
          path: line.map(([lat, lng]) => new l.T.LatLng(lat, lng)),
          strokeColor: safetyGradeColor(segments[i].grade),
          strokeWeight: 6,
          strokeOpacity: 0.95,
          map: l.map,
        }),
      )
  }

  useEffect(() => {
    let cancelled = false
    let map: TmapMap | null = null
    let lastMarkerTap = 0
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
        type Listenable = { addListener?: (event: string, fn: () => void) => void }

        const route = new T.Polyline({ path: path.map(toLatLng), strokeColor: ROUTE_COLOR, strokeWeight: 6, strokeOpacity: 0.9, map })
        layers.current = { T, map, route, routeShown: true, safety: [] }
        applySafety()
        for (const arrow of directionArrows(path)) {
          new T.Marker({
            position: new T.LatLng(arrow.at.lat, arrow.at.lng),
            icon: arrowIcon(arrow.deg),
            iconSize: new T.Size(ARROW_SIZE, ARROW_SIZE),
            anchor: 'center',
            map,
          })
        }

        for (const pill of endpointPills(start, end, type)) {
          new T.Marker({
            position: new T.LatLng(pill.at.lat, pill.at.lng),
            icon: pillIcon(pill.text, pill.width),
            iconSize: new T.Size(pill.width, 26),
            title: pill.text,
            map,
          })
        }
        places.forEach((p) => {
          const marker = new T.Marker({
            position: new T.LatLng(p.lat, p.lng),
            icon: numberIcon(p.order, ROUTE_COLOR),
            iconSize: new T.Size(30, 30),
            title: p.name,
            map: map!,
          }) as unknown as Listenable
          const open = () => {
            lastMarkerTap = Date.now()
            handlers.current.onPlaceClick?.(p.placeId)
          }
          marker.addListener?.('click', open)
          marker.addListener?.('touchend', open)
        })

        ;(map as unknown as Listenable).addListener?.('click', () => {
          window.setTimeout(() => {
            if (Date.now() - lastMarkerTap > MARKER_TAP_GUARD_MS) handlers.current.onMapClick?.()
          }, 50)
        })

        const bounds = new T.LatLngBounds()
        path.forEach((point) => bounds.extend(toLatLng(point)))
        places.forEach((p) => bounds.extend(new T.LatLng(p.lat, p.lng)))
        map.fitBounds(bounds)
      })
      .catch(() => {
        if (!cancelled) handlers.current.onFailed()
      })
    return () => {
      cancelled = true
      layers.current = null
      // 화면을 떠날 때 SDK 정리 중 오류가 나도 앱 전체가 멈추지 않게 해요 (지도 영역은 어차피 사라져요).
      try {
        map?.destroy()
      } catch (e) {
        console.warn('T map 지도 정리 중 오류', e)
      }
    }
    // applySafety는 ref만 읽어서 코스가 바뀔 때만 다시 그려요
  }, [mapId, path, places, start, end, type])

  return <div id={mapId} className="course-map-canvas" role="img" aria-label="코스 지도" />
}

export function CourseMap(props: CourseMapProps) {
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const open = () => setExpanded(true)
  const content = (mode: 'inline' | 'full') =>
    failed ? (
      <RouteSketch {...props} />
    ) : (
      <TmapCanvas {...props} onMapClick={mode === 'inline' ? open : undefined} onFailed={() => setFailed(true)} />
    )

  return (
    <>
      <div className={`course-map${failed ? ' course-map-sketch' : ''}`} onClick={failed ? open : undefined}>
        {!expanded && content('inline')}
        <button type="button" className="course-map-expand" onClick={open} aria-label="지도 크게 보기">
          <ExpandIcon />
        </button>
        {failed && <span className="course-map-note">지도를 불러오지 못해 코스 모양만 보여드려요</span>}
        {props.safetySegments && props.safetySegments.length > 0 && <SafetyLegend segments={props.safetySegments} />}
      </div>

      {expanded && (
        <div className="course-map-full" role="dialog" aria-modal="true" aria-label="코스 지도 전체 화면">
          <div className={`course-map-full-body${failed ? ' course-map-sketch' : ''}`}>{content('full')}</div>
          {props.safetySegments && props.safetySegments.length > 0 && <SafetyLegend segments={props.safetySegments} />}
          <button type="button" className="course-map-full-close" onClick={() => setExpanded(false)} aria-label="지도 닫기">
            ×
          </button>
        </div>
      )}
    </>
  )
}

/** 지도 왼쪽 아래 등급 범례 (이 코스에 나온 등급만) */
function SafetyLegend({ segments }: { segments: Safety['segments'] }) {
  return (
    <ul className="safety-legend" aria-label="안전 구간 색 설명">
      {gradesInUse(segments).map((g) => (
        <li key={g.grade}>
          <span className="safety-legend-swatch" style={{ background: g.color }} aria-hidden="true" />
          {g.label}
        </li>
      ))}
    </ul>
  )
}

function ExpandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6" />
    </svg>
  )
}

/** T map 없이 경로 모양만 그려요. 지도를 못 불러와도 코스 모양과 장소 순서는 볼 수 있어요. */
function RouteSketch({ path, places, start, end, type, safetySegments }: Omit<CourseMapProps, 'onPlaceClick'>) {
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
  const toPoints = (line: PathPoint[]) => line.map(([lat, lng]) => xy({ lat, lng }).join(',')).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="코스 모양 (지도를 불러오지 못했어요)">
      {safetySegments && safetySegments.length > 0 ? (
        safetySegments.map((seg, i) => (
          <polyline
            key={i}
            points={toPoints(segmentPath(path, seg))}
            fill="none"
            stroke={safetyGradeColor(seg.grade)}
            strokeWidth="5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))
      ) : (
        <polyline points={toPoints(path)} fill="none" stroke={ROUTE_COLOR} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {directionArrows(path).map((arrow, i) => {
        const [x, y] = xy(arrow.at)
        return (
          <path
            key={i}
            d="M-3 2 L0 -1.5 L3 2"
            transform={`translate(${x} ${y}) rotate(${arrow.deg})`}
            fill="none"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      })}
      {endpointPills(start, end, type).map((pill) => {
        const [x, y] = xy(pill.at)
        const w = pill.width * 0.8
        return (
          <g key={pill.text}>
            <rect x={x - w / 2} y={y - 10} width={w} height="20" rx="10" fill={START_COLOR} stroke="#fff" strokeWidth="2" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
              {pill.text}
            </text>
          </g>
        )
      })}
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
  )
}
