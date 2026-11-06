// API 명세 A-2의 12개 API. 화면은 이 함수만 부르고 fetch를 직접 쓰지 않아요.
import { request } from './client'
import type {
  Course,
  CreateCourseRequest,
  LocationSearchResponse,
  LoginRequest,
  MinDistanceRequest,
  MinDistanceResponse,
  ReasonsResponse,
  RunsResponse,
  SaveCourseResponse,
  SavedCoursesResponse,
  SaveRunRequest,
  SaveRunResponse,
  User,
} from './types'

export const api = {
  /** 1. 로그인 */
  login: (body: LoginRequest) => request<User>('POST', '/api/auth/login', { body }),
  /** 2. 프로필 조회 */
  getMe: () => request<User>('GET', '/api/users/me'),
  /** 3. 출발지·도착지 검색 */
  searchLocations: (query: string) =>
    request<LocationSearchResponse>('GET', '/api/locations/search', { query: { query } }),
  /** 4. 최소 입력 거리 확인 (도착지를 직접 입력했을 때만) */
  getMinDistance: (body: MinDistanceRequest) =>
    request<MinDistanceResponse>('POST', '/api/courses/min-distance', { body }),
  /** 5. 코스 생성·다시 만들기 */
  createCourse: (body: CreateCourseRequest, signal?: AbortSignal) =>
    request<Course>('POST', '/api/courses', { body, signal }),
  /** 6. 추천 이유 조회 (1초 간격 최대 5번) */
  getReasons: (courseId: number) => request<ReasonsResponse>('GET', `/api/courses/${courseId}/reasons`),
  /** 7. 코스 저장 */
  saveCourse: (courseId: number) => request<SaveCourseResponse>('PUT', `/api/courses/${courseId}/saved`),
  /** 8. 저장 코스 목록 */
  getSavedCourses: () => request<SavedCoursesResponse>('GET', '/api/courses/saved'),
  /** 9. 코스 상세 */
  getCourse: (courseId: number) => request<Course>('GET', `/api/courses/${courseId}`),
  /** 10. 저장 코스 삭제 (204) */
  deleteSavedCourse: (courseId: number) => request<void>('DELETE', `/api/courses/${courseId}/saved`),
  /** 11. 러닝 기록 저장 */
  saveRun: (body: SaveRunRequest) => request<SaveRunResponse>('POST', '/api/runs', { body }),
  /** 12. 러닝 기록 조회 */
  getRuns: () => request<RunsResponse>('GET', '/api/runs'),
}
