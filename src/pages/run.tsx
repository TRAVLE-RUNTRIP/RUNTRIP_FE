// M-20 카운트다운, M-21 러닝 측정, M-22 러닝 완료 (상세 구현: #7, #8)
import { Link, useLocation } from 'react-router-dom'
import { Screen } from '../components/Screen'
import { PATHS } from '../routes/paths'

export interface RunEntryState {
  type: 'COURSE' | 'FREE'
  courseId?: number
}

export function RunCountdownPage() {
  const { state } = useLocation() as { state: RunEntryState | null }
  return (
    <Screen id="M-20" title="3 · 2 · 1">
      <p className="muted">{state?.type === 'COURSE' ? `코스 #${state.courseId} 러닝` : '자유 러닝'} · GPS 확인 (#7)</p>
      <Link className="primary button" to={PATHS.run} state={state}>
        시작
      </Link>
    </Screen>
  )
}

export function RunPage() {
  const { state } = useLocation()
  return (
    <Screen id="M-21" title="러닝 측정">
      <p className="muted">지도 · 거리 · 시간 · 페이스, 50m 접근 시 장소 카드 (#7)</p>
      <Link className="primary button" to={PATHS.runComplete} state={state}>
        종료
      </Link>
    </Screen>
  )
}

export function RunCompletePage() {
  return (
    <Screen id="M-22" title="러닝 완료">
      <p className="muted">기록 저장 · 저장 안 함 · 코스 저장 체크박스 (#8)</p>
      <div className="row">
        <Link to={PATHS.my}>기록 저장</Link>
        <Link to={PATHS.home}>저장 안 함</Link>
      </div>
    </Screen>
  )
}
