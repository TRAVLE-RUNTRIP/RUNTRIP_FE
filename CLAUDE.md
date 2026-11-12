# CLAUDE.md — RUN+Trip FE

이 파일은 Claude가 작업을 시작할 때 읽는 프로젝트 안내예요. 결정이 바뀌면 이 파일도 같이 고쳐요.
원본 기준 문서는 팀 노션(이민구 님 워크스페이스)의 **기능명세서**, **API 명세**, **파트별 개발 순서**, **MVP 확정안**, **깃 규칙**이에요. 이 파일과 노션이 다르면 노션이 우선이에요.

## 프로젝트

- 서울에서 출발지·도착지·거리·취향을 받아 **관광지를 지나는 러닝 코스**를 AI로 만들고, 달린 기록을 저장하는 서비스의 데모
- 팀: 이민구(PM·BE), 노종원(디자인·FE), 장현서(AI·데이터). 레포: `TRAVLE-RUNTRIP/RUNTRIP_FE`, `RUNTRIP_BE`, `RUNTRIP_AI`
- 구조: **React PWA(Vercel, HTTPS)** → `/api/*` rewrites → **Spring Boot(EC2)** → FastAPI(MLP 점수·OR-Tools·안전 점수) + OSRM + PostgreSQL/PostGIS
- 시연: **Android Chrome** 기준. 러닝은 **화면을 켜 둔 동안만 측정**(Wake Lock). 백그라운드 GPS·네이티브 앱·스토어는 MVP 제외
- 지도: **T map 웹 SDK** (브라우저에서 직접 호출, 앱 키는 `VITE_TMAP_APP_KEY`)
- 로그인: 미리 만든 **테스트 계정만**, 세션 쿠키 24시간. 회원가입·JWT·로그아웃·설정 화면·탈퇴 없음

## 실행과 구조

```bash
npm install
cp .env.example .env.local   # 기본 mock
npm run dev                  # host: true, 같은 와이파이 휴대폰에서 접속 가능
npm run build && npm run lint
```

| 위치 | 내용 |
| --- | --- |
| `src/api/types.ts` | API 명세 A파트 요청·응답 타입 |
| `src/api/client.ts` | `request()` 하나로 모든 호출. `RsData`를 풀어 `data`만 돌려주고 실패 시 `ApiError(code, message, status)`. `UNAUTHENTICATED`면 `runtrip:auth-expired` 이벤트 → 로그인으로 |
| `src/api/endpoints.ts` | API 12개 함수(`api.login` 등). **화면에서 fetch를 직접 쓰지 않아요** |
| `src/api/mock/` | `VITE_USE_MOCK`이 `false`가 아니면 쓰는 가짜 서버(메모리 상태, 새로고침하면 초기화) |
| `src/routes/paths.ts` | 화면 주소, 하단 탭 표시 화면, 장소 카드 쿼리 |
| `src/pages/*.tsx` | 화면 뼈대(auth, course, run, saved). 각 화면 이슈에서 채움 |
| `src/components/` | `AppLayout`(탭 표시·세션 만료 처리), `BottomTab`, `Screen`, `PlaceCard` |
| `vite.config.ts` | PWA 설정. Service Worker는 `/api`를 캐시하지 않음(NetworkOnly + navigateFallback 제외) |
| `vercel.json` | `/api/*` → `https://BACKEND_DOMAIN/api/*` (EC2 도메인 확정 후 교체), 나머지 → `index.html` |

mock 로그인: `test@runtrip.test` / `runtrip1234` (로컬·mock 전용. EC2는 다른 비밀번호)

## 화면 (와이어프레임 v1.5, 화면 12개 + 장소 카드)

| ID | 화면 | 주소 | 하단 탭 |
| --- | --- | --- | --- |
| S-01 | 스플래시 (자동으로 로그인으로) | `/` | |
| S-02 | 로그인 | `/login` | |
| M-00 | 홈 (서울 관광지 사진 5장 고정 + AI 코스 만들기 / 자유 러닝) | `/home` | ✅ |
| M-10 | 코스 조건 입력 | `/course/new` | |
| M-11 | 생성 중 (4단계 표시, 실패 화면 포함) | `/course/generating` | |
| M-12 | 코스 결과 | `/course/result/:courseId` | |
| M-20 | 카운트다운 3·2·1 + GPS 확인 | `/run/countdown` | |
| M-21 | 러닝 측정 | `/run` | |
| M-21b | 장소 설명 카드 (오버레이) | `?place=장소ID` (M-12, C-03, M-21) | |
| M-22 | 러닝 완료 | `/run/complete` | |
| C-02 | 저장 코스 목록 | `/courses` | ✅ |
| C-03 | 코스 상세 | `/courses/:courseId` | |
| P-01 | 마이 (프로필 + 러닝 기록) | `/my` | ✅ |

