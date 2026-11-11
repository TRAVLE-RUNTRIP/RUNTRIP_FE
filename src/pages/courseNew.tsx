// M-10 코스 조건 입력 (#4, 기능명세서 F-02, Figma "05 코스 만들기")
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { api } from '../api/endpoints'
import type { CreateCourseRequest, LatLng, LocationResult, Preference } from '../api/types'
import backIcon from '../assets/icons/back.svg'
import moonIcon from '../assets/icons/moon.svg'
import { isNightInSeoul, isRoughlyInSeoul } from '../lib/seoul'
import { PATHS } from '../routes/paths'

export interface CoursePlaceInput extends LatLng {
  name: string
}

/** 조건 입력 화면 상태. 생성 중 화면(#5)에서 [조건 수정]으로 돌아올 때 그대로 넘겨주면 이어서 고칠 수 있어요. */
export interface CourseDraft {
  start: CoursePlaceInput | null
  startIsCurrent: boolean
  end: CoursePlaceInput | null
  targetKm: string
  preferences: Preference[]
}

export interface CourseGeneratingState {
  request: CreateCourseRequest
  draft: CourseDraft
}

const MIN_KM = 1
const MAX_KM = 21
const QUICK_KM = [3, 5, 10]

const PREFERENCES: { value: Preference; label: string; desc: string }[] = [
  { value: 'NIGHT_VIEW', label: '야경', desc: '밤에 빛나는 곳' },
  { value: 'ATTRACTION', label: '관광 명소', desc: '궁·광장·거리' },
  { value: 'NATURE', label: '자연·공원', desc: '강변·숲길' },
]

// 기능명세서 문구
const MSG_DISTANCE_RANGE = '1~21km 사이로 입력해 주세요'
const MSG_NO_PREFERENCE = '취향을 1개 이상 골라 주세요'
const MSG_OUT_OF_SEOUL = '서울에서만 만들 수 있어요'
// 기능명세서에 정확한 문구가 없어 임시로 정한 문구 (PR에서 확인 필요)
const MSG_NO_START = '출발지를 정해 주세요'
const MSG_LOCATION_DENIED = '위치 권한이 꺼져 있어요. 출발지를 직접 입력해 주세요'
const MSG_DESTINATION_TOO_FAR = '도착지가 너무 멀어요. 21km 안에 있는 도착지를 골라 주세요'
const msgTooShort = (minKm: number) => `이 도착지까지는 ${minKm}km 이상부터 만들 수 있어요`

const EMPTY_DRAFT: CourseDraft = { start: null, startIsCurrent: true, end: null, targetKm: '5', preferences: [] }

type MinDistance =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; minInputKm: number }
  | { status: 'error'; message: string }

function parseKm(text: string): number | null {
  const value = Number(text)
  return text.trim() !== '' && Number.isFinite(value) ? value : null
}

