// API 명세 예시를 바탕으로 만든 mock 데이터예요. 실제 장소·경로가 아니에요.
import { distanceM } from '../../lib/geo'
import type { Course, CoursePlace, LatLng, LocationResult, PathPoint, User } from '../types'

export const MOCK_USER: User = { userId: 1, nickname: '테스트러너', email: 'test@runtrip.test' }
export const MOCK_PASSWORD = 'runtrip1234'

// 3. 장소 검색 mock 결과 (서울 안만, 좌표는 대략)
export const MOCK_LOCATIONS: LocationResult[] = [
  { name: '경복궁', address: '서울 종로구 사직로 161', lat: 37.5796, lng: 126.977 },
  { name: '광화문 광장', address: '서울 종로구 세종대로 172', lat: 37.5724, lng: 126.9769 },
  { name: '서울광장', address: '서울 중구 세종대로 110', lat: 37.5663, lng: 126.9779 },
  { name: '청계광장', address: '서울 종로구 서린동 14', lat: 37.5692, lng: 126.9776 },
  { name: '남산서울타워', address: '서울 용산구 남산공원길 105', lat: 37.5512, lng: 126.9882 },
  { name: '서울숲', address: '서울 성동구 뚝섬로 273', lat: 37.5444, lng: 127.0374 },
  { name: '여의도 한강공원', address: '서울 영등포구 여의동로 330', lat: 37.5284, lng: 126.9327 },
  { name: '롯데월드타워', address: '서울 송파구 올림픽로 300', lat: 37.5126, lng: 127.1025 },
  { name: '북한산 우이역', address: '서울 강북구 삼양로 지하 552', lat: 37.6633, lng: 127.0124 },
]

// 시청 앞을 출발해 덕수궁 → 청계천 → 시청으로 돌아오는 가짜 순환 경로
const LOOP_PATH: PathPoint[] = [
  [37.5658, 126.9751],
  [37.5661, 126.9755],
  [37.5662, 126.9738],
  [37.5671, 126.9724],
  [37.5689, 126.9733],
  [37.5697, 126.9768],
  [37.5693, 126.9803],
  [37.5689, 126.9839],
  [37.5679, 126.9842],
  [37.5671, 126.9806],
  [37.5664, 126.9778],
  [37.5658, 126.9751],
]

const MOCK_PLACES: CoursePlace[] = [
  {
    placeId: 'T1116925',
    order: 1,
    name: '덕수궁 돌담길',
    category: '관광 명소',
    lat: 37.5662,
    lng: 126.9736,
    routeLat: 37.5662,
    routeLng: 126.9738,
    overview: '덕수궁 담장을 따라 이어지는 산책길이에요. (mock)',
    imageUrl: null,
    imageCredit: '한국관광공사',
    reason: null,
  },
  {
    placeId: 'T128961',
    order: 2,
    name: '청계천',
    category: '자연·공원',
    lat: 37.5691,
    lng: 126.9805,
    routeLat: 37.5693,
    routeLng: 126.9803,
    overview: null,
    imageUrl: null,
    imageCredit: null,
    reason: null,
  },
]

export function buildMockCourse(courseId: number, overrides: Partial<Course> = {}): Course {
  return {
    courseId,
    name: '덕수궁·청계천 코스',
    type: 'LOOP',
    distanceKm: 5.2,
    estimatedMinutes: 31,
    start: { lat: 37.5658, lng: 126.9751 },
    end: { lat: 37.5658, lng: 126.9751 },
    region: '서울 중구',
    preferences: ['NIGHT_VIEW', 'NATURE'],
    path: LOOP_PATH,
    places: MOCK_PLACES.map((p) => ({ ...p })),
    safety: {
      timeBand: 'NIGHT',
      score: 81,
      level: '좋음',
      coverage: 0.59,
      estimated: 0.41,
      hasLowSegment: true,
      segments: [
        { fromIndex: 0, toIndex: 4, grade: '적음' },
        { fromIndex: 4, toIndex: 11, grade: '큰길(조명 추정)' },
      ],
      warnings: ['밤에는 확인된 가로등이 적은 구간이 있어요. 밝은 옷과 라이트를 챙기세요'],
    },
    saved: false,
    savedAt: null,
    ...overrides,
  }
}

