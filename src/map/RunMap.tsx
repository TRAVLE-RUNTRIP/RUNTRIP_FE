// 러닝 측정 지도 (#7, M-21): 코스 경로선·장소 마커, 내가 달린 경로(끊긴 구간은 따로), 내 위치, 따라가기.
import { useEffect, useId, useRef, useState } from 'react'
import type { LatLng, PathPoint } from '../api/types'
import type { RunCourse } from '../lib/runTracker'
import { loadTmap, type TmapMap, type TmapMarker, type TmapNamespace, type TmapOverlay } from './tmap'

const COURSE_COLOR = '#98c9b0' // 코스 경로는 연하게, 내가 달린 경로를 진하게
const TRACK_COLOR = '#2f5e48' // --color-accent
const START_COLOR = '#10241b'
const ME_COLOR = '#1a73e8'

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

const placeIcon = (n: number, visited: boolean) =>
  svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">` +
      `<circle cx="15" cy="15" r="13" fill="${visited ? '#98fbcb' : TRACK_COLOR}" stroke="#fff" stroke-width="3"/>` +
      `<text x="15" y="20" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="${visited ? START_COLOR : '#fff'}">${n}</text>` +
      `</svg>`,
  )

const startIcon = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="26" viewBox="0 0 44 26">` +
    `<rect x="1.5" y="1.5" width="41" height="23" rx="11.5" fill="${START_COLOR}" stroke="#fff" stroke-width="3"/>` +
    `<text x="22" y="17.5" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#fff">출발</text>` +
    `</svg>`,
)

const meIcon = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
    `<circle cx="12" cy="12" r="11" fill="${ME_COLOR}" fill-opacity="0.2"/>` +
    `<circle cx="12" cy="12" r="6.5" fill="${ME_COLOR}" stroke="#fff" stroke-width="2.5"/>` +
    `</svg>`,
)

interface RunMapProps {
  course: RunCourse | null
  segments: PathPoint[][]
  current: LatLng | null
  visitedPlaceIds: string[]
  /** 켜져 있으면 내 위치가 바뀔 때마다 지도 가운데로 옮겨요. */
  follow: boolean
  /** 값이 바뀌면 지금 위치로 바로 옮겨요 ([내 위치로]). */
  recenterKey: number
  onPlaceClick?: (placeId: string) => void
  /** 켜져 있으면 달린 경로(코스 러닝은 코스까지)가 한 화면에 들어오게 맞춰요 (M-22). */
  fitTrack?: boolean
  /** 지도를 못 불러왔을 때 문구 */
  failedText?: string
}

export function RunMap({
  course,
  segments,
  current,
  visitedPlaceIds,
  follow,
  recenterKey,
  onPlaceClick,
  fitTrack = false,
  failedText = '지도를 불러오지 못했어요. 측정은 계속돼요.',
}: RunMapProps) {
  const mapId = `run-map-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const tmap = useRef<TmapNamespace | null>(null)
  const map = useRef<TmapMap | null>(null)
  const me = useRef<TmapMarker | null>(null)
  const tracks = useRef<TmapOverlay[]>([])
  const placeMarkers = useRef<TmapOverlay[]>([])
  const clickRef = useRef(onPlaceClick)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    clickRef.current = onPlaceClick
  })

  // 지도와 코스 경로선
  useEffect(() => {
    let cancelled = false
    loadTmap()
      .then((T) => {
        if (cancelled) return
        const center = course?.start ?? current ?? { lat: 37.5663, lng: 126.9779 }
        const m = new T.Map(mapId, {
          center: new T.LatLng(center.lat, center.lng),
          width: '100%',
          height: '100%',
          zoom: 17,
          zoomControl: false,
        })
        tmap.current = T
        map.current = m
        if (course) {
          new T.Polyline({
            path: course.path.map(([lat, lng]) => new T.LatLng(lat, lng)),
            strokeColor: COURSE_COLOR,
            strokeWeight: 8,
            strokeOpacity: 0.9,
            map: m,
          })
          new T.Marker({
            position: new T.LatLng(course.start.lat, course.start.lng),
            icon: startIcon,
            iconSize: new T.Size(44, 26),
            title: '출발',
            map: m,
          })
        }
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      map.current?.destroy()
      map.current = null
      tmap.current = null
      me.current = null
      tracks.current = []
      placeMarkers.current = []
      setReady(false)
    }
    // 지도는 코스가 바뀔 때만 새로 만들어요 (current는 처음 가운데로만 써요).
  }, [mapId, course])

  // 장소 마커: 방문하면 색이 바뀌어요.
  useEffect(() => {
    const T = tmap.current
    const m = map.current
    if (!ready || !T || !m || !course) return
    placeMarkers.current.forEach((mk) => mk.setMap(null))
    placeMarkers.current = course.places.map((p) => {
      const marker = new T.Marker({
        position: new T.LatLng(p.lat, p.lng),
        icon: placeIcon(p.order, visitedPlaceIds.includes(p.placeId)),
        iconSize: new T.Size(30, 30),
        title: p.name,
        map: m,
      })
      const withEvents = marker as unknown as { addListener?: (event: string, fn: () => void) => void }
      withEvents.addListener?.('click', () => clickRef.current?.(p.placeId))
      withEvents.addListener?.('touchend', () => clickRef.current?.(p.placeId))
      return marker
    })
  }, [ready, course, visitedPlaceIds])

  // 내가 달린 경로: 끝난 구간은 그대로 두고 마지막 구간만 다시 그려요.
  useEffect(() => {
    const T = tmap.current
    const m = map.current
    if (!ready || !T || !m) return
    const lines = tracks.current
    while (lines.length > segments.length) lines.pop()?.setMap(null)
    segments.forEach((seg, i) => {
      const isLast = i === segments.length - 1
      if (lines[i] && !isLast) return
      lines[i]?.setMap(null)
      lines[i] = new T.Polyline({
        path: (seg.length > 1 ? seg : [seg[0], seg[0]]).map(([lat, lng]) => new T.LatLng(lat, lng)),
        strokeColor: TRACK_COLOR,
        strokeWeight: 6,
        strokeOpacity: 1,
        map: m,
      })
    })

    if (fitTrack) {
      const points = [...segments.flat(), ...(course?.path ?? [])]
      if (points.length > 0) {
        const bounds = new T.LatLngBounds()
        points.forEach(([lat, lng]) => bounds.extend(new T.LatLng(lat, lng)))
        m.fitBounds(bounds)
      }
    }
  }, [ready, segments, fitTrack, course])

  // 내 위치와 따라가기
  useEffect(() => {
    const T = tmap.current
    const m = map.current
    if (!ready || !T || !m || !current) return
    const here = new T.LatLng(current.lat, current.lng)
    if (me.current) me.current.setPosition(here)
    else me.current = new T.Marker({ position: here, icon: meIcon, iconSize: new T.Size(24, 24), title: '내 위치', map: m })
    if (follow) m.setCenter(here)
  }, [ready, current, follow])

  // [내 위치로]
  useEffect(() => {
    const T = tmap.current
    const m = map.current
    if (!ready || !T || !m || !current || recenterKey === 0) return
    m.setCenter(new T.LatLng(current.lat, current.lng))
    m.setZoom(17)
    // 버튼을 누른 순간에만 옮겨요.
  }, [recenterKey, ready])

  if (failed) {
    return (
      <div className="run-map run-map-failed">
        <p>{failedText}</p>
      </div>
    )
  }
  return <div id={mapId} className="run-map" role="img" aria-label="러닝 지도" />
}
