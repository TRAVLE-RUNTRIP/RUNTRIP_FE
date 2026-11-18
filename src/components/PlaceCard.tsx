import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CoursePlace } from '../api/types'
import locationIcon from '../assets/icons/location.svg'
import { reasonText, type ReasonStatus } from '../lib/useCourseReasons'
import { PLACE_CARD_PARAM } from '../routes/paths'

/**
 * M-21b 장소 설명 카드 (#6, 기능명세서 F-05·F-08). 주소의 ?place=장소ID 로 열고 닫아요.
 * 코스 결과(M-12), 코스 상세(C-03), 러닝 측정(M-21)이 같은 카드를 써요.
 * 러닝 중 남은 거리 표시와 50m 접근 시 열기는 #7에서 붙여요.
 */
export function PlaceCard({ places, reasonStatus = 'done' }: { places: CoursePlace[]; reasonStatus?: ReasonStatus }) {
  const [params, setParams] = useSearchParams()
  const placeId = params.get(PLACE_CARD_PARAM)
  const place = places.find((p) => p.placeId === placeId)

  const close = () => {
    const next = new URLSearchParams(params)
    next.delete(PLACE_CARD_PARAM)
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (!place) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!place) return null

  const reason = reasonText(place)
  const titleId = `place-card-title-${place.placeId}`

  return (
    <div className="place-card-backdrop" onClick={close}>
      <div
        className="place-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 장소가 바뀌면 사진 오류 상태도 새로 시작해요 */}
        <PlacePhoto key={place.placeId} url={place.imageUrl} credit={place.imageCredit} />

        <div className="place-card-body">
          <div className="place-card-heading">
            <span className="course-place-order">{place.order}</span>
            <div className="place-card-title">
              <h2 id={titleId}>{place.name}</h2>
              <p>
                {place.category} · 경유 {place.order}/{places.length}
              </p>
            </div>
          </div>

          {reason ? (
            <section className="place-card-reason">
              <h3>추천 이유</h3>
              <p>{reason}</p>
            </section>
          ) : (
            reasonStatus === 'loading' && (
              <section className="place-card-reason place-card-reason-loading" aria-busy="true">
                <h3>추천 이유</h3>
                <p>추천 이유를 불러오고 있어요</p>
              </section>
            )
          )}

          {place.overview && (
            <section className="place-card-overview">
              <h3>소개</h3>
              <p>{place.overview}</p>
            </section>
          )}
        </div>

        <button type="button" className="place-card-close" onClick={close} aria-label="닫기">
          ×
        </button>
      </div>
    </div>
  )
}

/** 사진이 없거나 불러오지 못하면 기본 이미지를 보여줘요. 출처는 실제 사진에만 붙여요. */
function PlacePhoto({ url, credit }: { url: string | null; credit: string | null }) {
  const [broken, setBroken] = useState(false)

  if (!url || broken) {
    return (
      <div className="place-card-photo place-card-photo-default" aria-hidden="true">
        <img src={locationIcon} width={32} height={32} alt="" />
      </div>
    )
  }

  return (
    <figure className="place-card-figure">
      <img className="place-card-photo" src={url} alt="" onError={() => setBroken(true)} />
      {credit && <figcaption className="place-card-credit">사진 {credit}</figcaption>}
    </figure>
  )
}

/** 장소 카드를 여는 링크용 쿼리 문자열 */
export const placeCardSearch = (placeId: string) => `?${PLACE_CARD_PARAM}=${encodeURIComponent(placeId)}`
