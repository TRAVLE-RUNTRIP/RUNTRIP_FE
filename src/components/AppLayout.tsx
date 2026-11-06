import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AUTH_EXPIRED_EVENT } from '../api/client'
import { PATHS, TAB_PATHS } from '../routes/paths'
import { BottomTab } from './BottomTab'

export function AppLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const showTab = TAB_PATHS.includes(pathname)

  // 세션이 만료되면 로그인으로 보내요. 미저장 러닝 기록은 기기에 그대로 둬요 (#8).
  useEffect(() => {
    const onExpired = () => navigate(PATHS.login, { replace: true })
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
