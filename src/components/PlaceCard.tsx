import { useSearchParams } from 'react-router-dom'
import type { CoursePlace } from '../api/types'
import { PLACE_CARD_PARAM } from '../routes/paths'

/**
 * M-21b 장소 설명 카드. 주소의 ?place=장소ID 로 열고 닫아요.
 * 코스 결과(M-12), 코스 상세(C-03), 러닝 측정(M-21)이 같은 카드를 써요. 상세 UI는 #6.
 */
export function PlaceCard({ places }: { places: CoursePlace[] }) {
  const [params, setParams] = useSearchParams()
  const placeId = params.get(PLACE_CARD_PARAM)
  const place = places.find((p) => p.placeId === placeId)
  if (!place) return null

  const close = () => {
    const next = new URLSearchParams(params)
    next.delete(PLACE_CARD_PARAM)
    setParams(next, { replace: true })
  }

  return (
    <div className="place-card-backdrop" role="dialog" aria-modal="true" aria-label={place.name}>
      <div className="place-card">
        <button type="button" className="place-card-close" onClick={close} aria-label="닫기">
          ×
        </button>
        <span className="screen-id">M-21b</span>
        <h2>
          {place.order}. {place.name}
        </h2>
        <p className="muted">{place.category}</p>
        {place.reason && <p>{place.reason}</p>}
        {place.overview && <p className="muted">{place.overview}</p>}
      </div>
    </div>
  )
}

/** 장소 카드를 여는 링크용 쿼리 문자열 */
export const placeCardSearch = (placeId: string) => `?${PLACE_CARD_PARAM}=${encodeURIComponent(placeId)}`
