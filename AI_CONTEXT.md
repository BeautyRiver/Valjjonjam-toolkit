# 발쫀잼 툴킷 프로젝트 인수인계

작성 기준: 2026-11-04. 웹 구현 기준 커밋: `7cd1d80` 이후 모바일 화면 수정, 연동 봇 확인 기준: `5ca008e`.
다른 AI에 이 파일을 먼저 전달하면 됩니다. 설명이 코드와 다르면 현재 코드·Git 이력을 확인하고 차이를 알리세요.
공개 웹의 실제 호스팅·배포 상태는 이 문서만으로 보장하지 않습니다.

## 1. 프로젝트와 작업 규칙

- **발쫀잼 툴킷**: 발로란트 맵 추첨 및 커뮤니티 멤버·모집 참가자를 이용한 팀 편성 웹앱입니다.
- 폴더/저장소 이름은 `Valjjonjam-toolkit`입니다. 예전 이름 `valjjonjam-map-wheel`이 남은 자료가 있으면 현재 이름을 기준으로 봅니다.
- 독립 Git 저장소, 기본 브랜치 `main`, 원격 `BeautyRiver/Valjjonjam-toolkit`입니다.
- 형제 폴더 `../Valjjonjam_bot_Discord`의 Discord 봇이 멤버·모집 데이터를 저장합니다. 두 프로젝트는 별도 저장소입니다.
- 상위 폴더에서 두 저장소의 변경을 한꺼번에 커밋하지 마세요. 해당 저장소에서 작업합니다.
- 사용자 설명과 커밋 메시지는 **한국어**로 작성합니다.
- 작업 완료 후 **“커밋·푸시 진행할까요?”**라고 묻습니다. 해당 작업에 사용자가 이미 명시적으로 승인했다면 반복 질문 없이 진행합니다. 이전 작업의 승인을 새 작업에 재사용하지 않습니다.
- 커밋·푸시 승인은 **GCP 재시작, 호스팅/Firestore 규칙 배포, 운영 DB 수정 승인과 다릅니다.**
- 단, 공개 웹은 GitHub Pages(`https://beautyriver.github.io/Valjjonjam-toolkit/`)이고 **`main` 푸시가 곧 공개 웹 배포**입니다(2026-11-04 `ef5929e` 푸시 직후 공개 페이지 반영 확인). `main`에 푸시하기 전에 이 점을 사용자에게 함께 알립니다.
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
| `tests/ui-screenshots.browser.cjs` | 가짜 데이터로 PC·모바일 화면 캡처 (UI 확인용, 판정 테스트 아님) |
| `.agents/skills/toolkit-check/` | 수정 후·푸시 전 점검 절차(`SKILL.md`)와 점검 스크립트. `.claude/skills/toolkit-check/`는 이 본문을 가리킴 |
| `README.md`, `Guide.txt` | 기본 설명과 로컬 실행 안내 |

`index.html`의 로딩 순서는 Firebase compat SDK 10.12.0 → `config.js` → `script.js`입니다. 전역 `firebase`와 `firebaseConfig`를 사용합니다.
한글 폰트는 jsDelivr의 Pretendard `v1.3.9` 가변 폰트(`"Pretendard Variable"`)를 버전 고정으로 불러옵니다. Pretendard는 Google Fonts에 없으므로 Google Fonts 주소로 되돌리지 마세요.
버전 업그레이드나 모듈/프레임워크 전환을 사소한 기능 수정에 섞지 마세요.

## 3. 기능과 코드 진입점

### 맵 추첨

