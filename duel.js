// ===== 공/수 결투 =====
// 결과 화면의 🤠 공/수 정하기: 두 팀에서 한 명씩 무작위로 나와 서부극 총싸움을 하고, 이긴 팀이 공격·수비를 직접 고른다.
// - 승패·두 사람·꾸미기·패배 장면·"탕" 시점은 연출을 시작하기 전에 정하고, 연출은 보여주기만 한다 (건너뛰거나 닫아도 같은 승패).
// - 흐름: 휘오오~ 바람 소리 → 서부극풍 음악(직접 만든 곡, 영화 OST를 베끼지 않음) → 얼굴·눈·손 클로즈업이 점점 빨라짐
//         → 음악 2마디 뒤 무작위 엇박에서 승부(기본 총싸움·불발·총 던지기·연사·피하고 반격) → 가운데 큰 승리 문구 → 이긴 팀이 공/수 선택
// - 3D는 Three.js(버전 고정, jsDelivr)를 버튼을 처음 누를 때만 불러온다. 불러오지 못하거나 WebGL이 없으면 결과만 글자로 보여준다.
// - 이마 이름표는 캔버스에 글자로 그리고, 결과 문구는 textContent로 넣는다 (DB 문자열을 HTML로 해석하지 않음).
// - script.js의 lastTeams·lastRecruitmentResult·renderDirectTeams·renderRecruitmentTeams·openModalLayer·closeModalLayer를 쓴다.

const DUEL_THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js";
const DUEL_LOAD_TIMEOUT_MS = 8000;
const DUEL_TEAM_COLORS = ["#ff4655", "#7c5cff"];
const DUEL_SOUND_KEY = "valjjonjam.duelSound";
const DUEL_FONT = '"Pretendard Variable", "Pretendard", system-ui, sans-serif';

// 음악 박자: 100BPM(한 박 0.6초). 바람 소리 1.4초 뒤 음악 시작, 2마디(8박)가 흐른 뒤부터 6박 안의 엇박에서 승부
const DUEL_BEAT = 0.6;
const DUEL_MUSIC_START = 1.4;
const DUEL_FIRE_FROM_BEAT = 8;
const DUEL_FIRE_BEATS = 6;

// 승부 장면. weight는 뽑힐 비율(기본 총싸움 절반, 나머지 12.5%씩), ms는 승부 시작(엇박) 기준, hitMs에 진 사람이 쓰러지기 시작
const DUEL_EVENTS = {
  normal:  { weight: 8, hitMs: 70, how: "먼저 뽑아 한 방에 승리" },
  misfire: { weight: 2, hitMs: 1570, clicksMs: [0, 450], shotMs: 1500, how: "상대 총이 불발! 한심하게 보다가 승리" },
  throw:   { weight: 2, hitMs: 600, throwMs: 150, how: "총을 집어던져 승리" },
  rapid:   { weight: 2, hitMs: 520, shotsMs: [0, 90, 180, 270, 360, 450], how: "연사를 갈겨 승리" },
  dodge:   { weight: 2, hitMs: 920, shotMs: 850, how: "총알을 숙여 피하고 반격해 승리" }
};
const DUEL_HAT_Y = 2.4;

const duelOverlayEl = document.getElementById("duelOverlay");
const duelStageEl = document.getElementById("duelStage");
const duelCaptionEl = document.getElementById("duelCaption");
const duelLoadingEl = document.getElementById("duelLoading");
const duelFlashEl = document.getElementById("duelFlash");
const duelBangEl = document.getElementById("duelBang");
const duelSkipBtn = document.getElementById("duelSkipBtn");
const duelWinnerEl = document.getElementById("duelWinner");
const duelWinnerTeamEl = document.getElementById("duelWinnerTeam");
const duelWinnerNameEl = document.getElementById("duelWinnerName");
const duelWinnerHowEl = document.getElementById("duelWinnerHow");
const duelResultEl = document.getElementById("duelResult");
const duelFallbackNoteEl = document.getElementById("duelFallbackNote");
const duelChoosePromptEl = document.getElementById("duelChoosePrompt");
const duelChoiceEl = document.getElementById("duelChoice");
const duelPickAttackBtn = document.getElementById("duelPickAttackBtn");
const duelPickDefenseBtn = document.getElementById("duelPickDefenseBtn");
const duelSidesEl = document.getElementById("duelSides");
const duelDefenseTeamEl = document.getElementById("duelDefenseTeam");
const duelAttackTeamEl = document.getElementById("duelAttackTeam");
const duelAgainBtn = document.getElementById("duelAgainBtn");
const duelDoneBtn = document.getElementById("duelDoneBtn");
const duelSoundBtn = document.getElementById("duelSoundBtn");
const duelCloseBtn = document.getElementById("duelCloseBtn");

// target: "direct" | "recruitment", round: 비동기 작업이 끝났을 때 아직 같은 결투인지 확인하는 번호
const duelState = { target: null, info: null, round: 0, picks: null, looks: null, plan: null, winner: 0, revealed: false, scene: null, sound: null, timers: [] };
let duelThreePromise = null;
let duelAudioCtx = null;
let duelSoundOn = readDuelSoundPref();

function readDuelSoundPref() {
  try { return localStorage.getItem(DUEL_SOUND_KEY) !== "off"; } catch { return true; }
}

function duelRandomInt(max) {
  if (window.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return value[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function duelPick(list) {
  return list[duelRandomInt(list.length)];
}

function duelPickEvent() {
  const names = Object.keys(DUEL_EVENTS);
  let roll = duelRandomInt(names.reduce((sum, name) => sum + DUEL_EVENTS[name].weight, 0));
  for (const name of names) {
    roll -= DUEL_EVENTS[name].weight;
    if (roll < 0) return name;
  }
  return "normal";
}

// 승부 시점: 음악 8박이 지난 뒤 6박 안에서, 박이 아닌 엇박(박 사이 1/4·1/2·3/4 지점) 중 무작위 + 승부 장면
function planDuel() {
  const slots = [];
  for (let beat = DUEL_FIRE_FROM_BEAT; beat < DUEL_FIRE_FROM_BEAT + DUEL_FIRE_BEATS; beat++) {
    [0.25, 0.5, 0.75].forEach(offset => slots.push(beat + offset));
  }
  const fireBeat = duelPick(slots);
  return { fireBeat, fireAt: DUEL_MUSIC_START + fireBeat * DUEL_BEAT, event: duelPickEvent() };
}

// 우스꽝스러운 무작위 꾸미기. 실제 사람과 무관한 캐릭터 꾸미기이며, 여성 캐릭터에는 수염·탈모를 붙이지 않음
function rollDuelLook() {
  const female = duelRandomInt(100) < 35;
  return {
    female,
    facialHair: female ? "none" : duelPick(["none", "mustache", "mustache", "beard"]),
    bald: !female && duelRandomInt(100) < 40,
    glasses: duelPick(["none", "none", "round", "sun"]),
    unibrow: !female && duelRandomInt(100) < 25,
    redNose: duelRandomInt(100) < 25,
    hairColor: duelPick([0x2b1b14, 0x7a4a24, 0xd9a441, 0xb5442a]),
    hatColor: duelPick([0x6e4228, 0x2b2228, 0xe8dcc4]),
    tagTilt: (duelRandomInt(9) - 4) * 0.025   // 이마 이름표를 삐뚤게 붙인 정도
  };
}

// 결투할 결과의 두 팀. 직접 선택 2팀 결과, 또는 2팀인 모집 결과
function duelTargetInfo(target) {
  if (target === "direct") {
    return { teams: [lastTeams.teamA, lastTeams.teamB], labels: ["A", "B"], colors: DUEL_TEAM_COLORS };
  }
  if (!lastRecruitmentResult || lastRecruitmentResult.teams.length !== 2) return null;
  return {
    teams: lastRecruitmentResult.teams,
    labels: ["A", "B"],
    colors: [MULTI_TEAM_COLORS[0], MULTI_TEAM_COLORS[1]]
  };
}

function isDuelOpen() {
  return duelOverlayEl.classList.contains("open");
}

function openDuel(target, triggerBtn) {
  const info = duelTargetInfo(target);
  if (!info || info.teams.some(team => !team.length)) return;
  duelState.target = target;
  ensureDuelAudio();   // 버튼을 누른 순간에 소리 장치를 깨워 둬야 나중에 음악·"탕"이 남
  duelOverlayEl.classList.add("open");
  duelOverlayEl.setAttribute("aria-hidden", "false");
  openModalLayer(duelOverlayEl, triggerBtn);
  startDuelRound();
}

function startDuelRound() {
  const info = duelTargetInfo(duelState.target);
  if (!info) return closeDuel();
  const round = ++duelState.round;
  stopDuelScene();
  duelState.info = info;
  duelState.picks = info.teams.map(team => duelPick(team));
  duelState.looks = [rollDuelLook(), rollDuelLook()];
  duelState.plan = planDuel();
  duelState.winner = duelRandomInt(2);
  duelState.revealed = false;

  const winner = duelState.winner;
  duelWinnerTeamEl.textContent = `팀 ${info.labels[winner]} 승`;
  duelWinnerTeamEl.style.color = info.colors[winner];
  duelWinnerNameEl.textContent = `${duelState.picks[winner].name} 승리!`;
  duelWinnerHowEl.textContent = DUEL_EVENTS[duelState.plan.event].how;
  duelChoosePromptEl.textContent = `팀 ${info.labels[winner]}가 공격·수비를 고르세요`;
  duelWinnerEl.hidden = true;
  duelResultEl.hidden = true;
  duelFallbackNoteEl.hidden = true;
  duelChoiceEl.hidden = false;
  duelSidesEl.hidden = true;
  duelDoneBtn.hidden = true;
  duelSkipBtn.hidden = false;
  duelCaptionEl.hidden = false;
  duelStageEl.classList.remove("cinema");
  duelBangEl.classList.remove("show");
  duelFlashEl.classList.remove("show");
  duelLoadingEl.hidden = Boolean(duelState.threeLoaded);

  // 불러오는 중에 건너뛰기를 눌렀다면(이미 결과 표시) 효과 없이 끝난 장면만 보여줌
  const fontReady = document.fonts?.load ? document.fonts.load(`800 48px ${DUEL_FONT}`).catch(() => null) : Promise.resolve();
  Promise.all([loadDuelThree(), fontReady]).then(([THREE]) => {
    if (round !== duelState.round || !isDuelOpen()) return;
    duelState.threeLoaded = true;
    duelLoadingEl.hidden = true;
    try {
      duelState.scene = createDuelScene(THREE, info, duelState.picks, duelState.looks, winner, duelState.plan);
    } catch (error) {
      console.warn("[공/수 결투] 3D 화면을 만들지 못했어요:", error);
      if (duelState.revealed) duelFallbackNoteEl.hidden = false;
      else playDuelFallback(round);
      return;
    }
    if (duelState.revealed) {
      duelState.scene.skip();
      return;
    }
    duelState.sound = startDuelSound(duelState.plan);
    duelState.scene.start(duelState.sound?.leadSec ?? 0);
  }).catch(error => {
    if (round !== duelState.round || !isDuelOpen()) return;
    console.warn("[공/수 결투] 3D 라이브러리를 불러오지 못했어요:", error);
    duelLoadingEl.hidden = true;
    if (duelState.revealed) duelFallbackNoteEl.hidden = false;
    else playDuelFallback(round);
  });
}

function loadDuelThree() {
  if (!duelThreePromise) {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), DUEL_LOAD_TIMEOUT_MS));
    duelThreePromise = Promise.race([import(DUEL_THREE_URL), timeout]).catch(error => {
      duelThreePromise = null;   // 다음 결투 때 다시 시도
      throw error;
    });
  }
  return duelThreePromise;
}

