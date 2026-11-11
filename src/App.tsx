import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { LoginPage, SplashPage } from './pages/auth'
import { MapCheckPage } from './pages/dev'
import { CourseGeneratingPage, CourseNewPage, CourseResultPage, HomePage } from './pages/course'
import { RunCompletePage, RunCountdownPage, RunPage } from './pages/run'
import { CourseDetailPage, MyPage, SavedCoursesPage } from './pages/saved'
import { PATHS } from './routes/paths'

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: PATHS.splash, element: <SplashPage /> },
      { path: PATHS.login, element: <LoginPage /> },
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
      { path: PATHS.devMapCheck, element: <MapCheckPage /> },
      { path: '*', element: <Navigate to={PATHS.home} replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
