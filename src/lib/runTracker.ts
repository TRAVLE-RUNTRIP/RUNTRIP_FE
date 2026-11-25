// 러닝 측정 기록 (#7, 기능명세서 F-11·F-12). 화면과 상관없는 계산만 모았어요.
// 기록은 기기(localStorage)에 계속 저장해서 새로고침·앱 종료 뒤에도 이어가거나 완료 화면(#8)에서 쓸 수 있어요.
import type { Course, LatLng, PathPoint, RunType } from '../api/types'
import { distanceM } from './geo'
import type { GeoSample } from './useGeoWatch'

/** 정확도가 이 값(m)보다 나쁜 위치는 거리 계산에서 빼요 (#2 실측). */
export const ACCURACY_LIMIT_M = 20
/** 직전 위치에서 이 속도(m/s, 약 2분/km)보다 빠르게 튄 위치는 빼요 (#2 실측). */
export const JUMP_SPEED_LIMIT = 8.5
/** 제자리 GPS 흔들림이 거리로 쌓이지 않게, 직전 위치에서 이만큼(m) 움직여야 더해요. */
export const MIN_STEP_M = 2
/** 위치가 이 시간(ms) 넘게 끊기면 구간을 나눠요. 끊긴 동안은 거리에 더하지 않고 직선으로 잇지도 않아요. */
export const GAP_SPLIT_MS = 15_000
/** 경로 위 장소 지점(routeLat/routeLng)에서 이 거리(m) 안에 들어오면 방문으로 봐요 (F-08). */
export const PLACE_RADIUS_M = 50
/** 현재 페이스는 최근 이 시간(ms) 동안 달린 거리로 계산해요. */
const PACE_WINDOW_MS = 30_000

export type RunStatus = 'running' | 'paused' | 'finished'

/** 러닝 화면에서 쓰는 코스 정보 (API 9 응답 중 필요한 것만) */
export type RunCourse = Pick<Course, 'courseId' | 'name' | 'type' | 'distanceKm' | 'start' | 'end' | 'path' | 'places'>

export interface RunDraft {
  version: 1
  /** API 11의 runId. 같은 기록을 두 번 저장하지 않게 앱에서 만들어요. */
  runId: string
  type: RunType
  course: RunCourse | null
  status: RunStatus
  startedAtMs: number
  endedAtMs: number | null
  /** 지금 측정 중이면 이번 구간을 시작한 시각, 멈춰 있으면 null */
  activeSinceMs: number | null
  /** 멈추기 전까지 측정한 시간 합계 (지금 구간 제외) */
  elapsedMs: number
  distanceM: number
  /** 끊긴 곳마다 나눈 경로. 구간끼리는 잇지 않아요. */
  segments: PathPoint[][]
  /** 거리 계산에 쓴 마지막 위치. 멈추거나 끊기면 null이 되어 다음 위치부터 새 구간을 시작해요. */
  lastPoint: { lat: number; lng: number; t: number } | null
  /** 현재 페이스용 최근 기록 (시각, 그때까지의 거리) */
  recent: { t: number; d: number }[]
  visitedPlaceIds: string[]
  /** 마지막으로 기기에 저장한 시각. 앱이 꺼졌다 켜졌을 때 끊긴 시간을 빼는 데 써요. */
  updatedAtMs: number
}

function newRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // https가 아닌 주소(같은 와이파이 휴대폰 테스트)에서는 randomUUID가 없어요.
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16))
  hex[12] = '4'
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  const s = hex.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}

export function createDraft(type: RunType, course: RunCourse | null, now: number): RunDraft {
  return {
    version: 1,
    runId: newRunId(),
    type,
    course,
    status: 'running',
    startedAtMs: now,
    endedAtMs: null,
    activeSinceMs: now,
    elapsedMs: 0,
    distanceM: 0,
    segments: [],
    lastPoint: null,
    recent: [],
    visitedPlaceIds: [],
    updatedAtMs: now,
  }
}

/** 측정한 시간 (멈춘 시간·끊긴 시간 제외) */
export function elapsedMsAt(d: RunDraft, now: number): number {
  return d.elapsedMs + (d.activeSinceMs !== null ? Math.max(0, now - d.activeSinceMs) : 0)
}

