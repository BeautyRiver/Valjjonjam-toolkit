---
name: toolkit-check
description: 발쫀잼 웹 툴킷 수정 후·푸시 전 점검. 운영 Firebase에 접속하지 않고 문법 검사, 가짜 데이터 브라우저 회귀 테스트(직접 선택·모집 자동 선택), 봇과 공유하는 Firestore 컬렉션·필드·내부 티어 점수 변경, 비밀정보 유입을 확인하고 필요하면 가짜 데이터 화면을 캡처한다. index.html·style.css·script.js·tests를 수정한 뒤, main에 푸시하기 전(main 푸시 = GitHub Pages 공개 배포), 또는 사용자가 /toolkit-check·점검·검증을 요청할 때 사용. 커밋·푸시·배포는 하지 않는다.
---

# toolkit-check — 발쫀잼 웹 툴킷 점검

기준 문서는 저장소 루트의 `AI_CONTEXT.md`입니다. 이 파일은 점검 절차만 다룹니다.

## 하지 않는 것

- 미리보기 서버(`python -m http.server`, `.claude/launch.json`)로 화면 확인 — 실제 Firestore의 멤버 정보가 표시됩니다. 화면은 아래 가짜 데이터 캡처로 확인합니다.
- 커밋·푸시, GitHub Pages·Firebase Hosting 배포, `firestore.rules` 게시, 운영 DB 수정
- 봇 저장소(`../Valjjonjam_bot_Discord`) 수정 — 변경이 필요하면 전달 메모만 작성
- 사용자 승인 없는 패키지 설치, 저장소 안에 `package.json`·`node_modules` 만들기
- 봇의 `.env`, `serviceAccountKey.json`, `valjjonjam-server-token.txt`, SSH 키 열기

## 1. 점검 스크립트 실행

저장소 루트에서 실행합니다.

```sh
node .agents/skills/toolkit-check/scripts/toolkit_check.cjs
```

- 기본 비교 기준은 `HEAD`입니다(커밋하지 않은 변경). **푸시 직전에는 `--base origin/main`**으로 푸시될 커밋 전체를 봅니다.
- UI를 바꿨다면 `--screens [폴더]`를 붙여 가짜 데이터 화면(PC·모바일 390px의 맵, 맵 결과, 팀짜기, 2팀·4팀 후보, 2팀 결과·저장 보드, 모집 결과)을 캡처하고, **모바일 캡처를 직접 열어** 확인합니다. 폴더 기본값은 OS 임시 폴더의 `valjjonjam-toolkit-screens`입니다.
- 스크립트가 하는 일:
  - ① `node --check`(script.js·config.js·tests·이 스크립트), `git diff --check`
  - ② `tests/*.browser.cjs` 회귀 테스트(직접 선택 10명, 모집 10/15/20명, 후보 3개, 교체, 미분류 안내, HTML 문자열 미실행, 모바일 하단 바·맵 버튼). Playwright는 `NODE_PATH`, `VALJJONJAM_TEST_NODE_PATH`, `%LOCALAPPDATA%\valjjonjam-test-env\node_modules` 순으로 찾고, Chrome은 `BROWSER_EXECUTABLE` 또는 기본 설치 경로에서 찾습니다.
  - ③ 읽는 컬렉션이 `users`·`toolkit_recruitments`뿐인지, 웹이 읽는 DB 필드(`d.*`, `data.*`)의 변경 전후, 웹 `INTERNAL_TIER_INFO`와 봇 `INTERNAL_TIER_SCORES` 점수 일치, `firestore.rules`·`config.js` 변경
  - ④ 변경 파일의 비밀 파일 이름·개인키·서비스 계정·Admin SDK·Discord 토큰 형태
  - ⑤ 브랜치·origin/main 대비 상태와 "main 푸시 = 공개 배포" 안내
- 종료 코드 1은 FAIL이 있다는 뜻입니다. WARN은 실패가 아니라 사람이 확인할 항목, SKIP은 **검증하지 못한 항목**입니다.
- ②가 SKIP이면(Playwright 없음) 사용자 승인을 받아 저장소 밖 폴더에 설치합니다. 예: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --prefix <저장소 밖 폴더> playwright@<고정 버전>` 후 `NODE_PATH` 지정.

## 2. 스크립트가 못 보는 항목 — diff를 읽고 확인

변경이 해당 영역에 닿았을 때만 확인합니다.

- 맵 기능을 바꿨다면 맵 추첨·제외 모달·제외 모드·초기화를 직접 확인 (`--screens`는 추첨·결과 팝업까지만 찍음)
- 새 `innerHTML` 템플릿에 DB 값(이름·학번·Riot ID·티어·포지션·ID)을 넣었다면 `escapeHtml`을 거치는지
- 자동 선택은 체크만 하고, 모집 밖 멤버로 교체할 수 있고, 모집 참가자만 보이게 필터를 고정하지 않는지
- 내부 티어 미분류 시 밸런싱을 멈추고 `setTeamBuilderNotice`로 이름·해결 방법을 계속 보여주는지
- 멤버 정보·이름별 티어를 하드코딩하지 않았는지
- 모바일 하단 편성 바(`.team-action-dock`)와 `html, body`의 `overflow-x: clip`이 유지되는지
- 기능 동작이 바뀌었다면 `AI_CONTEXT.md`를 갱신했는지

## 3. 보고

한국어로 아래를 구분해 보고합니다.

1. ①~⑤ 결과 (OK / WARN / FAIL / SKIP 그대로), `--screens`를 썼다면 확인한 화면
2. 2장 확인 항목 중 확인한 것과 확인하지 못한 것
3. ③에 WARN이 있으면 봇 담당자 전달 메모:
   - 바뀐 필드·값의 변경 전 → 후
   - 기존 Firestore 데이터 처리 방법 (그대로 둠 / 백필 필요 / 옛 값 호환)
   - 봇에서 확인할 위치 (예: `bot.py`의 `INTERNAL_TIER_SCORES`·`INTERNAL_TIER_LABELS`, `build_toolkit_recruitment_data`)
4. 커밋·푸시 여부와 배포 여부 — 이 점검은 둘 다 하지 않았다고 명시하고, `main`에 푸시하면 공개 웹에 바로 반영된다고 알림
