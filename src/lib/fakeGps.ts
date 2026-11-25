// 개발용 가짜 GPS (#7). PC 브라우저는 GPS 정확도가 20m 안으로 들어오지 않아 러닝을 시작할 수 없어서,
// `npm run dev`에서만 주소에 ?fakegps 를 붙여 열면 코스 경로(없으면 시청 앞 원)를 따라 약 6분/km로 달려요.
// ?fakegps=off 로 끄고, 배포 빌드에는 들어가지 않아요.
import type { LatLng } from '../api/types'
import { distanceM } from './geo'
import type { GeoSample } from './useGeoWatch'

const FLAG_KEY = 'runtrip:fake-gps'
const SPEED_MPS = 2.8
const INTERVAL_MS = 1000

let route: LatLng[] | null = null

/** 주소의 ?fakegps 를 읽어 켜고 끄고, 지금 켜져 있는지 돌려줘요. */
export function isFakeGps(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    const flag = new URLSearchParams(window.location.search).get('fakegps')
    if (flag !== null) {
      if (flag === 'off') sessionStorage.removeItem(FLAG_KEY)
      else sessionStorage.setItem(FLAG_KEY, '1')
    }
    return sessionStorage.getItem(FLAG_KEY) === '1'
  } catch {
    return false
  }
}

/** 가짜 GPS가 따라 달릴 경로 (코스 러닝이면 코스 경로) */
export function setFakeRoute(points: LatLng[] | null) {
  route = points && points.length > 1 ? points : null
}

function defaultRoute(): LatLng[] {
  // 서울시청 앞을 중심으로 반지름 약 300m 원
  const center = { lat: 37.5663, lng: 126.9779 }
  return Array.from({ length: 37 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2
    return { lat: center.lat + 0.0027 * Math.sin(a), lng: center.lng + 0.0034 * Math.cos(a) }
  })
}

function pointAt(points: LatLng[], meters: number): LatLng {
  let left = meters
  for (let i = 1; i < points.length; i++) {
    const seg = distanceM(points[i - 1], points[i])
    if (left <= seg) {
      const k = seg === 0 ? 0 : left / seg
      return {
        lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * k,
        lng: points[i - 1].lng + (points[i].lng - points[i - 1].lng) * k,
      }
    }
    left -= seg
  }
  return points[points.length - 1]
}

/** watchPosition 대신 1초마다 가짜 위치를 보내요. 돌려준 함수로 멈춰요. */
export function startFakeWatch(onSample: (s: GeoSample) => void): () => void {
  const points = route ?? defaultRoute()
  const total = points.slice(1).reduce((sum, p, i) => sum + distanceM(points[i], p), 0)
  const started = Date.now()
  const tick = () => {
    const now = Date.now()
    const travelled = ((now - started) / 1000) * SPEED_MPS
    const here = pointAt(points, total > 0 ? travelled % total : 0)
    onSample({ ...here, accuracy: 6 + Math.random() * 4, speed: SPEED_MPS, timestamp: now })
  }
  tick()
  const id = window.setInterval(tick, INTERVAL_MS)
  return () => window.clearInterval(id)
}
