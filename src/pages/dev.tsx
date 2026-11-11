// #2 (FE-02) 실기기 검증 화면: T map 지도·경로선·마커·현재 위치, GPS 측정, Wake Lock
// 탭이나 다른 화면에서 연결하지 않아요. 휴대폰에서 /dev/map-check 로 직접 열어요.
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { LatLng, PathPoint } from '../api/types'
import { distanceM } from '../lib/geo'
import { useGeoWatch, type GeoError, type GeoSample } from '../lib/useGeoWatch'
import { useWakeLock, type WakeLockEvent } from '../lib/useWakeLock'
import { loadTmap, type TmapMap, type TmapMarker, type TmapNamespace, type TmapOverlay } from '../map/tmap'

// 시청 앞 출발, 덕수궁 → 서울광장 → 청계광장 → 광화문 샘플 경로
const SAMPLE_PATH: PathPoint[] = [
  [37.5658, 126.9751],
  [37.5662, 126.9768],
  [37.5663, 126.9779],
  [37.5679, 126.9779],
  [37.5692, 126.9776],
  [37.5718, 126.9769],
  [37.5759, 126.9769],
]
const SAMPLE_PLACES: (LatLng & { name: string })[] = [
  { name: '덕수궁', lat: 37.5658, lng: 126.9751 },
  { name: '청계광장', lat: 37.5692, lng: 126.9776 },
  { name: '광화문', lat: 37.5759, lng: 126.9769 },
]

/** 측정 기준 후보: 정확도가 이 값(m)보다 나쁘면 거리 계산에서 빼요. */
const ACCURACY_LIMIT_M = 20
/** 측정 기준 후보: 이 속도(m/s, 약 2분/km)보다 빠르게 튄 위치는 빼요. */
const JUMP_SPEED_LIMIT = 8.5

const GEO_ERROR_TEXT: Record<GeoError, string> = {
  unsupported: '이 브라우저는 위치를 지원하지 않아요',
  denied: '위치 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요',
  unavailable: '위치를 찾을 수 없어요',
  timeout: '위치 응답이 늦어요 (15초 초과)',
}

interface Stats {
  count: number
  accuracyLast: number | null
  accuracyAvg: number | null
  intervalLast: number | null
  intervalAvg: number | null
  intervalMax: number | null
  /** 가장 길게 끊긴 구간이 시작된 시각 */
  intervalMaxAt: number | null
  rawDistance: number
  filteredDistance: number
  droppedAccuracy: number
  droppedJump: number
}

function computeStats(samples: GeoSample[]): Stats {
  const n = samples.length
  let intervalSum = 0
  let intervalMax = 0
  let intervalMaxAt: number | null = null
  let rawDistance = 0
  let filteredDistance = 0
  let droppedAccuracy = 0
  let droppedJump = 0
  let lastKept: GeoSample | null = null

  samples.forEach((s, i) => {
    if (i > 0) {
      const gap = s.timestamp - samples[i - 1].timestamp
      intervalSum += gap
      if (gap > intervalMax) {
        intervalMax = gap
        intervalMaxAt = samples[i - 1].timestamp
      }
      rawDistance += distanceM(samples[i - 1], s)
    }
    if (s.accuracy > ACCURACY_LIMIT_M) {
      droppedAccuracy++
      return
    }
    if (lastKept) {
      const d = distanceM(lastKept, s)
      const dt = (s.timestamp - lastKept.timestamp) / 1000
      if (dt > 0 && d / dt > JUMP_SPEED_LIMIT) {
        droppedJump++
        return
      }
      filteredDistance += d
    }
    lastKept = s
  })

  return {
    count: n,
    accuracyLast: n ? samples[n - 1].accuracy : null,
    accuracyAvg: n ? samples.reduce((sum, s) => sum + s.accuracy, 0) / n : null,
    intervalLast: n > 1 ? samples[n - 1].timestamp - samples[n - 2].timestamp : null,
    intervalAvg: n > 1 ? intervalSum / (n - 1) : null,
    intervalMax: n > 1 ? intervalMax : null,
    intervalMaxAt,
    rawDistance,
    filteredDistance,
    droppedAccuracy,
    droppedJump,
  }
}

const fmt = (value: number | null, unit: string, digits = 0) =>
  value === null ? '-' : `${value.toFixed(digits)}${unit}`
const clock = (ms: number) => new Date(ms).toLocaleTimeString('ko-KR', { hour12: false })

