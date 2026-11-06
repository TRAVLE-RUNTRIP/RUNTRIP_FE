// C-02 저장 코스 목록, C-03 코스 상세, P-01 마이 (상세 구현: #9, #10)
import { Link, useParams } from 'react-router-dom'
import { PlaceCard, placeCardSearch } from '../components/PlaceCard'
import { Screen } from '../components/Screen'
import { PATHS } from '../routes/paths'
import { useCourse } from './course'

export function SavedCoursesPage() {
  return (
    <Screen id="C-02" title="저장한 코스">
      <p className="muted">저장 코스 목록 · 저장 취소 (#9)</p>
      <Link to={PATHS.courseNew}>AI 코스 만들기</Link>
    </Screen>
  )
}

export function CourseDetailPage() {
  const { courseId } = useParams()
  const { course, error } = useCourse(courseId)

  return (
    <Screen id="C-03" title="코스 상세">
      {error && <p className="error">{error.message}</p>}
      {course && (
        <>
          <p>{course.name}</p>
          <ol className="stack">
            {course.places.map((p) => (
              <li key={p.placeId}>
                <Link to={placeCardSearch(p.placeId)}>{p.name}</Link>
              </li>
            ))}
          </ol>
          <Link to={PATHS.runCountdown} state={{ type: 'COURSE', courseId: course.courseId }}>
            이 코스로 달리기
          </Link>
          <PlaceCard places={course.places} />
        </>
      )}
    </Screen>
  )
}

export function MyPage() {
  return (
    <Screen id="P-01" title="마이">
      <p className="muted">프로필 · 러닝 기록 (#10)</p>
    </Screen>
  )
}
