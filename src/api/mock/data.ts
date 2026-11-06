// API 명세 예시를 바탕으로 만든 mock 데이터예요. 실제 장소·경로가 아니에요.
import type { Course, CoursePlace, PathPoint, User } from '../types'

export const MOCK_USER: User = { userId: 1, nickname: '테스트러너', email: 'test@runtrip.test' }
export const MOCK_PASSWORD = 'runtrip1234'

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
}
