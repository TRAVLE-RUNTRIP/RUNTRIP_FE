// M-20 카운트다운, M-21 러닝 측정 (#7, 기능명세서 F-10·F-11·F-12·F-08). M-22 러닝 완료는 #8.
// 측정 기록은 lib/runTracker.ts가 계산하고 기기에 저장해요. 측정 중에는 API를 부르지 않아요 (러닝 시작 전 코스 조회만).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { api } from '../api/endpoints'
import type { RunType } from '../api/types'
import locationIcon from '../assets/icons/location.svg'
import { PlaceCard, placeCardSearch } from '../components/PlaceCard'
import { Screen } from '../components/Screen'
import { setFakeRoute } from '../lib/fakeGps'
import { distanceM } from '../lib/geo'
import {
  ACCURACY_LIMIT_M,
  addSample,
  avgPaceSec,
  clearDraft,
  createDraft,
  currentPaceSec,
  elapsedMsAt,
  finishRun,
  formatDuration,
  formatKm,
  formatMeters,
  formatPace,
  GAP_SPLIT_MS,
  interruptRun,
  loadDraft,
  newlyVisited,
  nextPlace,
  pauseRun,
  resumeRun,
  routePointOf,
  saveDraft,
  type RunCourse,
  type RunDraft,
} from '../lib/runTracker'
import { useGeoWatch, type GeoError, type GeoSample } from '../lib/useGeoWatch'
import { useWakeLock } from '../lib/useWakeLock'
import { RunMap } from '../map/RunMap'
import { PATHS, PLACE_CARD_PARAM } from '../routes/paths'

export interface RunEntryState {
  type: RunType
  courseId?: number
}

/** 출발점에서 이보다 멀면 거리를 알려줘요 (시작은 막지 않아요, F-11). 기능명세서에 값이 없어 임시로 정했어요. */
const FAR_FROM_START_M = 100
const COUNTDOWN_FROM = 3
/** 종료 버튼을 이만큼 누르고 있어야 끝나요. */
const HOLD_TO_END_MS = 1200
const NOTICE_MS = 4000

const GEO_BLOCK_TEXT: Partial<Record<GeoError, { title: string; desc: string }>> = {
  denied: {
    title: '위치 권한이 필요해요',
    desc: '브라우저 주소창 옆 사이트 설정에서 위치를 허용한 뒤 다시 시작해 주세요.',
  },
  unsupported: {
    title: '위치를 쓸 수 없는 브라우저예요',
    desc: 'Android Chrome에서 열어 주세요.',
  },
}

const toRunCourse = ({ courseId, name, type, distanceKm, start, end, path, places }: RunCourse): RunCourse => ({
  courseId,
  name,
  type,
  distanceKm,
  start,
  end,
  path,
  places,
})

// ---- M-20 카운트다운 ----

export function RunCountdownPage() {
  const { state } = useLocation() as { state: RunEntryState | null }
  // 끝나지 않은 러닝이 있으면 새로 시작하지 않고 그 기록으로 가요.
  const existing = useMemo(loadDraft, [])
  if (existing) return <Navigate to={existing.status === 'finished' ? PATHS.runComplete : PATHS.run} replace />
  if (!state) return <Navigate to={PATHS.home} replace />
  return <Countdown entry={state} />
}