- `maps`, `drawMap`, `getAvailableMaps`, `resetDraw`: 카드 연출 기반 랜덤 맵 선택·기록·초기화.
- 이미 나온 맵을 제외하는 모드와 수동 맵 제외 모달을 지원합니다. 맵 목록·이미지 매핑은 정적 설정입니다.
- 화면의 "포함 맵" 목록(`#mapListNames`)과 제외 목록은 `renderMapList`가 `maps` 배열에서 그립니다. 맵을 추가할 때 HTML에 맵 이름을 따로 적지 마세요.
- 뽑을 맵이 없으면 `showNoMapsLeft`가 원인을 구분합니다. 전부 수동 제외면 "뽑을 맵 없음"과 맵 제외 설정 안내, 제외 모드로 다 나왔으면 "모든 맵 완료!"와 초기화 안내입니다. "(마지막 맵)" 표시는 남은 맵 수 기준이라 수동 제외가 있어도 맞게 나옵니다.
- 한 열 배치(980px 이하)에서는 카드 영역 높이를 줄이고 `맵 뽑기`·`초기화` 버튼을 카드 바로 아래로 올려 모바일 첫 화면에 보이게 합니다. 안내 문구에 "우측"·"아래" 같은 위치 표현을 쓰지 않습니다.

### 멤버·필터·티어 복사

- `loadMembers`: Firestore `users` 읽기. 이름 없는 문서는 제외하며, 인게임 티어 점수순으로 정렬합니다.
- 🔄 새로고침은 새로고침 전 선택(모집 모드에서 교체한 멤버 포함)을 **Discord ID로 기억해 새 목록에서 다시 체크**합니다. 목록에서 사라진 사람만 빠지고 그 수를 안내합니다. 모집 모드에서 선택이 비어 있을 때만 자동 선택을 다시 합니다.
- `🐞 랜덤 10명`(`#debugPick10Btn`)은 디버그용입니다. 공개 사이트에서는 숨기고 `localhost`·`127.0.0.1`이나 주소에 `?debug`가 있을 때만 보입니다.
- 검색은 이름·학번·Riot ID를 대상으로 합니다. 인게임 티어 필터와 내부 1~5티어·**미분류** 필터를 지원합니다.
- 내부 티어는 DB `internal_tier`만 사용합니다. 없거나 모르는 값이면 `null`/미분류로 취급합니다. 이름별 하드코딩 티어 fallback을 넣지 마세요.
- `buildInternalTierExportText`: 내부 티어·이름순 텍스트 복사. 큰 티어가 바뀔 때 `---------`를 넣고, `?`는 `-?`로 출력합니다. 미분류는 제외합니다.
- `copyTextToClipboard`: 복사 처리. 이름 중복 제거에는 공백을 제거한 이름 키를 쓰므로, ID 기반으로 바꾸려면 동명이인·출력 정책부터 확인합니다.
- 멤버 카드 이름은 `.member-sid`(학번)와 `.member-name-text`(이름)로 나뉩니다. 이름은 띄어쓰기 단위로만 줄바꿈하고, 768px 이하에서는 이름이 위, 학번이 둘째 줄입니다. 멤버 그리드는 `minmax(0, 1fr)` 열이라 긴 이름이 한 열만 넓히지 않습니다.

### 모바일 하단 편성 바

- `.team-action-dock`가 편성 버튼(`.team-action-bar`), `#dockSelectedCount`, `#teamBuilderNotice`를 감쌉니다. 768px 이하에서만 `position: sticky; bottom: 0`으로 화면 하단에 고정되고, PC에서는 기존처럼 멤버 목록 아래에 있습니다.
- 선택 인원 문구는 `setSelectedCountBadge`가 필터 영역 `#selectedCount`와 하단 바 배지에 함께 씁니다. 배지 문구를 바꿀 때 `selectedCountEl.textContent`만 직접 고치지 마세요.
- 미분류 안내가 하단 바 안에 있어야 모바일에서도 버튼을 누른 자리에서 바로 보입니다. 안내를 바 밖으로 옮기지 마세요.
- `html, body`의 `overflow-x: clip`은 sticky가 동작하는 조건입니다. `hidden`만 남기면 body가 스크롤 컨테이너가 되어 하단 바가 고정되지 않습니다.

### 팀 결과 화면 (스코어보드형)

