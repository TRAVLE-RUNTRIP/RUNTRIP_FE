import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AUTH_EXPIRED_EVENT } from '../api/client'
import { PATHS, TAB_PATHS } from '../routes/paths'
import { BottomTab } from './BottomTab'

export function AppLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const showTab = TAB_PATHS.includes(pathname)

  // 세션이 만료되면 로그인으로 보내요. 미저장 러닝 기록은 기기에 그대로 둬요 (#8).
  // 스플래시·로그인 화면은 스스로 이동을 정하므로 여기서 건드리지 않아요.
  const pathnameRef = useRef(pathname)
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])
  useEffect(() => {
    const onExpired = () => {
      if (pathnameRef.current === PATHS.splash || pathnameRef.current === PATHS.login) return
      navigate(PATHS.login, { replace: true })
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [navigate])

  return (
    <div className={showTab ? 'app with-tab' : 'app'}>
      <main className="screen">
        <Outlet />
      </main>
      {showTab && <BottomTab />}
    </div>
  )
}
