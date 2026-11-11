// 로그인 상태 확인 (F-01). 세션은 서버 쿠키(24시간)에 있어서 앱은 API 2(프로필)로 살아 있는지만 확인해요.
import { ApiError, AUTH_EXPIRED_EVENT } from '../api/client'
import { api } from '../api/endpoints'

export type SessionStatus = 'ok' | 'unauthenticated' | 'error'

let checking: Promise<SessionStatus> | null = null

/** 앱을 연 뒤 처음 한 번만 서버에 물어보고, 그다음부터는 결과를 다시 써요. */
export function checkSession(): Promise<SessionStatus> {
  checking ??= api.getMe().then(
    (): SessionStatus => 'ok',
    (error: unknown): SessionStatus => {
      checking = null // 실패는 다음에 다시 확인해요.
      return error instanceof ApiError && error.code === 'UNAUTHENTICATED' ? 'unauthenticated' : 'error'
    },
  )
  return checking
}

/** 로그인에 성공하면 다시 묻지 않아도 돼요. */
export function markLoggedIn() {
  checking = Promise.resolve('ok')
}

// 어느 API든 UNAUTHENTICATED를 받으면 확인 결과를 지워요 (client.ts가 이벤트를 보내요).
window.addEventListener(AUTH_EXPIRED_EVENT, () => {
  checking = null
})