- 2팀 결과(`#teamResult`)와 2팀 밸런스 후보에는 `scoreboardHtml`이 만든 스코어보드가 위에 붙습니다. A·B 점수를 마주 놓고, 막대의 A 비율(`--a-share`)과 가운데 50% 눈금으로 두 팀이 얼마나 고른지 보여줍니다. 점수차는 이 안에 표시합니다.
- 팀 카드 머리는 `teamHeaderHtml`(“팀” + 큰 팀 글자, 인원, 다중팀은 점수)입니다. 팀 색은 `--team-color`로 정하며 2팀은 `.team-a-card`(빨강)·`.team-b-card`(보라), 다중팀은 `MULTI_TEAM_COLORS`를 style로 넣습니다.
- 멤버 행(`teamRowsHtml`)은 상자 없이 줄로 구분하는 3칸 그리드입니다. 왼쪽 칸(`memberPortraitHtml`)은 인게임 기준이면 티어 아이콘, 발쫀잼 기준이면 내부 티어 숫자이고, 가운데는 이름 아래에 학번·Riot ID, 오른쪽은 티어 글자(`memberTierLabelHtml`)입니다.
- 모달 안의 팀은 카드 배경 없이 왼쪽 색 띠로만 구분합니다(상자 세 겹 중첩 방지).
- 저장 보드와 직접 팀짜기 화면도 같은 체계입니다. 저장 항목은 기준 문구 + 스코어보드 + 팀 색 띠 이름 목록, 직접 팀짜기 행은 결과 행과 같은 3칸(배정하면 왼쪽 칸이 팀 색)이며 버튼 문구는 "팀 A"·"팀 B"입니다. 이름·학번 칸은 `memberInfoHtml`을 함께 씁니다.
- 팀 글자와 점수 숫자는 Pretendard 굵은 글꼴입니다. Valorant 글꼴은 B·2가 다른 글자처럼 보여 결과 화면에 쓰지 않습니다.
- 편성 방식은 `밸런스 편성`·`랜덤 편성`·`직접 편성`(`TEAM_METHOD_LABELS`)으로 부르고, 결과 스코어보드·모집 결과 제목·저장 보드·복사 문구에 `teamBasisText`(예: "밸런스 편성 · 인게임 티어 기준")로 같은 말을 씁니다. `lastTeams`와 저장 항목에 `method`가 있습니다.
- 복사 문구는 직접 선택(`buildTeamResultText`)과 모집(`buildRecruitmentResultText`) 모두 첫 줄에 기준과 점수차(모집은 최대 점수차), 팀 줄은 `teamCopyHeading`의 "팀 A (5명 · 112점)" 형식입니다. 화면 글자(`#teamAMeta`)를 읽어 만들지 않습니다.
- 막대 채우기와 결과 등장 연출은 `prefers-reduced-motion: reduce`에서 꺼집니다.
- 스코어보드는 A 점수 | 막대 | B 점수 한 줄과, 그 아래 점수차·기준 문구(`.sb-caption`) 줄로 된 그리드입니다. 768px 이하에서는 기준 문구가 좁은 막대 칸에서 여러 줄로 접히지 않게 전체 너비 줄로 내려갑니다.

### 다시 짜기 연출