// 3D 없이: "탕!"과 총소리만 보여주고 바로 결과
function playDuelFallback(round) {
  duelFallbackNoteEl.hidden = false;
  duelState.timers.push(setTimeout(() => {
    if (round !== duelState.round) return;
    fireDuelEffects("탕!");
    const ctx = duelSoundOn ? ensureDuelAudio() : null;
    if (ctx) playDuelGunshot(ctx, ctx.destination, ctx.currentTime);
    duelState.timers.push(setTimeout(() => { if (round === duelState.round) revealDuel(); }, 500));
  }, 300));
}

// 화면 가운데 효과 글자("탕!", "딸깍…", "퍽!" 등)와 번쩍임 (소리는 음악 시간표가 같은 순간에 냄)
function fireDuelEffects(text, flash = true) {
  duelBangEl.textContent = text;
  const targets = flash ? [duelBangEl, duelFlashEl] : [duelBangEl];
  targets.forEach(el => {
    el.classList.remove("show");
    void el.offsetWidth;   // 같은 결투 안에서 여러 번, 다시 결투할 때도 CSS 애니메이션을 처음부터 재생
    el.classList.add("show");
  });
}

// 이긴 팀만 결과에 기록하고(공/수는 아직 null), 가운데에 큰 승리 문구와 공/수 선택 버튼을 보여줌
function revealDuel() {
  if (duelState.revealed) return;
  duelState.revealed = true;
  applyDuelSides(null);
  duelSkipBtn.hidden = true;
  duelCaptionEl.hidden = true;
  duelStageEl.classList.remove("cinema");
  duelWinnerEl.hidden = false;
  duelResultEl.hidden = false;
  duelPickDefenseBtn.focus({ preventScroll: true });
}

// defense: 수비로 시작하는 팀 번호, null이면 아직 안 고름
function applyDuelSides(defense) {
  const sides = { winner: duelState.winner, defense };
  if (duelState.target === "direct") {
    lastTeams.sides = sides;
    renderDirectTeams();
  } else if (lastRecruitmentResult) {
    lastRecruitmentResult.sides = sides;
    renderRecruitmentTeams();
  }
}

// 이긴 팀의 선택: "defense"면 이긴 팀이 수비, "attack"이면 이긴 팀이 공격
function chooseDuelSide(choice) {
  if (!duelState.revealed) return;
  const winner = duelState.winner;
  const defense = choice === "defense" ? winner : 1 - winner;
  applyDuelSides(defense);
  duelDefenseTeamEl.textContent = `팀 ${duelState.info.labels[defense]}`;
  duelAttackTeamEl.textContent = `팀 ${duelState.info.labels[1 - defense]}`;
  duelChoiceEl.hidden = true;
  duelChoosePromptEl.textContent = `팀 ${duelState.info.labels[winner]}가 ${choice === "defense" ? "수비" : "공격"}를 골랐어요`;
  duelSidesEl.hidden = false;
  duelDoneBtn.hidden = false;
  duelDoneBtn.focus({ preventScroll: true });
}

// 건너뛰기: 음악을 끄고 끝난 장면과 결과로 바로
function skipDuel() {
  duelState.sound?.stop();
  duelState.sound = null;
  duelState.scene?.skip();
  duelState.timers.forEach(clearTimeout);
  duelState.timers = [];
  duelLoadingEl.hidden = true;
  revealDuel();
}

function closeDuel() {
  if (!isDuelOpen()) return;
  if (!duelState.revealed && duelState.info) revealDuel();   // 끝까지 안 보고 닫아도 이긴 팀은 기록 (공/수는 선택 전)
  duelState.round += 1;
  stopDuelScene();
  duelOverlayEl.classList.remove("open");
  duelOverlayEl.setAttribute("aria-hidden", "true");
  closeModalLayer(duelOverlayEl);
}

function stopDuelScene() {
  duelState.timers.forEach(clearTimeout);
  duelState.timers = [];
  duelState.sound?.stop();
  duelState.sound = null;
  duelState.scene?.dispose();
  duelState.scene = null;
}

// ===== 소리: 파일 없이 브라우저에서 만든 바람·음악·효과음 =====
// 곡은 이 기능을 위해 만든 E단조 서부극풍 곡(휘파람 선율, 튕기는 기타 저음, 시계 소리, 떨리는 현)이다.
const DUEL_NOTES = {
  E2: 82.41, G2: 98.0, A2: 110.0, B2: 123.47, D3: 146.83, E3: 164.81, G3: 196.0, B3: 246.94,
  E4: 329.63, G4: 392.0, A4: 440.0, B4: 493.88, D5: 587.33, E5: 659.25
};

function ensureDuelAudio() {
  if (!duelSoundOn) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    duelAudioCtx = duelAudioCtx || new AudioContextClass();
    if (duelAudioCtx.state === "suspended") duelAudioCtx.resume();
  } catch {
    duelAudioCtx = null;
  }
  return duelAudioCtx;
}

function duelNoiseBuffer(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function duelEnvelope(ctx, when, attack, hold, release, peak) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + attack);
  gain.gain.setValueAtTime(peak, when + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + attack + hold + release);
  return gain;
}