export function MapCheckPage() {
  const mapId = `tmap-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const tmap = useRef<TmapNamespace | null>(null)
  const map = useRef<TmapMap | null>(null)
  const meMarker = useRef<TmapMarker | null>(null)
  const meCircle = useRef<TmapOverlay | null>(null)
  const track = useRef<TmapOverlay | null>(null)

  const [mapError, setMapError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [measuring, setMeasuring] = useState(false)
  const [follow, setFollow] = useState(true)
  const [samples, setSamples] = useState<GeoSample[]>([])
  const [current, setCurrent] = useState<GeoSample | null>(null)
  const [copied, setCopied] = useState(false)
  // 이번 측정 구간 (결과 복사는 이 구간 기록만 담아요)
  const [session, setSession] = useState<{ start: number; end: number | null } | null>(null)

  const wakeLock = useWakeLock(measuring)

  // 지도, 샘플 경로선, 장소 마커
  useEffect(() => {
    let cancelled = false
    loadTmap()
      .then((T) => {
        if (cancelled) return
        tmap.current = T
        const center = new T.LatLng(SAMPLE_PATH[0][0], SAMPLE_PATH[0][1])
        const m = new T.Map(mapId, { center, width: '100%', height: '100%', zoom: 15 })
        map.current = m

        const path = SAMPLE_PATH.map(([lat, lng]) => new T.LatLng(lat, lng))
        new T.Polyline({ path, strokeColor: '#fc5230', strokeWeight: 6, strokeOpacity: 0.9, map: m })
        SAMPLE_PLACES.forEach((p) => new T.Marker({ position: new T.LatLng(p.lat, p.lng), title: p.name, map: m }))

        const bounds = new T.LatLngBounds()
        path.forEach((point) => bounds.extend(point))
        m.fitBounds(bounds)
        setMapReady(true)
      })
      .catch((error: unknown) => {
        if (!cancelled) setMapError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      cancelled = true
      map.current?.destroy()
      map.current = null
      meMarker.current = null
      meCircle.current = null
      track.current = null
    }
  }, [mapId])

  // 처음 들어왔을 때 현재 위치를 한 번 표시해요.
  const [firstFixError, setFirstFixError] = useState<GeoError | null>(null)
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setFirstFixError('unsupported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) =>
        setCurrent({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy, speed: coords.speed, timestamp }),
      (err) => setFirstFixError(err.code === 1 ? 'denied' : err.code === 2 ? 'unavailable' : 'timeout'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }, [])

  const onSample = useCallback((sample: GeoSample) => {
    setCurrent(sample)
    setSamples((prev) => [...prev, sample])
  }, [])
  const { error: watchError } = useGeoWatch(measuring, onSample)

  // 현재 위치 마커·정확도 원·내 이동 경로를 지도에 반영해요.
  useEffect(() => {
    const T = tmap.current
    const m = map.current
    if (!mapReady || !T || !m || !current) return
    const here = new T.LatLng(current.lat, current.lng)

    if (meMarker.current) meMarker.current.setPosition(here)
    else meMarker.current = new T.Marker({ position: here, title: '내 위치', label: '나', map: m })

    meCircle.current?.setMap(null)
    meCircle.current = new T.Circle({
      center: here,
      radius: current.accuracy,
      strokeColor: '#1a73e8',
      strokeWeight: 1,
      fillColor: '#1a73e8',
      fillOpacity: 0.15,
      map: m,
    })

    if (follow) m.setCenter(here)
  }, [current, follow, mapReady])

  useEffect(() => {
    const T = tmap.current
    const m = map.current
    if (!mapReady || !T || !m) return
    track.current?.setMap(null)
    track.current =
      samples.length > 1
        ? new T.Polyline({
            path: samples.map((s) => new T.LatLng(s.lat, s.lng)),
            strokeColor: '#1a73e8',
            strokeWeight: 4,
            map: m,
          })
        : null
  }, [samples, mapReady])

  const stats = computeStats(samples)
  const geoError = watchError ?? firstFixError

  const toggleMeasuring = () => {
    if (measuring) {
      setSession((prev) => prev && { ...prev, end: Date.now() })
    } else {
      setSamples([])
      setSession({ start: Date.now(), end: null })
    }
    setMeasuring((on) => !on)
  }

  // 이번 측정 구간의 기록: 측정 시작·정지 + Wake Lock·화면 숨김/복귀 (오래된 순)
  const sessionLog: WakeLockEvent[] = session
    ? [
        { at: session.start, message: '측정 시작' },
        ...wakeLock.events.filter((e) => e.at >= session.start && (session.end === null || e.at <= session.end)).reverse(),
        ...(session.end ? [{ at: session.end, message: '측정 정지' }] : []),
      ]
    : []
  const hiddenCount = sessionLog.filter((e) => e.message === '화면 숨김').length
  const sessionSec = session ? ((session.end ?? Date.now()) - session.start) / 1000 : null
  const device = navigator.userAgent.match(/Android [\d.]+|iPhone OS [\d_]+|Windows NT [\d.]+|Mac OS X [\d_]+/)?.[0] ?? '기타'
  const browser = navigator.userAgent.match(/(?:Chrome|CriOS|Firefox|Version)\/\d+/)?.[0] ?? ''
  const REPORT_LOG_LIMIT = 15

  const report = [
    `[#2 검증 결과] ${new Date().toLocaleString('ko-KR')}`,
    `기기: ${device} / ${browser}`,
    `측정 시간 ${fmt(sessionSec, '초')}, 화면 숨김 ${hiddenCount}회, Wake Lock 지금 ${wakeLock.status}`,
    `지도: ${mapError ? `실패 (${mapError})` : mapReady ? '표시됨' : '로딩 중'}`,
    `위치 샘플 ${stats.count}개, 정확도 마지막 ${fmt(stats.accuracyLast, 'm')} / 평균 ${fmt(stats.accuracyAvg, 'm', 1)}`,
    `갱신 간격 마지막 ${fmt(stats.intervalLast && stats.intervalLast / 1000, '초', 1)} / 평균 ${fmt(stats.intervalAvg && stats.intervalAvg / 1000, '초', 1)} / 최대 ${fmt(stats.intervalMax && stats.intervalMax / 1000, '초', 1)}${stats.intervalMaxAt ? ` (${clock(stats.intervalMaxAt)}부터)` : ''}`,
    `거리 전체 ${fmt(stats.rawDistance, 'm')} / 필터 후 ${fmt(stats.filteredDistance, 'm')} (제외: 정확도 ${ACCURACY_LIMIT_M}m 초과 ${stats.droppedAccuracy}개, ${JUMP_SPEED_LIMIT}m/s 초과 ${stats.droppedJump}개)`,
    `기록${sessionLog.length > REPORT_LOG_LIMIT ? ` (마지막 ${REPORT_LOG_LIMIT}개)` : ''}:`,
    ...sessionLog.slice(-REPORT_LOG_LIMIT).map((e) => `  ${clock(e.at)} ${e.message}`),
  ].join('\n')

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="map-check">
      <div className="map-check-map">
        {/* SDK가 이 div 안을 직접 그리므로 React 자식은 바깥에 둬요. */}
        <div id={mapId} className="map-check-canvas" />
        {mapError && <p className="error map-check-overlay">지도를 불러오지 못했어요: {mapError}</p>}
        {!mapError && !mapReady && <p className="muted map-check-overlay">지도 불러오는 중…</p>}
      </div>

      <div className="screen-body stack">
        <header className="screen-header">
          <span className="screen-id">#2 FE-02</span>
          <h1>지도 · GPS · Wake Lock 검증</h1>
        </header>

        {geoError && <p className="error">{GEO_ERROR_TEXT[geoError]}</p>}

        <div className="row map-check-actions">
          <button type="button" className="primary" onClick={toggleMeasuring}>
            {measuring ? '측정 정지' : '측정 시작'}
          </button>
          <label>
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> 지도 따라가기
          </label>
        </div>

        <dl className="map-check-stats">
          <dt>현재 위치</dt>
          <dd>{current ? `${current.lat.toFixed(6)}, ${current.lng.toFixed(6)}` : '-'}</dd>
          <dt>정확도 (마지막 / 평균)</dt>
          <dd>
            {fmt(current?.accuracy ?? null, 'm')} / {fmt(stats.accuracyAvg, 'm', 1)}
          </dd>
          <dt>갱신 간격 (마지막 / 평균 / 최대)</dt>
          <dd>
            {fmt(stats.intervalLast && stats.intervalLast / 1000, '초', 1)} /{' '}
            {fmt(stats.intervalAvg && stats.intervalAvg / 1000, '초', 1)} /{' '}
            {fmt(stats.intervalMax && stats.intervalMax / 1000, '초', 1)}
          </dd>
          <dt>속도 (기기 값)</dt>
          <dd>{fmt(current?.speed ?? null, 'm/s', 1)}</dd>
          <dt>샘플 수 (제외)</dt>
          <dd>
            {stats.count} (정확도 {stats.droppedAccuracy} · 튐 {stats.droppedJump})
          </dd>
          <dt>거리 (전체 / 필터 후)</dt>
          <dd>
            {fmt(stats.rawDistance, 'm')} / {fmt(stats.filteredDistance, 'm')}
          </dd>
          <dt>측정 시간 (화면 숨김)</dt>
          <dd>
            {fmt(sessionSec, '초')} ({hiddenCount}회)
          </dd>
          <dt>Wake Lock</dt>
          <dd>{wakeLock.supported ? wakeLock.status : '지원 안 함'}</dd>
        </dl>

        {sessionLog.length > 0 && (
          <ul className="map-check-log">
            {sessionLog.toReversed().map((e) => (
              <li key={`${e.at}-${e.message}`}>
                {clock(e.at)} {e.message}
              </li>
            ))}
          </ul>
        )}

        <button type="button" onClick={copyReport}>
          {copied ? '복사했어요' : '결과 복사 (이슈 기록용)'}
        </button>
      </div>
    </section>
  )
}