export const MOCK_REASONS: Record<string, string> = {
  T1116925: '돌담을 따라 조명이 이어져 밤에도 걷기 편해요',
  T128961: '물길을 따라 신호 없이 달릴 수 있어요',
  M2001: '차 없는 고가 보행길이라 멈추지 않고 달리기 좋아요',
  M2002: '완만한 숲길이라 페이스를 유지하기 편해요',
  M2003: '해가 지면 서울 야경이 한눈에 보여요',
  M3001: '성곽을 따라 조명이 켜져 밤 풍경이 예뻐요',
  M3002: '골목마다 벽화가 있어 천천히 둘러보기 좋아요',
}

// ---- 5. 코스 생성 mock (#5) ----
// 출발지·목표 거리에 맞춰 가짜 경로를 만들어요. 다시 만들기(excludedCombos)를 확인할 수 있게
// 장소 조합 3개를 차례로 돌려주고, 모두 보여주면 NO_MORE_COURSES가 나요.

type MockPlaceSeed = Pick<CoursePlace, 'placeId' | 'name' | 'category' | 'overview' | 'imageCredit'>

const MOCK_COMBOS: MockPlaceSeed[][] = [
  MOCK_PLACES.map(({ placeId, name, category, overview, imageCredit }) => ({
    placeId,
    name,
    category,
    overview,
    imageCredit,
  })),
  [
    { placeId: 'M2001', name: '서울로 7017', category: '관광 명소', overview: '옛 고가도로를 고친 보행길이에요. (mock)', imageCredit: null },
    { placeId: 'M2002', name: '남산 둘레길', category: '자연·공원', overview: null, imageCredit: null },
    { placeId: 'M2003', name: '남산 전망대', category: '야경', overview: '서울 시내가 내려다보이는 전망대예요. (mock)', imageCredit: null },
  ],
  [
    { placeId: 'M3001', name: '낙산공원 성곽길', category: '야경', overview: '한양도성을 따라 걷는 길이에요. (mock)', imageCredit: null },
    { placeId: 'M3002', name: '이화 벽화마을', category: '관광 명소', overview: null, imageCredit: null },
  ],
]

const M_PER_DEG_LAT = 111_320

function offset(origin: LatLng, northM: number, eastM: number): LatLng {
  return {
    lat: origin.lat + northM / M_PER_DEG_LAT,
    lng: origin.lng + eastM / (M_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180)),
  }
}

function pathLengthKm(path: PathPoint[]): number {
  let m = 0
  for (let i = 1; i < path.length; i++) {
    m += distanceM({ lat: path[i - 1][0], lng: path[i - 1][1] }, { lat: path[i][0], lng: path[i][1] })
  }
  return m / 1000
}

/** 출발지를 지나는 둥근 순환 경로. 방향(angle)을 바꿔 조합마다 다른 모양이 나와요. */
function loopPath(start: LatLng, km: number, angle: number): PathPoint[] {
  const N = 36
  const r = (km * 1000) / (2 * Math.PI)
  const center = offset(start, r * Math.sin(angle), r * Math.cos(angle))
  const points: PathPoint[] = []
  for (let k = 0; k <= N; k++) {
    const t = (2 * Math.PI * k) / N
    const theta = angle + Math.PI + t
    const wobble = 1 + 0.05 * Math.sin(3 * t) // 원 그대로면 어색해서 조금 울퉁불퉁하게
    const p = offset(center, r * wobble * Math.sin(theta), r * wobble * Math.cos(theta))
    points.push([p.lat, p.lng])
  }
  points[N] = points[0]
  return points
}