// 휘오오~: 좁은 대역으로 거른 바람 소리가 올라갔다 내려가고, 그 위로 휘파람 같은 미끄러지는 음
function playDuelWind(ctx, out, when) {
  const noise = ctx.createBufferSource();
  noise.buffer = duelNoiseBuffer(ctx, 3);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 9;
  band.frequency.setValueAtTime(420, when);
  band.frequency.exponentialRampToValueAtTime(1150, when + 1.1);
  band.frequency.exponentialRampToValueAtTime(560, when + 2.6);
  const noiseGain = duelEnvelope(ctx, when, 0.6, 1.2, 1.0, 0.5);
  noise.connect(band).connect(noiseGain).connect(out);
  noise.start(when);
  noise.stop(when + 3);

  const howl = ctx.createOscillator();
  howl.type = "sine";
  howl.frequency.setValueAtTime(620, when + 0.2);
  howl.frequency.exponentialRampToValueAtTime(1020, when + 1.0);
  howl.frequency.exponentialRampToValueAtTime(700, when + 2.2);
  const wobble = ctx.createOscillator();
  wobble.frequency.value = 4.5;
  const wobbleGain = ctx.createGain();
  wobbleGain.gain.value = 14;
  wobble.connect(wobbleGain).connect(howl.frequency);
  const howlGain = duelEnvelope(ctx, when + 0.2, 0.5, 0.9, 0.9, 0.07);
  howl.connect(howlGain).connect(out);
  howl.start(when + 0.2);
  wobble.start(when + 0.2);
  howl.stop(when + 2.6);
  wobble.stop(when + 2.6);
}

// 튕기는 기타 저음
function playDuelPluck(ctx, out, when, freq, volume = 0.32, length = 0.5) {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq * 1.01, when);
  osc.frequency.exponentialRampToValueAtTime(freq, when + 0.05);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2800, when);
  filter.frequency.exponentialRampToValueAtTime(320, when + length);
  const gain = duelEnvelope(ctx, when, 0.006, 0, length, volume);
  osc.connect(filter).connect(gain).connect(out);
  osc.start(when);
  osc.stop(when + length + 0.05);
}

// 휘파람 선율: 떨림(비브라토)이 천천히 들어오는 사인파
function playDuelWhistle(ctx, out, when, freq, length, volume = 0.13) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq * 0.94, when);
  osc.frequency.exponentialRampToValueAtTime(freq, when + 0.09);
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 5.6;
  const vibratoGain = ctx.createGain();
  vibratoGain.gain.setValueAtTime(0, when);
  vibratoGain.gain.linearRampToValueAtTime(freq * 0.014, when + Math.min(0.5, length));
  vibrato.connect(vibratoGain).connect(osc.frequency);
  const gain = duelEnvelope(ctx, when, 0.05, Math.max(0, length - 0.15), 0.1, volume);
  osc.connect(gain).connect(out);
  osc.start(when);
  vibrato.start(when);
  osc.stop(when + length + 0.05);
  vibrato.stop(when + length + 0.05);
}

// 시계·나무토막 같은 똑딱 소리
function playDuelTick(ctx, out, when, volume) {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = 1750;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1900;
  const gain = duelEnvelope(ctx, when, 0.002, 0, 0.045, volume);
  osc.connect(filter).connect(gain).connect(out);
  osc.start(when);
  osc.stop(when + 0.06);
}

// 낮게 울리는 북
function playDuelDrum(ctx, out, when, volume) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(95, when);
  osc.frequency.exponentialRampToValueAtTime(42, when + 0.45);
  const gain = duelEnvelope(ctx, when, 0.004, 0, 0.5, volume);
  osc.connect(gain).connect(out);
  osc.start(when);
  osc.stop(when + 0.55);
}

// 승부 직전까지 점점 커지며 떨리는 현 (E·B 화음)
function playDuelTremolo(ctx, out, from, to) {
  const length = Math.max(0.1, to - from);
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0.0001, from);
  bus.gain.exponentialRampToValueAtTime(0.07, to);
  const tremolo = ctx.createOscillator();
  tremolo.frequency.value = 11;
  const tremoloDepth = ctx.createGain();
  tremoloDepth.gain.value = 0.5;
  const shaper = ctx.createGain();
  shaper.gain.value = 0.5;
  tremolo.connect(tremoloDepth).connect(shaper.gain);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  [DUEL_NOTES.E4, DUEL_NOTES.B4].forEach(freq => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    osc.connect(filter);
    osc.start(from);
    osc.stop(from + length + 0.02);
  });
  filter.connect(shaper).connect(bus).connect(out);
  tremolo.start(from);
  tremolo.stop(from + length + 0.02);
}

// 총소리: 짧은 잡음 + 낮은 쿵 (+ 협곡에 울리는 메아리)
function playDuelGunshot(ctx, out, when, withEcho = true, volume = 1) {
  const dry = ctx.createGain();
  dry.gain.value = volume;
  dry.connect(out);
  if (withEcho) {
    const echo = ctx.createDelay(1);
    echo.delayTime.value = 0.27;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.33;
    const echoFilter = ctx.createBiquadFilter();
    echoFilter.type = "lowpass";
    echoFilter.frequency.value = 1400;
    echo.connect(echoFilter).connect(feedback).connect(echo);
    echoFilter.connect(out);
    dry.connect(echo);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = duelNoiseBuffer(ctx, 0.7);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3400, when);
  filter.frequency.exponentialRampToValueAtTime(260, when + 0.55);
  const noiseGain = duelEnvelope(ctx, when, 0.002, 0.02, 0.6, 0.95);
  noise.connect(filter).connect(noiseGain).connect(dry);
  noise.start(when);
  noise.stop(when + 0.7);

  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(140, when);
  thump.frequency.exponentialRampToValueAtTime(38, when + 0.28);
  const thumpGain = duelEnvelope(ctx, when, 0.003, 0, 0.32, 0.85);
  thump.connect(thumpGain).connect(dry);
  thump.start(when);
  thump.stop(when + 0.36);
}

// 불발: 공이치기가 헛도는 "딸깍"
function playDuelClick(ctx, out, when) {
  [[2600, 0], [1500, 0.03]].forEach(([freq, delay]) => {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;
    const gain = duelEnvelope(ctx, when + delay, 0.001, 0, 0.025, 0.12);
    osc.connect(gain).connect(out);
    osc.start(when + delay);
    osc.stop(when + delay + 0.04);
  });
}

// 휙: 던지거나 총알이 스치는 바람 소리
function playDuelWhoosh(ctx, out, when, from = 300, to = 2200, length = 0.28, volume = 0.35) {
  const noise = ctx.createBufferSource();
  noise.buffer = duelNoiseBuffer(ctx, length + 0.05);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 3;
  band.frequency.setValueAtTime(from, when);
  band.frequency.exponentialRampToValueAtTime(to, when + length);
  const gain = duelEnvelope(ctx, when, length * 0.5, 0, length * 0.5, volume);
  noise.connect(band).connect(gain).connect(out);
  noise.start(when);
  noise.stop(when + length + 0.05);
}

// 퍽: 던진 총이 머리에 맞는 둔탁한 소리 + 띠잉
function playDuelBonk(ctx, out, when) {
  const knock = ctx.createOscillator();
  knock.type = "triangle";
  knock.frequency.setValueAtTime(330, when);
  knock.frequency.exponentialRampToValueAtTime(110, when + 0.16);
  const knockGain = duelEnvelope(ctx, when, 0.002, 0, 0.2, 0.8);
  knock.connect(knockGain).connect(out);
  knock.start(when);
  knock.stop(when + 0.24);
  const ring = ctx.createOscillator();
  ring.type = "sine";
  ring.frequency.setValueAtTime(1320, when + 0.04);
  const wobble = ctx.createOscillator();
  wobble.frequency.value = 18;
  const wobbleGain = ctx.createGain();
  wobbleGain.gain.value = 40;
  wobble.connect(wobbleGain).connect(ring.frequency);
  const ringGain = duelEnvelope(ctx, when + 0.04, 0.01, 0, 0.5, 0.08);
  ring.connect(ringGain).connect(out);
  ring.start(when + 0.04);
  wobble.start(when + 0.04);
  ring.stop(when + 0.6);
  wobble.stop(when + 0.6);
}

