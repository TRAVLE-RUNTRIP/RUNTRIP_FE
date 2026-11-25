// C-02 저장 코스 목록, C-03 코스 상세 (#9, 기능명세서 F-14·F-15·F-16), P-01 마이 (#10, F-17·F-18)
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { api } from '../api/endpoints'
import type { RunSummary, SavedCourseSummary, User } from '../api/types'
import backIcon from '../assets/icons/back.svg'
import chevronRightIcon from '../assets/icons/chevron-right.svg'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PlaceCard, placeCardSearch } from '../components/PlaceCard'
import { formatDuration, formatPace, formatRunDate } from '../lib/runTracker'
import { useCourseReasons } from '../lib/useCourseReasons'
import { CourseMap } from '../map/CourseMap'
import { PATHS, toCourseDetail } from '../routes/paths'
import { COURSE_TYPE_LABEL, CoursePlaceList, formatMinutes, preferenceLabel, useCourse } from './course'
import type { RunEntryState } from './run'

const SAVED_DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' })
/** 11월 25일 */
const formatSavedDate = (iso: string | null) => (iso ? SAVED_DATE_FORMAT.format(new Date(iso)) : '-')

// ---- C-02 저장 코스 목록 ----

export function SavedCoursesPage() {
  const [courses, setCourses] = useState<SavedCourseSummary[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    setError(false)
    api
      .getSavedCourses()
      // F-14: 최신순 고정 (서버도 최신순으로 주지만 한 번 더 맞춰요)
      .then((res) => setCourses([...res.courses].sort((a, b) => b.savedAt.localeCompare(a.savedAt))))
      .catch(() => setError(true))
  }, [])

  useEffect(load, [load])

  return (
    <section className="saved">
      <header className="saved-header">
        <h1>저장한 코스</h1>
        {courses && courses.length > 0 && <span className="saved-count">{courses.length}개</span>}
      </header>

      {error ? (
        <div className="saved-empty">
          <p>코스를 불러오지 못했어요</p>
          <button type="button" className="secondary" onClick={load}>
            다시 시도
          </button>
        </div>
      ) : courses === null ? (
        <div className="saved-loading" aria-label="불러오는 중" />
      ) : courses.length === 0 ? (
        <div className="saved-empty">
          <p>저장한 코스가 없어요</p>
          <Link className="primary button" to={PATHS.courseNew}>
            AI 코스 만들기
          </Link>
        </div>
      ) : (
        <ul className="saved-list">
          {courses.map((c) => (
            <li key={c.courseId}>
              <Link className="saved-item" to={toCourseDetail(c.courseId)}>
                <span className="saved-item-text">
                  <span className="saved-item-name">{c.name}</span>
                  <span className="saved-item-meta">
                    <span className="number">{c.distanceKm}</span>km · {COURSE_TYPE_LABEL[c.type]}
                    {c.region && ` · ${c.region}`}
                  </span>
                  {c.preferences.length > 0 && (
                    <span className="course-tags">
                      {c.preferences.map((p) => (
                        <span key={p} className="course-tag">
                          {preferenceLabel(p)}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <img src={chevronRightIcon} width={18} height={18} alt="" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---- C-03 코스 상세 ----

export function CourseDetailPage() {
  const navigate = useNavigate()
  const { courseId } = useParams()
  const { course, error } = useCourse(courseId)
  const { places, status: reasonStatus } = useCourseReasons(course)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const toList = () => navigate(PATHS.savedCourses)
  const header = (
    <header className="page-header">
      <button type="button" className="icon-button" aria-label="저장한 코스로" onClick={toList}>
        <img src={backIcon} width={24} height={24} alt="" />
      </button>
      <h1>코스 상세</h1>
    </header>
  )

  const closeConfirm = useCallback(() => {
    setConfirming(false)
    setDeleteError(null)
  }, [])

  // F-16: 확인 창 → 삭제 → 목록으로. 러닝 기록은 코스명 복사본이라 그대로 남아요.
  const remove = async () => {
    if (!course || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.deleteSavedCourse(course.courseId)
      navigate(PATHS.savedCourses, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'COURSE_NOT_FOUND' || err.code === 'RESOURCE_NOT_FOUND')) {
        navigate(PATHS.savedCourses, { replace: true }) // 이미 지워진 코스
        return
      }
      setDeleteError('삭제하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setDeleting(false)
    }
  }

  if (error) {
    return (
      <section className="generating">
        {header}
        <div className="generating-body">
          <div className="status-icon status-icon-error" aria-hidden="true">
            !
          </div>
          <h2 className="generating-title">
            {error.code === 'COURSE_NOT_FOUND' ? '코스를 찾을 수 없어요' : '코스를 불러오지 못했어요'}
          </h2>
        </div>
        <div className="bottom-action">
          <button type="button" className="secondary block-button" onClick={toList}>
            저장한 코스로
          </button>
        </div>
      </section>
    )
  }

  if (!course) {
    return (
      <section className="course-result">
        {header}
        <div className="course-map course-map-loading" aria-label="코스를 불러오는 중" />
      </section>
    )
  }

  const runState: RunEntryState = { type: 'COURSE', courseId: course.courseId }

  return (
    <section className="course-result">
      {header}
      <CourseMap
        path={course.path}
        places={course.places}
        start={course.start}
        end={course.end}
        type={course.type}
        onPlaceClick={(placeId) => navigate({ search: placeCardSearch(placeId) })}
      />

      <div className="course-result-body">
        <section className="course-summary">
          <div className="course-tags">
            <span className="course-tag course-tag-strong">{COURSE_TYPE_LABEL[course.type]}</span>
            {course.region && <span className="course-tag">{course.region}</span>}
            {course.preferences.map((p) => (
              <span key={p} className="course-tag">
                {preferenceLabel(p)}
              </span>
            ))}
          </div>
          <h2 className="course-name">{course.name}</h2>
          <dl className="course-stats">
            <div>
              <dt>거리</dt>
              <dd>
                <span className="number">{course.distanceKm}</span>km
              </dd>
            </div>
            <div>
              <dt>예상 시간</dt>
              <dd>{formatMinutes(course.estimatedMinutes)}</dd>
            </div>
            <div>
              <dt>저장한 날</dt>
              <dd>{formatSavedDate(course.savedAt)}</dd>
            </div>
          </dl>
        </section>

        {/* 자유 러닝 코스(FREE)는 경유 장소 없이 경로선만 보여줘요. 안전 지수(F-15)는 #11에서 붙여요. */}
        {places.length > 0 && <CoursePlaceList places={places} reasonStatus={reasonStatus} />}
      </div>

      <div className={`bottom-action${course.saved ? ' button-pair' : ''}`}>
        {course.saved && (
          <button type="button" className="secondary block-button" onClick={() => setConfirming(true)}>
            삭제
          </button>
        )}
        <Link className="primary block-button" to={PATHS.runCountdown} state={runState}>
          이 코스로 달리기
        </Link>
      </div>

      <PlaceCard places={places} reasonStatus={reasonStatus} />

      {confirming && (
        <ConfirmDialog
          title="이 코스를 삭제할까요?"
          message="저장한 코스에서 사라져요. 이 코스로 달린 기록은 그대로 남아요."
          confirmLabel={deleting ? '삭제 중…' : '삭제'}
          danger
          busy={deleting}
          error={deleteError}
          onConfirm={() => void remove()}
          onCancel={closeConfirm}
        />
      )}
    </section>
  )
}

// ---- P-01 마이 (#10, 기능명세서 F-17·F-18) ----

export function MyPage() {
  const [user, setUser] = useState<User | null>(null)
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    setError(false)
    Promise.all([api.getMe(), api.getRuns()])
      .then(([me, res]) => {
        setUser(me)
        // F-18: 최신순
        setRuns([...res.runs].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)))
      })
      .catch(() => setError(true))
  }, [])

  useEffect(load, [load])

  return (
    <section className="saved my">
      <header className="saved-header">
        <h1>마이</h1>
      </header>

      {error ? (
        <div className="saved-empty">
          <p>정보를 불러오지 못했어요</p>
          <button type="button" className="secondary" onClick={load}>
            다시 시도
          </button>
        </div>
      ) : !user || !runs ? (
        <div className="saved-loading" aria-label="불러오는 중" />
      ) : (
        <>
          <section className="my-profile">
            <span className="my-avatar" aria-hidden="true">
              {user.nickname.slice(0, 1)}
            </span>
            <span className="my-profile-text">
              <span className="my-nickname">{user.nickname}</span>
              <span className="my-email">{user.email}</span>
            </span>
          </section>

          <h2 className="my-section-title">러닝 기록</h2>
          {runs.length === 0 ? (
            <div className="saved-empty my-empty">
              <p>아직 달린 기록이 없어요</p>
            </div>
          ) : (
            <ul className="saved-list">
              {runs.map((r) => (
                <li key={r.runId} className="run-record">
                  <div className="run-record-head">
                    <span className="run-record-title">{r.title}</span>
                    <span className="run-record-date">{formatRunDate(Date.parse(r.startedAt))}</span>
                  </div>
                  <dl className="run-record-stats">
                    <div>
                      <dt>거리</dt>
                      <dd>
                        <span className="number">{r.distanceKm.toFixed(2)}</span>km
                      </dd>
                    </div>
                    <div>
                      <dt>시간</dt>
                      <dd className="number">{formatDuration(r.durationSec * 1000)}</dd>
                    </div>
                    <div>
                      <dt>평균 페이스</dt>
                      <dd className="number">{formatPace(r.avgPaceSec > 0 ? r.avgPaceSec : null)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
