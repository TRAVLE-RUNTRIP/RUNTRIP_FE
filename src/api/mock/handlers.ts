// VITE_USE_MOCK일 때 client.ts가 fetch 대신 부르는 가짜 서버예요.
// 상태는 메모리에만 있어서 새로고침하면 처음으로 돌아가요.
import type { Course, CreateCourseRequest, ErrorCode, LoginRequest, RsData, RunSummary, SaveRunRequest } from '../types'
import { MOCK_PASSWORD, MOCK_REASONS, MOCK_USER, buildMockCourse } from './data'

interface MockResponse {
  status: number
  body: RsData<unknown> | null
}

const LATENCY_MS = 300
const COURSE_LATENCY_MS = 1500 // 생성 중 화면(M-11)을 볼 수 있게 조금 길게

const state = {
  loggedIn: false,
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

export async function mockRequest(method: string, url: string, body: unknown): Promise<MockResponse> {
  const { pathname, searchParams } = new URL(url, window.location.origin)
  await sleep(method === 'POST' && pathname === '/api/courses' ? COURSE_LATENCY_MS : LATENCY_MS)

  // 1. 로그인
  if (method === 'POST' && pathname === '/api/auth/login') {
    const { email, password } = body as LoginRequest
    if (email !== MOCK_USER.email || password !== MOCK_PASSWORD) {
      return fail(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호를 확인해 주세요')
    }
    state.loggedIn = true
    return ok(MOCK_USER)
  }

  if (!state.loggedIn) return unauthenticated()

  // 2. 프로필
  if (method === 'GET' && pathname === '/api/users/me') return ok(MOCK_USER)

  // 3. 장소 검색
  if (method === 'GET' && pathname === '/api/locations/search') {
    const query = searchParams.get('query')?.trim()
    if (!query) return fail(400, 'VALIDATION_ERROR', '검색어를 입력해 주세요.')
    return ok({
      results: [{ name: query, address: '서울 종로구 사직로 161 (mock)', lat: 37.5796, lng: 126.977 }],
    })
  }

  // 4. 최소 입력 거리
  if (method === 'POST' && pathname === '/api/courses/min-distance') {
    return ok({ shortestKm: 2.1, minInputKm: 2.4 })
  }

  // 5. 코스 생성
  if (method === 'POST' && pathname === '/api/courses') {
    const req = body as CreateCourseRequest
    if (req.targetKm < 1 || req.targetKm > 21) {
      return fail(400, 'VALIDATION_ERROR', '1~21km 사이로 입력해 주세요')
    }
    if (req.preferences.length === 0) return fail(400, 'VALIDATION_ERROR', '취향을 1개 이상 골라 주세요')
    if (req.excludedCombos.length >= 3) {
      return fail(422, 'NO_MORE_COURSES', '같은 조건으로 만들 수 있는 코스를 모두 보여드렸어요.')
    }
    const courseId = state.nextCourseId++
    const course = buildMockCourse(courseId, {
      type: req.end ? 'ONE_WAY' : 'LOOP',
      distanceKm: Math.round(req.targetKm * 1.04 * 10) / 10,
      estimatedMinutes: Math.round(req.targetKm * 1.04 * 6),
      start: req.start,
      end: req.end ?? req.start,
      preferences: req.preferences,
    })
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