## 기능 규칙 (기능명세서 요약)

- **조건 입력(F-02)**: 출발지 현재 위치/직접 입력, 도착지 미정(=순환)/직접 입력, 거리 1~21km 자유 입력 + 3·5·10 빠른 선택, 취향 야경/관광 명소/자연·공원 1개 이상. 범위 밖 "1~21km 사이로 입력해 주세요", 취향 없음 "취향을 1개 이상 골라 주세요". 도착지가 있어도 거리 입력 유지. 도착지 지정 시 [코스 생성] 전에 API 4로 최소 거리 확인 → 짧으면 막고 안내, 21km 초과면 도착지가 멀다고 안내. 서울 밖이면 "서울에서만 만들 수 있어요". 위치 권한 거부 시 출발지를 직접 입력으로
- **생성(F-03)**: 목표 2초, ±10%. 10초 넘으면 `GENERATION_TIMEOUT`. 실패 시 이유 + [조건 수정] [다시 시도]
- **결과(F-04)**: 지도(경로선·마커), 거리, 예상 시간, 순환·편도, 안전 지수, 경유 장소. 뒤로가기는 확인 없이 홈(미저장 코스 사라짐)
- **추천 이유(F-05)**: 결과 표시 후 API 6을 1초 간격 최대 5번. 그래도 PENDING이거나 실패면 장소 개요, 개요도 없으면 이름·분류만
- **안전 조언(F-06)**: 구간 색, 점수, 관측(coverage)·추정(estimated) 비율, 안내 문구, 야간 경고, "공공데이터 기반 참고용 지수". `safety`가 null이면 "준비 중". 경로는 바꾸지 않음. 낮은 구간 있으면 [다른 코스 만들기](=F-07)
- **다시 만들기(F-07)**: 이미 보여준 장소 조합을 `excludedCombos`로 보냄. 더 없으면 `NO_MORE_COURSES` + [조건 수정]
- **장소 카드(F-08)**: 아이콘 클릭 또는 러닝 중 `routeLat/routeLng` 50m 안. 측정은 계속, 카드 열린 동안 지도 따라가기 멈춤. 사진 없으면 기본 이미지, 개요 없으면 영역 숨김
- **코스 이름**: 서버가 자동 생성("덕수궁·청계천 코스", "경복궁 → 광화문 코스", "10월 9일 자유 러닝 코스")
- **러닝 시작(F-10, F-11)**: 준비 화면 없이 카운트다운. 목표 거리·페이스 없음. GPS 잡힐 때까지 대기. 출발점에서 멀면 거리 안내(막지 않음). 위치 권한 거부면 시작 막고 브라우저 설정 안내
- **러닝 측정(F-12)**: 지도, 거리, 시간, 현재·평균 페이스(코스 러닝은 다음 장소·남은 거리도). 일시정지·재시작, 내 위치로, 길게 눌러 종료. 정확도 낮거나 튀는 위치는 제외. 화면 끔·앱 전환 시 자동 일시정지, 복귀 시 안내 후 재개하고 끊긴 구간 제외, Wake Lock 재요청, 구간을 나눠 저장(직선으로 잇지 않음). 측정 중 데이터를 기기에 저장해 복구
- **러닝 완료(F-13)**: 날짜·코스명, 경로, 거리, 시간, 평균 페이스, 방문 장소 수(코스만). 체크박스 — 코스 러닝 "이 코스도 저장하기"(기본 켜짐, 이미 저장한 코스면 숨김), 자유 러닝 "이 경로를 코스로 저장하기"(기본 꺼짐). [기록 저장] → 응답 `courseSaved` true면 C-02, false면 P-01. [저장 안 함] → API 호출 없이 기기 데이터 삭제 후 홈. 실패 시 기기에 두고 [다시 시도]. `runId`(앱이 만든 UUID)로 중복 방지. 로그인 후 미저장 기록이 있으면 M-22로
- **저장 목록(F-14)**: 최신순 고정, 정렬 메뉴 없음. 비면 "저장한 코스가 없어요" + [AI 코스 만들기]
- **상세(F-15)**: 지금 시간대 기준 안전 지수. [이 코스로 달리기] [삭제]
- **삭제(F-16)**: 확인 창 후 삭제, 상세에서 지우면 C-02로. 러닝 기록은 코스명 복사본이라 그대로
- **마이(F-17, F-18)**: 닉네임·이메일, 기록(코스명/자유 러닝, 날짜, 시간, 평균 페이스, 거리) 최신순
- **MVP 제외**: km별 페이스, 월간 합계, 달린 횟수·최고 기록, 공유, 알림, 로그 수집

