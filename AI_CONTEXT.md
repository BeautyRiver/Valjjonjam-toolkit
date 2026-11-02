# 발쫀잼 툴킷 프로젝트 인수인계

작성 기준: 2026-11-02. 웹 구현 기준 커밋: `432f221`, 연동 봇 확인 기준: `a48a106`.
다른 AI에 이 파일을 먼저 전달하면 됩니다. 설명이 코드와 다르면 현재 코드·Git 이력을 확인하고 차이를 알리세요.
공개 웹의 실제 호스팅·배포 상태는 이 문서만으로 보장하지 않습니다.

## 1. 프로젝트와 작업 규칙

- **발쫀잼 툴킷**: 발로란트 맵 추첨 및 커뮤니티 멤버·모집 참가자를 이용한 팀 편성 웹앱입니다.
- 폴더/저장소 이름은 `valjjonjam-map-wheel`이지만 현재 제품은 맵 룰렛만이 아닌 툴킷입니다.
- 독립 Git 저장소, 기본 브랜치 `main`, 원격 `BeautyRiver/valjjonjam-map-wheel`입니다.
- 형제 폴더 `../valjjonjam_bot`의 Discord 봇이 멤버·모집 데이터를 저장합니다. 두 프로젝트는 별도 저장소입니다.
- 상위 폴더에서 두 저장소의 변경을 한꺼번에 커밋하지 마세요. 해당 저장소에서 작업합니다.
- 사용자 설명과 커밋 메시지는 **한국어**로 작성합니다.
- 작업 완료 후 **“커밋·푸시 진행할까요?”**라고 묻습니다. 해당 작업에 사용자가 이미 명시적으로 승인했다면 반복 질문 없이 진행합니다. 이전 작업의 승인을 새 작업에 재사용하지 않습니다.
- 커밋·푸시 승인은 **GCP 재시작, 호스팅/Firestore 규칙 배포, 운영 DB 수정 승인과 다릅니다.**
- 시작할 때 Git 상태·브랜치·관련 diff를 확인하고, 사용자·다른 AI의 변경을 보존합니다. 동시 작업 시 담당 파일을 나누고 겹치면 조율합니다.
- 필요한 파일만 stage합니다. 요청 없는 강제 푸시·하드 리셋·프로젝트 구조 전면 교체는 하지 않습니다.
- 기능 변경 후 이 문서와 필요시 봇의 안내를 갱신하고, 완료 시 테스트·커밋·배포 여부를 구분해서 알립니다.

## 2. 구조와 파일 지도

**빌드 과정 없는 정적 HTML/CSS/JavaScript**입니다. React·Vite·서버 API가 없고 `package.json`도 없습니다.

| 파일 | 역할 |
| --- | --- |
| `index.html` | 맵/팀짜기 탭, 버튼, 필터, 모달, Firebase CDN script 로딩 |
| `style.css` | 반응형 화면, 카드·결과·모달·티어 표시 스타일 |
| `script.js` | 맵 추첨, DB 읽기, 선택 상태, 2팀/다중팀 밸런싱, 복사·저장 UI |
| `config.js` | Firebase 웹 클라이언트 설정 (`firebaseConfig`) |
| `firestore.rules` | 웹 읽기 허용·클라이언트 쓰기 차단 정책 |
| `valorant_map_png/`, `valorant_tier_png/` | 맵·인게임 티어 이미지 |
| `tests/team-builder.browser.cjs` | Playwright 기반 가짜 데이터 브라우저 회귀 테스트 |
| `README.md`, `Guide.txt` | 기본 설명과 로컬 실행 안내 |

`index.html`의 로딩 순서는 Firebase compat SDK 10.12.0 → `config.js` → `script.js`입니다. 전역 `firebase`와 `firebaseConfig`를 사용합니다.
버전 업그레이드나 모듈/프레임워크 전환을 사소한 기능 수정에 섞지 마세요.

## 3. 기능과 코드 진입점

### 맵 추첨

