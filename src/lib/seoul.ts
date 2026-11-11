import type { LatLng } from '../api/types'

/**
 * 서울 경계를 감싸는 사각형(대략). 앱에서 먼저 막는 용도이고, 정확한 판정은 서버(OUT_OF_SEOUL)가 해요.
 * 경기도 일부가 안에 들어갈 수 있어요.
 */
const SEOUL_BOUNDS = { south: 37.413, north: 37.715, west: 126.734, east: 127.27 }

export function isRoughlyInSeoul({ lat, lng }: LatLng): boolean {
  return lat >= SEOUL_BOUNDS.south && lat <= SEOUL_BOUNDS.north && lng >= SEOUL_BOUNDS.west && lng <= SEOUL_BOUNDS.east
}

/** 밤 시간대: 한국 시간 18시 ~ 다음 날 6시. 안전 조언(#11)의 NIGHT와 같은 기준이에요. */
export const NIGHT_START_HOUR = 18
export const NIGHT_END_HOUR = 6

export function isNightInSeoul(date = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hourCycle: 'h23' }).format(date),
  )
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR
}