## API (API 명세 A파트, 필드 이름은 아직 제안값)

- 공통 응답 `RsData`: `{ success, data, error: { code, message } | null, timestamp }`. 예외: 10번 삭제는 `204` 본문 없음
- 시간은 한국 시간 ISO 8601, 좌표 `{lat, lng}`, 경로선 `[lat, lng]` 배열, 거리 km, 시간 초, 페이스 초/km
- 세션 쿠키(HttpOnly, Secure, SameSite=Lax), 로그인 외 전부 필요

| # | 메서드 · 경로 | 용도 |
| --- | --- | --- |
| 1 | `POST /api/auth/login` | 로그인 |
| 2 | `GET /api/users/me` | 프로필 |
| 3 | `GET /api/locations/search?query=` | 출발지·도착지 검색 (서울 안만) |
| 4 | `POST /api/courses/min-distance` | 최소 입력 거리 (도착지 있을 때만) |
| 5 | `POST /api/courses` | 코스 생성·다시 만들기 (201) |
| 6 | `GET /api/courses/{id}/reasons` | 추천 이유 (PENDING/DONE) |
| 7 | `PUT /api/courses/{id}/saved` | 코스 저장 |
| 8 | `GET /api/courses/saved` | 저장 목록 |
| 9 | `GET /api/courses/{id}` | 코스 상세 |
| 10 | `DELETE /api/courses/{id}/saved` | 저장 삭제 (204) |
| 11 | `POST /api/runs` | 러닝 기록 저장 (같은 runId면 200) |
| 12 | `GET /api/runs` | 러닝 기록 |

오류 코드: `UNAUTHENTICATED`(401→로그인), `INVALID_CREDENTIALS`(401, "이메일 또는 비밀번호를 확인해 주세요"), `VALIDATION_ERROR`(400), `OUT_OF_SEOUL`·`DISTANCE_TOO_SHORT`·`DESTINATION_TOO_FAR`·`NO_PLACES`·`NO_MORE_COURSES`(422), `COURSE_NOT_FOUND`·`RESOURCE_NOT_FOUND`(404), `METHOD_NOT_ALLOWED`(405), `GENERATION_TIMEOUT`(504), `SERVER_ERROR`(500). 앱 전용으로 `NETWORK_ERROR`

시나리오: 생성 후 바로 달리기 5 → 6 반복 → (달리는 중 호출 없음) → 11 → 8 또는 12 / 저장 코스 8 → 9 → 11 / 자유 러닝 11 / 복구 1 → M-22 → 11

## 이슈 순서 (RUNTRIP_FE 이슈 = 노션 파트별 개발 순서)

| 이슈 | 개발 순서 ID | 내용 | 선행 |
| --- | --- | --- | --- |
| #1 | FE-01 | React PWA 구성, Vercel 배포 | - |
| #2 | FE-02 | T map 웹 SDK, GPS, Wake Lock 실기기 검증 | #1 |
| #3 | FE-03 | 스플래시, 로그인 (mock → BE 배포 후 실제 API) | #1 |
| #4 | FE-04 | 홈, 코스 조건 입력 | #3 |
| #5 | FE-05 | 생성 중, 실패, 결과 | #2, #4 |
| #6 | FE-06 | 장소 카드, 추천 이유 조회 | #5 |
| #7 | FE-07 | 카운트다운, 러닝 측정 | #2, #6 |
| #8 | FE-08 | 러닝 완료, 미저장 기록 복구 | #7 |
| #9 | FE-09 | 저장 코스 목록·상세 | #5, #7 |
| #10 | FE-10 | 마이 | #3 |
| #11 | FE-11 | 안전 조언 표시 | #5 |
| #12 | FE-12 | UI 다듬기, 데모 영상 | 전체 |
| #13~#15 | INT-01~03 | 코스 생성 / 러닝·저장 / 추천 이유·안전 조언 BE 연동 | |