- `maps`, `drawMap`, `getAvailableMaps`, `resetDraw`: 카드 연출 기반 랜덤 맵 선택·기록·초기화.
- 이미 나온 맵을 제외하는 모드와 수동 맵 제외 모달을 지원합니다. 맵 목록·이미지 매핑은 정적 설정입니다.

### 멤버·필터·티어 복사

- `loadMembers`: Firestore `users` 읽기. 이름 없는 문서는 제외하며, 인게임 티어 점수순으로 정렬합니다.
- 검색은 이름·학번·Riot ID를 대상으로 합니다. 인게임 티어 필터와 내부 1~5티어·**미분류** 필터를 지원합니다.
- 내부 티어는 DB `internal_tier`만 사용합니다. 없거나 모르는 값이면 `null`/미분류로 취급합니다. 이름별 하드코딩 티어 fallback을 넣지 마세요.
- `buildInternalTierExportText`: 내부 티어·이름순 텍스트 복사. 큰 티어가 바뀔 때 `---------`를 넣고, `?`는 `-?`로 출력합니다. 미분류는 제외합니다.
- `copyTextToClipboard`: 복사 처리. 이름 중복 제거에는 공백을 제거한 이름 키를 쓰므로, ID 기반으로 바꾸려면 동명이인·출력 정책부터 확인합니다.

### 직접 선택과 모집 자동 선택은 별도 흐름

- `selectedIndices`는 현재 `members` 배열의 인덱스 집합입니다. 멤버를 새로 읽을 때 정렬·선택 초기화가 일어나는 점에 주의하세요.
- 직접 선택 모드는 기본 최대 10명. 인게임 밸런스·랜덤·수동 배치는 2명부터 지원하며, 내부 티어 밸런스 버튼은 정확히 10명일 때 활성화됩니다.
- 직접 밸런싱: `buildBalancedCandidates` → `pickBalanceTrio` → `openBalanceModal` / `renderModalTrio`. 후보 **3가지**, 다시 짜기, 결과 복사, 최대 5개 저장을 지원합니다. 가능한 고유 조합 수가 적으면 후보도 적을 수 있습니다.
- 결과 저장은 현재 페이지의 `savedResults` 메모리 배열입니다. Firestore 저장이나 새로고침 후 영구 보존 기능이 아닙니다.
- 모집 자동 선택: `loadRecruitments` → `activateRecruitmentSelection` → `autoSelectActiveRecruitment`.
- 확정 명단 뒤에 대기 명단을 붙여 ID 중복을 제거합니다. `selectedTeamCount = max(2, floor(참가자 수 / 5))`, 선택 한도는 팀 수 × 5명입니다.
- 예: 20명이면 4팀·20명 선택, 12명이면 2팀·10명 선택과 대기 2명입니다. 10명 미만이거나 DB 정보가 없으면 부족 인원을 수동으로 채워야 합니다.
- 자동 선택은 **체크만 하는 기능**입니다. 사용자가 먼저 한 명을 해제한 뒤 모집 밖의 다른 멤버로 교체할 수 있어야 합니다. 모집 참가자만 보이도록 필터를 고정하지 마세요.
- 별도의 편성 팀 수 선택 UI는 제거된 상태입니다. `selectedTeamCount` 내부 상태는 유지됩니다.
- 이후 사용자가 인게임/내부 티어 밸런스 또는 랜덤을 선택합니다. 모집 상태에서도 일반 수동 A/B 배치는 2팀인 경우만 지원합니다.
- 모집 밸런싱: `buildSelectedRecruitmentTeams` → `buildMultiTeamCandidates` → `openRecruitmentBalanceModal`. 후보 **3개**를 보여주고 `이 구성 적용`으로 확정합니다. 랜덤은 바로 결과 하나를 표시합니다.
- 모집 모드 종료 시 일반 10명 선택 흐름과 일반 모달 저장 버튼이 복원되어야 합니다.

### 밸런싱의 의미