export function CourseNewPage() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: { draft?: CourseDraft } | null }
  const [draft, setDraft] = useState<CourseDraft>(state?.draft ?? EMPTY_DRAFT)
  const [locating, setLocating] = useState(!state?.draft)
  const [locationDenied, setLocationDenied] = useState(false)
  const [sheet, setSheet] = useState<'start' | 'end' | null>(null)
  const [minDistance, setMinDistance] = useState<MinDistance>({ status: 'idle' })
  const [minDistanceAttempt, setMinDistanceAttempt] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [night] = useState(() => isNightInSeoul())

  const update = (patch: Partial<CourseDraft>) => setDraft((prev) => ({ ...prev, ...patch }))

  // 출발지 기본값: 현재 위치. 권한을 거부하면 직접 입력으로 바꿔요 (F-02).
  const locate = () => {
    if (!('geolocation' in navigator)) {
      setLocating(false)
      setLocationDenied(true)
      update({ start: null, startIsCurrent: false })
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        setLocationDenied(false)
        update({ start: { name: '현재 위치', lat: coords.latitude, lng: coords.longitude }, startIsCurrent: true })
      },
      () => {
        setLocating(false)
        setLocationDenied(true)
        update({ start: null, startIsCurrent: false })
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  useEffect(() => {
    // 처음 들어왔을 때 한 번만 위치를 물어봐요. (조건 수정으로 돌아온 경우는 이전 출발지를 그대로 써요)
    if (!state?.draft) locate()
  }, [])

  // 도착지를 정하면 최소 입력 거리를 확인해요 (API 4).
  const { start, end } = draft
  useEffect(() => {
    if (!start || !end) {
      setMinDistance({ status: 'idle' })
      return
    }
    let cancelled = false
    setMinDistance({ status: 'loading' })
    api
      .getMinDistance({ start: { lat: start.lat, lng: start.lng }, end: { lat: end.lat, lng: end.lng } })
      .then(({ minInputKm }) => {
        if (cancelled) return
        setMinDistance(
          minInputKm > MAX_KM ? { status: 'error', message: MSG_DESTINATION_TOO_FAR } : { status: 'ok', minInputKm },
        )
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const code = error instanceof ApiError ? error.code : null
        const message =
          code === 'DESTINATION_TOO_FAR'
            ? MSG_DESTINATION_TOO_FAR
            : code === 'OUT_OF_SEOUL'
              ? MSG_OUT_OF_SEOUL
              : code === 'NETWORK_ERROR'
                ? '네트워크 연결을 확인해 주세요.'
                : '최소 거리를 확인하지 못했어요. 다시 시도해 주세요.'
        setMinDistance({ status: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [start, end, minDistanceAttempt])

  // 검증
  const km = parseKm(draft.targetKm)
  const minKm = minDistance.status === 'ok' ? minDistance.minInputKm : null
  const startError = locating
    ? null
    : !start
      ? locationDenied
        ? MSG_LOCATION_DENIED
        : MSG_NO_START
      : !isRoughlyInSeoul(start)
        ? MSG_OUT_OF_SEOUL
        : null
  const endError = minDistance.status === 'error' ? minDistance.message : null
  const distanceError =
    km === null || km < MIN_KM || km > MAX_KM ? MSG_DISTANCE_RANGE : minKm !== null && km < minKm ? msgTooShort(minKm) : null
  const preferenceError = draft.preferences.length === 0 ? MSG_NO_PREFERENCE : null
  const checking = locating || minDistance.status === 'loading'

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (checking || startError || endError || distanceError || preferenceError || !start || km === null) return
    const request: CreateCourseRequest = {
      start: { lat: start.lat, lng: start.lng },
      end: end ? { lat: end.lat, lng: end.lng } : null,
      targetKm: km,
      preferences: draft.preferences,
      excludedCombos: [],
    }
    const next: CourseGeneratingState = { request, draft }
    navigate(PATHS.courseGenerating, { state: next })
  }

  const togglePreference = (value: Preference) =>
    update({
      preferences: draft.preferences.includes(value)
        ? draft.preferences.filter((p) => p !== value)
        : [...draft.preferences, value],
    })

  const startLabel = locating ? '현재 위치 찾는 중…' : start ? start.name : '출발지를 입력해 주세요'
  const endLabel = end ? end.name : '정하지 않음 · 출발지로 돌아오는 순환 코스'

  return (
    <form className="course-new" onSubmit={onSubmit} noValidate>
      <header className="page-header">
        <button type="button" className="icon-button" aria-label="뒤로" onClick={() => navigate(PATHS.home)}>
          <img src={backIcon} width={24} height={24} alt="" />
        </button>
        <h1>코스 만들기</h1>
      </header>

      <div className="course-new-body">
        <section className="form-section">
          <h2>어디서 출발해서 어디까지?</h2>
          <div className="route-box">
            <button type="button" className="route-row" onClick={() => setSheet('start')}>
              <span className="route-dot route-dot-start" aria-hidden="true" />
              <span className="route-text">
                <span className="route-label">출발</span>
                <span className="route-value">{startLabel}</span>
              </span>
              <span className="route-change">변경</span>
            </button>
            <span className="route-divider" aria-hidden="true" />
            <button type="button" className="route-row" onClick={() => setSheet('end')}>
              <span className="route-dot route-dot-end" aria-hidden="true" />
              <span className="route-text">
                <span className="route-label">도착</span>
                <span className="route-value">{endLabel}</span>
              </span>
              <span className="route-change">변경</span>
            </button>
          </div>
          {startError && (locationDenied || submitted || startError === MSG_OUT_OF_SEOUL) && (
            <p className="field-error" role="alert">
              {startError}
            </p>
          )}
          {endError && (
            <p className="field-error" role="alert">
              {endError}{' '}
              {minDistance.status === 'error' && endError !== MSG_DESTINATION_TOO_FAR && endError !== MSG_OUT_OF_SEOUL && (
                <button type="button" className="text-button" onClick={() => setMinDistanceAttempt((n) => n + 1)}>
                  다시 시도
                </button>
              )}
            </p>
          )}
        </section>

        <section className="form-section">
          <h2>얼마나 달릴까요?</h2>
          <label className="distance-box">
            <span className="distance-label">목표 거리</span>
            <input
              className="distance-input"
              type="text"
              inputMode="decimal"
              aria-label="목표 거리 (km)"
              aria-invalid={submitted && !!distanceError}
              value={draft.targetKm}
              onChange={(e) => update({ targetKm: e.target.value.replace(/[^\d.]/g, '') })}
            />
            <span className="distance-unit">km</span>
          </label>
          <div className="quick-km">
            {QUICK_KM.map((value) => (
              <button
                key={value}
                type="button"
                className={km === value ? 'quick-km-button selected' : 'quick-km-button'}
                aria-pressed={km === value}
                onClick={() => update({ targetKm: String(value) })}
              >
                {value}km
              </button>
            ))}
          </div>
          {distanceError && (submitted || (km !== null && (km < MIN_KM || km > MAX_KM)) || minKm !== null) ? (
            <p className="field-error" role="alert">
              {distanceError}
            </p>
          ) : (
            <p className="field-hint">
              {minKm !== null ? `${minKm}~21km` : '1~21km'} · 실제 코스는 목표 거리 ±10% 안에서 만들어요
            </p>
          )}
        </section>

        <section className="form-section">
          <h2>
            무엇을 보고 싶어요? <span className="form-section-sub">여러 개 선택 가능</span>
          </h2>
          <div className="preference-grid">
            {PREFERENCES.map((p) => {
              const selected = draft.preferences.includes(p.value)
              return (
                <button
                  key={p.value}
                  type="button"
                  className={selected ? 'preference-chip selected' : 'preference-chip'}
                  aria-pressed={selected}
                  onClick={() => togglePreference(p.value)}
                >
                  <span className="preference-label">{p.label}</span>
                  <span className="preference-desc">{p.desc}</span>
                </button>
              )
            })}
          </div>
          {submitted && preferenceError && (
            <p className="field-error" role="alert">
              {preferenceError}
            </p>
          )}
        </section>

        {night && (
          <p className="info-box">
            <img src={moonIcon} width={18} height={18} alt="" />
            지금은 밤 시간대예요. 밤에 어울리는 장소를 우선 고르고, 구간별 조명 정보도 알려드려요.
          </p>
        )}
      </div>

      <div className="bottom-action">
        <button type="submit" className="primary block-button" disabled={checking}>
          {checking ? '확인하는 중…' : '코스 만들기'}
        </button>
      </div>

      {sheet && (
        <LocationSheet
          kind={sheet}
          onClose={() => setSheet(null)}
          onUseCurrent={() => {
            setSheet(null)
            locate()
          }}
          onClearEnd={() => {
            setSheet(null)
            update({ end: null })
          }}
          onPick={(place) => {
            setSheet(null)
            const picked = { name: place.name, lat: place.lat, lng: place.lng }
            if (sheet === 'start') {
              setLocationDenied(false)
              update({ start: picked, startIsCurrent: false })
            } else {
              update({ end: picked })
            }
          }}
        />
      )}
    </form>
  )
}

interface LocationSheetProps {
  kind: 'start' | 'end'
  onClose: () => void
  onUseCurrent: () => void
  onClearEnd: () => void
  onPick: (place: LocationResult) => void
}

/** 출발지·도착지 검색 (API 3, 서울 안만) */
function LocationSheet({ kind, onClose, onUseCurrent, onClearEnd, onPick }: LocationSheetProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  const search = async () => {
    const q = query.trim()
    if (!q || searching) return
    setSearching(true)
    setError(null)
    try {
      const { results } = await api.searchLocations(q)
      setResults(results)
    } catch (err) {
      setResults(null)
      setError(err instanceof ApiError && err.code === 'NETWORK_ERROR' ? err.message : '검색하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={kind === 'start' ? '출발지 정하기' : '도착지 정하기'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <h2>{kind === 'start' ? '출발지' : '도착지'}</h2>
          <button type="button" className="text-button" onClick={onClose}>
            닫기
          </button>
        </div>

        {kind === 'start' ? (
          <button type="button" className="sheet-option" onClick={onUseCurrent}>
            현재 위치에서 출발
          </button>
        ) : (
          <button type="button" className="sheet-option" onClick={onClearEnd}>
            정하지 않음 · 출발지로 돌아오는 순환 코스
          </button>
        )}

        <div className="sheet-search">
          <input
            type="search"
            enterKeyHint="search"
            placeholder="장소 이름이나 주소 (서울)"
            aria-label="장소 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void search()
              }
            }}
            autoFocus
          />
          <button type="button" className="primary" onClick={() => void search()} disabled={!query.trim() || searching}>
            {searching ? '검색 중…' : '검색'}
          </button>
        </div>

        {error && <p className="field-error">{error}</p>}
        {results && results.length === 0 && <p className="field-hint">검색 결과가 없어요</p>}
        {results && results.length > 0 && (
          <ul className="sheet-results">
            {results.map((r) => (
              <li key={`${r.name}-${r.lat}-${r.lng}`}>
                <button type="button" onClick={() => onPick(r)}>
                  <span className="sheet-result-name">{r.name}</span>
                  <span className="sheet-result-address">{r.address}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
