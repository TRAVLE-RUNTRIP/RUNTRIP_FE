// M-00 홈 (#4, Figma "04 메인"). 위치 주소 줄은 빼고, Figma의 '이번 주 러닝'(MVP 제외) 자리에 관광지 사진 5장을 둬요.
import { Link } from 'react-router-dom'
import arrowRightIcon from '../assets/icons/arrow-right.svg'
import chevronRightIcon from '../assets/icons/chevron-right.svg'
import routeIllustration from '../assets/icons/home-course-route.svg'
import playIcon from '../assets/icons/play.svg'
import { PATHS } from '../routes/paths'
import type { RunEntryState } from './run'

interface HomePlace {
  name: string
  caption: string
  /** public/home/ 아래 사진 경로. 사진이 정해지기 전에는 null이라 자리 표시를 보여줘요. */
  image: string | null
}

// 서울 대표 관광지 5장 (고정). 사진 파일이 정해지면 image만 채우면 돼요.
const HOME_PLACES: HomePlace[] = [
  { name: '경복궁', caption: '종로구', image: null },
  { name: '광화문 광장', caption: '종로구', image: null },
  { name: '청계천', caption: '중구·종로구', image: null },
  { name: '남산서울타워', caption: '용산구', image: null },
  { name: '여의도 한강공원', caption: '영등포구', image: null },
]

const FREE_RUN: RunEntryState = { type: 'FREE' }

export function HomePage() {
  return (
    <section className="home">
      <h1 className="home-title">
        오늘은 어디를
        <br />
        달려볼까요?
      </h1>

      <Link className="home-ai-card" to={PATHS.courseNew}>
        <img className="home-ai-route" src={routeIllustration} width={350} height={210} alt="" />
        <span className="home-ai-eyebrow">AI 코스 추천</span>
        <span className="home-ai-title">취향 따라 관광지를 잇는 코스 만들기</span>
        <span className="home-ai-cta">
          코스 만들기
          <img src={arrowRightIcon} width={18} height={18} alt="" />
        </span>
      </Link>

      <Link className="home-free-card" to={PATHS.runCountdown} state={FREE_RUN}>
        <span className="home-free-icon">
          <img src={playIcon} width={22} height={22} alt="" />
        </span>
        <span className="home-free-text">
          <span className="home-free-title">자유 러닝</span>
          <span className="home-free-desc">코스 없이 바로 달리고 기록해요</span>
        </span>
        <img src={chevronRightIcon} width={18} height={18} alt="" />
      </Link>

      <h2 className="home-section-title">서울 대표 관광지</h2>
      <ul className="home-places">
        {HOME_PLACES.map((place) => (
          <li key={place.name} className="home-place">
            {place.image ? (
              <img className="home-place-photo" src={place.image} alt={place.name} loading="lazy" />
            ) : (
              <span className="home-place-photo home-place-placeholder" aria-hidden="true" />
            )}
            <span className="home-place-name">{place.name}</span>
            <span className="home-place-caption">{place.caption}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
