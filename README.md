# Valjjonjam-toolkit (발쫀잼 툴킷)

발로란트 맵 카드 뽑기 + Firebase 연동 팀짜기 툴킷.
공개 주소: https://beautyriver.github.io/Valjjonjam-toolkit/ (`main`에 푸시하면 GitHub Pages로 바로 반영)

## 기능
- 🃏 **맵 고르기**: 카드를 뒤집어 맵 뽑기 (이미 나온 맵 제외 모드, 맵 수동 제외 지원)
- ⚔️ **팀짜기**: 디스코드 봇이 모은 멤버 정보를 Firebase에서 불러와 인게임·발쫀잼 티어 밸런스, 랜덤, 직접 배정으로 팀 구성
- ⚡ **모집 자동 선택**: Discord 파티·발쫀전의 참가 확정자와 대기자를 순서대로 불러와 팀 수에 맞게 체크하고, 인게임/발쫀잼 티어 기준으로 5명씩 여러 팀 구성

## 데이터 흐름
1. 디스코드 봇(별도 저장소, 형제 폴더 `../Valjjonjam_bot_Discord`)에서 멤버가 `/기본설정`으로 **학번·이름·발로닉·티어·역할군**을 등록
2. 봇이 Firestore `users` 컬렉션에 저장
3. 봇이 파티·발쫀전의 팀 편성용 공개 필드(확정·대기 명단, 희망 티어대 포함)만 `toolkit_recruitments` 컬렉션에 동기화
4. 이 웹앱이 `users`와 `toolkit_recruitments`를 결합해 참가자를 자동 선택하고 팀을 구성

`events` 원본에 저장되는 참가비·예금주·계좌번호는 웹에서 읽지 않으며,
`toolkit_recruitments`에도 복사하지 않습니다.

## 설정 방법
### 1) Firebase 웹 설정값 채우기
`config.js`를 열고 Firebase 콘솔 값으로 교체:
- Firebase 콘솔 > 프로젝트 설정(⚙️) > "내 앱" > 웹 앱(`</>`)
- 웹 앱이 없으면 **앱 추가 > 웹**으로 하나 생성
- `apiKey`, `messagingSenderId`, `appId`를 복사해 붙여넣기 (나머지는 미리 채워둠)

### 2) Firestore 보안 규칙 적용
`firestore.rules` 내용을 Firebase 콘솔 > Firestore Database > 규칙 에 붙여넣고 게시.
- `users`, `toolkit_recruitments`: 공개 읽기 / 클라이언트 쓰기 차단 (쓰기는 봇의 Admin SDK만)
- `parties`, `events`: 웹 접근 차단 유지
- ⚠️ `users` 문서 전체(학번·발로ID 포함)가 공개 읽기로 노출됩니다. 내부용으로만 사용하세요.

## 실행
정적 파일이라 로컬 서버로 열면 됩니다 (실제 Firestore를 읽으므로 실제 멤버 정보가 보입니다):
```bash
python -m http.server 8000 --bind 127.0.0.1   # http://127.0.0.1:8000
```
로컬 주소나 주소 끝에 `?debug`를 붙이면 `🐞 랜덤 10명` 디버그 버튼이 보입니다.

## 점검과 회귀 테스트
Playwright와 Chromium이 설치된 Node.js 환경에서 실행합니다. 실제 Firebase 대신 가짜 멤버·모집 데이터만 씁니다.
```bash
node .agents/skills/toolkit-check/scripts/toolkit_check.cjs            # 문법·회귀 테스트·봇 계약·비밀정보 점검
node .agents/skills/toolkit-check/scripts/toolkit_check.cjs --screens  # + PC·모바일 화면 캡처
node tests/team-builder.browser.cjs                                     # 회귀 테스트만
```
설치된 Chrome을 사용할 때는 `BROWSER_EXECUTABLE` 환경변수에 실행 파일 경로를 지정할 수 있습니다.
자세한 구조·규칙은 `AI_CONTEXT.md`를 참고하세요.