// 결투 소리 전체를 t0(초) 기준으로 예약. 실제 재생과 확인용 녹음(OfflineAudioContext) 모두 이 함수를 씀
function scheduleDuelSound(ctx, out, t0, plan) {
  const fireTime = t0 + plan.fireAt;
  const beatTime = beat => t0 + DUEL_MUSIC_START + beat * DUEL_BEAT;
  const at = ms => fireTime + ms / 1000;
  const event = DUEL_EVENTS[plan.event] || DUEL_EVENTS.normal;
  const music = ctx.createGain();   // 승부 순간에 음악만 뚝 끊기 위한 묶음
  music.gain.value = 1;
  music.connect(out);

  playDuelWind(ctx, music, t0);

  // 저음 반복 (마디마다): E-B, G-D, A-E, 이후 E-B 반복
  const bassBars = [["E2", "B2"], ["G2", "D3"], ["A2", "E3"], ["E2", "B2"], ["E2", "B2"]];
  for (let beat = 0; beatTime(beat) < fireTime; beat++) {
    const pair = bassBars[Math.min(Math.floor(beat / 4), bassBars.length - 1)];
    playDuelPluck(ctx, music, beatTime(beat), DUEL_NOTES[pair[beat % 2]], beat < 8 ? 0.3 : 0.24);
    if (beat >= 4) playDuelPluck(ctx, music, beatTime(beat + 0.5), DUEL_NOTES[pair[0]] * 2, 0.08, 0.2);   // 말발굽 같은 엇박 튕김
  }

  // 휘파람 선율 (2마디) → 높은 E를 승부까지 길게 끎
  const melody = [[0.5, "B4", 0.5], [1, "E5", 1], [2, "D5", 0.5], [2.5, "B4", 1.5], [4, "G4", 0.75], [4.75, "A4", 0.25], [5, "B4", 2.5]];
  melody.forEach(([beat, note, length]) => {
    if (beatTime(beat) < fireTime) playDuelWhistle(ctx, music, beatTime(beat), DUEL_NOTES[note], Math.min(length * DUEL_BEAT, fireTime - beatTime(beat)));
  });
  if (beatTime(8) < fireTime) playDuelWhistle(ctx, music, beatTime(8), DUEL_NOTES.E5, fireTime - beatTime(8), 0.1);

  // 시계 소리: 둘째 마디부터 한 박마다, 셋째 마디부터 반 박마다 점점 크게
  for (let beat = 4; beatTime(beat) < fireTime; beat += beat >= 8 ? 0.5 : 1) {
    playDuelTick(ctx, music, beatTime(beat), Math.min(0.14, 0.04 + (beat - 4) * 0.012));
  }
  for (let bar = 0; beatTime(bar * 4) < fireTime; bar++) playDuelDrum(ctx, music, beatTime(bar * 4), 0.35);
  if (beatTime(8) < fireTime) playDuelTremolo(ctx, music, beatTime(8), fireTime);

  // 승부: 음악을 끊고 장면별 효과음, 쓰러진 뒤 짧은 기타 마무리
  music.gain.setValueAtTime(1, fireTime - 0.01);
  music.gain.exponentialRampToValueAtTime(0.0001, fireTime + 0.02);
  if (plan.event === "misfire") {
    event.clicksMs.forEach(ms => playDuelClick(ctx, out, at(ms)));
    playDuelGunshot(ctx, out, at(event.shotMs));
  } else if (plan.event === "throw") {
    playDuelWhoosh(ctx, out, at(event.throwMs));
    playDuelBonk(ctx, out, at(event.hitMs));
  } else if (plan.event === "rapid") {
    event.shotsMs.forEach((ms, i) => playDuelGunshot(ctx, out, at(ms), i === event.shotsMs.length - 1, 0.55));
  } else if (plan.event === "dodge") {
    playDuelGunshot(ctx, out, at(0));
    playDuelWhoosh(ctx, out, at(40), 2600, 500, 0.2, 0.25);
    playDuelGunshot(ctx, out, at(event.shotMs));
  } else {
    playDuelGunshot(ctx, out, at(0));
  }
  ["E2", "B2", "E3", "G3", "B3"].forEach((note, i) => playDuelPluck(ctx, out, at(event.hitMs + 1200) + i * 0.045, DUEL_NOTES[note], 0.16, 1.2));
}

// 실제 재생: 소리를 끄면 아무것도 예약하지 않음. leadSec: 예약해 둔 소리 시작까지의 여유(화면 시계도 같이 늦춤)
function startDuelSound(plan) {
  const ctx = duelSoundOn ? ensureDuelAudio() : null;
  if (!ctx) return null;
  const leadSec = 0.08;
  const master = ctx.createGain();
  master.gain.value = 0.55;   // 효과음·떨리는 현이 겹쳐도 소리가 깨지지 않게 여유를 둠
  master.connect(ctx.destination);
  scheduleDuelSound(ctx, master, ctx.currentTime + leadSec, plan);
  return {
    leadSec,
    stop() {
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.06);
        setTimeout(() => master.disconnect(), 120);
      } catch { /* 이미 끊긴 경우 */ }
    }
  };
}

function updateDuelSoundButton() {
  duelSoundBtn.textContent = duelSoundOn ? "🔊" : "🔇";
  duelSoundBtn.setAttribute("aria-pressed", String(duelSoundOn));
  duelSoundBtn.setAttribute("aria-label", duelSoundOn ? "소리 끄기" : "소리 켜기");
}

// ===== 3D 장면 =====
const clamp01 = value => Math.min(1, Math.max(0, value));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeIn = k => k * k;
const easeInOut = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

// 화면 비율에 맞춰 두 사람이 모두 보이게: 세로 화면은 더 가깝게 세우고 시야를 넓힘
// fallZ: 옆으로 넘어가는 정도. 세로 화면은 옆 여유가 적어 더 뒤쪽(카메라 반대)으로 쓰러지게
function duelLayout(THREE, aspect) {
  const portrait = aspect < 0.9;
  const fov = portrait ? 50 : 38;
  const spacing = portrait ? 1.65 : 2.9;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const zNear = Math.max((spacing + (portrait ? 1.3 : 1.45)) / (tanHalf * aspect), 2.5 / tanHalf);
  return { fov, spacing, zNear, zFar: zNear * 1.35, fallZ: portrait ? 0.4 : 0.75 };
}

function makeSkyTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#160d2a");
  gradient.addColorStop(0.42, "#4b2457");
  gradient.addColorStop(0.68, "#c4544a");
  gradient.addColorStop(0.82, "#f08a4b");
  gradient.addColorStop(1, "#f6a95a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 이마에 붙인 쪽지 이름표: 이름만 (팀은 쪽지 색으로 구분). 머리에 붙어 같이 움직이고 같이 쓰러짐 (캔버스 글자라 HTML로 해석되지 않음)
// 인물이 3/4로 서 있어 평평한 쪽지는 옆으로 찌그러져 안 읽히므로, 이마의 카메라 쪽에 붙이고 항상 카메라를 보게 함(Sprite).
// 쪽지 너비는 이름 길이에 맞추되 너무 길면 글자를 줄이고 끝을 "…"로 자름. tilt: 삐뚤게 붙인 각도
function makeForeheadTag(THREE, name, color, tilt) {
  const height = 160;
  const maxCanvasWidth = 560;
  const padding = 64;
  const measureCtx = document.createElement("canvas").getContext("2d");
  let text = String(name ?? "");
  let size = 104;
  const measure = () => {
    measureCtx.font = `900 ${size}px ${DUEL_FONT}`;
    return measureCtx.measureText(text).width;
  };
  while (measure() + padding > maxCanvasWidth && size > 64) size -= 4;
  while (measure() + padding > maxCanvasWidth && text.length > 1) text = text.slice(0, -1);
  if (text !== String(name ?? "")) text = `${text.slice(0, -1)}…`;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(220, Math.ceil(measure() + padding));
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  roundRectPath(ctx, 6, 8, canvas.width - 12, height - 16, 30);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#fff6e0";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${size}px ${DUEL_FONT}`;
  ctx.fillText(text, canvas.width / 2, height / 2 + 6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // 머리가 돌아가도 쪽지 일부가 머리 뒤로 숨지 않게 깊이 검사 없이 맨 앞에 그림
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, rotation: tilt, depthTest: false }));
  tag.renderOrder = 10;
  tag.userData.baseScale = [0.27 * (canvas.width / height), 0.27];   // 화면 비율에 맞춘 크기는 applyLayout이 정함
  tag.scale.set(...tag.userData.baseScale, 1);
  // 머리 기준: 이마 높이(0.23)에서 카메라 쪽(-x, 오른쪽 사람은 좌우를 뒤집어 같은 효과)으로 비켜 머리 밖 0.07 지점
  tag.position.set(-0.16, 0.23, 0.38);
  return tag;
}

// 대머리 반짝임
function makeSparkle(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const radius = i % 2 === 0 ? 30 : 6;
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    ctx.lineTo(32 + Math.cos(angle) * radius, 32 + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false }));
  sprite.scale.setScalar(0.32);
  return sprite;
}