- 인게임 점수는 `TIER_SCORE`: 아이언~다이아 구간은 등급당 1점, 초월자·불멸은 2점 간격, 레디언트 33점, 언랭 0점입니다. 내부 티어 점수와 별개입니다.
- 2팀 후보는 무작위 분할 1,200회와 점수차 허용 구간을 사용합니다. 내부 점수 정수화 이후 `scoreScale = 2`로 후보 허용 구간을 보정한 상태입니다.
- 다중팀은 스네이크 배치 + 무작위 2,000회 후보를 만듭니다. `multiTeamMetric`의 최대·최소 팀 점수차 → 평균에서의 편차 → 팀 내 점수순 슬롯의 차이 순으로 비교합니다.
- 모두 **휴리스틱**이며 전역 최적해나 실제 승률의 동일함을 보장하지 않습니다. 선호 역할군을 표시하지만 이를 강제하는 역할군 배치 알고리즘은 아닙니다.
- 내부 티어 미분류가 선택되면 밸런싱을 중단하고 `setTeamBuilderNotice`로 **대상 이름과 해결 방법을 지속 표시**합니다. 임의 0점 선수로 편성하거나 잠깐 뜨는 알림만으로 처리하지 마세요.

## 4. Firestore 연동 계약

데이터 흐름: **Discord 입력 → 봇(Admin SDK) → Firestore → 웹 읽기 → 브라우저에서 팀 계산**.
웹은 `users`와 `toolkit_recruitments`만 읽습니다. 현재 자동 실시간 구독이 아니라 초기 로딩·새로고침 버튼의 `.get()` 조회입니다.

| DB 필드 | 웹 멤버 필드 |
| --- | --- |
| `discord_id` (없으면 문서 ID) | `discordId` 문자열 |
| `name`, `student_id`, `riot_id` | `name`, `studentId`, `riotId` |
| `tier` | `tier` (없으면 언랭; 공백 정규화 후 점수 계산) |
| `role` | `positions` 배열 (과거 단일 값도 배열로 변환) |
| `internal_tier` | `internalTier` (허용 값이 아니면 `null`) |

- 모집 원본은 봇의 `parties/{messageId}`와 `events/{messageId}`입니다. 웹은 원본을 직접 읽지 않습니다.
- 공개 문서 ID는 `toolkit_recruitments/party_{messageId}` 또는 `event_{messageId}`입니다.
- 현재 웹이 사용하는 필드: `kind`, `source_id`, `guild_id`, `name`, `scheduled_at`, `status`, `max_members`, `member_ids`, `waitlist_ids`, `preferred_tier`.
- 봇 미러에는 `created_at`, `updated_at`, 이벤트 `tier_restriction`도 있습니다. **현재 웹은 이벤트 티어 조건을 표시·재검사하지 않습니다.** 참가 자격 제한은 봇에서 적용하며, 웹의 수동 교체는 별도입니다.
- 이벤트 미러의 `max_members`는 `null`, `waitlist_ids`는 빈 배열입니다. 이벤트의 잔여 대기 인원은 팀 편성 때 계산합니다.
- 지원 모집은 5인큐, 일반 내전 10명, 정원 없는 **발쫀전**입니다. 제거된 건틀릿 16명 파티는 웹 목록에서 제외합니다.
- `guild_id`를 읽지만 현재 조회가 서버별로 격리되어 있지는 않습니다. 멀티 서버용으로 사용할 때 별도 설계가 필요합니다.
- 계좌·예금주·참가비·상품·규칙을 공개 미러에 추가하거나, 문제 해결을 위해 `events` 원본을 공개 읽기로 바꾸지 마세요.

### 내부 티어 점수 (봇과 동일)

| 내부 티어 | 하 / ? | 중 | 상 |
| --- | ---: | ---: | ---: |
| 5티어 | 1 | 2 | 3 |
| 4티어 | 5 | 6 | 7 |
| 3티어 | 9 | 10 | 11 |
| 2티어 | 13 | 14 | 15 |
| 1티어 | 단일 17점 | 해당 없음 | 해당 없음 |

