import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { checkSession, type SessionStatus } from '../auth/session'
import { PATHS } from '../routes/paths'

/** 로그인해야 볼 수 있는 화면을 감싸요. 세션이 없으면 로그인으로 보내요. */
export function RequireAuth() {
  const [status, setStatus] = useState<SessionStatus | 'checking'>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    checkSession().then((result) => {
      if (!cancelled) setStatus(result)
    })
    return () => {
      cancelled = true
    }
  }, [attempt])

  if (status === 'checking') return null
  if (status === 'unauthenticated') return <Navigate to={PATHS.login} replace />
  if (status === 'error') {
    return (
      <section className="screen-body stack">
        <p className="error">네트워크 연결을 확인해 주세요.</p>
        <button
          type="button"
          className="primary"
          onClick={() => {
            setStatus('checking')
            setAttempt((n) => n + 1)
          }}
        >
          다시 시도
        </button>
      </section>
    )
  }
  return <Outlet />
}