// 그림처럼 단순한 도형으로 만든 총잡이. 앞(+z)을 보고 서 있고, 오른손(-x)에 총을 든다.
// look: rollDuelLook()의 무작위 꾸미기 (수염·대머리·안경·여성·일자눈썹·빨간 코·머리색·모자색)
function makeGunslinger(THREE, teamColor, look) {
  const root = new THREE.Group();
  const pivot = new THREE.Group();   // 발밑 기준으로 쓰러지는 축
  const body = new THREE.Group();    // 상대를 바라보는 방향
  root.add(pivot);
  pivot.add(body);

  const coatMat = new THREE.MeshStandardMaterial({ color: 0x3b2b42, roughness: 0.9, flatShading: true });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe2b38c, roughness: look.bald ? 0.28 : 0.8 });
  const teamMat = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.55, emissive: teamColor, emissiveIntensity: 0.18 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x6e4228, roughness: 0.9, flatShading: true });
  const hatMat = new THREE.MeshStandardMaterial({ color: look.hatColor, roughness: 0.85, flatShading: true });
  const hairMat = new THREE.MeshStandardMaterial({ color: look.hairColor, roughness: 0.95, flatShading: true });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xa7afb8, metalness: 0.7, roughness: 0.35 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.6, roughness: 0.3 });
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x1a1220 });

  const profile = [[0, 0], [0.62, 0], [0.6, 0.18], [0.52, 0.7], [0.44, 1.15], [0.34, 1.5], [0.2, 1.66], [0, 1.7]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  body.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 18), coatMat));

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.075, 8, 20), teamMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.66;
  body.add(scarf);

  // 머리: 얼굴 장식은 모두 head 기준 위치 (앞이 +z, 반지름 0.4). 이마(0.15~0.37)는 이름표 자리
  const head = new THREE.Group();
  head.position.y = 2.02;
  body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 16), skinMat));

  const eyes = [-0.13, 0.13].map(x => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), darkMat);
    eye.position.set(x, 0.04, 0.36);
    head.add(eye);
    return eye;
  });
  // 쓰러지면 눈이 X로
  const xEyes = new THREE.Group();
  [-0.13, 0.13].forEach(x => {
    [Math.PI / 4, -Math.PI / 4].forEach(angle => {
      const stroke = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.02), darkMat);
      stroke.position.set(x, 0.04, 0.39);
      stroke.rotation.z = angle;
      xEyes.add(stroke);
    });
  });
  xEyes.visible = false;
  head.add(xEyes);

  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(look.redNose ? 0.09 : 0.065, 12, 10),
    look.redNose ? new THREE.MeshStandardMaterial({ color: 0xe2453c, roughness: 0.4 }) : skinMat
  );
  nose.position.set(0, -0.05, 0.4);
  head.add(nose);

  if (look.unibrow) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.05), hairMat);
    brow.position.set(0, 0.11, 0.375);
    head.add(brow);
  }

  if (look.facialHair === "mustache" || look.facialHair === "beard") {
    // 양끝이 말려 올라간 콧수염 (턱수염이 있으면 그 앞으로 조금 더 나오게)
    const front = look.facialHair === "beard" ? 0.05 : 0;
    const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 4, 8), hairMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, -0.14, 0.38 + front);
    head.add(bar);
    [-1, 1].forEach(side => {
      const curl = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.024, 6, 12, Math.PI * 1.25), hairMat);
      curl.position.set(side * 0.18, -0.1, 0.36 + front);
      curl.rotation.set(0, side * 0.35, side > 0 ? -Math.PI * 0.75 : Math.PI * 0.5);
      head.add(curl);
    });
  }
  if (look.facialHair === "beard") {
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.42), hairMat);
    beard.position.set(0, -0.05, 0.05);
    beard.scale.set(1, 1.35, 1);
    head.add(beard);
  }

  // 반짝임은 대머리일 때만 보이지만 정리(dispose)가 함께 되도록 항상 머리에 붙여 둠
  const sparkle = makeSparkle(THREE);
  head.add(sparkle);
  if (look.bald) {
    // 옆·뒤에만 남은 머리카락 + 빛나는 정수리 (모자가 벗겨지면 반짝).
    // 고리를 눕히면 고리 각도 a가 (cos a, 0, sin a) 방향이 되므로, 1.25π 길이의 호를 0.875π부터 시작해 앞(0.5π)을 비움
    const fringe = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.07, 8, 24, Math.PI * 1.25), hairMat);
    fringe.rotation.set(Math.PI / 2, 0, Math.PI * 0.875);
    fringe.position.y = -0.02;
    head.add(fringe);
    sparkle.position.set(0.12, 0.42, 0.15);
  }

  if (look.female) {
    const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.43, 18, 14), hairMat);
    backHair.position.set(0, -0.04, -0.09);
    backHair.scale.set(1.04, 1.06, 1);
    head.add(backHair);
    [-1, 1].forEach(side => {
      // 양 갈래 땋은 머리 + 팀 색 리본
      for (let i = 0; i < 5; i++) {
        const knot = new THREE.Mesh(new THREE.SphereGeometry(0.085 - i * 0.006, 10, 8), hairMat);
        knot.position.set(side * (0.34 + i * 0.015), -0.24 - i * 0.13, 0.02);
        head.add(knot);
      }
      const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 6, 12), teamMat);
      ribbon.position.set(side * 0.41, -0.88, 0.02);
      head.add(ribbon);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), new THREE.MeshBasicMaterial({ color: 0xff7a8a, transparent: true, opacity: 0.55 }));
      blush.position.set(side * 0.22, -0.09, 0.335);
      blush.rotation.y = side * 0.55;
      head.add(blush);
      const lash = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.018, 0.01), darkMat);
      lash.position.set(side * 0.15, 0.1, 0.385);
      lash.rotation.z = side * 0.35;
      head.add(lash);
    });
    const lips = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd63a4a, roughness: 0.5 }));
    lips.scale.set(1.4, 0.6, 0.6);
    lips.position.set(0, -0.18, 0.36);
    head.add(lips);
  }

  if (look.glasses === "round") {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.5, roughness: 0.4 });
    [-0.13, 0.13].forEach(x => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.017, 8, 20), frameMat);
      ring.position.set(x, 0.04, 0.4);
      head.add(ring);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.085, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }));
      lens.position.set(x, 0.04, 0.405);
      head.add(lens);
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.015), frameMat);
    bridge.position.set(0, 0.05, 0.41);
    head.add(bridge);
  } else if (look.glasses === "sun") {
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.4, roughness: 0.15 });
    [-0.13, 0.13].forEach(x => {
      const shade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.03), shadeMat);
      shade.position.set(x, 0.04, 0.4);
      head.add(shade);
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), shadeMat);
    bridge.position.set(0, 0.06, 0.41);
    head.add(bridge);
  }

  const hat = new THREE.Group();
  hat.position.y = DUEL_HAT_Y;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.05, 28), hatMat);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.42, 16), hatMat);
  crown.position.y = 0.22;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.367, 0.367, 0.09, 16), teamMat);
  band.position.y = 0.07;
  hat.add(brim, crown, band);
  body.add(hat);

  const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 5), goldMat);
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0.16, 1.22, 0.4);
  body.add(badge);

  const otherArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.62, 10), coatMat);
  otherArm.position.set(0.47, 1.17, 0);
  otherArm.rotation.z = 0.14;
  body.add(otherArm);

  // 총 든 팔: 어깨 축에서 아래로 늘어져 있다가 rotation.x = -π/2면 앞을 겨눔. 총(gun)은 던질 수 있게 따로 묶음
  const arm = new THREE.Group();
  arm.position.set(-0.42, 1.48, 0);
  arm.rotation.z = -0.12;
  body.add(arm);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.62, 10), coatMat);
  sleeve.position.y = -0.31;
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), skinMat);
  hand.position.y = -0.64;
  arm.add(sleeve, hand);
  const gun = new THREE.Group();
  gun.position.y = -0.64;
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.07), metalMat);
  barrel.position.y = -0.26;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.18), leatherMat);
  grip.position.set(0, -0.04, -0.07);
  const muzzle = new THREE.Object3D();
  muzzle.position.y = -0.48;
  gun.add(barrel, grip, muzzle);
  arm.add(gun);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.78, 28),
    new THREE.MeshBasicMaterial({ color: 0x1a0c14, transparent: true, opacity: 0.35, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  return { root, pivot, body, head, eyes, xEyes, arm, hand, gun, hat, muzzle, sparkle, look };
}

function makeCactus(THREE, material, scale) {
  const cactus = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.2, 8), material);
  trunk.position.y = 1.1;
  const armLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 8), material);
  armLeft.position.set(-0.42, 1.4, 0);
  const armRight = armLeft.clone();
  armRight.position.set(0.42, 1.0, 0);
  const elbowLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.32, 8), material);
  elbowLeft.rotation.z = Math.PI / 2;
  elbowLeft.position.set(-0.28, 1.05, 0);
  const elbowRight = elbowLeft.clone();
  elbowRight.position.set(0.28, 0.65, 0);
  cactus.add(trunk, armLeft, armRight, elbowLeft, elbowRight);
  cactus.scale.setScalar(scale);
  return cactus;
}

