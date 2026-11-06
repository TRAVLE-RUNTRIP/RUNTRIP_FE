# RUN+Trip FE

서울 관광 러닝 코스를 AI로 만들어 주는 RUN+Trip의 프론트엔드(React PWA)입니다.

- 플랫폼: React PWA, Android Chrome 기준 시연
- 배포: Vercel (HTTPS), `/api/*`는 `vercel.json` rewrites로 Spring Boot 백엔드(EC2)에 연결
- 지도: T map 웹 SDK

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