function Countdown({ entry }: { entry: RunEntryState }) {
  const navigate = useNavigate()
  const isCourse = entry.type === 'COURSE' && entry.courseId !== undefined
  const [course, setCourse] = useState<RunCourse | null>(null)
  const [courseError, setCourseError] = useState<ApiError | null>(null)
  const [sample, setSample] = useState<GeoSample | null>(null)
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!isCourse) return
    api
      .getCourse(entry.courseId!)
      .then((c) => {
        setFakeRoute(c.path.map(([lat, lng]) => ({ lat, lng })))
        setCourse(toRunCourse(c))
      })
      .catch((err) => setCourseError(err instanceof ApiError ? err : new ApiError('SERVER_ERROR', String(err), 0)))
  }, [isCourse, entry.courseId])

  useEffect(() => {
    if (!isCourse) setFakeRoute(null)
  }, [isCourse])

  const ready = !isCourse || course !== null
  const { error: geoError } = useGeoWatch(ready, setSample)
  const gpsOk = sample !== null && sample.accuracy <= ACCURACY_LIMIT_M

  // F-10: GPS가 잡히면 3·2·1을 세고 시작해요.
  useEffect(() => {
    if (gpsOk && count === null) setCount(COUNTDOWN_FROM)
  }, [gpsOk, count])

  useEffect(() => {
    if (count === null) return
    if (count === 0) {
      saveDraft(createDraft(entry.type, course, Date.now()))
      navigate(PATHS.run, { replace: true })
      return
    }
    const id = window.setTimeout(() => setCount(count - 1), 1000)
    return () => window.clearTimeout(id)
  }, [count, course, entry.type, navigate])

  const cancel = () => navigate(-1)
  const block = geoError ? GEO_BLOCK_TEXT[geoError] : undefined

  if (courseError || block) {
    return (
      <section className="generating">
        <div className="generating-body run-block">
          <div className="status-icon status-icon-error" aria-hidden="true">
            !
          </div>
          <h2 className="generating-title">{block ? block.title : '코스를 불러오지 못했어요'}</h2>
          <p className="generating-desc">{block ? block.desc : '잠시 후 다시 시도해 주세요.'}</p>
        </div>
        <div className="bottom-action">
          <button type="button" className="secondary block-button" onClick={cancel}>
            돌아가기
          </button>
        </div>
      </section>
    )
  }

  const farM = course && sample ? distanceM(sample, course.start) : 0

  return (
    <section className="countdown">
      <div className="countdown-body">
        <p className="countdown-title">{isCourse ? (course?.name ?? '코스 러닝') : '자유 러닝'}</p>
        {count !== null ? (
          <div className="countdown-number" aria-live="assertive">
            {count === 0 ? '' : count}
          </div>
        ) : (
          <div className="countdown-wait" aria-live="polite">
            <div className="status-icon status-icon-loading" aria-hidden="true">
              <div className="spinner" />
            </div>
            <h2 className="generating-title">GPS를 찾고 있어요</h2>
            <p className="generating-desc">
              {sample ? `정확도 ${Math.round(sample.accuracy)}m · ${ACCURACY_LIMIT_M}m 안으로 들어오면 시작해요` : '하늘이 보이는 곳에서 기다려 주세요'}
            </p>
          </div>
        )}
        {farM > FAR_FROM_START_M && (
          <p className="info-box countdown-far">
            <img src={locationIcon} width={20} height={20} alt="" />
            <span>출발점에서 {formatMeters(farM)} 떨어져 있어요. 여기서 시작해도 기록은 돼요.</span>
          </p>
        )}
        {geoError && !block && <p className="field-error">위치를 아직 받지 못했어요. 잠시만 기다려 주세요.</p>}
      </div>
      <div className="bottom-action">
        <button type="button" className="secondary block-button" onClick={cancel}>
          취소
        </button>
      </div>
    </section>
  )
}

// ---- M-21 러닝 측정 ----

export function RunPage() {
  // 새로고침·앱 재실행으로 다시 열렸으면, 끊긴 시간은 빼고 멈춘 상태로 이어가요.
  const initial = useMemo(() => {
    const d = loadDraft()
    if (!d || d.status === 'finished') return { draft: d, interrupted: false }
    const stale = d.status === 'running' && Date.now() - d.updatedAtMs > GAP_SPLIT_MS
    return { draft: stale ? interruptRun(d) : d, interrupted: stale }
  }, [])

  if (!initial.draft) return <Navigate to={PATHS.home} replace />
  if (initial.draft.status === 'finished') return <Navigate to={PATHS.runComplete} replace />
  return <RunTracking initial={initial.draft} interrupted={initial.interrupted} />
}

