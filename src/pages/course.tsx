// M-11 생성 중·실패, M-12 코스 결과 (#5, 기능명세서 F-03·F-04·F-07·F-09). 추천 이유·장소 카드는 #6, 안전 조언은 #11.
// M-00 홈은 home.tsx, M-10 조건 입력은 courseNew.tsx
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { api } from '../api/endpoints'
import type { Course, CourseType, CreateCourseRequest, ErrorCode } from '../api/types'
import backIcon from '../assets/icons/back.svg'
import chevronRightIcon from '../assets/icons/chevron-right.svg'
import { PlaceCard, placeCardSearch } from '../components/PlaceCard'
import { CourseMap } from '../map/CourseMap'
import { PATHS, toCourseResult } from '../routes/paths'
import { PREFERENCES, type CourseDraft, type CourseGeneratingState } from './courseNew'
import type { RunEntryState } from './run'

/** 결과 화면에 넘겨주는 상태. 다시 만들기·조건 수정에 써요. 새로고침해도 브라우저 기록에 남아요. */
export type CourseResultState = CourseGeneratingState

// F-03: 서버는 10초가 넘으면 GENERATION_TIMEOUT을 줘요. 응답 자체가 오지 않을 때를 대비해 앱도 15초에서 끊어요.
const CLIENT_TIMEOUT_MS = 15_000
const STEP_INTERVAL_MS = 500
const STEPS = ['주변 장소 찾기', '장소 점수 매기기', '장소 조합 찾기', '경로 잇기']

export const COURSE_TYPE_LABEL: Record<CourseType, string> = { LOOP: '순환', ONE_WAY: '편도', FREE: '자유 러닝' }

// 실패 안내. 기능명세서에 정확한 문구가 없는 것은 임시로 정한 문구예요 (PR에서 확인 필요).
interface FailureCopy {
  title: string
  desc: string
  /** 같은 조건으로 다시 시도해서 나아질 수 있는 오류인지 */
  retry: boolean
}

