// VITE_USE_MOCK일 때 client.ts가 fetch 대신 부르는 가짜 서버예요.
// 상태는 메모리에만 있어서 새로고침하면 처음으로 돌아가요.
import { distanceM } from '../../lib/geo'
import { isRoughlyInSeoul } from '../../lib/seoul'
import type {
  Course,
  CreateCourseRequest,
  ErrorCode,
  LatLng,
  LoginRequest,
  MinDistanceRequest,
  RsData,
  RunSummary,
  SaveRunRequest,
} from '../types'
import { MOCK_LOCATIONS, MOCK_PASSWORD, MOCK_REASONS, MOCK_USER, buildMockCourse, generateMockCourse } from './data'

interface MockResponse {
  status: number
  body: RsData<unknown> | null
}

const LATENCY_MS = 300
const COURSE_LATENCY_MS = 1500 // 생성 중 화면(M-11)을 볼 수 있게 조금 길게

// 세션 쿠키(24시간)처럼 새로고침해도 로그인이 남도록 만료 시각만 기기에 저장해요.
// 코스·기록 같은 나머지 mock 데이터는 메모리에만 있어서 새로고침하면 처음으로 돌아가요.
const SESSION_KEY = 'runtrip:mock-session-expires'
const SESSION_MS = 24 * 60 * 60 * 1000

let memoryExpires = 0 // 저장소를 못 쓰는 환경에서는 새로고침 전까지만 유지돼요.

const mockSession = {
  isValid(): boolean {
    let stored = 0
    try {
      stored = Number(localStorage.getItem(SESSION_KEY))
    } catch {
      // 저장소를 못 쓰면 메모리 값만 봐요.
    }
    return Math.max(stored, memoryExpires) > Date.now()
  },
  start() {
    memoryExpires = Date.now() + SESSION_MS
    try {
      localStorage.setItem(SESSION_KEY, String(memoryExpires))
    } catch {
      // 위 memoryExpires로 대신해요.
    }
  },
}

const state = {
  nextCourseId: 101,
  courses: new Map<number, Course>(),
  reasonPolls: new Map<number, number>(),
  runs: [] as RunSummary[],
  runIds: new Set<string>(),
}

const now = () => new Date().toISOString()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function ok(data: unknown, status = 200): MockResponse {
  return { status, body: { success: true, data, error: null, timestamp: now() } }
}

function fail(status: number, code: ErrorCode, message: string): MockResponse {
  return { status, body: { success: false, data: null, error: { code, message }, timestamp: now() } }
}

const unauthenticated = () => fail(401, 'UNAUTHENTICATED', '다시 로그인해 주세요.')
const courseNotFound = () => fail(404, 'COURSE_NOT_FOUND', '코스를 찾을 수 없어요.')
const outOfSeoul = () => fail(422, 'OUT_OF_SEOUL', '서울에서만 만들 수 있어요')
const anyOutOfSeoul = (...points: (LatLng | null)[]) => points.some((p) => p !== null && !isRoughlyInSeoul(p))

// 실패 화면(M-11) 확인용: mock에서만 이 목표 거리로 만들면 해당 오류가 나요.
// NO_MORE_COURSES는 [다시 만들기]를 3번 누르면, OUT_OF_SEOUL은 서울 밖 출발지로 확인해요.
const MOCK_ERROR_BY_KM: Record<number, { status: number; code: ErrorCode; message: string }> = {
  13: { status: 422, code: 'NO_PLACES', message: '조건에 맞는 장소를 찾지 못했어요.' },
  17: { status: 504, code: 'GENERATION_TIMEOUT', message: '코스 생성 시간이 초과됐어요.' },
  19: { status: 500, code: 'SERVER_ERROR', message: '잠시 후 다시 시도해 주세요.' },
}

