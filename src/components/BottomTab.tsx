import { NavLink } from 'react-router-dom'
import { PATHS } from '../routes/paths'

const TABS = [
  { to: PATHS.home, label: '메인' },
  { to: PATHS.savedCourses, label: '코스' },
  { to: PATHS.my, label: '마이' },
]

export function BottomTab() {
  return (
    <nav className="bottom-tab" aria-label="하단 탭">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end className={({ isActive }) => (isActive ? 'active' : undefined)}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
