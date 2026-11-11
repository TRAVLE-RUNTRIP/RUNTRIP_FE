import type { CSSProperties } from 'react'
import { NavLink } from 'react-router-dom'
import tabCourseIcon from '../assets/icons/tab-course.svg'
import tabHomeIcon from '../assets/icons/tab-home.svg'
import tabMyIcon from '../assets/icons/tab-my.svg'
import { PATHS } from '../routes/paths'

const TABS = [
  { to: PATHS.home, label: '메인', icon: tabHomeIcon },
  { to: PATHS.savedCourses, label: '코스', icon: tabCourseIcon },
  { to: PATHS.my, label: '마이', icon: tabMyIcon },
]

export function BottomTab() {
  return (
    <nav className="bottom-tab" aria-label="하단 탭">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end className={({ isActive }) => (isActive ? 'active' : undefined)}>
          <span className="tab-icon" aria-hidden="true" style={{ '--icon': `url("${tab.icon}")` } as CSSProperties} />
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