function RunTracking({ initial, interrupted }: { initial: RunDraft; interrupted: boolean }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [draft, setDraft] = useState(initial)
  const draftRef = useRef(initial)
  const [current, setCurrent] = useState<GeoSample | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [follow, setFollow] = useState(true)
  const [recenterKey, setRecenterKey] = useState(0)
  const [notice, setNotice] = useState<string | null>(
    interrupted ? '앱이 꺼진 동안은 기록하지 않았어요. 다시 시작을 눌러 이어 달려요' : null,
  )
  const autoPaused = useRef(false)

  const cardOpen = params.has(PLACE_CARD_PARAM)
  const running = draft.status === 'running'

  const commit = useCallback((next: RunDraft) => {
    if (next === draftRef.current) return
    draftRef.current = next
    setDraft(next)
    saveDraft(next)
  }, [])

  const openCard = useCallback(
    (placeId: string) => navigate({ search: placeCardSearch(placeId) }, { replace: true }),
    [navigate],
  )

  // F-12: 위치마다 거리·구간을 계산하고, F-08: 장소 50m 안에 들어오면 카드를 열어요 (측정은 계속).
  const onSample = useCallback(
    (s: GeoSample) => {
      setCurrent(s)
      let next = addSample(draftRef.current, s)
      const visited = newlyVisited(next, s)
      if (visited.length > 0) {
        next = { ...next, visitedPlaceIds: [...next.visitedPlaceIds, ...visited] }
        openCard(visited[visited.length - 1])
      }
      commit(next)
    },
    [commit, openCard],
  )
  const { error: geoError } = useGeoWatch(true, onSample)
  useWakeLock(true)

  // 시간 표시. 측정 중에는 마지막 저장 시각도 갱신해 앱이 꺼졌을 때 끊긴 시간을 정확히 빼요.
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (draftRef.current.status === 'running') {
        draftRef.current = { ...draftRef.current, updatedAtMs: t }
        saveDraft(draftRef.current)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // F-12: 화면이 꺼지거나 다른 앱으로 가면 자동 일시정지, 돌아오면 안내하고 이어서 측정해요 (끊긴 구간은 제외).
  useEffect(() => {
    const onVisibility = () => {
      const d = draftRef.current
      if (document.visibilityState === 'hidden') {
        if (d.status === 'running') {
          autoPaused.current = true
          commit(pauseRun(d, Date.now()))
        }
      } else if (autoPaused.current) {
        autoPaused.current = false
        commit(resumeRun(d, Date.now()))
        setNotice('화면이 꺼진 동안은 기록하지 않았어요. 이어서 측정해요')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [commit])

  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(id)
  }, [notice])

  const togglePause = () => {
    autoPaused.current = false
    const d = draftRef.current
    commit(d.status === 'running' ? pauseRun(d, Date.now()) : resumeRun(d, Date.now()))
    setNotice(null)
  }

  const recenter = () => {
    setFollow(true)
    setRecenterKey((k) => k + 1)
  }

  const end = () => {
    commit(finishRun(draftRef.current, Date.now()))
    navigate(PATHS.runComplete, { replace: true })
  }

  const course = draft.course
  const next = nextPlace(draft)
  const toNext = next && current ? distanceM(current, routePointOf(next)) : null
  const weakGps = running && current !== null && current.accuracy > ACCURACY_LIMIT_M

  return (
    <section className="run">
      <div className="run-map-wrap">
        <RunMap
          course={course}
          segments={draft.segments}
          current={current}
          visitedPlaceIds={draft.visitedPlaceIds}
          follow={follow && !cardOpen}
          recenterKey={recenterKey}
          onPlaceClick={openCard}
        />
        <div className="run-top">
          <span className="run-title">{course ? course.name : '자유 러닝'}</span>
          {!running && <span className="run-badge">일시정지</span>}
        </div>
        {(notice || geoError || weakGps) && (
          <p className="run-notice" role="status">
            {notice ??
              (geoError === 'denied'
                ? '위치 권한이 꺼져 측정할 수 없어요. 브라우저 설정에서 허용해 주세요'
                : geoError
                  ? '위치를 받지 못하고 있어요'
                  : 'GPS 신호가 약해 이 위치는 거리에서 빼고 있어요')}
          </p>
        )}
        <button type="button" className="run-locate" onClick={recenter} aria-label="내 위치로">
          <img src={locationIcon} width={22} height={22} alt="" />
        </button>
      </div>

      <div className="run-panel">
        {course && (
          <div className="run-next">
            {next ? (
              <>
                <span className="course-place-order">{next.order}</span>
                <span className="run-next-text">
                  <span className="run-next-label">다음 장소</span>
                  <span className="run-next-name">{next.name}</span>
                </span>
                <span className="run-next-distance">{toNext !== null ? formatMeters(toNext) : '-'}</span>
              </>
            ) : (
              <span className="run-next-text">
                <span className="run-next-name">경유 장소를 모두 지났어요</span>
              </span>
            )}
            <span className="run-next-meta">
              {draft.visitedPlaceIds.length}/{course.places.length}곳 · 코스 {course.distanceKm}km
            </span>
          </div>
        )}

        <div className="run-distance">
          <span className="number">{formatKm(draft.distanceM)}</span>
          <span className="run-distance-unit">km</span>
        </div>

        <dl className="run-stats">
          <div>
            <dt>시간</dt>
            <dd className="number">{formatDuration(elapsedMsAt(draft, now))}</dd>
          </div>
          <div>
            <dt>현재 페이스</dt>
            <dd className="number">{formatPace(running ? currentPaceSec(draft) : null)}</dd>
          </div>
          <div>
            <dt>평균 페이스</dt>
            <dd className="number">{formatPace(avgPaceSec(draft, now))}</dd>
          </div>
        </dl>

        <div className="run-actions">
          <button type="button" className={running ? 'secondary block-button' : 'primary block-button'} onClick={togglePause}>
            {running ? '일시정지' : '다시 시작'}
          </button>
          <HoldToEnd onDone={end} />
        </div>
      </div>

      {course && <PlaceCard places={course.places} />}
    </section>
  )
}

/** 실수로 끝나지 않게 길게 눌러야 종료돼요 (F-12). */
function HoldToEnd({ onDone }: { onDone: () => void }) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | null>(null)

  const start = () => {
    if (timer.current !== null) return
    setHolding(true)
    timer.current = window.setTimeout(() => {
      timer.current = null
      setHolding(false)
      onDone()
    }, HOLD_TO_END_MS)
  }
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    setHolding(false)
  }
  useEffect(() => cancel, [])

  return (
    <button
      type="button"
      className={`run-end block-button${holding ? ' holding' : ''}`}
      style={{ ['--hold-ms' as string]: `${HOLD_TO_END_MS}ms` }}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && start()}
      onKeyUp={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span>{holding ? '계속 누르세요' : '길게 눌러 종료'}</span>
    </button>
  )
}

// ---- M-22 러닝 완료 (#8에서 구현) ----

export function RunCompletePage() {
  const navigate = useNavigate()
  const draft = useMemo(loadDraft, [])
  if (!draft) return <Navigate to={PATHS.home} replace />

  // #8 전까지 임시: 결과만 보여주고, [저장 안 함]으로 기기 기록을 지워요.
  const discard = () => {
    clearDraft()
    navigate(PATHS.home, { replace: true })
  }
  const end = draft.endedAtMs ?? Date.now()

  return (
    <Screen id="M-22" title="러닝 완료">
      <p className="muted">
        {draft.course ? draft.course.name : '자유 러닝'} · {formatKm(draft.distanceM)}km · {formatDuration(elapsedMsAt(draft, end))} · 평균{' '}
        {formatPace(avgPaceSec(draft, end))}
        {draft.course && ` · 방문 ${draft.visitedPlaceIds.length}곳`}
      </p>
      <p className="muted">기록 저장·코스 저장 체크박스·미저장 기록 복구는 #8에서 붙여요.</p>
      <button type="button" className="secondary block-button" onClick={discard}>
        저장 안 함
      </button>
    </Screen>
  )
}