/** 출발지에서 도착지로 휘어 가는 편도 경로. 휘는 정도를 목표 거리에 맞춰 찾아요. */
function oneWayPath(start: LatLng, end: LatLng, km: number, side: number): PathPoint[] {
  const N = 30
  const mid = { lat: (start.lat + end.lat) / 2, lng: (start.lng + end.lng) / 2 }
  const northM = (end.lat - start.lat) * M_PER_DEG_LAT
  const eastM = (end.lng - start.lng) * M_PER_DEG_LAT * Math.cos((start.lat * Math.PI) / 180)
  const len = Math.hypot(northM, eastM) || 1

  const curve = (bulgeM: number): PathPoint[] => {
    const control = offset(mid, (eastM / len) * bulgeM * side, (-northM / len) * bulgeM * side)
    const points: PathPoint[] = []
    for (let k = 0; k <= N; k++) {
      const t = k / N
      const a = (1 - t) ** 2
      const b = 2 * (1 - t) * t
      const c = t ** 2
      points.push([a * start.lat + b * control.lat + c * end.lat, a * start.lng + b * control.lng + c * end.lng])
    }
    return points
  }

  // 휘는 정도(m)를 이분 탐색으로 맞춰요. 도착지가 목표보다 멀면 거의 직선이 돼요.
  let lo = 0
  let hi = km * 1000
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2
    if (pathLengthKm(curve(m)) < km) lo = m
    else hi = m
  }
  return curve(lo)
}

const comboKey = (ids: string[]) => ids.join(',')

/** 5. 코스 생성 mock. 더 보여줄 조합이 없으면 null */
export function generateMockCourse(
  courseId: number,
  req: { start: LatLng; end: LatLng | null; targetKm: number; preferences: Course['preferences']; excludedCombos: string[][] },
): Course | null {
  const excluded = new Set(req.excludedCombos.map(comboKey))
  const index = MOCK_COMBOS.findIndex((combo) => !excluded.has(comboKey(combo.map((p) => p.placeId))))
  if (index < 0) return null
  const seeds = MOCK_COMBOS[index]

  const type = req.end ? 'ONE_WAY' : 'LOOP'
  const end = req.end ?? req.start
  const path =
    type === 'LOOP'
      ? loopPath(req.start, req.targetKm, (index * 2 * Math.PI) / 3 + Math.PI / 4)
      : oneWayPath(req.start, end, req.targetKm, index % 2 === 0 ? 1 : -1)

  const places: CoursePlace[] = seeds.map((seed, i) => {
    const at = path[Math.round(((i + 1) * (path.length - 1)) / (seeds.length + 1))]
    const spot = offset({ lat: at[0], lng: at[1] }, 25, 15) // 장소는 경로에서 조금 떨어져 있어요
    return {
      ...seed,
      order: i + 1,
      lat: spot.lat,
      lng: spot.lng,
      routeLat: at[0],
      routeLng: at[1],
      imageUrl: null,
      reason: null,
    }
  })

  const distanceKm = Math.round(pathLengthKm(path) * 10) / 10
  const third = Math.floor((path.length - 1) / 3)
  const base = buildMockCourse(courseId)
  return buildMockCourse(courseId, {
    name: type === 'LOOP' ? `${seeds[0].name}·${seeds[1].name} 코스` : `${seeds[0].name} → ${seeds[seeds.length - 1].name} 코스`,
    type,
    distanceKm,
    estimatedMinutes: Math.round(distanceKm * 6),
    start: req.start,
    end,
    preferences: req.preferences,
    path,
    places,
    safety: base.safety && {
      ...base.safety,
      segments: [
        { fromIndex: 0, toIndex: third, grade: '적음' },
        { fromIndex: third, toIndex: path.length - 1, grade: '큰길(조명 추정)' },
      ],
    },
  })
}
