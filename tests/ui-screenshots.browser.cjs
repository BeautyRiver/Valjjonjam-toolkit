// 가짜 데이터로 PC·모바일 화면을 캡처한다. 운영 Firebase에는 접속하지 않는다.
// 실행: node tests/ui-screenshots.browser.cjs [저장 폴더]
//   저장 폴더 기본값: TEST_SCREENSHOT_DIR 또는 OS 임시 폴더/valjjonjam-toolkit-screens
//   BROWSER_EXECUTABLE로 설치된 Chrome/Chromium을 지정할 수 있다.
// 화면을 실제와 비슷하게 보이도록 한글 폰트(cdn.jsdelivr.net)만 외부 요청을 허용한다.
const { chromium } = require("playwright");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outDir = path.resolve(process.argv[2] || process.env.TEST_SCREENSHOT_DIR
  || path.join(os.tmpdir(), "valjjonjam-toolkit-screens"));
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".ttf": "font/ttf" };

const tiers = ["1", "2상", "2?", "3중", "3?", "4상", "4중", "4?", "5중", "5?"];
const ranks = ["다이아몬드2", "초월자1", "골드3", "플래티넘1", "실버2", "불멸1", "골드1", "브론즈3", "레디언트", "언랭"];
const roles = [["타격대"], ["감시자"], ["척후대"], ["전략가"], ["타격대", "척후대"]];
const users = Array.from({ length: 25 }, (_, i) => ({
  id: String(i + 1), name: `테스트${i + 1}`, internal_tier: tiers[i % 10], tier: ranks[i % 10],
  role: roles[i % 5], student_id: `2026${String(i).padStart(4, "0")}`, riot_id: `tester${i + 1}#KR1`
}));
const recruitments = [{
  id: "event_screens", kind: "event", name: "화면 확인용 모집", status: "open", max_members: null,
  member_ids: users.slice(0, 20).map(u => u.id), waitlist_ids: [], scheduled_at: { seconds: Date.now() / 1000 + 3600 }
}];

async function openPage(browser, viewport, errors) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(({ users, recruitments }) => {
    window.firebase = { apps: [{}], firestore: () => ({ collection: name => ({ get: async () => {
      const docs = (name === "users" ? users : recruitments).map(data => ({ id: data.id, data: () => data }));
      return { docs, forEach: callback => docs.forEach(callback) };
    } }) }) };
  }, { users, recruitments });
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname === "cdn.jsdelivr.net") return route.continue().catch(() => route.fulfill({ status: 404, body: "" }));
    if (url.hostname !== "toolkit.test") return route.fulfill({ status: 404, body: "" });
    const file = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    if (file === "config.js") return route.fulfill({
      contentType: "text/javascript", body: 'const firebaseConfig={apiKey:"test",appId:"test"};'
    });
    const full = path.join(root, file);
    if (!full.startsWith(root + path.sep) || !fs.existsSync(full)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: types[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(full) });
  });
  await page.goto("http://toolkit.test/");
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {})
  });
  const errors = [];
  const saved = [];
  const shot = async (page, name, fullPage = false) => {
    const file = path.join(outDir, name);
    await page.screenshot({ path: file, fullPage, animations: "disabled" });
    saved.push(file);
  };
  const selectFirst = async (page, count) => {
    for (let i = 0; i < count; i++) await page.locator(".member-card").nth(i).click();
  };
  try {
    for (const [prefix, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
      const page = await openPage(browser, viewport, errors);
      await shot(page, `${prefix}-map.png`);
      await page.click("#spinBtn");
      await page.waitForSelector("#mapReveal.open", { timeout: 10000 });
      await page.waitForTimeout(700);
      await shot(page, `${prefix}-map-reveal.png`);
      await page.click("#mapRevealClose");

      await page.click('[data-tab="team"]');
      await page.waitForSelector(".member-card");
      await selectFirst(page, 10);
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, `${prefix}-team-top.png`);
      await page.evaluate(() => window.scrollTo(0, document.querySelector("#memberGrid").offsetTop));
      await shot(page, `${prefix}-team-members.png`);
      await page.click("#balanceTeamBtn");
      await page.waitForSelector("#balanceModal.open");
      await page.waitForTimeout(500);
      await shot(page, `${prefix}-modal-2teams.png`);
      await page.locator("#balanceModalList .opt-save").first().click();
      await page.click("#balanceModalClose");
      await page.click("#savedBoard .saved-load");
      await page.waitForSelector("#teamResult:not(.hidden)");
      await page.locator("#teamResult").evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 12));
      await page.waitForTimeout(900);
      await shot(page, `${prefix}-team-result.png`);
      await page.click("#manualTeamBtn");
      const manualRows = page.locator(".manual-row");
      for (let i = 0; i < 7; i++) await manualRows.nth(i).locator(`[data-team="${i % 2 ? "B" : "A"}"]`).click();
      await page.locator("#manualSection").evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 12));
      await shot(page, `${prefix}-manual.png`);

      await page.selectOption("#recruitmentSelect", "event_screens");
      await page.click("#selectRecruitmentMembersBtn");
      await page.click("#internalBalanceTeamBtn");
      await page.waitForSelector("#balanceModal.open");
      await page.waitForTimeout(500);
      await shot(page, `${prefix}-modal-4teams.png`);
      await page.locator("#balanceModalList .opt-apply").first().click();
      await page.locator("#recruitmentResult").scrollIntoViewIfNeeded();
      await shot(page, `${prefix}-recruitment-result.png`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  saved.forEach(file => console.log(`SAVED: ${file}`));
  if (errors.length) {
    console.error(`FAIL: 브라우저 JS 오류 ${errors.length}건\n${errors.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${saved.length}장 캡처, 브라우저 JS 오류 없음 (가짜 데이터 화면)`);
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
