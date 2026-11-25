import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isFakeGps } from './lib/fakeGps'

// 개발용 가짜 GPS: 어느 화면이든 주소에 ?fakegps 를 붙여 열면 켜져요 (npm run dev 전용, #7).
isFakeGps()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
