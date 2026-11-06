# RUN+Trip FE

서울 관광 러닝 코스를 AI로 만들어 주는 RUN+Trip의 프론트엔드(React PWA)입니다.

- 플랫폼: React PWA, Android Chrome 기준 시연
- 배포: Vercel (HTTPS), `/api/*`는 `vercel.json` rewrites로 Spring Boot 백엔드(EC2)에 연결
- 지도: T map 웹 SDK

## 실행

```bash
npm install
cp .env.example .env.local   # 기본값: mock 응답 사용
npm run dev                  # 같은 와이파이의 휴대폰에서도 열려요 (host: true)
npm run build && npm run preview
```

- mock 로그인: `test@runtrip.test` / `runtrip1234` (mock은 메모리에만 있어서 새로고침하면 다시 로그인해요)
- 실제 백엔드: `.env.local`에 `VITE_USE_MOCK=false`, `VITE_API_PROXY_TARGET=http://localhost:8080`
- 휴대폰 GPS는 HTTPS에서만 동작해요. 실기기 확인은 Vercel 주소로 해요.

## 구조

| 위치 | 내용 |
| --- | --- |
| `src/api/types.ts` | API 명세 A파트 요청·응답 타입 (공통 응답 `RsData`) |
| `src/api/client.ts` | 모든 호출이 지나는 곳. `data`만 돌려주고 실패하면 `ApiError(code)`를 던져요 |
| `src/api/endpoints.ts` | API 12개 함수. 화면은 이것만 불러요 |
| `src/api/mock/` | `VITE_USE_MOCK`일 때 쓰는 가짜 서버 |
| `src/routes/paths.ts` | 화면 12개 주소, 하단 탭 표시 화면, 장소 카드 쿼리(`?place=`) |
| `src/pages/` | 화면 뼈대. 각 화면 이슈(#3~#11)에서 채워요 |

## 배포 (Vercel)

- `vercel.json`의 `BACKEND_DOMAIN`을 백엔드 EC2 도메인으로 바꿔요 (HTTPS 필수).
- `/api/*`는 백엔드로, 나머지 주소는 `index.html`로 보내요.
- Service Worker는 빌드 파일만 캐시하고 `/api`는 캐시하지 않아요.

## 브랜치

| 브랜치 | 역할 |
| --- | --- |
| `main` | 배포용. 직접 push 금지, `develop`에서만 merge |
| `develop` | 개발 통합. 작업 브랜치를 PR로 merge |
| 작업 브랜치 | `develop`에서 생성. 이름은 `라벨#이슈번호-이름` (예: `feat#4-mingu`) |

## 커밋·PR 규칙

- 커밋: `[Label/#이슈번호]: message` (예: `[Feat/#4]: 코스 조건 입력 화면 구현`)
- PR 제목: `[Label/#이슈번호] 작업 요약`, 본문에 `Closes #이슈번호`
- 라벨: Feat, Fix, Refactor, Design, Chore, Setting, Comment, Docs, Test
