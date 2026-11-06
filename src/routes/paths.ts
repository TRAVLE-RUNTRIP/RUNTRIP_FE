// 화면 12개의 주소. 화면 ID는 기능명세서·와이어프레임 v1.5 기준이에요.
export const PATHS = {
  splash: '/', // S-01
  login: '/login', // S-02
  home: '/home', // M-00
  courseNew: '/course/new', // M-10
  courseGenerating: '/course/generating', // M-11
  courseResult: '/course/result/:courseId', // M-12
  runCountdown: '/run/countdown', // M-20
  run: '/run', // M-21 (M-21b 장소 설명 카드는 ?place= 로 여는 오버레이)
  runComplete: '/run/complete', // M-22
  savedCourses: '/courses', // C-02
  courseDetail: '/courses/:courseId', // C-03
  my: '/my', // P-01
} as const

export const toCourseResult = (courseId: number) => `/course/result/${courseId}`
export const toCourseDetail = (courseId: number) => `/courses/${courseId}`

/** 하단 탭은 이 세 화면에서만 보여요 (기능명세서 4장). */
export const TAB_PATHS: string[] = [PATHS.home, PATHS.savedCourses, PATHS.my]

/** 장소 설명 카드(M-21b)를 여는 쿼리 이름. M-12, C-03, M-21에서 써요. */
export const PLACE_CARD_PARAM = 'place'