function failureCopy(error: ApiError): FailureCopy {
  const map: Partial<Record<ErrorCode, FailureCopy>> = {
    OUT_OF_SEOUL: { title: '서울에서만 만들 수 있어요', desc: '출발지와 도착지를 서울 안에서 골라 주세요.', retry: false },
    DISTANCE_TOO_SHORT: { title: '목표 거리가 너무 짧아요', desc: '도착지까지 갈 수 있도록 거리를 늘려 주세요.', retry: false },
    DESTINATION_TOO_FAR: { title: '도착지가 너무 멀어요', desc: '21km 안에 있는 도착지를 골라 주세요.', retry: false },
    NO_PLACES: { title: '조건에 맞는 장소를 찾지 못했어요', desc: '취향을 더 고르거나 거리를 늘려 보세요.', retry: false },
    NO_MORE_COURSES: {
      title: '더 만들 수 있는 코스가 없어요',
      desc: '같은 조건으로 만들 수 있는 코스를 모두 보여드렸어요. 조건을 바꿔 보세요.',
      retry: false,
    },
    VALIDATION_ERROR: { title: '조건을 다시 확인해 주세요', desc: error.message, retry: false },
    GENERATION_TIMEOUT: { title: '코스를 만드는 데 시간이 오래 걸려요', desc: '잠시 후 다시 시도해 주세요.', retry: true },
    NETWORK_ERROR: { title: '네트워크 연결을 확인해 주세요', desc: '인터넷에 연결된 뒤 다시 시도해 주세요.', retry: true },
  }
  return map[error.code] ?? { title: '코스를 만들지 못했어요', desc: '잠시 후 다시 시도해 주세요.', retry: true }
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

const preferenceLabel = (value: string) => PREFERENCES.find((p) => p.value === value)?.label ?? value

/** 요청한 조건 요약 (생성 중·실패 화면) */
function RequestSummary({ request, draft }: { request: CreateCourseRequest; draft: CourseDraft | undefined }) {
  return (
    <dl className="request-summary">
      <div>
        <dt>출발</dt>
        <dd>{draft?.start?.name ?? '출발지'}</dd>
      </div>
      <div>
        <dt>도착</dt>
        <dd>{request.end ? (draft?.end?.name ?? '도착지') : '정하지 않음 · 순환 코스'}</dd>
      </div>
      <div>
        <dt>거리</dt>
        <dd className="number">{request.targetKm}km</dd>
      </div>
      <div>
        <dt>취향</dt>
        <dd>{request.preferences.map(preferenceLabel).join(' · ')}</dd>
      </div>
    </dl>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 7.5 5.8 10 11 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CourseGeneratingPage() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: Partial<CourseGeneratingState> | null }
  const request = state?.request
  const draft = state?.draft
  const [error, setError] = useState<ApiError | null>(null)
  const [step, setStep] = useState(0)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!request) {
      navigate(PATHS.courseNew, { replace: true })
      return
    }
    setError(null)
    setStep(0)
    const controller = new AbortController()
    let cancelled = false // 화면을 떠난 뒤 늦게 온 응답은 무시해요 (mock은 abort를 받지 않아요)
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, CLIENT_TIMEOUT_MS)
    // 서버는 진행 상황을 알려주지 않아서, 단계 표시는 시간에 맞춰 넘기고 마지막 단계에서 응답을 기다려요.
    const ticker = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), STEP_INTERVAL_MS)

    api
      .createCourse(request, controller.signal)
      .then((course) => {
        if (cancelled) return
        const next: CourseResultState = { request, draft: draft ?? emptyDraftFrom(request) }
        navigate(toCourseResult(course.courseId), { replace: true, state: next })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError) setError(err)
        else if (timedOut) setError(new ApiError('GENERATION_TIMEOUT', '코스 생성 시간이 초과됐어요.', 504))
        else if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(new ApiError('SERVER_ERROR', '잠시 후 다시 시도해 주세요.', 500))
        }
      })
      .finally(() => {
        window.clearTimeout(timeout)
        window.clearInterval(ticker)
      })

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeout)
      window.clearInterval(ticker)
    }
  }, [request, draft, navigate, attempt])

  if (!request) return null

  const editConditions = () => navigate(PATHS.courseNew, { replace: true, state: { draft } })
  const regenerating = request.excludedCombos.length > 0

  if (error) {
    const copy = failureCopy(error)
    return (
      <section className="generating">
        <header className="page-header">
          <button type="button" className="icon-button" aria-label="홈으로" onClick={() => navigate(PATHS.home)}>
            <img src={backIcon} width={24} height={24} alt="" />
          </button>
          <h1>코스 만들기</h1>
        </header>
        <div className="generating-body">
          <div className="status-icon status-icon-error" aria-hidden="true">
            !
          </div>
          <h2 className="generating-title" role="alert">
            {copy.title}
          </h2>
          <p className="generating-desc">{copy.desc}</p>
          <RequestSummary request={request} draft={draft} />
        </div>
        <div className="bottom-action button-pair">
          <button type="button" className={copy.retry ? 'secondary block-button' : 'primary block-button'} onClick={editConditions}>
            조건 수정
          </button>
          {copy.retry && (
            <button type="button" className="primary block-button" onClick={() => setAttempt((n) => n + 1)}>
              다시 시도
            </button>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="generating" aria-busy="true">
      <header className="page-header">
        <h1 className="page-header-solo">코스 만들기</h1>
      </header>
      <div className="generating-body">
        <div className="status-icon status-icon-loading" aria-hidden="true">
          <span className="spinner" />
        </div>
        <h2 className="generating-title">{regenerating ? '다른 코스를 만들고 있어요' : '코스를 만들고 있어요'}</h2>
        <p className="generating-desc">관광지를 지나는 길을 찾는 중이에요</p>

        <ol className="generating-steps" aria-live="polite">
          {STEPS.map((label, i) => {
            const status = i < step ? 'done' : i === step ? 'active' : 'pending'
            return (
              <li key={label} className={`generating-step ${status}`}>
                <span className="generating-step-mark">{status === 'done' ? <CheckIcon /> : i + 1}</span>
                <span>{label}</span>
              </li>
            )
          })}
        </ol>

        <RequestSummary request={request} draft={draft} />
      </div>
      <div className="bottom-action">
        <button type="button" className="secondary block-button" onClick={editConditions}>
          조건 수정
        </button>
      </div>
    </section>
  )
}

/** 상태에 draft가 없을 때(예전 기록) 요청으로 조건 입력 상태를 다시 만들어요. */
function emptyDraftFrom(request: CreateCourseRequest): CourseDraft {
  return {
    start: { name: '출발지', ...request.start },
    startIsCurrent: false,
    end: request.end ? { name: '도착지', ...request.end } : null,
    targetKm: String(request.targetKm),
    preferences: request.preferences,
  }
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
  const navigate = useNavigate()
  const { courseId } = useParams()
  const { state } = useLocation() as { state: Partial<CourseResultState> | null }
  const { course, error } = useCourse(courseId)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // F-04: 뒤로가기는 확인 없이 홈으로 (저장하지 않은 코스는 사라져요).
  const goHome = () => navigate(PATHS.home)

  // F-07: 이미 보여준 장소 조합을 빼고 다시 만들어요.
  const request = state?.request
  const regenerate =
    course && request
      ? () => {
          const combo = [...course.places].sort((a, b) => a.order - b.order).map((p) => p.placeId)
          const next: CourseGeneratingState = {
            request: { ...request, excludedCombos: [...request.excludedCombos, combo] },
            draft: state?.draft ?? emptyDraftFrom(request),
          }
          navigate(PATHS.courseGenerating, { replace: true, state: next })
        }
      : null

  // F-09: 저장하고 저장 목록으로 가요.
  const save = async () => {
    if (!course || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await api.saveCourse(course.courseId)
      navigate(PATHS.savedCourses)
    } catch (err) {
      setSaveError(
        err instanceof ApiError && err.code === 'NETWORK_ERROR' ? err.message : '저장하지 못했어요. 다시 시도해 주세요.',
      )
      setSaving(false)
    }
  }

  const header = (
    <header className="page-header">
      <button type="button" className="icon-button" aria-label="홈으로" onClick={goHome}>
        <img src={backIcon} width={24} height={24} alt="" />
      </button>
      <h1>코스 결과</h1>
    </header>
  )

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
          <p className="generating-desc">홈에서 코스를 다시 만들어 주세요.</p>
        </div>
        <div className="bottom-action">
          <button type="button" className="primary block-button" onClick={goHome}>
            홈으로
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
  const places = [...course.places].sort((a, b) => a.order - b.order)

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
              <dt>경유 장소</dt>
              <dd>
                <span className="number">{places.length}</span>곳
              </dd>
            </div>
          </dl>
          {request && <p className="field-hint">목표 {request.targetKm}km로 만든 코스예요</p>}
        </section>

        <section className="course-places-section">
          <h3>경유 장소</h3>
          <ol className="course-places">
            {places.map((p) => (
              <li key={p.placeId}>
                <Link className="course-place" to={placeCardSearch(p.placeId)}>
                  <span className="course-place-order">{p.order}</span>
                  <span className="course-place-text">
                    <span className="course-place-name">{p.name}</span>
                    <span className="course-place-category">{p.category}</span>
                  </span>
                  <img src={chevronRightIcon} width={18} height={18} alt="" />
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {regenerate && (
          <button type="button" className="outline-button" onClick={regenerate}>
            다른 코스로 다시 만들기
          </button>
        )}
        {saveError && (
          <p className="field-error" role="alert">
            {saveError}
          </p>
        )}
      </div>

      <div className="bottom-action button-pair">
        <button type="button" className="secondary block-button" onClick={() => void save()} disabled={saving || course.saved}>
          {course.saved ? '저장됨' : saving ? '저장 중…' : '저장'}
        </button>
        <Link className="primary block-button" to={PATHS.runCountdown} state={runState}>
          바로 시작
        </Link>
      </div>

      <PlaceCard places={course.places} />
    </section>
  )
}