- 핵심 목표(단계 3): **5km 순환 코스가 실제 API로 지도에 ±10%로 표시**. 코스 생성(#5, #13)은 일정이 밀려도 빼지 않아요
- 일정이 밀리면 줄이는 순서: 안전 조언(#11) → 추천 이유(#6의 이유 부분, 개요로 대체)
- 진행: #1 완료(`setting#1-jongwon`). Vercel 프로젝트 `runtrip_fe`(Vite 프리셋, `VITE_USE_MOCK=true`) 미리보기 배포를 Android Chrome에서 확인. 정식 주소는 develop → main 머지 후. `BACKEND_DOMAIN`은 EC2 도메인 확정 후 BE 연동(#13)에서 교체
- 진행: #2 완료(`feat#2-jongwon`). Android 10 / Chrome 150에서 T map 지도·경로선·마커·현재 위치, GPS(평균 정확도 약 11m, 약 1초 갱신), Wake Lock(앱 전환 후 복귀 시 재획득) 확인. 검증 화면 `/dev/map-check`. T map 앱 키는 Vercel 환경 변수 `VITE_TMAP_APP_KEY`(Production·Preview), 허용 IP 제한 없음
- 진행: #3 mock 기준 구현(`feat#3-jongwon`). 세션 확인은 `src/auth/session.ts`(API 2로 확인, 앱 실행 중 한 번), 보호 화면은 `RequireAuth`로 감쌈(스플래시·로그인·`/dev/map-check` 제외). mock 세션은 만료 시각을 localStorage에 저장해 새로고침 후 24시간 유지. **이슈 #3은 BE #5(EC2 배포) 후 실제 API로 새로고침 유지까지 확인하고 닫음**
- 진행: #5 mock 기준 구현(`feat#5-jongwon`). 지도는 `src/map/CourseMap.tsx`(경로선·출발/도착·번호 마커, T map 실패 시 경로 모양 그림으로 대체, #7·#9에서 재사용). 조건 입력 → 생성 중은 `replace`로 이동해 결과에서 뒤로가기 = 홈. 다시 만들기는 결과 화면 state의 `request.excludedCombos`에 지금 조합(placeId 순서대로)을 더해 보냄. mock 실패 확인: 목표 거리 13km `NO_PLACES`, 17km `GENERATION_TIMEOUT`, 19km `SERVER_ERROR`, 다시 만들기 3번이면 `NO_MORE_COURSES`. 실패 문구 일부는 기능명세서에 없어 임시(`course.tsx` `failureCopy`)

## 러닝 측정 기준 후보 (#2 실측, #7에서 적용)

- SDK·훅: `src/map/tmap.ts`(`loadTmap()`, 공식 로더의 document.write를 가로채서 불러옴), `src/lib/useGeoWatch.ts`, `src/lib/useWakeLock.ts`, `src/lib/geo.ts`(`distanceM`)
- 정확도 20m 초과 위치는 거리 계산에서 제외. 측정 시작 직후에 많이 나오므로 카운트다운(M-20)에서 정확도 20m 이내가 될 때까지 대기
- 직전 위치 대비 8.5m/s(약 2분/km) 초과로 튄 위치는 제외
- 화면 끔·앱 전환 중에는 위치가 들어오지 않음(실측 91초 공백). 공백은 직선으로 잇지 않고 구간을 나누고, 복귀 시 Wake Lock 재요청

## 깃 규칙 (팀 노션 "깃 규칙 정리")

- 브랜치: `main`(배포용, 직접 push 금지) / `develop`(통합) / 작업 브랜치는 develop에서 `라벨#이슈번호-이름` (예: `feat#4-jongwon`, 라벨 소문자)
- 커밋: `[Label/#이슈번호]: message` (예: `[Feat/#4]: 코스 조건 입력 화면 구현`)
- 라벨: Feat, Fix, Refactor, Design, Chore, Setting, Comment, Docs, Test
- 이슈 제목 `[라벨] 목표 한 줄`, 본문 목적 / 범위(포함·제외) / 작업 내용 / 완료 조건
- PR: develop으로. 제목 `[Label/#이슈번호] 작업 요약`, 본문 연관 Issue(`Closes #n`) / 요약 / 작업 내용 / 범위(포함·제외) / 스크린샷
- 배포 시 develop → main PR

## 작업 원칙

- 이슈의 **범위(포함·제외)** 밖은 건드리지 않아요. 다른 이슈 일은 TODO 주석 대신 해당 이슈 번호를 적어요
- API 필드는 `src/api/types.ts`에서만 고쳐요. 명세가 바뀌면 mock(`src/api/mock`)도 같이 맞춰요
- 사용자에게 보이는 문구는 기능명세서 문구를 그대로 써요(존댓말 "~해요"체)
- 작업 후 `npm run build`와 `npm run lint`가 통과해야 해요
