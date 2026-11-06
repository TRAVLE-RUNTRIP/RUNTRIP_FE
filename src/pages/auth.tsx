// S-01 스플래시, S-02 로그인 (상세 구현: #3)
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, USE_MOCK } from '../api/client'
import { api } from '../api/endpoints'
import { Screen } from '../components/Screen'
import { PATHS } from '../routes/paths'

export function SplashPage() {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => navigate(PATHS.login, { replace: true }), 1200)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <Screen id="S-01" title="RUN+Trip">
      <p className="muted">달리면서 서울을 여행해요</p>
    </Screen>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(USE_MOCK ? 'test@runtrip.test' : '')
  const [password, setPassword] = useState(USE_MOCK ? 'runtrip1234' : '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.login({ email, password })
      navigate(PATHS.home, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen id="S-02" title="로그인">
      <form className="stack" onSubmit={onSubmit}>
        <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary" disabled={loading}>
          {loading ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </Screen>
  )
}
