// 안전 조언 박스 (#11, 기능명세서 F-06). 코스 결과(M-12)와 코스 상세(C-03)가 같이 써요.
// 조언만 하고 경로는 바꾸지 않아요. 점수·등급·안내 문구는 서버(/safety)가 준 그대로 보여줘요.
import { useState } from 'react'
import type { Safety } from '../api/types'
import { percent } from '../lib/safety'

/** 안내 문구가 많을 때 처음에 보여줄 개수 (실제 코스에서 7개까지 나와요) */
const WARNINGS_PREVIEW = 3

const LEVEL_CLASS: Record<NonNullable<Safety['level']>, string> = {
  좋음: 'safety-level-good',
  보통: 'safety-level-normal',
  주의: 'safety-level-caution',
}

interface SafetySectionProps {
  safety: Safety | null
  /** 지도 경로선을 등급 색으로 보여주는 중인지 */
  showSegments: boolean
  onToggleSegments: () => void
  /** F-07과 같은 동작. 코스 결과에서만 넘겨요 (상세에는 다시 만들 조건이 없어요) */
  onRegenerate?: () => void
}

export function SafetySection({ safety, showSegments, onToggleSegments, onRegenerate }: SafetySectionProps) {
  const [allWarnings, setAllWarnings] = useState(false)

  if (!safety) {
    return (
      <section className="safety-section" aria-labelledby="safety-title">
        <h3 id="safety-title">안전 지수</h3>
        <p className="safety-pending">준비 중이에요</p>
        <p className="safety-note">공공데이터 기반 참고용 지수</p>
      </section>
    )
  }

  const night = safety.timeBand === 'NIGHT'
  const warnings = allWarnings ? safety.warnings : safety.warnings.slice(0, WARNINGS_PREVIEW)
  const hidden = safety.warnings.length - warnings.length

  return (
    <section className="safety-section" aria-labelledby="safety-title">
      <div className="safety-head">
        <h3 id="safety-title">안전 지수</h3>
        <span className={`safety-time${night ? ' safety-time-night' : ''}`}>{night ? '야간 기준' : '주간 기준'}</span>
      </div>

      <div className="safety-score">
        {safety.score !== null ? (
          <>
            <span className="safety-score-value">
              <span className="number">{safety.score}</span>점
            </span>
            {safety.level && <span className={`safety-level ${LEVEL_CLASS[safety.level]}`}>{safety.level}</span>}
          </>
        ) : (
          <span className="safety-score-value safety-score-empty">자료부족</span>
        )}
      </div>

      <dl className="safety-ratio">
        <div>
          <dt>보안등으로 확인</dt>
          <dd className="number">{percent(safety.coverage)}</dd>
        </div>
        <div>
          <dt>큰길이라 조명 추정</dt>
          <dd className="number">{percent(safety.estimated)}</dd>
        </div>
      </dl>

      {safety.segments.length > 0 && (
        <button type="button" className="safety-toggle" aria-pressed={showSegments} onClick={onToggleSegments}>
          {showSegments ? '지도 구간 색 끄기' : '지도에서 구간 색 보기'}
        </button>
      )}

      {safety.warnings.length > 0 && (
        <ul className={`safety-warnings${night ? ' safety-warnings-night' : ''}`}>
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <button type="button" className="text-button safety-more" onClick={() => setAllWarnings(true)}>
          안내 {hidden}개 더 보기
        </button>
      )}

      {safety.hasLowSegment && onRegenerate && (
        <button type="button" className="outline-button" onClick={onRegenerate}>
          다른 코스 만들기
        </button>
      )}

      <p className="safety-note">공공데이터 기반 참고용 지수</p>
    </section>
  )
}
