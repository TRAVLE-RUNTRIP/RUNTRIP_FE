// S-01 스플래시, S-02 로그인 (#3, 기능명세서 F-01)
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, USE_MOCK } from '../api/client'
import { api } from '../api/endpoints'
import { checkSession, markLoggedIn } from '../auth/session'
import { PATHS } from '../routes/paths'

/** 스플래시를 최소한 이만큼은 보여줘요. 세션 확인이 더 늦으면 그만큼 기다려요. */
const SPLASH_MIN_MS = 1200

export function SplashPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    const minDelay = new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS))
    // 세션이 살아 있으면(새로고침·앱 다시 열기) 로그인을 건너뛰어요.
    // TODO(#8): 기기에 미저장 러닝 기록이 있으면 러닝 완료(M-22)로 보내기
    Promise.all([checkSession(), minDelay]).then(([status]) => {
      if (!cancelled) navigate(status === 'ok' ? PATHS.home : PATHS.login, { replace: true })
    })
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <section className="splash">
      <h1 className="splash-logo">
        RUN<span className="logo-plus">+</span>Trip
      </h1>
      <p className="splash-tagline">달리면서 만나는 서울</p>
    </section>
  )
}

const LOGIN_FAILED = '이메일 또는 비밀번호를 확인해 주세요'

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS' || error.code === 'VALIDATION_ERROR') return LOGIN_FAILED
    if (error.code === 'NETWORK_ERROR') return error.message
  }
  return '잠시 후 다시 시도해 주세요.'
}

export function LoginPage() {
  const navigate = useNavigate()
  // mock에서는 테스트 계정을 미리 채워 둬요. 실제 서버 비밀번호는 다르므로 채우지 않아요.
  const [email, setEmail] = useState(USE_MOCK ? 'test@runtrip.test' : '')
  const [password, setPassword] = useState(USE_MOCK ? 'runtrip1234' : '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      await api.login({ email: email.trim(), password })
      markLoggedIn()
      // TODO(#8): 기기에 미저장 러닝 기록이 있으면 러닝 완료(M-22)로 보내기
      navigate(PATHS.home, { replace: true })
    } catch (err) {
      setError(loginErrorMessage(err))
      setLoading(false)
    }
  }

  return (
    <section className="screen-body login">
      <h1 className="login-logo">
        RUN<span className="logo-plus">+</span>Trip
      </h1>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <input
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          placeholder="이메일"
          aria-label="이메일"
          aria-invalid={error === LOGIN_FAILED}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(null)
          }}
        />
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          aria-label="비밀번호"
          aria-invalid={error === LOGIN_FAILED}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(null)
          }}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={loading || !email.trim() || !password}>
          {loading ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </section>
  )
}