- 밸런스 후보 🎲 다시 짜기, 모집 결과의 랜덤 다시 짜기, 직접 선택 🎲 랜덤 팀짜기에서 `playDealAnimation`이 컨테이너에 `is-dealing`을 붙입니다. 멤버 줄이 팀별로 한 줄씩(왼쪽 팀은 왼쪽, 짝수 번째 팀은 오른쪽에서) 들어오고, 후보 상자는 금색 테두리가 한 번 번지며, 점수 숫자는 `countUpScores`로 0부터 올라갑니다. 전체 0.7초 안쪽입니다.
- 후보·결과 데이터는 **바로(동기적으로) 바뀌고** 화면만 연출합니다. 클릭 직후 `recruitmentBalanceContext`·`modalTrio`를 읽는 테스트와 맞물리므로 데이터 교체를 지연시키지 마세요.
- 후보 목록(`#balanceModalList`)은 클래스를 떼는 순간 후보 상자의 원래 등장 애니메이션(`optIn`)이 다시 재생되므로 `keepClass`로 남겨 두고, 다음에 목록을 그릴 때(`renderModalTrio`·`renderRecruitmentBalanceCandidates` 시작) 뗍니다. 결과 화면은 0.9초 뒤 떼서 팀 편집으로 다시 그릴 때 연출이 반복되지 않게 합니다.
- 다시 짜면 모달을 맨 위로 스크롤합니다. 움직임 줄이기 설정에서는 연출 없이 결과만 바뀝니다.

### 팀 편집 (결과에서 두 사람 맞바꾸기)

- 직접 선택 2팀 결과(`#editTeamsBtn`)와 모집 결과(`#editRecruitmentTeamsBtn`)에 ✏️ 팀 편집이 있습니다. 비교용 후보 모달에는 없습니다.
- 한 명을 누른 뒤 **다른 팀** 사람을 누르면 맞바꿉니다. 같은 팀 사람을 누르면 선택만 바뀌고, 같은 사람을 다시 누르거나 Esc를 누르면 취소됩니다. 키보드는 줄에 포커스한 뒤 Enter·Space입니다. 인원이 달라지지 않도록 한쪽으로 옮기는 기능은 없습니다(인원 차이가 필요하면 직접 팀짜기).
- 맞바꿀 때마다 점수·스코어보드·(모집은) 최대 점수차를 다시 계산하고, 안내(`#teamEditHint`·`#recruitmentTeamEditHint`)에 "A ↔ B 교체 · 점수차 7 → 3"을 보여줍니다. ↩️ 되돌리기는 한 번씩 이전 구성으로 돌립니다.
- 맞바꾼 결과는 `lastTeams.edited`·`lastRecruitmentResult.edited`가 `true`이고, 편성 방식에 "(수정됨)"이 붙어 결과·복사 문구·저장 보드에 그대로 반영됩니다. 모집 결과는 `candidateKey`도 바뀐 구성으로 갱신합니다.
- 상태는 `teamEditState`(대상·고른 사람·되돌리기 기록), 대상별 연결은 `getTeamEditor`입니다. 다시 그리기는 `renderDirectTeams`·`renderRecruitmentTeams`이고 그 끝에서 `decorateEditRows`가 줄에 `role="button"`·`tabindex`·`aria-pressed`를 붙입니다. 사람은 `data-member-id`(Discord ID, `escapeHtml` 거침)로, 팀은 `[data-team-index]`로 찾습니다.
- 결과가 새로 그려지거나 숨겨지면(`displayTeams`, `renderRecruitmentResult`, 선택 변경, 자동 선택, 모집 종료, 직접 팀짜기 열기) `endTeamEdit`로 편집이 끝납니다.

### 키보드·모달 접근성

- 멤버 카드는 `role="checkbox"`·`tabindex="0"`·`aria-checked`이며 Space·Enter로 선택합니다.
- 맵 결과·맵 제외·밸런스 후보 모달은 `openModalLayer`/`closeModalLayer`를 거칩니다. 열면 대화상자(`tabindex="-1"`)로 포커스를 옮기고 Tab이 모달 안에서만 돌며, `html.modal-open`으로 배경 스크롤을 막습니다. 닫으면 연 버튼으로 포커스를 되돌립니다. 새 모달을 추가할 때도 이 두 함수를 쓰세요.
- 모달을 열 때 `visibility`는 바로 바뀌고(닫을 때만 서서히) 그래야 열자마자 포커스를 옮길 수 있습니다. 열기 전환에 `visibility` 지연을 다시 넣지 마세요.