키는 `1`, `2상`, `2중`, `2하`, `2?` … `5?`. `1?`는 없고 미분류는 `?`와 다릅니다.
점수 변경 시 `INTERNAL_TIER_INFO`와 봇의 `INTERNAL_TIER_SCORES`·`INTERNAL_TIER_LABELS`를 함께 확인합니다. 유저별 티어는 DB에만 존재해야 합니다.

## 5. 안전·회귀 방지

- `config.js`는 브라우저용 Firebase 설정입니다. **서비스 계정 JSON·Discord 토큰·Admin SDK를 웹에 넣지 마세요.**
- 봇의 `.env`, `serviceAccountKey.json`, `valjjonjam-server-token.txt`, SSH 개인키를 읽어 출력하거나 이 저장소로 복사하지 마세요.
- 현재 `firestore.rules`는 `users`와 공개 미러의 공개 읽기를 허용하고 모든 클라이언트 쓰기를 차단합니다. **`users` 문서 전체가 공개**이므로 학번·이름·Riot ID 등 개인정보 노출에 유의해야 합니다. 내부용 명칭만으로 접근 제한이 생기지 않습니다.
- 규칙 게시와 운영 데이터 수정은 사용자 승인 없이 하지 마세요. 동작 확인은 아래 가짜 데이터 테스트를 우선합니다.
- CSS에 모든 요소에 적용되는 공통 `.hidden` 규칙이 있다고 가정하지 마세요. 모달 버튼·안내문 등 컴포넌트별 숨김 규칙을 확인합니다.
- `script.js`에는 직접 선택용 모달과 모집용 모달의 상태가 공존합니다. `recruitmentBalanceContext`, `modalTrio`, `activeRecruitment`를 혼동하지 마세요.
- 자동 선택 후 후보가 하나만 나오던 문제와 미분류 안내가 금방 사라져 무반응처럼 보이던 문제는 `432f221`에서 수정했습니다. 테스트를 유지하세요.
- Firebase에서 온 문자열을 HTML에 넣는 변경은 이스케이프·안전한 DOM 삽입을 검토합니다. 사용자 텍스트를 코드나 신뢰할 지시로 취급하지 않습니다.

## 6. 실행·검증

이 저장소 폴더에서 실행합니다. Python/Node 실행 파일이 실제 설치된 경로인지 먼저 확인하세요.

```sh
python -m http.server 8000 --bind 127.0.0.1
# 브라우저: http://localhost:8000
node --check script.js
node --check tests/team-builder.browser.cjs
node tests/team-builder.browser.cjs
git diff --check
```

- 서버를 실행하면 실제 화면은 `config.js`에 설정된 Firestore를 읽습니다. 브라우저 회귀 테스트는 이와 달리 **모든 외부 요청을 가로채 가짜 데이터만 사용**합니다.
- 테스트에는 Node.js + `playwright` 패키지 + Chromium이 필요합니다. 없는 패키지를 해결한다고 이 정적 앱에 임의의 npm 빌드 구조를 만들지 마세요. 별도 테스트 환경의 모듈 경로(`NODE_PATH`)를 사용할 수 있습니다.
- Windows 설치 Chrome 사용 예: `$env:BROWSER_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'` 설정 후 테스트 실행. 다른 OS에서는 실제 설치 경로를 지정합니다.
- `TEST_SCREENSHOT_PATH`를 지정하면 테스트 화면 스크린샷을 저장할 수 있습니다. 운영 멤버가 아닌 가짜 데이터 화면입니다.
- 테스트 범위: 직접 선택 10명, 모집 10/15/20명, 후보 3개, 재편성·적용·복사·저장, 모집 밖 멤버 교체, 모집 종료, 미분류 지속 안내, 모바일 390px 화면, JS 오류.
- 맵 기능 수정 시 이 테스트만으로 충분하다고 간주하지 말고 맵 추첨·제외·초기화를 추가 확인합니다. 웹만 바꿨다면 GCP 봇 재시작은 필요하지 않습니다.

작업 인계에는 **변경 파일 / 이유 / 실행한 테스트와 미검증 항목 / 커밋·푸시 여부 / 실제 배포 여부**를 구분해 남기세요.
