// Run with Node.js and Playwright installed. No requests reach the real Firebase.
// BROWSER_EXECUTABLE optionally selects an installed Chrome/Chromium executable.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");

async function run() {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const tiers = ["1", "2상", "2?", "3중", "3?", "4상", "4중", "4?", "5중", "5?"];
    const users = Array.from({ length: 25 }, (_, i) => ({
      id: String(i + 1), name: `테스트${i + 1}`, internal_tier: tiers[i % 10],
      tier: "골드1", role: ["플렉스"]
    }));
    // DB 문자열에 HTML이 들어와도 실행되지 않고 글자로만 보이는지 확인 (직접 선택 10명·모든 모집에 포함되는 멤버)
    const payload = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
    Object.assign(users[1], { name: `테스트2${payload}`, student_id: payload, riot_id: payload, role: ["플렉스", payload] });
    const assertNoInjectedHtml = async where => {
      assert.equal(await page.evaluate(() => window.__xss), undefined, `HTML executed: ${where}`);
      assert.equal(await page.locator("img[src='x']").count(), 0, `HTML element injected: ${where}`);
    };
    await page.addInitScript(({ users }) => {
      const recruitments = [10, 15, 20].map(n => ({
        id: `group${n}`, kind: n === 10 ? "party" : "event", name: `${n}명 테스트`,
        max_members: n === 10 ? 10 : null,
        member_ids: users.slice(0, n).map(user => user.id),
        waitlist_ids: n === 10 ? ["11", "12"] : [],
        scheduled_at: { seconds: Date.now() / 1000 + 3600 }
      }));
      // 모집 새로고침 테스트에서 명단을 바꿀 수 있도록 노출
      window.__mockRecruitments = recruitments;
      window.firebase = { apps: [{}], firestore: () => ({
        collection: name => ({ get: async () => {
          const docs = (name === "users" ? users : window.__mockRecruitments)
            .map(data => ({ id: data.id, data: () => data }));
          return { docs, forEach: callback => docs.forEach(callback) };
        } })
      }) };
    }, { users });
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.hostname !== "toolkit.test") return route.fulfill({ status: 200, body: "" });
      const file = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
      if (file === "config.js") return route.fulfill({
        contentType: "text/javascript", body: 'const firebaseConfig={apiKey:"test",appId:"test"};'
      });
      if (["index.html", "style.css", "script.js"].includes(file)) return route.fulfill({
        contentType: file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html",
        body: fs.readFileSync(path.join(root, file))
      });
      if (/^valorant_tier_png\/[a-z0-9_-]+\.png$/.test(file) && fs.existsSync(path.join(root, file))) {
        return route.fulfill({ contentType: "image/png", body: fs.readFileSync(path.join(root, file)) });
      }
      return route.fulfill({ status: 200, body: "" });
    });
    await page.goto("http://toolkit.test/");
    await page.click('[data-tab="team"]');
    await page.waitForSelector(".member-card");

    for (let i = 0; i < 10; i++) await page.locator(".member-card").nth(i).click();
    await page.click("#internalBalanceTeamBtn");
    await page.waitForSelector("#balanceModal.open");
    assert.equal(await page.locator("#balanceModalList .modal-option").count(), 3);
    await page.locator("#balanceModalList .opt-save").first().click();
    assert.equal(await page.locator("#savedBoard .saved-item").count(), 1);
    await page.click("#rerollBalanceBtn");
    assert.equal(await page.locator("#balanceModalList .modal-option").count(), 3);
    await page.click("#balanceModalClose");
    await page.click("#savedBoard .saved-load");
    assert.equal(await page.locator("#teamAList .team-member-row").count(), 5);
    assert.ok((await page.locator("#teamResult").textContent()).includes("테스트2<img"));
    assert.ok((await page.locator("#savedBoard").textContent()).includes("테스트2<img"));
    await page.click("#manualTeamBtn");
    await page.locator(".manual-row", { hasText: "테스트2<img" }).locator('[data-team="A"]').click();
    assert.ok((await page.locator("#manualAChips").textContent()).includes("테스트2<img"));
    await assertNoInjectedHtml("member card, modal, result, saved board, manual list");
    console.log("PASS: direct 10, 3 options, save, reroll, load, manual list, HTML in DB strings shown as text");

    for (const count of [10, 15, 20]) {
      await page.selectOption("#recruitmentSelect", `group${count}`);
      await page.click("#selectRecruitmentMembersBtn");
      assert.equal(await page.locator(".member-card.selected").count(), count);
      await page.click("#internalBalanceTeamBtn");
      await page.waitForSelector("#balanceModal.open");
      assert.equal(await page.locator("#balanceModalList .modal-option").count(), 3);
      const first = page.locator("#balanceModalList .modal-option").first();
      assert.equal(await first.locator(".team-card").count(), count / 5);
      assert.equal(await first.locator(".team-member-row").count(), count);
      assert.equal(await page.locator("#saveMinDiffBtn").isVisible(), false);
      const previous = await page.evaluate(() => recruitmentBalanceContext.candidates.map(candidate => candidate.key));
      assert.equal(new Set(previous).size, 3);
      await page.click("#rerollBalanceBtn");
      const current = await page.evaluate(() => recruitmentBalanceContext.candidates.map(candidate => candidate.key));
      assert.equal(new Set(current).size, 3);
      assert.ok(current.every(key => !previous.includes(key)));
      await page.locator("#balanceModalList .opt-apply").nth(1).click();
      assert.equal(await page.locator("#balanceModal").evaluate(el => el.classList.contains("open")), false);
      assert.equal(await page.locator("#recruitmentTeamGrid .team-card").count(), count / 5);
      const result = await page.evaluate(() => ({
        ids: lastRecruitmentResult.teams.flat().map(member => member.discordId),
        key: lastRecruitmentResult.candidateKey, text: buildRecruitmentResultText()
      }));
      assert.equal(result.ids.length, count);
      assert.equal(new Set(result.ids).size, count);
      assert.equal(result.key, current[1]);
      assert.ok(result.text.includes("발쫀잼 티어"));
      if (count === 10) assert.ok(result.text.includes("대기 (2명"));
      await page.click("#rerollRecruitmentTeamsBtn");
      await page.waitForSelector("#balanceModal.open");
      assert.equal(await page.locator("#balanceModalList .modal-option").count(), 3);
      await page.click("#balanceModalClose");
      await page.click("#randomTeamBtn");
      assert.equal(await page.locator("#recruitmentTeamGrid .team-card").count(), count / 5);
      await page.click("#balanceTeamBtn");
      await page.waitForSelector("#balanceModal.open");
      assert.equal(await page.locator("#balanceModalList .modal-option").count(), 3);
      await page.click("#balanceModalClose");
      await page.click("#exitRecruitmentModeBtn");
      console.log(`PASS: auto ${count}, 3 distinct options, apply, reroll, copy, reserves, game/random paths`);
    }

    await page.selectOption("#recruitmentSelect", "group10");
    await page.click("#selectRecruitmentMembersBtn");
    await page.locator('.member-card[data-index="0"]').click();
    await page.locator('.member-card[data-index="24"]').click();
    await page.click("#internalBalanceTeamBtn");
    await page.waitForSelector("#balanceModal.open");
    assert.ok(await page.evaluate(() => recruitmentBalanceContext.candidates.every(candidate => {
      const ids = candidate.teams.flat().map(member => member.discordId);
      return ids.includes("25") && !ids.includes("1");
    })));
    await page.click("#balanceModalClose");
    await page.click("#exitRecruitmentModeBtn");
    for (let i = 0; i < 10; i++) await page.locator(".member-card").nth(i).click();
    await page.click("#internalBalanceTeamBtn");
    await page.waitForSelector("#balanceModal.open");
    assert.equal(await page.locator("#saveMinDiffBtn").isVisible(), true);
    await page.click("#balanceModalClose");
    await page.evaluate(() => { members[0].internalTier = null; renderMemberGrid(); });
    await page.click("#internalBalanceTeamBtn");
    assert.equal(await page.locator("#teamBuilderNotice").isVisible(), true);
    assert.ok((await page.locator("#teamBuilderNotice").textContent()).includes("테스트1"));
    await page.waitForTimeout(2500);
    assert.equal(await page.locator("#teamBuilderNotice").isVisible(), true);
    await page.click("#balanceTeamBtn");
    await page.waitForSelector("#balanceModal.open");
    assert.equal(await page.locator("#teamBuilderNotice").isVisible(), false);
    await page.click("#balanceModalClose");
    await page.locator('.member-card[data-index="0"]').click();
    await page.locator('.member-card[data-index="10"]').click();
    await page.click("#internalBalanceTeamBtn");
    await page.waitForSelector("#balanceModal.open");
    assert.equal(await page.locator("#balanceModalList .modal-option").count(), 3);
    await page.click("#balanceModalClose");
    console.log("PASS: player replacement, direct mode restoration, persistent warning and recovery");

    // 미분류 안내는 한도 초과 경고(1.2초)가 끝난 뒤에도 남아 있어야 함 (members[0]은 위에서 미분류로 바꿈)
    await page.click("#deselectAllBtn");
    for (let i = 0; i < 10; i++) await page.locator(`.member-card[data-index="${i}"]`).click();
    await page.click("#internalBalanceTeamBtn");
    assert.equal(await page.locator("#teamBuilderNotice").isVisible(), true);
    await page.locator('.member-card[data-index="20"]').click();
    await page.waitForTimeout(1500);
    assert.equal(await page.locator("#teamBuilderNotice").isVisible(), true, "notice survives the limit warning");

    // 직접 팀짜기: 미배정이 남으면 확정 불가, 멤버 새로고침 뒤에도 선택·배정 유지
    await page.click("#manualTeamBtn");
    const manualRows = page.locator(".manual-row");
    for (let i = 0; i < 5; i++) await manualRows.nth(i).locator(`[data-team="${i < 3 ? "A" : "B"}"]`).click();
    assert.equal(await page.locator("#confirmManualBtn").isDisabled(), true);
    assert.ok((await page.locator("#confirmManualBtn").textContent()).includes("미배정 5명"));
    for (let i = 5; i < 10; i++) await manualRows.nth(i).locator(`[data-team="${i < 7 ? "A" : "B"}"]`).click();
    assert.equal(await page.locator("#confirmManualBtn").isEnabled(), true);
    const selectedIds = () => page.evaluate(() => [...selectedIndices].map(i => members[i].discordId).sort());
    const directBefore = await selectedIds();
    await page.click("#reloadMembersBtn");
    await page.waitForFunction(() => !document.querySelector("#reloadMembersBtn").disabled);
    assert.deepEqual(await selectedIds(), directBefore, "direct selection kept after member reload");
    assert.equal(await page.locator("#confirmManualBtn").isEnabled(), true, "manual assignment kept after reload");
    await page.click("#confirmManualBtn");
    assert.equal(await page.locator("#teamResult .team-member-row").count(), 10);
    const directCopy = await page.evaluate(() => buildTeamResultText());
    assert.ok(directCopy.startsWith("[직접 편성 · 인게임 티어 기준 · 점수차 "), directCopy);
    assert.ok(directCopy.includes("팀 A (5명 · ") && directCopy.includes("팀 B (5명 · "));
    await page.click("#saveResultBtn");
    assert.ok((await page.locator("#savedBoard").textContent()).includes("직접 편성"));

    // 선택이 바뀌면 직접 선택 결과도 숨김, 발쫀잼 티어 밸런스는 2명부터 사용 가능
    await page.locator('.member-card[data-index="9"]').click();
    assert.equal(await page.locator("#teamResult").isVisible(), false);
    assert.equal(await page.locator("#internalBalanceTeamBtn").isEnabled(), true, "internal balance with 9 people");

    // 키보드: 멤버 카드는 Tab으로 가서 Space로 선택, 모달은 포커스를 안으로 옮기고 Esc 뒤 연 버튼으로 되돌림
    const card9 = page.locator('.member-card[data-index="9"]');
    await card9.focus();
    await page.keyboard.press("Space");
    assert.equal(await page.locator('.member-card[data-index="9"]').getAttribute("aria-checked"), "true");
    await page.locator("#internalBalanceTeamBtn").focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector("#balanceModal.open");
    await page.waitForFunction(() => document.querySelector("#balanceModal").contains(document.activeElement));
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("modal-open")), true);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.id), "internalBalanceTeamBtn");
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("modal-open")), false);
    assert.equal(await page.locator("#debugPick10Btn").isVisible(), false, "debug button hidden on public hosts");

    // 모집 모드: 교체한 선택은 멤버·모집 새로고침 뒤에도 유지, 명단이 바뀌면 안내
    await page.selectOption("#recruitmentSelect", "group10");
    await page.click("#selectRecruitmentMembersBtn");
    await page.locator('.member-card[data-index="0"]').click();
    await page.locator('.member-card[data-index="24"]').click();
    const swapped = await selectedIds();
    assert.ok(swapped.includes("25") && !swapped.includes("1"));
    await page.click("#reloadMembersBtn");
    await page.waitForFunction(() => !document.querySelector("#reloadMembersBtn").disabled);
    assert.deepEqual(await selectedIds(), swapped, "recruitment swap kept after member reload");
    await page.evaluate(() => window.__mockRecruitments[0].member_ids.push("13", "14", "15"));
    await page.click("#reloadRecruitmentsBtn");
    await page.waitForFunction(() => !document.querySelector("#reloadRecruitmentsBtn").disabled);
    assert.ok((await page.locator("#recruitmentStatus").textContent()).includes("참가자 명단이 바뀌었어요"));
    assert.deepEqual(await selectedIds(), swapped, "selection kept after recruitment reload");
    assert.equal(await page.evaluate(() => activeRecruitmentParticipantIds.has("15")), true);
    await page.evaluate(() => window.__mockRecruitments[0].member_ids.splice(10));
    await page.click("#exitRecruitmentModeBtn");

    // 맵: 포함 맵 목록은 실제 맵 배열(13개)과 같고, 전부 제외하면 이유와 해결 방법을 안내
    await page.click('[data-tab="map"]');
    assert.ok((await page.locator("#mapListNames").textContent()).includes("Summit"));
    assert.equal(await page.locator("#remainingText").textContent(), "남은 맵: 13개");
    await page.click("#excludeMapsBtn");
    await page.waitForFunction(() => document.querySelector("#excludeModal").contains(document.activeElement));
    for (const button of await page.locator(".exclude-map").all()) await button.click();
    await page.click("#excludeDoneBtn");
    assert.ok((await page.locator("#mapListExcluded").textContent()).includes("Summit"));
    await page.click("#spinBtn");
    assert.equal(await page.locator("#resultText").textContent(), "뽑을 맵 없음");
    assert.ok((await page.locator("#drawStage").textContent()).includes("맵 제외 설정"));
    await page.click("#excludeMapsBtn");
    await page.click("#excludeResetBtn");
    await page.click("#excludeDoneBtn");
    assert.equal(await page.locator("#mapListExcluded").isVisible(), false);
    await page.click('[data-tab="team"]');
    await assertNoInjectedHtml("manual rows, saved board, copy text");
    console.log("PASS: notice after limit, manual unassigned guard, reload keeps selection, recruitment reload notice, map list, keyboard and modal focus");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.selectOption("#recruitmentSelect", "group20");
    await page.click("#selectRecruitmentMembersBtn");
    await page.locator('.member-card[data-index="0"]').click();
    await page.locator('.member-card[data-index="24"]').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    const dock = await page.evaluate(() => {
      const rect = document.querySelector("#internalBalanceTeamBtn").getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, count: document.querySelector("#dockSelectedCount").textContent };
    });
    assert.ok(dock.top >= 0 && dock.bottom <= 844, "mobile action dock stays on screen at the top of the page");
    assert.equal(dock.count, "20 / 20명 선택됨");
    await page.click("#internalBalanceTeamBtn");
    await page.waitForSelector("#balanceModal.open");
    assert.equal(await page.locator("#balanceModalList .modal-option").count(), 3);
    assert.ok(await page.locator("#balanceModal .modal-box").evaluate(el => {
      const rect = el.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth + 1;
    }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#balanceModal .modal-box")).opacity === "1");
    if (process.env.TEST_SCREENSHOT_PATH) {
      await page.screenshot({ path: process.env.TEST_SCREENSHOT_PATH, animations: "disabled" });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({
        path: process.env.TEST_SCREENSHOT_PATH.replace(/\.png$/, "-desktop.png"), animations: "disabled"
      });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.click("#balanceModalClose");
    await page.click('[data-tab="map"]');
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.ok(await page.locator("#spinBtn").evaluate(el => el.getBoundingClientRect().bottom <= innerHeight),
      "map draw button is visible on the first mobile screen");
    await assertNoInjectedHtml("recruitment modals and results");
    assert.deepEqual(errors, []);
    console.log("PASS: mobile 4-team candidates, sticky action dock, map button on first screen, no JS errors");
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