### 직접 선택과 모집 자동 선택은 별도 흐름

- `selectedIndices`는 현재 `members` 배열의 인덱스 집합입니다. 멤버를 새로 읽으면 인덱스가 바뀌므로, 새로고침 사이에 유지할 값(선택·직접 팀짜기 배정)은 Discord ID로 기억합니다.
- 직접 선택 모드는 기본 최대 10명. 인게임·발쫀잼 티어 밸런스·랜덤·직접 팀짜기 네 가지 모두 2명부터 지원합니다.
- 선택이 바뀌면(`handleSelectionChange`) 직접 선택 결과와 모집 결과를 모두 숨깁니다. 직접 선택 결과는 저장 보드에서 다시 불러올 수 있습니다.
- 직접 팀짜기 배정(`manualAssign`)은 Discord ID 키입니다. 선택에서 빠진 사람의 배정은 지워지고, **미배정이 한 명이라도 있으면 확정할 수 없으며** 버튼에 "미배정 N명"을 표시합니다(말없이 빠지는 일 방지).
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
- 자동 선택 중에 모집을 🔄 새로고침하면(`syncActiveRecruitmentAfterReload`) 대기 배지·대기 명단은 새 명단으로 바꾸지만 **사람이 고친 선택과 팀 수는 그대로** 둡니다. 명단이 바뀌었으면 "참가자 명단이 바뀌었어요 (10명 → 15명)"과 다시 자동 선택하는 방법을 안내합니다.

### 밸런싱의 의미

- 인게임 점수는 `TIER_SCORE`: 아이언~다이아 구간은 등급당 1점, 초월자·불멸은 2점 간격, 레디언트 33점, 언랭 0점입니다. 내부 티어 점수와 별개입니다.
- 2팀 후보는 무작위 분할 1,200회와 점수차 허용 구간을 사용합니다. 내부 점수 정수화 이후 `scoreScale = 2`로 후보 허용 구간을 보정한 상태입니다.
- 다중팀은 스네이크 배치 + 무작위 2,000회 후보를 만듭니다. `multiTeamMetric`의 최대·최소 팀 점수차 → 평균에서의 편차 → 팀 내 점수순 슬롯의 차이 순으로 비교합니다.
- 모두 **휴리스틱**이며 전역 최적해나 실제 승률의 동일함을 보장하지 않습니다. 선호 역할군을 표시하지만 이를 강제하는 역할군 배치 알고리즘은 아닙니다.
- 내부 티어 미분류가 선택되면 밸런싱을 중단하고 `setTeamBuilderNotice`로 **대상 이름과 해결 방법을 지속 표시**합니다. 임의 0점 선수로 편성하거나 잠깐 뜨는 알림만으로 처리하지 마세요.
- `updateSelectedCount`는 기본적으로 안내를 지우므로, 선택이 바뀌지 않는 갱신(한도 초과 경고가 끝난 뒤 배지 복원, 모집 새로고침)에는 `{ keepNotice: true }`를 넘깁니다.

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
- DB 문자열을 `innerHTML`에 넣는 곳은 모두 `escapeHtml`을 거칩니다: 멤버 카드(학번·이름·Riot ID·포지션), 인게임 티어 배지(`tierBadgeHtml`·`tierTextBadgeHtml`), 팀 결과·밸런스 모달 행(`teamRowsHtml`, 줄의 `data-member-id` 포함)과 이름·학번 칸(`memberInfoHtml`), 직접 팀짜기 칩·목록(배정 버튼 묶음의 `aria-label` 포함), 저장 보드, 정보 없는 대기 참가자 ID. 모집 이름·안내문·상태 문구는 `textContent`로 넣습니다. 새 HTML 템플릿에 DB 값을 넣을 때도 같은 방식을 지키고, 회귀 테스트의 HTML 문자열 검사를 유지하세요.

## 6. 실행·검증

이 저장소 폴더에서 실행합니다. Python/Node 실행 파일이 실제 설치된 경로인지 먼저 확인하세요.

