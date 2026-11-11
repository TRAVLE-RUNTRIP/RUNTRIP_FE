import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { LoginPage, SplashPage } from './pages/auth'
import { MapCheckPage } from './pages/dev'
import { CourseGeneratingPage, CourseResultPage } from './pages/course'
import { CourseNewPage } from './pages/courseNew'
import { HomePage } from './pages/home'
import { RunCompletePage, RunCountdownPage, RunPage } from './pages/run'
import { CourseDetailPage, MyPage, SavedCoursesPage } from './pages/saved'
import { PATHS } from './routes/paths'

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      // 로그인 없이 볼 수 있는 화면
      { path: PATHS.splash, element: <SplashPage /> },
      { path: PATHS.login, element: <LoginPage /> },
      { path: PATHS.devMapCheck, element: <MapCheckPage /> },
      // 로그인해야 볼 수 있는 화면
      {
        element: <RequireAuth />,
        children: [
          { path: PATHS.home, element: <HomePage /> },
          { path: PATHS.courseNew, element: <CourseNewPage /> },
          { path: PATHS.courseGenerating, element: <CourseGeneratingPage /> },
          { path: PATHS.courseResult, element: <CourseResultPage /> },
          { path: PATHS.runCountdown, element: <RunCountdownPage /> },
          { path: PATHS.run, element: <RunPage /> },
          { path: PATHS.runComplete, element: <RunCompletePage /> },
          { path: PATHS.savedCourses, element: <SavedCoursesPage /> },
          { path: PATHS.courseDetail, element: <CourseDetailPage /> },
          { path: PATHS.my, element: <MyPage /> },
        ],
      },
      { path: '*', element: <Navigate to={PATHS.home} replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
