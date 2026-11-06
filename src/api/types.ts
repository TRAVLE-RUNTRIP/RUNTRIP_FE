// API 명세 A파트(프론트 ↔ 백엔드) 기준 타입. 필드 이름은 아직 제안값이라 확정되면 맞춰요.

export interface RsData<T> {
  success: boolean
  data: T | null
  error: { code: ErrorCode; message: string } | null
  timestamp: string
}

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'VALIDATION_ERROR'
  | 'OUT_OF_SEOUL'
  | 'DISTANCE_TOO_SHORT'
  | 'DESTINATION_TOO_FAR'
  | 'NO_PLACES'
  | 'NO_MORE_COURSES'
  | 'COURSE_NOT_FOUND'
  | 'GENERATION_TIMEOUT'
  | 'RESOURCE_NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR' // 앱에서만 쓰는 값 (응답을 받지 못함)

export interface LatLng {
  lat: number
  lng: number
}

/** 경로선 좌표 [lat, lng] */
export type PathPoint = [number, number]

export type Preference = 'NIGHT_VIEW' | 'ATTRACTION' | 'NATURE'
export type CourseType = 'LOOP' | 'ONE_WAY' | 'FREE'
export type RunType = 'COURSE' | 'FREE'

// 1, 2. 로그인·프로필
export interface LoginRequest {
  email: string
  password: string
}
export interface User {
  userId: number
  nickname: string
  email: string
}

// 3. 출발지·도착지 검색
export interface LocationResult extends LatLng {
  name: string
  address: string
}
export interface LocationSearchResponse {
  results: LocationResult[]
}

// 4. 최소 입력 거리
export interface MinDistanceRequest {
  start: LatLng
  end: LatLng
}
export interface MinDistanceResponse {
  shortestKm: number
  minInputKm: number
}

// 5. 코스 생성·다시 만들기
export interface CreateCourseRequest {
  start: LatLng
  end: LatLng | null
  targetKm: number
  preferences: Preference[]
  excludedCombos: string[][]
}

export interface CoursePlace {
  placeId: string
  order: number
  name: string
  category: string
  lat: number
  lng: number
  routeLat: number
  routeLng: number
  overview: string | null
  imageUrl: string | null
  imageCredit: string | null
  reason: string | null
}

export type SafetyGrade = '큰길(조명 추정)' | '많음' | '보통' | '적음' | '자료없음'

export interface Safety {
  timeBand: 'DAY' | 'NIGHT'
  score: number | null
  level: '좋음' | '보통' | '주의' | null
  coverage: number
  estimated: number
  hasLowSegment: boolean
  segments: { fromIndex: number; toIndex: number; grade: SafetyGrade }[]
  warnings: string[]
}

export interface Course {
  courseId: number
  name: string
  type: CourseType
  distanceKm: number
  estimatedMinutes: number
  start: LatLng
  end: LatLng
  region: string | null
  preferences: Preference[]
  path: PathPoint[]
  places: CoursePlace[]
  /** /safety 실패·시간 초과면 null → "준비 중" 표시 */
  safety: Safety | null
  saved: boolean
  savedAt: string | null
}

// 6. 추천 이유
export interface ReasonsResponse {
  status: 'PENDING' | 'DONE'
  reasons: { placeId: string; reason: string | null; source: 'GEMINI' | 'OVERVIEW' }[]
}

// 7. 코스 저장
export interface SaveCourseResponse {
  courseId: number
  saved: boolean
  savedAt: string
}

// 8. 저장 코스 목록
export interface SavedCourseSummary {
  courseId: number
  name: string
  type: CourseType
  distanceKm: number
  region: string | null
  preferences: Preference[]
  savedAt: string
}
export interface SavedCoursesResponse {
  count: number
  courses: SavedCourseSummary[]
}

// 11. 러닝 기록 저장
export interface SaveRunRequest {
  runId: string
  type: RunType
  courseId: number | null
  title: string
  startedAt: string
  endedAt: string
  distanceKm: number
  durationSec: number
  avgPaceSec: number
  visitedPlaceIds: string[]
  /** 끊긴 구간마다 나눈 경로 */
  segments: PathPoint[][]
  saveCourse: boolean
}
export interface SaveRunResponse {
  runId: string
  courseSaved: boolean
  courseId: number | null
}

// 12. 러닝 기록 조회
export interface RunSummary {
  runId: string
  type: RunType
  title: string
  startedAt: string
  durationSec: number
  avgPaceSec: number
  distanceKm: number
}
export interface RunsResponse {
  runs: RunSummary[]
}