```sh
# 한 번에 점검 (문법·회귀 테스트·봇 계약·비밀정보·배포 안내). 푸시 직전에는 --base origin/main
node .agents/skills/toolkit-check/scripts/toolkit_check.cjs
# UI 변경 시 가짜 데이터 화면 캡처까지
node .agents/skills/toolkit-check/scripts/toolkit_check.cjs --screens

# 개별 실행
node --check script.js
node --check tests/team-builder.browser.cjs
node tests/team-builder.browser.cjs
node tests/ui-screenshots.browser.cjs [저장 폴더]
git diff --check

# 실제 Firestore를 읽는 로컬 서버 (실제 멤버 정보가 보임)
python -m http.server 8000 --bind 127.0.0.1
```

- 서버를 실행하면 실제 화면은 `config.js`에 설정된 Firestore를 읽습니다. 브라우저 회귀 테스트는 이와 달리 **모든 외부 요청을 가로채 가짜 데이터만 사용**합니다.
- `.claude/launch.json`의 미리보기 서버는 `python -m http.server`의 3000·8080번 포트입니다. 이 경우에도 실제 Firestore를 읽습니다.
- 테스트에는 Node.js + `playwright` 패키지 + Chromium이 필요합니다. 없는 패키지를 해결한다고 이 정적 앱에 임의의 npm 빌드 구조를 만들지 마세요. 별도 테스트 환경의 모듈 경로(`NODE_PATH`)를 사용할 수 있습니다. 현재 작업 PC에는 `%LOCALAPPDATA%\valjjonjam-test-env`에 Playwright `1.64.1`이 설치되어 있습니다(`$env:NODE_PATH="$env:LOCALAPPDATA\valjjonjam-test-env\node_modules"`).
- Windows 설치 Chrome 사용 예: `$env:BROWSER_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'` 설정 후 테스트 실행. 다른 OS에서는 실제 설치 경로를 지정합니다.
- `TEST_SCREENSHOT_PATH`를 지정하면 테스트 화면 스크린샷을 저장할 수 있습니다. 운영 멤버가 아닌 가짜 데이터 화면입니다.
- 테스트 범위: 직접 선택 10명, 모집 10/15/20명, 후보 3개, 재편성·적용·복사·저장, 모집 밖 멤버 교체, 모집 종료, 미분류 지속 안내(한도 초과 경고 뒤 포함), 직접 팀짜기 미배정 확정 차단, 멤버·모집 새로고침 뒤 선택·교체·배정 유지와 명단 변경 안내, 직접 선택 복사 문구, 선택 변경 시 결과 숨김, 발쫀잼 티어 밸런스 9명 사용, 멤버 카드 키보드 선택, 모달 포커스 이동·Esc 복귀·배경 스크롤 잠금, 공개 주소에서 디버그 버튼 숨김, 맵 목록 13개·전부 제외 안내, 팀 편집(직접 2팀·모집 4팀 맞바꾸기, 점수·문구 갱신, 되돌리기, 키보드, "(수정됨)" 저장, 다시 짜면 편집 종료), 다시 짜기 연출과 움직임 줄이기 설정, 모바일 390px 화면(하단 편성 바가 첫 화면에 보이는지, 맵 뽑기 버튼이 첫 화면에 보이는지 포함), 이름·학번·Riot ID·포지션에 넣은 HTML이 실행되지 않는지(직접 팀짜기 목록·저장 보드 포함), JS 오류.
- 맵 기능 수정 시 이 테스트만으로 충분하다고 간주하지 말고 맵 추첨·제외·초기화를 추가 확인합니다. 웹만 바꿨다면 GCP 봇 재시작은 필요하지 않습니다.

작업 인계에는 **변경 파일 / 이유 / 실행한 테스트와 미검증 항목 / 커밋·푸시 여부 / 실제 배포 여부**를 구분해 남기세요.