// 카메라 장면 목록(ms): 전경 → 얼굴 A → 얼굴 B → 한 박마다 손 A·손 B·눈 A·눈 B를 번갈아(점점 빨라짐) → 승부 직후 다시 전경
function planDuelShots(fireAtMs) {
  const beatMs = DUEL_BEAT * 1000;
  const at = beat => (DUEL_MUSIC_START + beat * DUEL_BEAT) * 1000;
  const shots = [
    { type: "wide", from: 0, to: at(4) },
    { type: "face", who: 0, from: at(4), to: at(6) },
    { type: "face", who: 1, from: at(6), to: at(8) }
  ];
  const cycle = [["hand", 0], ["hand", 1], ["eyes", 0], ["eyes", 1]];
  for (let i = 0, from = at(8); from < fireAtMs; i++, from += beatMs) {
    shots.push({ type: cycle[i % 4][0], who: cycle[i % 4][1], from, to: from + beatMs });
  }
  return shots;
}

function createDuelScene(THREE, info, picks, looks, winner, plan) {
  const width = Math.max(1, duelStageEl.clientWidth);
  const height = Math.max(1, duelStageEl.clientHeight);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.domElement.className = "duel-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  duelStageEl.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = makeSkyTexture(THREE);
  scene.fog = new THREE.Fog(0xd06a48, 20, 60);
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 140);

  scene.add(new THREE.HemisphereLight(0xffc49a, 0x3a1d33, 1.3));
  const sunLight = new THREE.DirectionalLight(0xffa860, 2.4);
  sunLight.position.set(0, 5, -12);
  const fillLight = new THREE.DirectionalLight(0xc4b6ff, 1.1);
  fillLight.position.set(3, 6, 10);
  scene.add(sunLight, fillLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: 0xa65f38, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const sun = new THREE.Mesh(new THREE.CircleGeometry(6.5, 48), new THREE.MeshBasicMaterial({ color: 0xffc061, fog: false }));
  sun.position.set(0, 1.6, -55);
  scene.add(sun);

  const mesaMat = new THREE.MeshStandardMaterial({ color: 0x5a2c48, roughness: 1, flatShading: true });
  [[-26, -40, 7, 6], [-14, -46, 5, 4], [18, -42, 9, 5], [31, -50, 6, 8]].forEach(([x, z, radius, h]) => {
    const mesa = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.75, radius, h, 6), mesaMat);
    mesa.position.set(x, h / 2, z);
    scene.add(mesa);
  });
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x2f5c3c, roughness: 0.9, flatShading: true });
  [[-7.5, -4, 1], [8.5, -7, 1.2], [-12, -12, 1.3], [5, -16, 0.9]].forEach(([x, z, s]) => {
    const cactus = makeCactus(THREE, cactusMat, s);
    cactus.position.set(x, 0, z);
    scene.add(cactus);
  });

  // 왼쪽 팀 A, 오른쪽 팀 B. 서로 마주 보되 카메라 쪽으로 살짝 돌려 3/4로 보이게
  const fighters = [0, 1].map(index => {
    const fighter = makeGunslinger(THREE, info.colors[index], looks[index]);
    const dir = index === 0 ? -1 : 1;
    fighter.dir = dir;
    fighter.body.rotation.y = dir < 0 ? Math.PI / 2 - 0.55 : -(Math.PI / 2 - 0.55);
    // 오른쪽 사람은 좌우를 뒤집어 총 든 팔이 몸 뒤로 숨지 않고 카메라 쪽에 오게
    if (dir > 0) fighter.body.scale.x = -1;
    fighter.tag = makeForeheadTag(THREE, picks[index]?.name, info.colors[index], looks[index].tagTilt);
    fighter.head.add(fighter.tag);
    fighter.phase = index * 1.7;
    scene.add(fighter.root);
    return fighter;
  });
  const shooter = fighters[winner];
  const target = fighters[1 - winner];

  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0 }));
  const flashLight = new THREE.PointLight(0xffc06b, 0, 8);
  scene.add(flash, flashLight);
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0xe9e2da, transparent: true, opacity: 0, roughness: 1, depthWrite: false });
  const smoke = [0, 1, 2, 3].map(() => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), smokeMat.clone());
    scene.add(puff);
    return puff;
  });
  // 피하기 장면에서 숙인 머리 위로 지나가는 총알
  const bullet = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.5, 4, 6), new THREE.MeshBasicMaterial({ color: 0xffe6a0 }));
  bullet.rotation.z = Math.PI / 2;
  bullet.visible = false;
  scene.add(bullet);

  const tumbleweed = new THREE.Group();
  [[0.46, 0x9c7442], [0.32, 0x7a5530]].forEach(([radius, color]) => {
    tumbleweed.add(new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), new THREE.MeshBasicMaterial({ color, wireframe: true })));
  });
  scene.add(tumbleweed);

  let layout;
  const applyLayout = () => {
    const w = Math.max(1, duelStageEl.clientWidth);
    const h = Math.max(1, duelStageEl.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    layout = duelLayout(THREE, camera.aspect);
    fighters.forEach(fighter => {
      fighter.root.position.x = fighter.dir * layout.spacing;
      // 세로 화면(휴대폰)은 사람이 작게 보이므로 이마 이름표를 키움
      const [w, h] = fighter.tag.userData.baseScale;
      const grow = camera.aspect < 0.9 ? 1.35 : 1;
      fighter.tag.scale.set(w * grow, h * grow, 1);
    });
  };
  applyLayout();

  // 시간표 (ms). F = 승부 시점(planDuel()이 정한 음악 엇박), 장면별 세부 시각은 DUEL_EVENTS
  const event = DUEL_EVENTS[plan.event] || DUEL_EVENTS.normal;
  const F = plan.fireAt * 1000;
  const hitAt = F + event.hitMs;
  const revealAt = hitAt + 1600;
  const closeupFrom = (DUEL_MUSIC_START + 4 * DUEL_BEAT) * 1000;
  const shots = planDuelShots(F);
  // 총을 쏘는 순간(총구 불꽃·흔들림): [누가, 언제]
  const fireShots = {
    normal: [[shooter, F]],
    misfire: [[shooter, F + (event.shotMs || 0)]],
    throw: [],
    rapid: (event.shotsMs || []).map(ms => [shooter, F + ms]),
    dodge: [[target, F], [shooter, F + (event.shotMs || 0)]]
  }[plan.event] || [[shooter, F]];
  const shakeTimes = fireShots.map(([, time]) => time).concat(plan.event === "throw" ? [hitAt] : []);
  // 화면 가운데 효과 글자 [언제, 글자, 번쩍임]
  const texts = {
    normal: [[F, "탕!", true]],
    misfire: [[F, "딸깍…", false], [F + 450, "딸깍…", false], [F + (event.shotMs || 0), "탕!", true]],
    throw: [[F + 120, "휙!", false], [hitAt, "퍽!", true]],
    rapid: [[F, "타다다당!", true]],
    dodge: [[F, "탕!", true], [F + 200, "휙! 피했다", false], [F + (event.shotMs || 0), "탕!", true]]
  }[plan.event] || [[F, "탕!", true]];
  const doneTexts = new Set();

  const hatStart = new THREE.Vector3();
  const muzzlePos = new THREE.Vector3();
  const smokeOrigin = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const gunStart = new THREE.Vector3();
  const gunTarget = new THREE.Vector3();
  const bulletFrom = new THREE.Vector3();
  let hatDetached = false;
  let gunDetached = false;
  let startTime = 0;
  let offset = 0;
  let revealEvent = false;
  let running = false;
  let rafId = 0;
  let lastShotKey = "";

  const shotAt = t => {
    if (t >= F + 120) {
      // 불발: 상대가 한심하게 쳐다보는 얼굴을 잠깐 클로즈업
      if (plan.event === "misfire" && t >= F + 450 && t < F + event.shotMs - 350) {
        return { type: "face", who: winner, from: F + 450, to: F + event.shotMs - 350 };
      }
      return { type: "wide" };   // 승부 직후 전경으로 돌아와 쓰러지는 모습을 보여줌
    }
    return shots.find(shot => t >= shot.from && t < shot.to) || shots[shots.length - 1];
  };

  // 클로즈업 시야각은 가로 화면 기준. 세로 화면(휴대폰)은 좌우가 좁아 얼굴이 잘리지 않게 넓힘
  const setFov = (fov, closeup = true) => {
    if (closeup && camera.aspect < 0.9) fov *= 1.35;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  };

  const placeCamera = (shot, t) => {
    if (shot.type === "wide") {
      const k = easeInOut(clamp01(t / closeupFrom));
      setFov(layout.fov, false);
      camera.position.set(0, lerp(2.7, 1.85, k), lerp(layout.zFar, layout.zNear, k));
      camera.lookAt(0, lerp(1.3, 1.45, k), 0);
      return;
    }
    const fighter = fighters[shot.who];
    fighter.body.getWorldDirection(facing);
    facing.y = 0;
    facing.normalize();
    const push = clamp01((t - shot.from) / (shot.to - shot.from));
    if (shot.type === "face") {
      fighter.head.getWorldPosition(focus);
      focus.y += 0.06;
      setFov(36);
      camera.position.copy(focus).addScaledVector(facing, lerp(2.1, 1.65, push));
      camera.position.y += 0.08;
    } else if (shot.type === "eyes") {
      fighter.head.getWorldPosition(focus);
      focus.y += 0.04;
      setFov(24);
      camera.position.copy(focus).addScaledVector(facing, lerp(1.05, 0.9, push));
    } else {
      // 손: 총 든 손은 카메라(앞, +z) 쪽에 있으므로 정면 앞쪽에서 살짝 위·옆으로 비켜 내려다봄 (외투에 가리지 않게)
      fighter.hand.getWorldPosition(focus);
      setFov(40);
      camera.position.set(
        focus.x + facing.x * 0.35,
        focus.y + 0.35,
        focus.z + lerp(1.5, 1.25, push)
      );
    }
    camera.lookAt(focus);
  };

  // 0→1 사이를 duration(ms) 동안 올라가는 값
  const ramp = (t, from, duration) => clamp01((t - from) / duration);

  const update = t => {
    const shot = shotAt(t);
    placeCamera(shot, t);
    shakeTimes.forEach(time => {
      const since = t - time;
      if (since >= 0 && since < 420) {
        const amp = (shot.type === "wide" ? 0.13 : 0.05) * (1 - since / 420);
        camera.position.x += (Math.random() - 0.5) * amp;
        camera.position.y += (Math.random() - 0.5) * amp;
      }
    });

    // 클로즈업 동안은 화면 위아래 검은 띠, 안내 문구는 숨김
    if (shot.type !== lastShotKey) {
      lastShotKey = shot.type;
      duelStageEl.classList.toggle("cinema", shot.type !== "wide" && !revealEvent);
      if (shot.type !== "wide") duelCaptionEl.hidden = true;
    }

    // 숨쉬기, 눈 가늘게 뜨기, 손 떨림 (긴장)
    const squint = t < F ? ramp(t, closeupFrom, 900) : 0;
    fighters.forEach(fighter => {
      fighter.body.position.y = 0.02 * Math.sin(t * 0.004 + fighter.phase);
      fighter.body.scale.y = 1;
      fighter.head.rotation.set(0, 0, 0);
      fighter.eyes.forEach(eye => { eye.scale.y = lerp(1, 0.3, squint); });
      const twitch = ramp(t, F - 1800, 1800) * (t < F ? 0.07 * Math.sin(t * 0.045 + fighter.phase) : 0);
      fighter.arm.rotation.x = twitch;
      fighter.arm.rotation.z = -0.12;
    });

    // 반동: 쏜 직후 총구가 위로 튀었다가 돌아옴 (rotation.x가 작을수록 팔이 위로)
    const recoilOf = fighter => fireShots
      .filter(([who, time]) => who === fighter && t > time)
      .reduce((sum, [, time]) => sum + 0.35 * Math.exp(-(t - time) / 90), 0);
    const aim = (fighter, amount) => {
      fighter.arm.rotation.x += -Math.PI / 2 * amount - recoilOf(fighter);
      fighter.arm.rotation.z = lerp(-0.12, 0, Math.min(1, amount));
    };
    const drop = ramp(t, hitAt, 400);

    // 이긴 사람(shooter)
    if (plan.event === "misfire") {
      aim(shooter, easeOut(ramp(t, F + event.shotMs - 320, 320)));
      // 상대 총이 불발되자 고개를 갸웃하며 한심하게 쳐다봄
      const meh = ramp(t, F + 250, 250) * (1 - ramp(t, F + event.shotMs - 300, 200));
      shooter.head.rotation.z = 0.22 * meh;
      shooter.head.rotation.y = 0.12 * meh * Math.sin(t * 0.008);
      shooter.eyes.forEach(eye => { eye.scale.y = lerp(eye.scale.y, 0.35, meh); });
    } else if (plan.event === "throw") {
      // 뽑아서 겨누다 → 머리 위로 들어 → 던지고 팔을 앞으로 휘두름
      const draw = easeOut(ramp(t, F - 120, 120));
      const windup = easeOut(ramp(t, F, event.throwMs));
      const follow = easeOut(ramp(t, F + event.throwMs, 220));
      shooter.arm.rotation.x += lerp(lerp(-Math.PI / 2 * draw, -2.7, windup), -0.9, follow);
      shooter.arm.rotation.z = 0;
    } else if (plan.event === "dodge") {
      // 상대 총알을 몸을 납작하게 숙여 피했다가 일어나서 쏨
      const duck = t < F + 450 ? easeOut(ramp(t, F - 70, 90)) : 1 - easeInOut(ramp(t, F + 450, 200));
      shooter.body.scale.y = 1 - 0.45 * duck;
      aim(shooter, easeOut(ramp(t, F + event.shotMs - 180, 180)));
    } else {
      aim(shooter, easeOut(ramp(t, F - 120, 120)));   // 기본·연사: 먼저 뽑아 쏨
    }

    // 진 사람(target)
    if (plan.event === "misfire") {
      // 먼저 뽑았지만 딸깍… 딸깍… 총을 내려다보다가 맞음
      aim(target, easeOut(ramp(t, F - 120, 120)) * (1 - 0.6 * ramp(t, F + 800, 200)) * (1 - drop));
      target.head.rotation.x = 0.4 * ramp(t, F + 800, 200) * (1 - drop);
    } else if (plan.event === "dodge") {
      aim(target, easeOut(ramp(t, F - 120, 120)) * (1 - drop));   // 먼저 쐈지만 빗나감
    } else {
      aim(target, easeOut(ramp(t, F - 40, 260)) * 0.55 * (1 - drop));   // 한발 늦게 뽑다가 맞음
    }
    if (plan.event === "rapid" && t >= F && t < hitAt) {
      target.pivot.rotation.set((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12);   // 연사에 부들부들
    }

    // 던진 총: 이긴 사람 손에서 떨어져 회전하며 상대 머리로 날아가고, 맞은 뒤 땅에 떨어짐
    if (plan.event === "throw") {
      if (t >= F + event.throwMs && !gunDetached) {
        shooter.root.updateMatrixWorld(true);
        target.root.updateMatrixWorld(true);
        scene.attach(shooter.gun);
        gunStart.copy(shooter.gun.position);
        target.head.getWorldPosition(gunTarget);
        gunDetached = true;
      }
      if (gunDetached) {
        const flight = ramp(t, F + event.throwMs, event.hitMs - event.throwMs);
        if (t < hitAt) {
          shooter.gun.position.lerpVectors(gunStart, gunTarget, flight);
          shooter.gun.position.y += 0.9 * 4 * flight * (1 - flight);
          shooter.gun.rotation.set(flight * 9, 0, flight * 13);
        } else {
          const s = ramp(t, hitAt, 450);
          shooter.gun.position.set(
            gunTarget.x - target.dir * 0.7 * s,
            Math.max(0.05, gunTarget.y + 1.2 * s - 3.4 * s * s),
            gunTarget.z + 0.3 * s
          );
          shooter.gun.rotation.set(9 + s * 4, 0, s >= 1 ? Math.PI / 2 : 13 + s * 6);
        }
      }
    }

    // 맞은 순간 모자를 몸에서 떼어 날리고, 몸은 뒤로 쓰러짐
    if (t >= hitAt && !hatDetached) {
      target.pivot.rotation.set(0, 0, 0);
      target.root.updateMatrixWorld(true);
      scene.attach(target.hat);
      hatStart.copy(target.hat.position);
      hatDetached = true;
    }
    // 뒤(상대 반대쪽)로, 카메라에서도 살짝 멀어지게 비스듬히 쓰러져 화면 밖으로 넘어가지 않게
    const fall = easeIn(ramp(t, hitAt, 650));
    const bounce = t > hitAt + 650 ? 0.05 * Math.exp(-(t - hitAt - 650) / 120) * Math.sin((t - hitAt - 650) / 40) : 0;
    if (t >= hitAt || plan.event !== "rapid") {
      target.pivot.rotation.z = -target.dir * (layout.fallZ * fall + bounce);
      target.pivot.rotation.x = -1.3 * fall;
    }
    target.xEyes.visible = t >= hitAt + 300;
    target.eyes.forEach(eye => { eye.visible = t < hitAt + 300; });
    if (hatDetached) {
      const up = 2.8;
      const s = Math.max(0, t - hitAt) / 1000;
      const y = hatStart.y + up * s - 4.9 * s * s;
      const landed = y <= 0.06;
      // 땅(0.06)에 닿는 시각: 4.9s² - up·s - (시작 높이 - 0.06) = 0의 양의 해
      const flight = landed ? (up + Math.sqrt(up * up + 19.6 * (hatStart.y - 0.06))) / 9.8 : s;
      target.hat.position.set(hatStart.x + target.dir * 1.1 * flight, landed ? 0.06 : y, hatStart.z - 0.5 * flight);
      target.hat.rotation.set(landed ? 0.18 : flight * 7, 0, landed ? target.dir * 0.4 : target.dir * flight * 5);
    }

    // 이긴 사람은 모자를 살짝 들어 인사 (대머리면 정수리가 반짝)
    const tip = Math.sin(Math.PI * ramp(t, hitAt + 700, 1100));
    shooter.hat.position.y = DUEL_HAT_Y + 0.32 * tip;
    shooter.hat.rotation.z = 0.35 * tip;
    const twinkle = phase => 0.5 + 0.5 * Math.sin(t * 0.02 + phase);
    shooter.sparkle.material.opacity = shooter.look.bald ? tip * twinkle(0) : 0;
    target.sparkle.material.opacity = target.look.bald && t > hitAt + 200 ? twinkle(1.3) : 0;

    // 총구 불꽃 (가장 최근 발사)과 이긴 사람 마지막 발사의 연기
    const recent = fireShots.filter(([, time]) => t >= time && t < time + 80).pop();
    if (recent) {
      recent[0].muzzle.getWorldPosition(muzzlePos);
      const flashK = 1 - (t - recent[1]) / 80;
      flash.position.copy(muzzlePos);
      flash.material.opacity = flashK;
      flash.scale.setScalar(0.6 + flashK * 1.4);
      flashLight.position.copy(muzzlePos);
      flashLight.intensity = flashK * 40;
    } else {
      flash.material.opacity = 0;
      flashLight.intensity = 0;
    }
    const lastShot = fireShots.filter(([who]) => who === shooter).pop();
    if (lastShot) {
      if (t < lastShot[1]) shooter.muzzle.getWorldPosition(smokeOrigin);
      smoke.forEach((puff, i) => {
        const life = clamp01((t - lastShot[1] - i * 60) / 1100);
        puff.visible = t >= lastShot[1] && life < 1;
        puff.position.set(smokeOrigin.x + shooter.dir * -0.1 * i, smokeOrigin.y + life * 0.9 + i * 0.05, smokeOrigin.z + 0.1 * i);
        puff.scale.setScalar(0.6 + life * 2.4);
        puff.material.opacity = 0.55 * (1 - life);
      });
    } else {
      smoke.forEach(puff => { puff.visible = false; });
    }

    // 피하기: 진 사람의 총알이 숙인 머리 위로 지나감
    if (plan.event === "dodge") {
      if (t < F) target.muzzle.getWorldPosition(bulletFrom);
      const travel = ramp(t, F, 220);
      bullet.visible = t >= F && travel < 1;
      bullet.position.set(bulletFrom.x - target.dir * travel * (layout.spacing * 2 + 4), bulletFrom.y + 0.15, bulletFrom.z);
    }

    // 회전초가 앞을 굴러 지나감
    const tx = -9 + (t / 1000) * 3.0;
    tumbleweed.position.set(tx, 0.46 + Math.abs(Math.sin(t * 0.006)) * 0.35, 1.8);
    tumbleweed.rotation.z = -tx / 0.46;
  };

  const loop = now => {
    if (!running) return;
    if (!startTime) startTime = now;
    const t = Math.max(0, now - startTime + offset);
    update(t);
    renderer.render(scene, camera);
    texts.forEach(([time, text, withFlash], i) => {
      if (!doneTexts.has(i) && t >= time) {
        doneTexts.add(i);
        fireDuelEffects(text, withFlash);
      }
    });
    if (!revealEvent && t >= revealAt) {
      revealEvent = true;
      revealDuel();
    }
    // 결과가 나오고 장면이 멈춘 뒤에는 그리기를 멈춰 배터리를 아낌 (크기가 바뀌면 다시 한 번 그림)
    if (t > revealAt + 2500) {
      running = false;
      return;
    }
    rafId = requestAnimationFrame(loop);
  };

  const resizeObserver = new ResizeObserver(() => {
    applyLayout();
    if (!running) renderer.render(scene, camera);
  });
  resizeObserver.observe(duelStageEl);

  return {
    // leadSec: 소리를 조금 뒤에 시작하도록 예약했으면 화면 시계도 그만큼 늦춰 박자를 맞춤
    start(leadSec = 0) {
      running = true;
      offset = -leadSec * 1000;
      rafId = requestAnimationFrame(loop);
    },
    // 건너뛰기: 효과음·글자 없이 끝난 장면으로 바로
    skip() {
      texts.forEach((_, i) => doneTexts.add(i));
      revealEvent = true;
      duelStageEl.classList.remove("cinema");
      const endT = revealAt + 1200;
      const now = performance.now();
      offset = endT - (startTime ? now - startTime : 0);
      if (!startTime) startTime = now;
      update(endT);
      renderer.render(scene, camera);
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(loop);
      }
    },
    dispose() {
      running = false;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      duelStageEl.classList.remove("cinema");
      scene.traverse(object => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        materials.forEach(material => {
          material.map?.dispose();
          material.dispose();
        });
      });
      smokeMat.dispose();
      scene.background?.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    }
  };
}

