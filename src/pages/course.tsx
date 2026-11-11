// M-11 생성 중, M-12 결과 (상세 구현: #5, #6). M-00 홈은 home.tsx, M-10 조건 입력은 courseNew.tsx
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { api } from '../api/endpoints'
import type { Course } from '../api/types'
import { PlaceCard, placeCardSearch } from '../components/PlaceCard'
import { Screen } from '../components/Screen'
import { PATHS, toCourseResult } from '../routes/paths'
import type { CourseGeneratingState } from './courseNew'

export function CourseGeneratingPage() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: Partial<CourseGeneratingState> | null }
  const request = state?.request
  const draft = state?.draft
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!request) {
      navigate(PATHS.courseNew, { replace: true })
      return
    }
    const controller = new AbortController()
    api
      .createCourse(request, controller.signal)
      .then((course) => navigate(toCourseResult(course.courseId), { replace: true, state: { request } }))
      .catch((err) => {
        if (err instanceof ApiError) setError(err)
      })
    return () => controller.abort()
  }, [request, navigate])

  return (
    <Screen id="M-11" title={error ? '코스를 만들지 못했어요' : '코스를 만들고 있어요'}>
      {error ? (
        <>
          <p className="error">{error.message}</p>
          <Link to={PATHS.courseNew} state={{ draft }}>
            조건 수정
          </Link>
        </>
      ) : (
        <p className="muted">주변 장소 찾기 → 장소 점수 매기기 → 장소 조합 찾기 → 경로 잇기 (#5)</p>
      )}
    </Screen>
  )
}

/** 코스 조회 훅 (결과·상세 공용) */
export function useCourse(courseId: string | undefined) {
  const [course, setCourse] = useState<Course | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!courseId) return
    api
      .getCourse(Number(courseId))
      .then(setCourse)
      .catch((err) => err instanceof ApiError && setError(err))
  }, [courseId])

  return { course, error }
}

export function CourseResultPage() {
  const { courseId } = useParams()
  const { course, error } = useCourse(courseId)

  return (
    <Screen id="M-12" title="코스 결과">
      {error && <p className="error">{error.message}</p>}
      {course && (
        <>
          <p>
            {course.name} · {course.distanceKm}km · 약 {course.estimatedMinutes}분
          </p>
          <ol className="stack">
            {course.places.map((p) => (
              <li key={p.placeId}>
                <Link to={placeCardSearch(p.placeId)}>{p.name}</Link>
              </li>
            ))}
          </ol>
          <div className="row">
            <Link to={PATHS.runCountdown} state={{ type: 'COURSE', courseId: course.courseId }}>
              바로 시작
            </Link>
            <Link to={PATHS.home}>홈으로</Link>
          </div>
          <PlaceCard places={course.places} />
        </>
      )}
    </Screen>
  )
}