export async function mockRequest(method: string, url: string, body: unknown): Promise<MockResponse> {
  const { pathname, searchParams } = new URL(url, window.location.origin)
  await sleep(method === 'POST' && pathname === '/api/courses' ? COURSE_LATENCY_MS : LATENCY_MS)

  // 1. 로그인
  if (method === 'POST' && pathname === '/api/auth/login') {
    const { email, password } = body as LoginRequest
    if (email !== MOCK_USER.email || password !== MOCK_PASSWORD) {
      return fail(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호를 확인해 주세요')
    }
    mockSession.start()
    return ok(MOCK_USER)
  }

  if (!mockSession.isValid()) return unauthenticated()

  // 2. 프로필
  if (method === 'GET' && pathname === '/api/users/me') return ok(MOCK_USER)

  // 3. 장소 검색
  if (method === 'GET' && pathname === '/api/locations/search') {
    const query = searchParams.get('query')?.trim()
    if (!query) return fail(400, 'VALIDATION_ERROR', '검색어를 입력해 주세요.')
    const results = MOCK_LOCATIONS.filter((l) => l.name.includes(query) || l.address.includes(query))
    return ok({ results })
  }

  // 4. 최소 입력 거리
  // 직선거리 × 1.3을 가장 짧은 길로, 그 1.1배를 최소 입력 거리로 흉내 내요.
  if (method === 'POST' && pathname === '/api/courses/min-distance') {
    const { start, end } = body as MinDistanceRequest
    if (anyOutOfSeoul(start, end)) return outOfSeoul()
    const shortestKm = Math.round((distanceM(start, end) / 1000) * 1.3 * 10) / 10
    const minInputKm = Math.max(1, Math.ceil(shortestKm * 1.1 * 10) / 10)
    if (minInputKm > 21) return fail(422, 'DESTINATION_TOO_FAR', '도착지가 너무 멀어요.')
    return ok({ shortestKm, minInputKm })
  }

  // 5. 코스 생성
  if (method === 'POST' && pathname === '/api/courses') {
    const req = body as CreateCourseRequest
    if (anyOutOfSeoul(req.start, req.end)) return outOfSeoul()
    if (req.targetKm < 1 || req.targetKm > 21) {
      return fail(400, 'VALIDATION_ERROR', '1~21km 사이로 입력해 주세요')
    }
    if (req.preferences.length === 0) return fail(400, 'VALIDATION_ERROR', '취향을 1개 이상 골라 주세요')
    const forced = MOCK_ERROR_BY_KM[req.targetKm]
    if (forced) return fail(forced.status, forced.code, forced.message)
    const course = generateMockCourse(state.nextCourseId, req)
    if (!course) return fail(422, 'NO_MORE_COURSES', '같은 조건으로 만들 수 있는 코스를 모두 보여드렸어요.')
    const courseId = state.nextCourseId++
    state.courses.set(courseId, course)
    state.reasonPolls.set(courseId, 0)
    return ok(course, 201)
  }

  // 8. 저장 코스 목록 (/api/courses/{id}보다 먼저 확인)
  if (method === 'GET' && pathname === '/api/courses/saved') {
    const courses = [...state.courses.values()]
      .filter((c) => c.saved)
      .sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''))
      .map(({ courseId, name, type, distanceKm, region, preferences, savedAt }) => ({
        courseId,
        name,
        type,
        distanceKm,
        region,
        preferences,
        savedAt,
      }))
    return ok({ count: courses.length, courses })
  }

  const courseMatch = pathname.match(/^\/api\/courses\/(\d+)(\/reasons|\/saved)?$/)
  if (courseMatch) {
    const courseId = Number(courseMatch[1])
    const sub = courseMatch[2]
    const course = state.courses.get(courseId)

    // 10. 삭제는 이미 지운 코스도 204
    if (method === 'DELETE' && sub === '/saved') {
      if (course) state.courses.set(courseId, { ...course, saved: false, savedAt: null })
      return { status: 204, body: null }
    }
    if (!course) return courseNotFound()

    // 6. 추천 이유: 두 번째 조회부터 DONE
    if (method === 'GET' && sub === '/reasons') {
      const polls = (state.reasonPolls.get(courseId) ?? 0) + 1
      state.reasonPolls.set(courseId, polls)
      const done = polls >= 2
      if (done) {
        course.places = course.places.map((p) => ({ ...p, reason: MOCK_REASONS[p.placeId] ?? p.overview }))
      }
      return ok({
        status: done ? 'DONE' : 'PENDING',
        reasons: done
          ? course.places.map((p) => ({ placeId: p.placeId, reason: p.reason, source: 'GEMINI' }))
          : [],
      })
    }

    // 7. 저장
    if (method === 'PUT' && sub === '/saved') {
      const savedAt = course.savedAt ?? now()
      state.courses.set(courseId, { ...course, saved: true, savedAt })
      return ok({ courseId, saved: true, savedAt })
    }

    // 9. 상세
    if (method === 'GET' && !sub) return ok(course)
  }

  // 11. 러닝 기록 저장 (같은 runId면 200으로 같은 내용)
  if (method === 'POST' && pathname === '/api/runs') {
    const req = body as SaveRunRequest
    const duplicated = state.runIds.has(req.runId)
    let courseId = req.courseId
    let courseSaved = false

    if (!duplicated) {
      state.runIds.add(req.runId)
      state.runs.unshift({
        runId: req.runId,
        type: req.type,
        title: req.title,
        startedAt: req.startedAt,
        durationSec: req.durationSec,
        avgPaceSec: req.avgPaceSec,
        distanceKm: req.distanceKm,
      })
    }

    if (req.saveCourse) {
      if (req.type === 'FREE') {
        courseId = state.nextCourseId++
        const d = new Date(req.startedAt)
        state.courses.set(
          courseId,
          buildMockCourse(courseId, {
            name: `${d.getMonth() + 1}월 ${d.getDate()}일 자유 러닝 코스`,
            type: 'FREE',
            distanceKm: req.distanceKm,
            path: req.segments.flat(),
            places: [],
            safety: null,
            saved: true,
            savedAt: now(),
          }),
        )
        courseSaved = true
      } else if (courseId !== null && state.courses.has(courseId)) {
        const course = state.courses.get(courseId)!
        state.courses.set(courseId, { ...course, saved: true, savedAt: course.savedAt ?? now() })
        courseSaved = true
      }
    }

    return ok({ runId: req.runId, courseSaved, courseId }, duplicated ? 200 : 201)
  }

  // 12. 러닝 기록 조회
  if (method === 'GET' && pathname === '/api/runs') return ok({ runs: state.runs })

  return fail(404, 'RESOURCE_NOT_FOUND', '없는 API 주소예요.')
}