// ===== 연결 =====
document.getElementById("duelBtn").addEventListener("click", event => openDuel("direct", event.currentTarget));
document.getElementById("recruitmentDuelBtn").addEventListener("click", event => openDuel("recruitment", event.currentTarget));
duelSkipBtn.addEventListener("click", skipDuel);
duelPickAttackBtn.addEventListener("click", () => chooseDuelSide("attack"));
duelPickDefenseBtn.addEventListener("click", () => chooseDuelSide("defense"));
duelAgainBtn.addEventListener("click", () => {
  ensureDuelAudio();
  startDuelRound();
});
duelDoneBtn.addEventListener("click", closeDuel);
duelCloseBtn.addEventListener("click", closeDuel);
duelOverlayEl.addEventListener("click", event => {
  if (event.target === duelOverlayEl) closeDuel();
});
duelSoundBtn.addEventListener("click", () => {
  duelSoundOn = !duelSoundOn;
  try { localStorage.setItem(DUEL_SOUND_KEY, duelSoundOn ? "on" : "off"); } catch { /* 저장 못 해도 이번 화면에서는 적용 */ }
  if (duelSoundOn) ensureDuelAudio();
  else {
    duelState.sound?.stop();   // 재생 중이던 음악도 바로 끔
    duelState.sound = null;
  }
  updateDuelSoundButton();
});
// Esc: 닫기(이긴 팀은 기록). 연출 중 Enter·Space(버튼에 포커스가 없을 때)·S: 건너뛰기
document.addEventListener("keydown", event => {
  if (!isDuelOpen()) return;
  if (event.key === "Escape") {
    closeDuel();
    return;
  }
  const onButton = event.target instanceof HTMLElement && event.target.closest("button");
  const skipKey = event.key === "s" || event.key === "S" || (!onButton && (event.key === "Enter" || event.key === " "));
  if (skipKey && !duelState.revealed && !duelSkipBtn.hidden) {
    event.preventDefault();
    skipDuel();
  }
});
updateDuelSoundButton();