/** 위치 하나를 기록에 더해요. 측정 중이 아니거나 거를 위치면 그대로 돌려줘요. */
export function addSample(d: RunDraft, s: GeoSample): RunDraft {
  if (d.status !== 'running' || s.accuracy > ACCURACY_LIMIT_M) return d
  if (d.activeSinceMs !== null && s.timestamp < d.activeSinceMs) return d // 멈추기 전에 측정된 위치

  const point: PathPoint = [s.lat, s.lng]
  const here = { lat: s.lat, lng: s.lng, t: s.timestamp }
  const last = d.lastPoint

  // 측정 시작·다시 시작 직후, 또는 위치가 오래 끊긴 뒤: 새 구간을 시작해요.
  if (!last || s.timestamp - last.t > GAP_SPLIT_MS) {
    return {
      ...d,
      segments: [...d.segments, [point]],
      lastPoint: here,
      recent: [{ t: s.timestamp, d: d.distanceM }],
      updatedAtMs: s.timestamp,
    }
  }

  const step = distanceM(last, s)
  const dt = (s.timestamp - last.t) / 1000
  if (dt <= 0 || step / dt > JUMP_SPEED_LIMIT) return d // 튄 위치
  if (step < MIN_STEP_M) return d // 제자리 흔들림 (움직임이 쌓이면 다음 위치에서 더해져요)

  const distance = d.distanceM + step
  const segments = d.segments.slice()
  segments[segments.length - 1] = [...segments[segments.length - 1], point]
  const recent = [...d.recent, { t: s.timestamp, d: distance }].filter((r) => s.timestamp - r.t <= PACE_WINDOW_MS)

  return { ...d, distanceM: distance, segments, lastPoint: here, recent, updatedAtMs: s.timestamp }
}

export function pauseRun(d: RunDraft, at: number): RunDraft {
  if (d.status !== 'running' || d.activeSinceMs === null) return d
  return {
    ...d,
    status: 'paused',
    elapsedMs: d.elapsedMs + Math.max(0, at - d.activeSinceMs),
    activeSinceMs: null,
    lastPoint: null,
    recent: [],
    updatedAtMs: at,
  }
}

export function resumeRun(d: RunDraft, now: number): RunDraft {
  if (d.status !== 'paused') return d
  return { ...d, status: 'running', activeSinceMs: now, lastPoint: null, recent: [], updatedAtMs: now }
}

export function finishRun(d: RunDraft, now: number): RunDraft {
  const paused = pauseRun(d, now)
  return { ...paused, status: 'finished', endedAtMs: now, updatedAtMs: now }
}

/**
 * 앱이 꺼졌다 켜지거나 새로고침으로 다시 열었을 때: 마지막 저장 이후 시간은 빼고 멈춘 상태로 바꿔요.
 * 다시 시작하면 새 구간으로 이어져요.
 */
export function interruptRun(d: RunDraft): RunDraft {
  return d.status === 'running' ? pauseRun(d, Math.max(d.updatedAtMs, d.activeSinceMs ?? 0)) : d
}

/** 현재 페이스(초/km). 최근 30초 동안 거의 움직이지 않았으면 null */
export function currentPaceSec(d: RunDraft): number | null {
  if (d.recent.length < 2) return null
  const first = d.recent[0]
  const last = d.recent[d.recent.length - 1]
  const meters = last.d - first.d
  const sec = (last.t - first.t) / 1000
  if (meters < 10 || sec < 5) return null
  return (sec / meters) * 1000
}

/** 평균 페이스(초/km). 거리가 너무 짧으면 null */
export function avgPaceSec(d: RunDraft, now: number): number | null {
  if (d.distanceM < 10) return null
  return (elapsedMsAt(d, now) / 1000 / d.distanceM) * 1000
}

/** 이번 위치로 새로 방문한 장소 (코스 러닝만). 순서대로 돌려줘요. */
export function newlyVisited(d: RunDraft, s: GeoSample): string[] {
  if (!d.course || d.status !== 'running' || s.accuracy > ACCURACY_LIMIT_M) return []
  return d.course.places
    .filter((p) => !d.visitedPlaceIds.includes(p.placeId))
    .filter((p) => distanceM({ lat: p.routeLat, lng: p.routeLng }, s) <= PLACE_RADIUS_M)
    .sort((a, b) => a.order - b.order)
    .map((p) => p.placeId)
}

/** 아직 방문하지 않은 장소 중 순서가 가장 빠른 곳 */
export function nextPlace(d: RunDraft) {
  if (!d.course) return null
  return [...d.course.places].sort((a, b) => a.order - b.order).find((p) => !d.visitedPlaceIds.includes(p.placeId)) ?? null
}

export const routePointOf = (p: { routeLat: number; routeLng: number }): LatLng => ({ lat: p.routeLat, lng: p.routeLng })

// ---- 기기 저장 ----

const STORAGE_KEY = 'runtrip:run-draft'

export function loadDraft(): RunDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as RunDraft
    return d?.version === 1 && typeof d.runId === 'string' ? d : null
  } catch {
    return null
  }
}

export function saveDraft(d: RunDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
  } catch {
    // 저장 공간이 없거나 막힌 경우: 측정은 계속하고 복구만 못 해요.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 무시
  }
}

// ---- 표시 ----

/** 3:05, 1:02:09 */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** 5'30" (null이면 -'--") */
export function formatPace(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec) || sec > 99 * 60) return `-'--"`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return s === 60 ? `${m + 1}'00"` : `${m}'${String(s).padStart(2, '0')}"`
}

/** 0.00 (km) */
export const formatKm = (meters: number) => (Math.floor(meters / 10) / 100).toFixed(2)

/** 350m, 1.2km */
export const formatMeters = (meters: number) =>
  meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(meters / 1000).toFixed(1)}km`
