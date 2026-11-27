// 안전 조언 표시 기준 (#11, 기능명세서 F-06). 점수 계산은 AI 서버(/safety)가 하고 앱은 보여주기만 해요.
import type { Safety, SafetyGrade } from '../api/types'

/** 지도 구간 색과 범례 순서. 밝을수록(조명 많음) 초록·파랑, 적을수록 빨강, 자료 없음은 회색이에요. */
export const SAFETY_GRADES: { grade: SafetyGrade; color: string; label: string }[] = [
  { grade: '많음', color: '#2f9e5b', label: '가로등 많음' },
  { grade: '큰길(조명 추정)', color: '#3b7dd8', label: '큰길(조명 추정)' },
  { grade: '보통', color: '#e0a100', label: '가로등 보통' },
  { grade: '적음', color: '#e0472f', label: '가로등 적음' },
  { grade: '자료없음', color: '#9aa5a0', label: '자료 없음' },
]

const GRADE_COLOR = new Map(SAFETY_GRADES.map((g) => [g.grade, g.color]))
export const safetyGradeColor = (grade: SafetyGrade) => GRADE_COLOR.get(grade) ?? '#9aa5a0'

/** 이 코스에 실제로 나온 등급만, 범례 순서대로 */
export function gradesInUse(segments: Safety['segments']) {
  const used = new Set(segments.map((s) => s.grade))
  return SAFETY_GRADES.filter((g) => used.has(g.grade))
}

/** 0.59 → "59%" */
export const percent = (ratio: number) => `${Math.round(Math.min(Math.max(ratio, 0), 1) * 100)}%`
