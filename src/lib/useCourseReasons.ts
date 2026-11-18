// F-05 추천 이유 조회 (#6). 코스 결과가 뜬 뒤 API 6을 1초 간격으로 최대 5번 불러요.
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/endpoints'
import type { Course, CoursePlace } from '../api/types'

export const REASON_POLL_INTERVAL_MS = 1000
export const REASON_POLL_MAX = 5

/** loading: 아직 조회 중 · done: 받았거나, 끝까지 PENDING·실패라 개요로 대신하기로 함 */
export type ReasonStatus = 'loading' | 'done'

interface Result {
  courseId: number
  /** 장소별 추천 이유. 끝까지 받지 못했으면 null */
  reasons: Map<string, string | null> | null
}

/**
 * 코스 장소에 추천 이유를 채워서 돌려줘요.
 * 이미 모든 장소에 이유가 있으면(코스 상세 등) 조회하지 않아요.
 * 조회가 실패해도 다음 번으로 넘어가고, 5번 안에 DONE이 안 오면 그대로 끝내요(화면은 개요로 대체).
 */
export function useCourseReasons(course: Course | null): { places: CoursePlace[]; status: ReasonStatus } {
  const [result, setResult] = useState<Result | null>(null)
  const courseId = course?.courseId
  const needsPolling = !!course && course.places.length > 0 && course.places.some((p) => p.reason === null)

  useEffect(() => {
    if (courseId === undefined || !needsPolling) return
    let cancelled = false
    let timer: number | undefined
    let attempts = 0

    const finish = (reasons: Result['reasons']) => {
      if (!cancelled) setResult({ courseId, reasons })
    }
    const next = () => {
      if (cancelled) return
      if (attempts >= REASON_POLL_MAX) finish(null)
      else timer = window.setTimeout(poll, REASON_POLL_INTERVAL_MS)
    }
    function poll() {
      attempts += 1
      api
        .getReasons(courseId as number)
        .then((res) => {
          if (cancelled) return
          if (res.status === 'DONE') finish(new Map(res.reasons.map((r) => [r.placeId, r.reason])))
          else next()
        })
        .catch(next)
    }

    poll()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [courseId, needsPolling])

  const current = result && result.courseId === courseId ? result : null
  const reasons = current ? current.reasons : null
  const status: ReasonStatus = !needsPolling || current ? 'done' : 'loading'

  const places = useMemo(() => {
    const list = course ? [...course.places].sort((a, b) => a.order - b.order) : []
    if (!reasons) return list
    return list.map((p) => ({ ...p, reason: p.reason ?? reasons.get(p.placeId) ?? null }))
  }, [course, reasons])

  return { places, status }
}

/**
 * 화면에 보여줄 추천 이유. 서버가 개요로 대신 채운 경우(source: OVERVIEW)는 개요와 같은 문장이라
 * 카드에서는 소개 영역과 겹치지 않게 빼요.
 */
export function reasonText(place: CoursePlace): string | null {
  if (!place.reason) return null
  return place.reason === place.overview ? null : place.reason
}
