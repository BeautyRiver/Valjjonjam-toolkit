#!/usr/bin/env node
// 발쫀잼 웹 툴킷 점검 (실제 Firebase·호스팅 접속 없음, 커밋·푸시·배포 없음)
//   ① 문법·공백  ② 가짜 데이터 브라우저 회귀 테스트  ③ 봇과의 데이터 계약
//   ④ 비밀정보 유입  ⑤ 배포 안내  (+ --screens: 가짜 데이터 화면 캡처)
// 실행: node .agents/skills/toolkit-check/scripts/toolkit_check.cjs [--base HEAD|origin/main] [--screens [폴더]]
"use strict";
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const SELF = path.relative(ROOT, __filename).split(path.sep).join("/");
const DEFAULT_BOT = path.join(ROOT, "..", "Valjjonjam_bot_Discord", "bot.py");
const ALLOWED_COLLECTIONS = ["toolkit_recruitments", "users"];
const PAGES_URL = "https://beautyriver.github.io/Valjjonjam-toolkit/";
const SCREENSHOT_TEST = "tests/ui-screenshots.browser.cjs";

const results = [];
function record(step, state, summary) {
  results.push({ step, state, summary });
  console.log(`[${state}] ${step}: ${summary}`);
}
function heading(title) { console.log(`\n=== ${title} ===`); }
function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...options });
}
function git(...args) { return run("git", args); }
function readAt(base, file) {
  const res = git("show", `${base}:${file}`);
  return res.status === 0 ? res.stdout : null;
}
function readNow(file) {
  const full = path.join(ROOT, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
}
function setDiff(before, after) {
  const added = [...after].filter(x => !before.has(x)).sort();
  const removed = [...before].filter(x => !after.has(x)).sort();
  return { added, removed, changed: added.length + removed.length > 0 };
}
function describeDiff({ added, removed }) {
  return [added.length ? `추가 ${added.join(", ")}` : "", removed.length ? `제거 ${removed.join(", ")}` : ""]
    .filter(Boolean).join(" / ");
}

function parseArgs(argv) {
  const opts = { base: "HEAD", bot: DEFAULT_BOT, screens: null, skipBrowser: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--base") opts.base = argv[++i];
    else if (arg === "--bot") opts.bot = path.resolve(argv[++i]);
    else if (arg === "--skip-browser") opts.skipBrowser = true;
    else if (arg === "--screens") {
      const next = argv[i + 1];
      opts.screens = next && !next.startsWith("--") ? path.resolve(argv[++i]) : path.join(os.tmpdir(), "valjjonjam-toolkit-screens");
    } else if (arg === "-h" || arg === "--help") {
      console.log("사용법: node .agents/skills/toolkit-check/scripts/toolkit_check.cjs [--base HEAD|origin/main] [--screens [폴더]] [--bot <bot.py>] [--skip-browser]");
      process.exit(0);
    } else {
      console.error(`알 수 없는 옵션: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

// 변경 파일 (기준 대비 + 추적되지 않은 새 파일)
function changedFiles(base) {
  const tracked = git("diff", "--name-only", base).stdout.split("\n").filter(Boolean);
  const untracked = git("ls-files", "--others", "--exclude-standard").stdout.split("\n").filter(Boolean);
  return [...new Set([...tracked, ...untracked])];
}

// ① 문법·공백
function checkSyntax(base) {
  heading("① 문법·공백");
  const files = ["script.js", "config.js", SELF,
    ...fs.readdirSync(path.join(ROOT, "tests")).filter(f => f.endsWith(".cjs")).map(f => `tests/${f}`)];
  const failed = [];
  for (const file of files) {
    if (!fs.existsSync(path.join(ROOT, file))) continue;
    const res = run(process.execPath, ["--check", file]);
    if (res.status !== 0) failed.push(`${file}\n${(res.stderr || "").trim()}`);
  }
  if (failed.length) record("syntax", "FAIL", `node --check 실패\n${failed.join("\n")}`);
  else record("syntax", "OK", `node --check ${files.length}개 파일 통과`);

  const diff = git("diff", "--check", base);
  if (diff.status === 0) record("whitespace", "OK", `git diff --check ${base} 통과`);
  else record("whitespace", "FAIL", `공백 오류\n${(diff.stdout || diff.stderr).trim()}`);
}

// Playwright 모듈·브라우저 위치 찾기 (저장소에 package.json을 만들지 않음)
function playwrightEnv() {
  const candidates = [
    ...(process.env.NODE_PATH || "").split(path.delimiter),
    process.env.VALJJONJAM_TEST_NODE_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "valjjonjam-test-env", "node_modules"),
    path.join(os.homedir(), ".valjjonjam-test-env", "node_modules")
  ].filter(Boolean);
  const modules = candidates.find(dir => fs.existsSync(path.join(dir, "playwright", "package.json")));
  const browsers = [
    process.env.BROWSER_EXECUTABLE,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"
  ].filter(Boolean);
  const browser = browsers.find(file => fs.existsSync(file));
  const env = { ...process.env };
  if (modules) env.NODE_PATH = modules;
  if (browser) env.BROWSER_EXECUTABLE = browser;
  return { env, modules, browser };
}

// ② 가짜 데이터 브라우저 회귀 테스트
function checkBrowserTests(skip) {
  heading("② 가짜 데이터 브라우저 회귀 테스트");
  if (skip) return record("browser", "SKIP", "--skip-browser 지정 — 직접 선택·모집 자동 선택 미검증");
  const { env, modules, browser } = playwrightEnv();
  if (!modules) {
    return record("browser", "SKIP",
      "playwright 모듈을 찾지 못함 — 저장소 밖 폴더에 설치 후 NODE_PATH 지정 필요 (AI_CONTEXT.md 6장). 직접 선택·모집 자동 선택 미검증");
  }
  console.log(`playwright: ${modules}\nbrowser: ${browser || "(Playwright 기본 브라우저)"}`);
  const tests = fs.readdirSync(path.join(ROOT, "tests"))
    .filter(f => f.endsWith(".browser.cjs") && `tests/${f}` !== SCREENSHOT_TEST).map(f => `tests/${f}`);
  for (const test of tests) {
    const res = run(process.execPath, [test], { env, timeout: 10 * 60 * 1000 });
    const out = `${res.stdout || ""}${res.stderr || ""}`.trim();
    const passes = out.split("\n").filter(line => line.startsWith("PASS"));
    passes.forEach(line => console.log(`  ${line}`));
    if (res.status === 0) record("browser", "OK", `${test} 통과 (PASS ${passes.length}개)`);
    else record("browser", "FAIL", `${test} 실패\n${out.split("\n").slice(-25).join("\n")}`);
  }
}

// ③ 봇과의 데이터 계약
function collectionsOf(text) {
  const names = new Set();
  for (const m of text.matchAll(/\.collection\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) names.add(m[1]);
  for (const m of text.matchAll(/const\s+\w*COLLECTION\w*\s*=\s*["'`]([^"'`]+)["'`]/g)) names.add(m[1]);
  return names;
}
function fieldsOf(text, variable) {
  return new Set([...text.matchAll(new RegExp(`\\b${variable}\\.([a-z][a-z0-9_]*)\\b`, "g"))].map(m => m[1]));
}
function webTierScores(text) {
  const block = text && text.match(/const INTERNAL_TIER_INFO = \{([\s\S]*?)\n\};/);
  if (!block) return null;
  return Object.fromEntries([...block[1].matchAll(/"([^"]+)":\s*\{[^}]*?score:\s*(\d+)/g)].map(m => [m[1], Number(m[2])]));
}
function botTierScores(text) {
  const block = text && text.match(/^INTERNAL_TIER_SCORES\s*=\s*\{([\s\S]*?)\}/m);
  if (!block) return null;
  return Object.fromEntries([...block[1].matchAll(/"([^"]+)":\s*(\d+)/g)].map(m => [m[1], Number(m[2])]));
}
function scoreDiff(a, b) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
    .filter(key => a[key] !== b[key]).map(key => `${key}: ${a[key] ?? "없음"} → ${b[key] ?? "없음"}`);
}
function checkContract(base, botPath, files) {
  heading("③ 봇과의 데이터 계약");
  const now = readNow("script.js");
  const before = readAt(base, "script.js") ?? now;

  const cols = collectionsOf(now);
  const extra = [...cols].filter(name => !ALLOWED_COLLECTIONS.includes(name));
  if (extra.length) record("contract", "FAIL", `웹이 허용되지 않은 컬렉션을 읽음: ${extra.join(", ")} (users·toolkit_recruitments만 허용, events 원본 공개 금지)`);
  else record("contract", "OK", `읽는 컬렉션: ${[...cols].sort().join(", ")}`);

  for (const [label, variable] of [["users 필드(d.*)", "d"], ["toolkit_recruitments 필드(data.*)", "data"]]) {
    const diff = setDiff(fieldsOf(before, variable), fieldsOf(now, variable));
    if (diff.changed) record("contract", "WARN", `${label} 변경 ${describeDiff(diff)} — 봇 담당자와 확인 필요`);
    else record("contract", "OK", `${label} 변경 없음 (${[...fieldsOf(now, variable)].sort().join(", ")})`);
  }

  const webNow = webTierScores(now);
  const webBefore = webTierScores(before);
  if (!webNow) record("contract", "FAIL", "script.js에서 INTERNAL_TIER_INFO를 찾지 못함");
  else {
    const changed = webBefore ? scoreDiff(webBefore, webNow) : [];
    if (changed.length) record("contract", "WARN", `웹 내부 티어 점수 변경: ${changed.join(", ")} — 봇 INTERNAL_TIER_SCORES와 함께 바꿔야 함`);
    const botText = fs.existsSync(botPath) ? fs.readFileSync(botPath, "utf8") : null;
    const bot = botTierScores(botText);
    if (!bot) record("contract", "SKIP", `봇 점수 확인 생략 (봇 파일 또는 INTERNAL_TIER_SCORES 없음: ${botPath})`);
    else {
      const mismatch = scoreDiff(bot, webNow);
      if (mismatch.length) record("contract", "FAIL", `웹·봇 내부 티어 점수 불일치 (봇 → 웹): ${mismatch.join(", ")}`);
      else record("contract", "OK", `웹 INTERNAL_TIER_INFO와 봇 INTERNAL_TIER_SCORES 점수 ${Object.keys(webNow).length}개 일치`);
    }
  }

  if (files.includes("firestore.rules")) record("contract", "WARN", "firestore.rules 변경 — 규칙 게시는 별도 승인 필요, users 공개 범위 확인");
  if (files.includes("config.js")) record("contract", "WARN", "config.js 변경 — 브라우저용 firebaseConfig 외 값이 없는지 확인");
}

// ④ 비밀정보 유입
function checkSecrets(files) {
  heading("④ 비밀정보 유입");
  const forbiddenName = /(^|\/)(serviceAccountKey[^/]*\.json|\.env(\..*)?|valjjonjam-server-token\.txt|id_rsa[^/]*|[^/]+\.pem)$/i;
  const patterns = [
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "개인키"],
    [/"private_key"\s*:/, "서비스 계정 private_key"],
    [/"type"\s*:\s*"service_account"/, "서비스 계정 JSON"],
    [/firebase-admin|admin\.initializeApp|firebase_admin/, "Admin SDK"],
    [/\b[MNO][A-Za-z\d_-]{23,27}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,}\b/, "Discord 봇 토큰 형태"]
  ];
  const codeExt = /\.(js|cjs|mjs|html|css|json|rules|txt|env)$/i;
  const problems = [];
  for (const file of files) {
    if (forbiddenName.test(file)) { problems.push(`${file}: 비밀 파일 이름`); continue; }
    if (file === SELF || !codeExt.test(file)) continue;
    const text = readNow(file);
    if (text === null) continue;
    for (const [re, label] of patterns) if (re.test(text)) problems.push(`${file}: ${label}`);
  }
  if (problems.length) record("secrets", "FAIL", problems.join("\n"));
  else record("secrets", "OK", `변경 파일 ${files.length}개에서 비밀정보 패턴 없음`);
}

// ⑤ 배포 안내
function deployNote() {
  heading("⑤ 배포 안내");
  const branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.trim();
  const counts = git("rev-list", "--left-right", "--count", "origin/main...HEAD");
  const [behind, ahead] = counts.status === 0 ? counts.stdout.trim().split(/\s+/).map(Number) : [NaN, NaN];
  const dirty = git("status", "--porcelain", "--untracked-files=all").stdout.split("\n").filter(Boolean).length;
  record("deploy", "INFO",
    `브랜치 ${branch} · origin/main 대비 앞섬 ${ahead} / 뒤처짐 ${behind} (마지막 fetch 기준) · 커밋 안 된 파일 ${dirty}개\n` +
    `main 푸시 = GitHub Pages 공개 배포 (${PAGES_URL}). 이 점검은 커밋·푸시·배포를 하지 않음`);
}

// --screens: 가짜 데이터 화면 캡처
function captureScreens(dir) {
  heading("+ 가짜 데이터 화면 캡처");
  const { env, modules } = playwrightEnv();
  if (!modules) return record("screens", "SKIP", "playwright 모듈을 찾지 못해 캡처 생략");
  const res = run(process.execPath, [SCREENSHOT_TEST, dir], { env, timeout: 5 * 60 * 1000 });
  const out = `${res.stdout || ""}${res.stderr || ""}`.trim();
  if (res.status === 0) record("screens", "OK", `${dir}에 저장 — 모바일(390px) 화면을 직접 열어 확인할 것\n${out}`);
  else record("screens", "FAIL", out.split("\n").slice(-20).join("\n"));
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (git("rev-parse", "--verify", `${opts.base}^{commit}`).status !== 0) {
    console.error(`기준 커밋을 찾을 수 없음: ${opts.base}`);
    process.exit(2);
  }
  console.log(`발쫀잼 툴킷 점검 · 저장소 ${ROOT} · 기준 ${opts.base}`);
  const files = changedFiles(opts.base);
  console.log(`기준 대비 변경 파일 ${files.length}개${files.length ? `: ${files.join(", ")}` : ""}`);

  checkSyntax(opts.base);
  checkBrowserTests(opts.skipBrowser);
  checkContract(opts.base, opts.bot, files);
  checkSecrets(files);
  if (opts.screens) captureScreens(opts.screens);
  deployNote();

  const count = state => results.filter(r => r.state === state).length;
  console.log(`\n=== 요약: OK ${count("OK")} · WARN ${count("WARN")} · FAIL ${count("FAIL")} · SKIP ${count("SKIP")} ===`);
  process.exitCode = count("FAIL") ? 1 : 0;
}

main();
