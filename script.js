const maps = [
  "Ascent",
  "Bind",
  "Breeze",
  "Haven",
  "Icebox",
  "Lotus",
  "Pearl",
  "Fracture",
  "Split",
  "Sunset",
  "Abyss",
  "Corrode",
  "Summit"
];

// 맵 이름 → PNG 슬러그 (영문 소문자가 파일명과 동일)
function mapSlug(name) {
  return (name || "").toLowerCase();
}

const resultText = document.getElementById("resultText");
const drawBtn = document.getElementById("spinBtn");
const resetBtn = document.getElementById("resetBtn");
const historyList = document.getElementById("historyList");
const usedList = document.getElementById("usedList");
const excludeModeCheckbox = document.getElementById("excludeMode");
const modeStatusText = document.getElementById("modeStatusText");
const remainingText = document.getElementById("remainingText");
const cardDeckEl = document.getElementById("cardDeck");
const drawStageEl = document.getElementById("drawStage");

let isDrawing = false;
let history = [];
let usedMaps = [];
const excludedMaps = new Set();   // 수동으로 제외한 맵

function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = `<span class="empty-history">아직 기록이 없습니다.</span>`;
    return;
  }

  historyList.innerHTML = history
    .map(item => `<span class="history-chip">${item}</span>`)
    .join("");
}

function renderUsedMaps() {
  if (usedMaps.length === 0) {
    usedList.innerHTML = `<span class="empty-history">아직 나온 맵이 없습니다.</span>`;
    return;
  }

  usedList.innerHTML = usedMaps
    .map(item => `<span class="used-chip">${item}</span>`)
    .join("");
}

function updateModeUI() {
  const isExcludeMode = excludeModeCheckbox.checked;

  modeStatusText.textContent = isExcludeMode ? "현재: 제외 모드" : "현재: 기본 모드";
  remainingText.textContent = `남은 맵: ${getAvailableMaps().length}개`;
}

function getAvailableMaps() {
  // 수동 제외 맵은 항상 빠짐
  let pool = maps.filter(map => !excludedMaps.has(map));

  // 제외 모드면 이미 나온 맵도 제외
  if (excludeModeCheckbox.checked) {
    pool = pool.filter(map => !usedMaps.includes(map));
  }

  return pool;
}

const SHUFFLE_MS = 850;   // 덱 셔플 시간
const DEAL_MS = 520;      // 카드 딜 후 뒤집기까지
const FLIP_MS = 680;      // 뒤집기 시간

function drawMap() {
  if (isDrawing) return;

  const availableMaps = getAvailableMaps();
  if (availableMaps.length === 0) {
    resultText.textContent = "모든 맵 완료!";
    return;
  }

  isDrawing = true;
  drawBtn.disabled = true;
  resetBtn.disabled = true;
  excludeModeCheckbox.disabled = true;
  resultText.textContent = "뽑는 중...";

  const pickedMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];

  // 1) 덱 셔플
  cardDeckEl.classList.add("shuffling");

  setTimeout(() => {
    cardDeckEl.classList.remove("shuffling");

    // 2) 카드 한 장 딜 + 뒤집기
    const slug = mapSlug(pickedMap);
    const back = slug
      ? `<img class="draw-card-img" src="valorant_map_png/${slug}.png" alt="${pickedMap}"><span class="draw-card-name">${pickedMap}</span>`
      : `<span class="draw-card-name draw-card-name-only">${pickedMap}</span>`;

    drawStageEl.innerHTML = `
      <div class="draw-card" title="크게 보기">
        <div class="draw-card-inner">
          <div class="draw-card-face draw-card-front"><span>?</span></div>
          <div class="draw-card-face draw-card-back">${back}</div>
        </div>
      </div>
    `;

    const innerEl = drawStageEl.querySelector(".draw-card-inner");
    drawStageEl.querySelector(".draw-card")
      .addEventListener("click", () => showMapReveal(pickedMap));

    setTimeout(() => innerEl.classList.add("flipped"), DEAL_MS);

    // 3) 마무리 (기록/사용맵/모드 갱신)
    setTimeout(() => {
      resultText.textContent = pickedMap;

      history.unshift(pickedMap);
      history = history.slice(0, 5);

      if (!usedMaps.includes(pickedMap)) {
        usedMaps.push(pickedMap);
      }

      renderHistory();
      renderUsedMaps();
      updateModeUI();

      isDrawing = false;
      drawBtn.disabled = false;
      resetBtn.disabled = false;
      excludeModeCheckbox.disabled = false;

      if (excludeModeCheckbox.checked && usedMaps.length === maps.length) {
        resultText.textContent = `${pickedMap} (마지막 맵)`;
      }

      // 카드가 다 뒤집힌 직후 큰 리빌 팝업
      showMapReveal(pickedMap);
    }, DEAL_MS + FLIP_MS);
  }, SHUFFLE_MS);
}

// ===== 맵 결과 리빌 =====

const mapRevealEl     = document.getElementById("mapReveal");
const mapRevealImgEl  = document.getElementById("mapRevealImg");
const mapRevealNameEl = document.getElementById("mapRevealName");
const mapRevealCloseEl = document.getElementById("mapRevealClose");

function showMapReveal(mapName) {
  const slug = mapSlug(mapName);
  if (slug) {
    mapRevealImgEl.src = `valorant_map_png/${slug}.png`;
    mapRevealImgEl.alt = mapName;
    mapRevealImgEl.style.display = "";
  } else {
    mapRevealImgEl.removeAttribute("src");
    mapRevealImgEl.style.display = "none";
  }
  mapRevealNameEl.textContent = mapName;
  // 애니메이션 재시작을 위해 클래스 토글 리플로우
  mapRevealEl.classList.remove("open");
  void mapRevealEl.offsetWidth;
  mapRevealEl.classList.add("open");
  mapRevealEl.setAttribute("aria-hidden", "false");
}

function closeMapReveal() {
  mapRevealEl.classList.remove("open");
  mapRevealEl.setAttribute("aria-hidden", "true");
}

mapRevealCloseEl.addEventListener("click", closeMapReveal);
mapRevealEl.addEventListener("click", (e) => {
  if (e.target === mapRevealEl) closeMapReveal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && mapRevealEl.classList.contains("open")) closeMapReveal();
});

// PC(버튼이 오른쪽)·모바일(버튼이 아래) 모두 맞도록 위치 표현 없이 안내
const DRAW_HINT_HTML = `<div class="draw-hint"><b>맵 뽑기</b>를 눌러<br>맵을 뽑아보세요</div>`;

function resetDraw() {
  if (isDrawing) return;

  history = [];
  usedMaps = [];
  resultText.textContent = "?";
  drawStageEl.innerHTML = DRAW_HINT_HTML;

  renderHistory();
  renderUsedMaps();
  updateModeUI();
}

drawBtn.addEventListener("click", drawMap);
resetBtn.addEventListener("click", resetDraw);
excludeModeCheckbox.addEventListener("change", updateModeUI);

// ===== 맵 제외 설정 모달 =====

const excludeMapsBtn   = document.getElementById("excludeMapsBtn");
const excludeModalEl   = document.getElementById("excludeModal");
const excludeModalCloseEl = document.getElementById("excludeModalClose");
const excludeGridEl    = document.getElementById("excludeMapGrid");
const excludeDoneBtn   = document.getElementById("excludeDoneBtn");
const excludeResetBtn  = document.getElementById("excludeResetBtn");

function renderExcludeGrid() {
  excludeGridEl.innerHTML = maps.map(m => {
    const ex = excludedMaps.has(m);
    return `
      <button class="exclude-map${ex ? " excluded" : ""}" data-map="${m}">
        <span class="exclude-map-thumb">
          <img src="valorant_map_png/${mapSlug(m)}.png" alt="">
        </span>
        <span class="exclude-map-state">${ex ? "제외됨" : "포함"}</span>
        <span class="exclude-map-name">${m}</span>
      </button>
    `;
  }).join("");

  excludeGridEl.querySelectorAll(".exclude-map").forEach(btn => {
    btn.addEventListener("click", () => {
      const m = btn.dataset.map;
      if (excludedMaps.has(m)) excludedMaps.delete(m);
      else excludedMaps.add(m);
      renderExcludeGrid();
    });
  });
}

function openExcludeModal() {
  renderExcludeGrid();
  excludeModalEl.classList.add("open");
  excludeModalEl.setAttribute("aria-hidden", "false");
}

function closeExcludeModal() {
  excludeModalEl.classList.remove("open");
  excludeModalEl.setAttribute("aria-hidden", "true");
  updateModeUI();   // 남은 맵 수 갱신
}

excludeMapsBtn.addEventListener("click", openExcludeModal);
excludeModalCloseEl.addEventListener("click", closeExcludeModal);
excludeDoneBtn.addEventListener("click", closeExcludeModal);
excludeResetBtn.addEventListener("click", () => {
  excludedMaps.clear();
  renderExcludeGrid();
});
excludeModalEl.addEventListener("click", (e) => {
  if (e.target === excludeModalEl) closeExcludeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && excludeModalEl.classList.contains("open")) closeExcludeModal();
});

renderHistory();
renderUsedMaps();
updateModeUI();

// ===== 팀짜기 =====

// Firestore roster 컬렉션에서 채워짐 (loadMembers)
let members = [];

// "다이아 1" / "초월자2" 같은 봇 표기를 "다이아1" 형태로 통일
function normalizeTier(tier) {
  return (tier || "").replace(/\s+/g, "");
}

// 티어 → 점수
const TIER_SCORE = {
  "언랭": 0,
  "아이언1": 1,  "아이언2": 2,  "아이언3": 3,
  "브론즈1": 4,  "브론즈2": 5,  "브론즈3": 6,
  "실버1": 7,    "실버2": 8,    "실버3": 9,
  "골드1": 10,   "골드2": 11,   "골드3": 12,
  "플래티넘1": 13, "플래티넘2": 14, "플래티넘3": 15,
  "다이아1": 16,  "다이아2": 17,  "다이아3": 18,   // +1씩
  "초월자1": 20,  "초월자2": 22,  "초월자3": 24,   // +2씩
  "불멸1": 26,    "불멸2": 28,    "불멸3": 30,    // +2씩
  "레디언트": 33   // +3 한 번
};

function tierScore(tier) {
  return TIER_SCORE[normalizeTier(tier)] ?? 0;
}

// 내전·5인큐 기록으로 정리한 발쫀잼 내부 티어.
// ? 표시는 유지하되 점수는 같은 티어의 -하와 동일하게 계산한다.
const INTERNAL_TIER_INFO = {
  "1":  { label: "1티어", score: 17, level: 1 },
  "2상": { label: "2티어 -상", score: 15, level: 2 },
  "2중": { label: "2티어 -중", score: 14, level: 2 },
  "2하": { label: "2티어 -하", score: 13, level: 2 },
  "2?":  { label: "2티어 ?", score: 13, level: 2 },
  "3상": { label: "3티어 -상", score: 11, level: 3 },
  "3중": { label: "3티어 -중", score: 10, level: 3 },
  "3하": { label: "3티어 -하", score: 9, level: 3 },
  "3?":  { label: "3티어 ?", score: 9, level: 3 },
  "4상": { label: "4티어 -상", score: 7, level: 4 },
  "4중": { label: "4티어 -중", score: 6, level: 4 },
  "4하": { label: "4티어 -하", score: 5, level: 4 },
  "4?":  { label: "4티어 ?", score: 5, level: 4 },
  "5상": { label: "5티어 -상", score: 3, level: 5 },
  "5중": { label: "5티어 -중", score: 2, level: 5 },
  "5하": { label: "5티어 -하", score: 1, level: 5 },
  "5?":  { label: "5티어 ?", score: 1, level: 5 }
};

function normalizeMemberName(name) {
  return (name || "").replace(/\s+/g, "");
}

const INTERNAL_TIER_ORDER = Object.fromEntries(
  Object.keys(INTERNAL_TIER_INFO).map((tier, index) => [tier, index])
);

const SCORE_MODE_GAME = "game";
const SCORE_MODE_INTERNAL = "internal";
let activeScoreMode = SCORE_MODE_GAME;

function internalTierBadgeHtml(internalTier) {
  const info = INTERNAL_TIER_INFO[internalTier];
  if (!info) {
    return `<span class="internal-tier-badge internal-tier-unknown">내부 미분류</span>`;
  }
  return `<span class="internal-tier-badge internal-tier-${info.level}">${info.label}</span>`;
}

function scoreModeLabel(scoreMode) {
  return scoreMode === SCORE_MODE_INTERNAL ? "발쫀잼 티어" : "인게임 티어";
}

function memberScore(member, scoreMode = activeScoreMode) {
  if (scoreMode === SCORE_MODE_INTERNAL) {
    return INTERNAL_TIER_INFO[member.internalTier]?.score ?? 0;
  }
  return tierScore(member.tier);
}

function memberTierBadgeHtml(member, scoreMode = activeScoreMode) {
  return scoreMode === SCORE_MODE_INTERNAL
    ? internalTierBadgeHtml(member.internalTier)
    : tierBadgeHtml(member.tier);
}

// Fisher-Yates 셔플 (배열을 직접 섞고 반환)
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getTierClass(tier) {
  if (tier.startsWith("레디언트")) return "tier-radiant";
  if (tier.startsWith("불멸"))    return "tier-immortal";
  if (tier.startsWith("초월자"))  return "tier-ascendant";
  if (tier.startsWith("다이아"))  return "tier-diamond";
  if (tier.startsWith("플래티넘")) return "tier-platinum";
  if (tier.startsWith("골드"))    return "tier-gold";
  if (tier.startsWith("실버"))    return "tier-silver";
  if (tier.startsWith("브론즈"))  return "tier-bronze";
  if (tier.startsWith("아이언"))  return "tier-iron";
  return "tier-unranked";
}

function getPosClass(pos) {
  const map = {
    "타격대": "pos-duelist",
    "감시자": "pos-sentinel",
    "척후대": "pos-initiator",
    "전략가": "pos-controller",
    "플랙스": "pos-flex",
    "플렉스": "pos-flex"
  };
  return map[pos] || "pos-flex";
}

// 정규화 티어 → valorant_tier_png 파일 슬러그
const TIER_ICON = {
  "언랭": "unranked",
  "아이언1": "iron1", "아이언2": "iron2", "아이언3": "iron3",
  "브론즈1": "bronze1", "브론즈2": "bronze2", "브론즈3": "bronze3",
  "실버1": "silver1", "실버2": "silver2", "실버3": "silver3",
  "골드1": "gold1", "골드2": "gold2", "골드3": "gold3",
  "플래티넘1": "platinum1", "플래티넘2": "platinum2", "플래티넘3": "platinum3",
  "다이아1": "diamond1", "다이아2": "diamond2", "다이아3": "diamond3",
  "초월자1": "ascendant1", "초월자2": "ascendant2", "초월자3": "ascendant3",
  "불멸1": "immortal1", "불멸2": "immortal2", "불멸3": "immortal3",
  "레디언트": "radiant"
};

function tierIcon(tier) {
  const slug = TIER_ICON[normalizeTier(tier)];
  return slug ? `valorant_tier_png/${slug}.png` : "";
}

// 티어 아이콘 + 뱃지 묶음 HTML (표시는 공백 없는 형식으로 통일: "초월자2", "다이아2")
function tierBadgeHtml(tier) {
  const icon = tierIcon(tier);
  const img = icon ? `<img class="tier-icon" src="${icon}" alt="">` : "";
  return `${img}${tierTextBadgeHtml(tier)}`;
}

function tierTextBadgeHtml(tier) {
  return `<span class="tier-badge ${getTierClass(tier)}">${escapeHtml(normalizeTier(tier))}</span>`;
}

const DEFAULT_MAX_SELECT = 10;
const selectedIndices = new Set();
let activeFilter = "all";
let activeInternalFilter = "all";
let activeSearch = "";

const memberGridEl   = document.getElementById("memberGrid");
const memberSearchEl = document.getElementById("memberSearch");
const selectedCountEl = document.getElementById("selectedCount");
// 필터 영역 배지 + 모바일 하단 편성 바 배지를 같은 내용으로 유지
const selectedCountEls = [selectedCountEl, document.getElementById("dockSelectedCount")].filter(Boolean);
const balanceTeamBtn  = document.getElementById("balanceTeamBtn");
const internalBalanceTeamBtn = document.getElementById("internalBalanceTeamBtn");
const teamBuilderNoticeEl = document.getElementById("teamBuilderNotice");
const randomTeamBtn   = document.getElementById("randomTeamBtn");
const manualTeamBtn   = document.getElementById("manualTeamBtn");
const manualSectionEl = document.getElementById("manualSection");
const manualMemberListEl = document.getElementById("manualMemberList");
const manualAChipsEl  = document.getElementById("manualAChips");
const manualBChipsEl  = document.getElementById("manualBChips");
const manualACountEl  = document.getElementById("manualACount");
const manualBCountEl  = document.getElementById("manualBCount");
const confirmManualBtn = document.getElementById("confirmManualBtn");
const savedBoardEl    = document.getElementById("savedBoard");
const teamResultEl    = document.getElementById("teamResult");
const teamAListEl    = document.getElementById("teamAList");
const teamBListEl    = document.getElementById("teamBList");
const teamScoreboardEl = document.getElementById("teamScoreboard");
const teamAMetaEl    = document.getElementById("teamAMeta");
const teamBMetaEl    = document.getElementById("teamBMeta");
const copyResultBtn  = document.getElementById("copyResultBtn");
const copyInternalTiersBtn = document.getElementById("copyInternalTiersBtn");
const saveResultBtn  = document.getElementById("saveResultBtn");

function getFilteredMembers() {
  return members.map((m, i) => ({ ...m, index: i })).filter(m => {
    const haystack = `${m.name} ${m.studentId || ""} ${m.riotId || ""}`.toLowerCase();
    const matchSearch = activeSearch === "" || haystack.includes(activeSearch.toLowerCase());
    let matchTier = true;
    if (activeFilter !== "all") {
      if (activeFilter === "실버이하") {
        matchTier = m.tier.startsWith("실버") || m.tier.startsWith("브론즈")
          || m.tier.startsWith("아이언") || m.tier === "언랭";
      } else if (activeFilter === "불멸") {
        matchTier = m.tier.startsWith("불멸") || m.tier.startsWith("레디언트");
      } else {
        matchTier = m.tier.startsWith(activeFilter);
      }
    }
    const matchInternalTier = activeInternalFilter === "all"
      || (activeInternalFilter === "unclassified"
        ? !INTERNAL_TIER_INFO[m.internalTier]
        : INTERNAL_TIER_INFO[m.internalTier]?.level === Number(activeInternalFilter));
    return matchSearch && matchTier && matchInternalTier;
  });
}

// Firebase에서 온 문자열을 innerHTML에 넣기 전에 HTML로 해석되지 않게 변환
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

function renderMemberGrid() {
  const filtered = getFilteredMembers();

  if (filtered.length === 0) {
    memberGridEl.innerHTML = `<div class="no-results">검색 결과가 없어요.</div>`;
    return;
  }

  memberGridEl.innerHTML = filtered.map(m => {
    const isSelected = selectedIndices.has(m.index);
    const posBadges  = m.positions.map(p =>
      `<span class="pos-chip ${getPosClass(p)}">${escapeHtml(p)}</span>`
    ).join("");

    // 학번·이름을 따로 감싸 모바일에서 학번을 둘째 줄로 내리고, 이름이 글자 중간에서 끊기지 않게 함
    const studentIdHtml = m.studentId ? `<span class="member-sid">${escapeHtml(m.studentId)}</span> ` : "";
    const isRecruitmentParticipant = activeRecruitmentParticipantIds?.has(m.discordId);
    const recruitmentState = activeRecruitment && (isSelected || isRecruitmentParticipant)
      ? `<span class="recruitment-selection-state ${isSelected ? "main" : "reserve"}">${isSelected ? "선택됨" : "대기"}</span>`
      : "";

    return `
      <div class="member-card${isSelected ? " selected" : ""}" data-index="${m.index}">
        <div class="member-card-top">
          <div>
            <div class="member-name">${studentIdHtml}<span class="member-name-text">${escapeHtml(m.name)}</span></div>
            ${m.riotId ? `<div class="member-riot">${escapeHtml(m.riotId)}</div>` : ""}
          </div>
          <div class="check-indicator"></div>
        </div>
        <div class="member-badges">
          ${tierBadgeHtml(m.tier)}
          ${internalTierBadgeHtml(m.internalTier)}
          ${posBadges}
          ${recruitmentState}
        </div>
      </div>
    `;
  }).join("");

  memberGridEl.querySelectorAll(".member-card").forEach(card => {
    card.addEventListener("click", () => {
      const idx = parseInt(card.dataset.index);
      // 전체를 다시 그리지 않고 누른 카드만 토글 → 그 카드의 체크 팝만 작동
      if (selectedIndices.has(idx)) {
        selectedIndices.delete(idx);
        card.classList.remove("selected");
      } else {
        if (selectedIndices.size >= currentSelectionLimit()) {
          flashSelectLimit();
          return;
        }
        selectedIndices.add(idx);
        card.classList.add("selected");
      }
      if (activeRecruitment) renderMemberGrid();
      recruitmentResultEl.classList.add("hidden");
      lastRecruitmentResult = null;
      updateSelectedCount();
    });
  });
}

function setTeamBuilderNotice(message = "") {
  teamBuilderNoticeEl.textContent = message;
  teamBuilderNoticeEl.classList.toggle("hidden", !message);
  if (message) teamBuilderNoticeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function updateSelectedCount() {
  setTeamBuilderNotice();
  const count = selectedIndices.size;
  const limit = currentSelectionLimit();

  if (activeRecruitment) {
    const ready = count === limit;
    setSelectedCountBadge(`${count} / ${limit}명 선택됨`, "at-limit", ready);
    balanceTeamBtn.disabled = !ready;
    internalBalanceTeamBtn.disabled = !ready;
    randomTeamBtn.disabled = !ready;
    manualTeamBtn.disabled = !ready || selectedTeamCount !== 2;

    const shortage = limit - count;
    recruitmentSelectionGuideEl.textContent = ready
      ? "✅ 자동 선택 완료 · 교체하려면 선택된 멤버를 먼저 해제한 뒤 다른 멤버를 선택하세요."
      : `⚠️ ${shortage}명을 더 선택해주세요. 모집에 없던 멤버도 선택할 수 있어요.`;
    recruitmentSelectionGuideEl.className = `recruitment-selection-guide ${ready ? "success" : "warning"}`;
    return;
  }

  setSelectedCountBadge(`${count} / ${DEFAULT_MAX_SELECT}명 선택됨`, "at-limit", count >= DEFAULT_MAX_SELECT);
  const canBuild = count >= 2;
  balanceTeamBtn.disabled = !canBuild;
  internalBalanceTeamBtn.disabled = count !== DEFAULT_MAX_SELECT;
  randomTeamBtn.disabled = !canBuild;
  manualTeamBtn.disabled = !canBuild;
}

function currentSelectionLimit() {
  return activeRecruitment ? selectedTeamCount * 5 : DEFAULT_MAX_SELECT;
}

function setSelectedCountBadge(text, className, enabled) {
  selectedCountEls.forEach(el => {
    el.textContent = text;
    if (className) el.classList.toggle(className, enabled);
  });
}

// 선택 가능 인원을 초과하면 잠깐 경고 표시
function flashSelectLimit() {
  const limit = currentSelectionLimit();
  setSelectedCountBadge(activeRecruitment
    ? `최대 ${limit}명입니다. 먼저 교체할 멤버를 해제해주세요!`
    : `최대 ${limit}명까지만!`, "limit-warn", true);
  clearTimeout(flashSelectLimit._t);
  flashSelectLimit._t = setTimeout(() => {
    selectedCountEls.forEach(el => el.classList.remove("limit-warn"));
    updateSelectedCount();
  }, 1200);
}

function buildTeams(method) {
  const pool = [...selectedIndices].map(i => members[i]);

  if (method === "balance") {
    pool.sort((a, b) => memberScore(b) - memberScore(a));
  } else {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  }

  const teamA = [], teamB = [];
  pool.forEach((member, i) => {
    // 스네이크 드래프트: A, B, B, A, A, B, B, A ...
    const round      = Math.floor(i / 2);
    const posInRound = i % 2;
    if (round % 2 === 0) {
      posInRound === 0 ? teamA.push(member) : teamB.push(member);
    } else {
      posInRound === 0 ? teamB.push(member) : teamA.push(member);
    }
  });

  return { teamA, teamB };
}

function teamScore(team, scoreMode = activeScoreMode) {
  return team.reduce((s, m) => s + memberScore(m, scoreMode), 0);
}

// 결과 행 왼쪽 칸: 인게임 기준은 티어 아이콘, 발쫀잼 기준은 내부 티어 숫자
function memberPortraitHtml(m, scoreMode = activeScoreMode) {
  if (scoreMode === SCORE_MODE_INTERNAL) {
    const info = INTERNAL_TIER_INFO[m.internalTier];
    return info
      ? `<span class="team-member-portrait portrait-level internal-tier-${info.level}">${info.level}</span>`
      : `<span class="team-member-portrait portrait-level internal-tier-unknown">?</span>`;
  }
  const icon = tierIcon(m.tier);
  return `<span class="team-member-portrait">${icon ? `<img class="tier-icon" src="${icon}" alt="">` : ""}</span>`;
}

// 결과 행 오른쪽 티어 글자 (아이콘은 왼쪽 칸에 있으므로 글자만)
function memberTierLabelHtml(m, scoreMode = activeScoreMode) {
  return scoreMode === SCORE_MODE_INTERNAL
    ? internalTierBadgeHtml(m.internalTier)
    : tierTextBadgeHtml(m.tier);
}

// 팀 멤버 행들의 HTML (재사용: 결과 화면 + 모달 + 대기 명단)
function teamRowsHtml(team, scoreMode = activeScoreMode) {
  return team.map(m => {
    const sid = m.studentId ? `<span class="team-member-sid">${escapeHtml(m.studentId)}</span>` : "";
    const riot = m.riotId ? `<span class="team-member-riot">${escapeHtml(m.riotId)}</span>` : "";
    const sub = sid || riot ? `<span class="team-member-sub">${sid}${riot}</span>` : "";
    return `
    <div class="team-member-row">
      ${memberPortraitHtml(m, scoreMode)}
      <div class="team-member-info">
        <span class="team-member-name">${escapeHtml(m.name)}</span>
        ${sub}
      </div>
      <span class="team-member-tier">${memberTierLabelHtml(m, scoreMode)}</span>
    </div>
  `;
  }).join("");
}

// 팀 카드 머리: "팀" + 큰 팀 글자, 오른쪽에 인원(과 점수)
function teamHeaderHtml(letter, team, scoreMode, showScore) {
  const score = showScore
    ? `<span class="team-score"><span class="team-score-num">${teamScore(team, scoreMode)}</span>점</span>`
    : "";
  return `
    <div class="team-header">
      <span class="team-label"><span class="team-word">팀</span><span class="team-letter">${letter}</span></span>
      <span class="team-header-side">${score}<span class="team-meta">${team.length}명</span></span>
    </div>
  `;
}

// 두 팀 점수를 마주 보게 놓고, 막대의 갈림점으로 얼마나 고른지 보여줌
function scoreboardHtml(sA, sB, scoreMode, withBasis = false) {
  const total = sA + sB;
  const share = total > 0 ? (sA / total) * 100 : 50;
  const basis = withBasis ? `<span class="sb-basis">${scoreModeLabel(scoreMode)} 기준</span>` : "";
  return `
    <div class="scoreboard" style="--a-share:${share.toFixed(2)}%">
      <span class="sb-side sb-a"><span class="sb-letter">A</span><span class="sb-score">${sA}</span></span>
      <span class="sb-center">
        <span class="sb-bar" aria-hidden="true"><span class="sb-fill sb-fill-a"></span><span class="sb-fill sb-fill-b"></span></span>
        <span class="sb-caption"><span class="sb-diff">점수차 ${Math.abs(sA - sB)}</span>${basis}</span>
      </span>
      <span class="sb-side sb-b"><span class="sb-score">${sB}</span><span class="sb-letter">B</span></span>
    </div>
  `;
}

// 팀 A/B 풀 상세 그리드 HTML (결과 화면과 동일한 모양)
function teamGridHtml(teamA, teamB, scoreMode = activeScoreMode) {
  return `
    <div class="team-result-grid">
      <div class="team-card card team-a-card">
        ${teamHeaderHtml("A", teamA, scoreMode, false)}
        <div class="team-member-list">${teamRowsHtml(teamA, scoreMode)}</div>
      </div>
      <div class="team-card card team-b-card">
        ${teamHeaderHtml("B", teamB, scoreMode, false)}
        <div class="team-member-list">${teamRowsHtml(teamB, scoreMode)}</div>
      </div>
    </div>
  `;
}

function teamMetaText(team, scoreMode) {
  return `${team.length}명 · ${scoreModeLabel(scoreMode)} ${teamScore(team, scoreMode)}점`;
}

function renderTeamList(container, team, scoreMode = activeScoreMode) {
  container.innerHTML = teamRowsHtml(team, scoreMode);
}

// 결과 복사용으로 마지막 팀 구성 보관
let lastTeams = { teamA: [], teamB: [], scoreMode: SCORE_MODE_GAME };

// 팀 내부를 티어 내림차순으로 정렬
function sortByTier(team, scoreMode = activeScoreMode) {
  return [...team].sort((a, b) => memberScore(b, scoreMode) - memberScore(a, scoreMode));
}

function displayTeams(teamA, teamB, scoreMode = activeScoreMode) {
  activeScoreMode = scoreMode;
  teamA = sortByTier(teamA, scoreMode);
  teamB = sortByTier(teamB, scoreMode);
  lastTeams = { teamA, teamB, scoreMode };
  const sA = teamScore(teamA, scoreMode), sB = teamScore(teamB, scoreMode);
  teamScoreboardEl.innerHTML = scoreboardHtml(sA, sB, scoreMode, true);
  teamAMetaEl.textContent = `${teamA.length}명`;
  teamBMetaEl.textContent = `${teamB.length}명`;
  renderTeamList(teamAListEl, teamA, scoreMode);
  renderTeamList(teamBListEl, teamB, scoreMode);
  teamResultEl.classList.remove("hidden");
  teamResultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// 탭 전환
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// 검색
memberSearchEl.addEventListener("input", () => {
  activeSearch = memberSearchEl.value.trim();
  renderMemberGrid();
});

// 인게임 티어 필터
document.querySelectorAll(".game-tier-filter").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".game-tier-filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.tier;
    renderMemberGrid();
  });
});

// 발쫀잼 내부 티어 필터
document.querySelectorAll(".internal-tier-filter").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".internal-tier-filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeInternalFilter = btn.dataset.internalTier;
    renderMemberGrid();
  });
});

function buildInternalTierExportText() {
  const uniqueMembers = new Map();
  members.forEach(member => {
    const nameKey = normalizeMemberName(member.name);
    uniqueMembers.set(nameKey, member);
  });

  const groupedMembers = new Map();
  [...uniqueMembers.values()]
    .filter(member => member.internalTier)
    .sort((a, b) => {
      const tierDiff = INTERNAL_TIER_ORDER[a.internalTier] - INTERNAL_TIER_ORDER[b.internalTier];
      if (tierDiff !== 0) return tierDiff;
      return a.name.localeCompare(b.name, "ko");
    })
    .forEach(member => {
      const tier = member.internalTier;
      const info = INTERNAL_TIER_INFO[tier];
      const tierLabel = tier.endsWith("?") ? info.label.replace(" ?", " -?") : info.label;
      if (!groupedMembers.has(info.level)) groupedMembers.set(info.level, []);
      groupedMembers.get(info.level).push(`${member.name} ${tierLabel}`);
    });

  return [...groupedMembers.values()]
    .map(lines => lines.join("\n"))
    .join("\n---------\n");
}

function copyTextToClipboard(text) {
  const fallbackCopy = () => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied ? Promise.resolve() : Promise.reject(new Error("copy failed"));
  };

  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(fallbackCopy);
  }
  return fallbackCopy();
}

copyInternalTiersBtn.addEventListener("click", () => {
  copyTextToClipboard(buildInternalTierExportText()).then(() => {
    copyInternalTiersBtn.textContent = "✅ 명단 복사됨!";
    setTimeout(() => { copyInternalTiersBtn.textContent = "📋 발쫀잼 티어 복사"; }, 2000);
  }).catch(() => {
    copyInternalTiersBtn.textContent = "복사 실패";
    setTimeout(() => { copyInternalTiersBtn.textContent = "📋 발쫀잼 티어 복사"; }, 2000);
  });
});

// 전체 해제

document.getElementById("deselectAllBtn").addEventListener("click", () => {
  getFilteredMembers().forEach(m => selectedIndices.delete(m.index));
  renderMemberGrid();
  updateSelectedCount();
});

// 디버그: 전체 멤버 중 아무나 10명(부족하면 있는 만큼) 즉시 선택
document.getElementById("debugPick10Btn").addEventListener("click", () => {
  selectedIndices.clear();
  const pool = shuffle(members
    .map((member, index) => ({ member, index }))
    .filter(({ member }) => !activeRecruitmentParticipantIds || activeRecruitmentParticipantIds.has(member.discordId))
    .map(({ index }) => index))
    .slice(0, currentSelectionLimit());
  pool.forEach(i => selectedIndices.add(i));
  renderMemberGrid();
  updateSelectedCount();
});

// ===== 밸런스 팀짜기: 점수차 최소인 구성 1개 (누를 때마다 새로) =====

function sumScore(ids) {
  return ids.reduce((s, i) => s + memberScore(members[i]), 0);
}

// A/B 순서·좌우 뒤집힘을 같은 구성으로 보는 키
function candidateKey(aIds, bIds) {
  const a = [...aIds].sort((x, y) => x - y).join(",");
  const b = [...bIds].sort((x, y) => x - y).join(",");
  return [a, b].sort().join("|");
}

// 무작위 분할을 많이 만들어, 점수차가 작은 "서로 다른" 구성들을 모음
function buildBalancedCandidates() {
  const ids = [...selectedIndices];
  const n = ids.length;
  const even = n % 2 === 0;
  const baseA = Math.floor(n / 2);
  const seen = new Map();

  for (let it = 0; it < 1200; it++) {
    const sh = shuffle([...ids]);
    // 홀수 인원이면 A/B 크기를 번갈아 (한 명 차이) → 더 다양하게
    const aSize = even ? baseA : (it % 2 === 0 ? baseA : baseA + 1);
    const aIds = sh.slice(0, aSize);
    const bIds = sh.slice(aSize);
    const diff = Math.abs(sumScore(aIds) - sumScore(bIds));
    const key = candidateKey(aIds, bIds);
    const prev = seen.get(key);
    if (!prev || diff < prev.diff) seen.set(key, { aIds, bIds, diff });
  }

  const all = [...seen.values()].sort((x, y) => x.diff - y.diff);
  if (!all.length) return [];

  // 최소 점수차 근처(밴드)만 남기되, 후보가 너무 적으면 밴드를 넓힘
  // 내부 티어 점수 간격을 2배로 바꿔도 기존 후보 허용 범위는 유지한다.
  const minDiff = all[0].diff;
  const scoreScale = activeScoreMode === SCORE_MODE_INTERNAL ? 2 : 1;
  let band = 6 * scoreScale;
  let near = all.filter(c => c.diff <= minDiff + band);
  while (near.length < 6 && band < 40 * scoreScale) {
    band += 6 * scoreScale;
    near = all.filter(c => c.diff <= minDiff + band);
  }
  return shuffle(near);  // 누를 때마다 다른 근접 구성
}

// ===== 밸런스 후보 모달 (3가지 + 다시 짜기) =====

const balanceModalEl     = document.getElementById("balanceModal");
const balanceModalTitleEl = document.getElementById("balanceModalTitle");
const balanceModalListEl = document.getElementById("balanceModalList");
const balanceModalCloseEl = document.getElementById("balanceModalClose");
const rerollBalanceBtn   = document.getElementById("rerollBalanceBtn");
const saveMinDiffBtn     = document.getElementById("saveMinDiffBtn");
const saveRandomBtn      = document.getElementById("saveRandomBtn");

let modalTrio = [];   // 현재 모달에 떠있는 3개 후보
let recruitmentBalanceContext = null;

// 저장된 구성 제외하고 근접 후보 3개 뽑기
function pickBalanceTrio() {
  const cands = buildBalancedCandidates();
  if (!cands.length) return [];
  const savedKeys = new Set(savedResults.map(r => r.key));
  const fresh = cands.filter(c =>
    !savedKeys.has(teamsKey(c.aIds.map(i => members[i]), c.bIds.map(i => members[i])))
  );
  const saved = cands.filter(c =>
    savedKeys.has(teamsKey(c.aIds.map(i => members[i]), c.bIds.map(i => members[i])))
  );
  return [...fresh, ...saved].slice(0, 3);
}

function renderModalTrio() {
  modalTrio = pickBalanceTrio();

  if (!modalTrio.length) {
    balanceModalListEl.innerHTML = `<div class="modal-empty">더 만들 수 있는 구성이 없어요.<br>저장 보드에서 몇 개 지우고 다시 시도해보세요.</div>`;
    syncFootButtons();
    return;
  }

  balanceModalListEl.innerHTML = modalTrio.map((c, idx) => {
    const teamA = sortByTier(c.aIds.map(i => members[i]));
    const teamB = sortByTier(c.bIds.map(i => members[i]));
    return `
      <div class="modal-option" style="animation-delay:${idx * 0.08}s" data-opt="${idx}">
        <div class="opt-head">
          <span class="opt-title">옵션 ${idx + 1}</span>
        </div>
        ${scoreboardHtml(teamScore(teamA), teamScore(teamB), activeScoreMode)}
        ${teamGridHtml(teamA, teamB)}
        <button class="primary-btn opt-save" data-opt="${idx}">이 구성 저장</button>
      </div>
    `;
  }).join("");

  balanceModalListEl.querySelectorAll(".opt-save").forEach(btn => {
    btn.addEventListener("click", () => {
      const c = modalTrio[parseInt(btn.dataset.opt)];
      if (!c) return;
      const teamA = sortByTier(c.aIds.map(i => members[i]));
      const teamB = sortByTier(c.bIds.map(i => members[i]));
      saveTeams(teamA, teamB);   // 중복/가득참은 버튼 상태로 표시
      updateModalSaveButtons();
    });
  });

  updateModalSaveButtons();
}

// 모달 저장 버튼들의 라벨/상태 갱신 (이 구성 저장 (n/5))
function updateModalSaveButtons() {
  const savedKeys = new Set(savedResults.map(r => r.key));
  const full = savedResults.length >= MAX_SAVED;

  balanceModalListEl.querySelectorAll(".opt-save").forEach(btn => {
    const c = modalTrio[parseInt(btn.dataset.opt)];
    if (!c) return;
    const key = teamsKey(c.aIds.map(i => members[i]), c.bIds.map(i => members[i]));

    if (savedKeys.has(key)) {
      btn.textContent = "✅ 저장됨";
      btn.disabled = true;
      btn.classList.add("opt-saved");
    } else if (full) {
      btn.textContent = `보드 가득참 (${savedResults.length}/${MAX_SAVED})`;
      btn.disabled = true;
      btn.classList.remove("opt-saved");
    } else {
      btn.textContent = `이 구성 저장 (${savedResults.length}/${MAX_SAVED})`;
      btn.disabled = false;
      btn.classList.remove("opt-saved");
    }
  });

  syncFootButtons();
}

// 모달 푸터의 "최저/랜덤 구성 저장" 버튼 활성/비활성 갱신
function syncFootButtons() {
  const noTrio = !modalTrio.length;
  const full = savedResults.length >= MAX_SAVED;
  [saveMinDiffBtn, saveRandomBtn].forEach(btn => {
    if (btn._flashT) return;   // 잠깐 피드백 표시 중이면 건드리지 않음
    btn.disabled = noTrio || full;
  });
}

// 모달 푸터 버튼에 잠깐 결과 메시지를 띄움
function flashFootBtn(btn, text) {
  clearTimeout(btn._flashT);
  if (btn._label === undefined) btn._label = btn.innerHTML;
  btn.innerHTML = text;
  btn.disabled = true;
  btn._flashT = setTimeout(() => {
    btn.innerHTML = btn._label;
    btn._label = undefined;
    btn._flashT = null;
    syncFootButtons();
  }, 1400);
}

// 후보 하나(c)를 보드에 저장하고 결과를 버튼에 피드백
function saveCandidate(c, btn) {
  const teamA = sortByTier(c.aIds.map(i => members[i]));
  const teamB = sortByTier(c.bIds.map(i => members[i]));
  const status = saveTeams(teamA, teamB);
  updateModalSaveButtons();
  if (status === "dup")       flashFootBtn(btn, "이미 저장된 구성!");
  else if (status === "full") flashFootBtn(btn, `최대 ${MAX_SAVED}개까지!`);
  else if (status === "ok")   flashFootBtn(btn, "✅ 저장됨!");
}

function openBalanceModal() {
  recruitmentBalanceContext = null;
  saveMinDiffBtn.classList.remove("hidden");
  saveRandomBtn.classList.remove("hidden");
  balanceModalTitleEl.textContent = activeScoreMode === SCORE_MODE_INTERNAL
    ? "🏆 발쫀잼 티어 밸런스 후보 3가지"
    : "⚖️ 인게임 티어 밸런스 후보 3가지";
  renderModalTrio();
  balanceModalEl.classList.add("open");
  balanceModalEl.setAttribute("aria-hidden", "false");
}

function closeBalanceModal() {
  balanceModalEl.classList.remove("open");
  balanceModalEl.setAttribute("aria-hidden", "true");
  recruitmentBalanceContext = null;
}

balanceTeamBtn.addEventListener("click", () => {
  setTeamBuilderNotice();
  manualSectionEl.classList.add("hidden");
  activeScoreMode = SCORE_MODE_GAME;
  if (activeRecruitment) {
    buildSelectedRecruitmentTeams(SCORE_MODE_GAME);
    return;
  }
  openBalanceModal();
});

internalBalanceTeamBtn.addEventListener("click", () => {
  const missing = [...selectedIndices]
    .map(i => members[i])
    .filter(member => !INTERNAL_TIER_INFO[member.internalTier]);
  if (missing.length) {
    setTeamBuilderNotice(
      `⚠️ 내부 티어 미분류: ${missing.map(m => m.name).join(", ")} · Discord에서 /내부티어설정 후 새로고침해주세요. 인게임 티어 밸런스는 그대로 사용할 수 있어요.`
    );
    return;
  }
  setTeamBuilderNotice();
  manualSectionEl.classList.add("hidden");
  activeScoreMode = SCORE_MODE_INTERNAL;
  if (activeRecruitment) {
    buildSelectedRecruitmentTeams(SCORE_MODE_INTERNAL);
    return;
  }
  openBalanceModal();
});

rerollBalanceBtn.addEventListener("click", () => {
  rerollBalanceBtn.classList.add("rolling");
  if (recruitmentBalanceContext) renderRecruitmentBalanceCandidates();
  else renderModalTrio();
  setTimeout(() => rerollBalanceBtn.classList.remove("rolling"), 500);
});

// 위 3개 후보 중 점수차가 가장 작은 구성을 저장
saveMinDiffBtn.addEventListener("click", () => {
  if (!modalTrio.length) return;
  const best = modalTrio.reduce((a, b) => (b.diff < a.diff ? b : a));
  saveCandidate(best, saveMinDiffBtn);
});

// 위 3개 후보 중 하나를 무작위로 저장
saveRandomBtn.addEventListener("click", () => {
  if (!modalTrio.length) return;
  const pick = modalTrio[Math.floor(Math.random() * modalTrio.length)];
  saveCandidate(pick, saveRandomBtn);
});

balanceModalCloseEl.addEventListener("click", closeBalanceModal);
// 배경(딤) 클릭 시 닫기 — 박스 안쪽 클릭은 무시
balanceModalEl.addEventListener("click", (e) => {
  if (e.target === balanceModalEl) closeBalanceModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && balanceModalEl.classList.contains("open")) closeBalanceModal();
});

randomTeamBtn.addEventListener("click", () => {
  setTeamBuilderNotice();
  manualSectionEl.classList.add("hidden");
  activeScoreMode = SCORE_MODE_GAME;
  if (activeRecruitment) {
    buildSelectedRecruitmentTeams(SCORE_MODE_GAME, false, "random");
    return;
  }
  const { teamA, teamB } = buildTeams("random");
  displayTeams(teamA, teamB, SCORE_MODE_GAME);
});

// 직접 팀짜기
const manualAssign = {}; // index -> 'A' | 'B' | null

function openManualTeam() {
  setTeamBuilderNotice();
  // 선택된 멤버만 초기화 (기존 배정 유지)
  [...selectedIndices].forEach(i => {
    if (!(i in manualAssign)) manualAssign[i] = null;
  });
  Object.keys(manualAssign).forEach(k => {
    if (!selectedIndices.has(parseInt(k))) delete manualAssign[k];
  });

  teamResultEl.classList.add("hidden");
  manualSectionEl.classList.remove("hidden");
  renderManualSection();
  manualSectionEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderManualSection() {
  const aIdx = [...selectedIndices].filter(i => manualAssign[i] === "A");
  const bIdx = [...selectedIndices].filter(i => manualAssign[i] === "B");

  manualACountEl.textContent = `${aIdx.length}명`;
  manualBCountEl.textContent = `${bIdx.length}명`;

  manualAChipsEl.innerHTML = aIdx.length
    ? aIdx.map(i => `<span class="manual-chip">${escapeHtml(members[i].name)}</span>`).join("")
    : `<span class="manual-chip-empty">없음</span>`;

  manualBChipsEl.innerHTML = bIdx.length
    ? bIdx.map(i => `<span class="manual-chip">${escapeHtml(members[i].name)}</span>`).join("")
    : `<span class="manual-chip-empty">없음</span>`;

  manualMemberListEl.innerHTML = [...selectedIndices].map(i => {
    const m = members[i];
    const assigned = manualAssign[i];
    return `
      <div class="manual-row" data-index="${i}">
        <div class="manual-row-info">
          <span class="member-name">${m.studentId ? `${escapeHtml(m.studentId)} ` : ""}${escapeHtml(m.name)}</span>
          ${tierBadgeHtml(m.tier)}
        </div>
        <div class="manual-assign-btns">
          <button class="assign-btn${assigned === "A" ? " assign-active-a" : ""}" data-team="A">A팀</button>
          <button class="assign-btn${assigned === "B" ? " assign-active-b" : ""}" data-team="B">B팀</button>
        </div>
      </div>
    `;
  }).join("");

  manualMemberListEl.querySelectorAll(".assign-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx  = parseInt(btn.closest(".manual-row").dataset.index);
      const team = btn.dataset.team;
      manualAssign[idx] = manualAssign[idx] === team ? null : team;
      renderManualSection();
    });
  });

  confirmManualBtn.disabled = aIdx.length === 0 || bIdx.length === 0;
}

manualTeamBtn.addEventListener("click", openManualTeam);

confirmManualBtn.addEventListener("click", () => {
  const teamA = [...selectedIndices].filter(i => manualAssign[i] === "A").map(i => members[i]);
  const teamB = [...selectedIndices].filter(i => manualAssign[i] === "B").map(i => members[i]);
  manualSectionEl.classList.add("hidden");
  displayTeams(teamA, teamB, SCORE_MODE_GAME);
});

// 결과 복사 (lastTeams 데이터 기반: 학번 이름 발로ID - 선택한 밸런스 티어)
function memberLine(m, scoreMode) {
  const sid = m.studentId ? `${m.studentId} ` : "";
  const riot = m.riotId ? ` ${m.riotId}` : "";
  const tierLabel = scoreMode === SCORE_MODE_INTERNAL
    ? (INTERNAL_TIER_INFO[m.internalTier]?.label || "내부 미분류")
    : normalizeTier(m.tier);
  return `  ${sid}${m.name}${riot} - ${tierLabel}`;
}

copyResultBtn.addEventListener("click", () => {
  const aRows = lastTeams.teamA.map(m => memberLine(m, lastTeams.scoreMode));
  const bRows = lastTeams.teamB.map(m => memberLine(m, lastTeams.scoreMode));

  const { teamA, teamB, scoreMode } = lastTeams;
  const text = `[${scoreModeLabel(scoreMode)} 기준]\n팀 A (${teamMetaText(teamA, scoreMode)})\n${aRows.join("\n")}\n\n팀 B (${teamMetaText(teamB, scoreMode)})\n${bRows.join("\n")}`;

  copyTextToClipboard(text).then(() => {
    copyResultBtn.textContent = "✅ 복사됨!";
    setTimeout(() => { copyResultBtn.textContent = "📋 결과 복사하기"; }, 2000);
  }).catch(() => {
    copyResultBtn.textContent = "복사 실패";
    setTimeout(() => { copyResultBtn.textContent = "📋 결과 복사하기"; }, 2000);
  });
});

// ===== 저장 보드 (최대 5개) =====

const MAX_SAVED = 5;
let savedResults = [];   // { teamA, teamB, sA, sB, diff, key, scoreMode }

function flashSaveBtn(text) {
  const old = saveResultBtn.textContent;
  saveResultBtn.textContent = text;
  saveResultBtn.disabled = true;
  setTimeout(() => {
    saveResultBtn.textContent = old;
    saveResultBtn.disabled = false;
  }, 1400);
}

// 멤버 단위 고유키(학번|이름|발로ID) 기반, A/B 좌우 뒤집힘도 같은 구성으로 취급
function teamsKey(teamA, teamB) {
  const id = m => `${m.studentId}|${m.name}|${m.riotId}`;
  const a = teamA.map(id).sort().join(",");
  const b = teamB.map(id).sort().join(",");
  return [a, b].sort().join(" / ");
}

// 보드에 저장 (중복/가득참 검사). 반환: "ok" | "dup" | "full" | "empty"
function saveTeams(teamA, teamB, scoreMode = activeScoreMode) {
  if (!teamA.length && !teamB.length) return "empty";
  const key = teamsKey(teamA, teamB);
  if (savedResults.some(r => r.key === key)) return "dup";
  if (savedResults.length >= MAX_SAVED) return "full";
  const sA = teamScore(teamA, scoreMode), sB = teamScore(teamB, scoreMode);
  savedResults.push({ teamA, teamB, sA, sB, diff: Math.abs(sA - sB), key, scoreMode });
  renderSavedBoard();
  return "ok";
}

saveResultBtn.addEventListener("click", () => {
  const status = saveTeams(lastTeams.teamA, lastTeams.teamB, lastTeams.scoreMode);
  if (status === "dup")  flashSaveBtn("이미 저장된 구성!");
  else if (status === "full") flashSaveBtn(`최대 ${MAX_SAVED}개까지!`);
  else if (status === "ok")   flashSaveBtn("✅ 저장됨!");
});

function renderSavedBoard() {
  if (savedResults.length === 0) {
    savedBoardEl.classList.add("hidden");
    savedBoardEl.innerHTML = "";
    return;
  }
  savedBoardEl.classList.remove("hidden");

  const namesOf = team => team
    .map(m => escapeHtml(`${m.studentId ? m.studentId + " " : ""}${m.name}`))
    .join(", ");

  savedBoardEl.innerHTML = `
    <div class="saved-board-head">
      <span class="saved-board-title">📋 저장된 구성</span>
      <span class="saved-board-count">${savedResults.length} / ${MAX_SAVED}</span>
    </div>
    ${savedResults.map((r, idx) => `
      <div class="saved-item card" data-idx="${idx}">
        <div class="saved-item-head">
          <span class="saved-item-title">#${idx + 1} · ${scoreModeLabel(r.scoreMode)}</span>
          <span class="opt-diff">점수차 ${r.diff}</span>
        </div>
        <div class="opt-team"><span class="opt-tag team-a-color">A · ${r.teamA.length}명 · ${r.sA}점</span> ${namesOf(r.teamA)}</div>
        <div class="opt-team"><span class="opt-tag team-b-color">B · ${r.teamB.length}명 · ${r.sB}점</span> ${namesOf(r.teamB)}</div>
        <div class="saved-item-actions">
          <button class="sm-btn secondary-btn saved-load" data-idx="${idx}">불러오기</button>
          <button class="sm-btn secondary-btn saved-del" data-idx="${idx}">삭제</button>
        </div>
      </div>
    `).join("")}
  `;

  savedBoardEl.querySelectorAll(".saved-load").forEach(btn => {
    btn.addEventListener("click", () => {
      const r = savedResults[parseInt(btn.dataset.idx)];
      if (r) displayTeams(r.teamA, r.teamB, r.scoreMode);
    });
  });
  savedBoardEl.querySelectorAll(".saved-del").forEach(btn => {
    btn.addEventListener("click", () => {
      savedResults.splice(parseInt(btn.dataset.idx), 1);
      renderSavedBoard();
    });
  });
}

// ===== Firestore 연동 =====

const reloadMembersBtn = document.getElementById("reloadMembersBtn");
const reloadRecruitmentsBtn = document.getElementById("reloadRecruitmentsBtn");
const recruitmentSelectEl = document.getElementById("recruitmentSelect");
const selectRecruitmentMembersBtn = document.getElementById("selectRecruitmentMembersBtn");
const recruitmentStatusEl = document.getElementById("recruitmentStatus");
const recruitmentTeamControlsEl = document.getElementById("recruitmentTeamControls");
const recruitmentSelectionGuideEl = document.getElementById("recruitmentSelectionGuide");
const exitRecruitmentModeBtn = document.getElementById("exitRecruitmentModeBtn");
const recruitmentResultEl = document.getElementById("recruitmentResult");
const recruitmentResultLabelEl = document.getElementById("recruitmentResultLabel");
const recruitmentResultTitleEl = document.getElementById("recruitmentResultTitle");
const recruitmentResultSummaryEl = document.getElementById("recruitmentResultSummary");
const recruitmentTeamGridEl = document.getElementById("recruitmentTeamGrid");
const recruitmentReserveListEl = document.getElementById("recruitmentReserveList");
const rerollRecruitmentTeamsBtn = document.getElementById("rerollRecruitmentTeamsBtn");
const copyRecruitmentResultBtn = document.getElementById("copyRecruitmentResultBtn");

const TOOLKIT_RECRUITMENT_COLLECTION = "toolkit_recruitments";
const MULTI_TEAM_CANDIDATE_TRIALS = 2000;
const MULTI_TEAM_COLORS = ["#ff4655", "#7c5cff", "#00c8ee", "#52d981", "#ffd166", "#ff8f70"];
const PARTY_PREFERRED_TIER_LABELS = {
  free: "자유 모집",
  unrated: "일반전",
  iron_bronze: "아이언~브론즈",
  bronze_silver: "브론즈~실버",
  silver_gold: "실버~골드",
  gold_platinum: "골드~플래티넘",
  platinum_diamond: "플래티넘~다이아",
  diamond_ascendant: "다이아~초월자",
  ascendant_immortal: "초월자~불멸",
  immortal_plus: "불멸 이상"
};

let recruitments = [];
let lastRecruitmentResult = null;
let activeRecruitment = null;
let activeRecruitmentParticipantIds = null;
let selectedTeamCount = 2;

function showMemberMessage(msg) {
  memberGridEl.innerHTML = `<div class="no-results">${msg}</div>`;
}

// config.js의 firebaseConfig가 아직 플레이스홀더인지 검사
function isConfigReady() {
  return typeof firebaseConfig !== "undefined"
    && firebaseConfig.apiKey
    && !firebaseConfig.apiKey.startsWith("YOUR_")
    && firebaseConfig.appId
    && !firebaseConfig.appId.startsWith("YOUR_");
}

function initFirebase() {
  if (typeof firebase === "undefined") return false;
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  return true;
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRecruitmentTime(value) {
  const millis = timestampMillis(value);
  if (!millis) return "시간 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(millis));
}

function recruitmentTypeLabel(recruitment) {
  if (recruitment.kind === "event") return "발쫀전";
  if (recruitment.maxMembers === 10) return "내전";
  if (recruitment.maxMembers === 5) return "5인큐";
  return "파티";
}

function recruitmentPreferredTierLabel(recruitment) {
  return PARTY_PREFERRED_TIER_LABELS[recruitment.preferredTier] || PARTY_PREFERRED_TIER_LABELS.free;
}

function recruitmentStatusLabel(recruitment) {
  if (timestampMillis(recruitment.scheduledAt) <= Date.now()) return "마감";
  if (recruitment.status === "closed") return "마감";
  if (recruitment.status === "full") return "대기 접수 중";
  return "모집 중";
}

function setRecruitmentStatus(message, tone = "") {
  recruitmentStatusEl.textContent = message;
  recruitmentStatusEl.className = `recruitment-status${tone ? ` ${tone}` : ""}`;
}

function selectedRecruitment() {
  return recruitments.find(item => item.id === recruitmentSelectEl.value) || null;
}

function recruitmentParticipantIds(recruitment) {
  const seen = new Set();
  return [...recruitment.memberIds, ...(recruitment.waitlistIds || [])].filter(id => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function resetMemberFilters() {
  activeSearch = "";
  activeFilter = "all";
  activeInternalFilter = "all";
  memberSearchEl.value = "";
  document.querySelectorAll(".game-tier-filter").forEach(button => {
    button.classList.toggle("active", button.dataset.tier === "all");
  });
  document.querySelectorAll(".internal-tier-filter").forEach(button => {
    button.classList.toggle("active", button.dataset.internalTier === "all");
  });
}

function autoSelectActiveRecruitment() {
  if (!activeRecruitment) return;
  const participantIds = recruitmentParticipantIds(activeRecruitment);
  const memberIndexById = new Map(members.map((member, index) => [member.discordId, index]));
  const targetIds = participantIds.slice(0, selectedTeamCount * 5);

  selectedIndices.clear();
  targetIds.forEach(id => {
    const index = memberIndexById.get(id);
    if (index !== undefined) selectedIndices.add(index);
  });

  recruitmentResultEl.classList.add("hidden");
  teamResultEl.classList.add("hidden");
  manualSectionEl.classList.add("hidden");
  lastRecruitmentResult = null;
  renderMemberGrid();
  updateSelectedCount();

  const missingCount = targetIds.length - selectedIndices.size;
  const candidateCount = Math.max(0, participantIds.length - selectedTeamCount * 5);
  const candidateText = candidateCount ? ` · 대기 ${candidateCount}명` : "";
  const missingText = missingCount ? ` · 기본설정 정보 없음 ${missingCount}명` : "";
  setRecruitmentStatus(
    `${participantIds.length}명 중 ${selectedIndices.size}명 자동 선택${candidateText}${missingText}`,
    missingCount ? "warning" : "success"
  );
}

function activateRecruitmentSelection() {
  const recruitment = selectedRecruitment();
  if (!recruitment) return;
  const participantIds = recruitmentParticipantIds(recruitment);

  activeRecruitment = recruitment;
  activeRecruitmentParticipantIds = new Set(participantIds);
  selectedTeamCount = Math.max(2, Math.floor(participantIds.length / 5));
  resetMemberFilters();
  recruitmentTeamControlsEl.classList.remove("hidden");
  autoSelectActiveRecruitment();
  recruitmentTeamControlsEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function exitRecruitmentMode() {
  activeRecruitment = null;
  activeRecruitmentParticipantIds = null;
  selectedTeamCount = 2;
  selectedIndices.clear();
  recruitmentTeamControlsEl.classList.add("hidden");
  recruitmentResultEl.classList.add("hidden");
  lastRecruitmentResult = null;
  resetMemberFilters();
  renderMemberGrid();
  updateSelectedCount();
}

function analyzeActiveRecruitment() {
  if (!activeRecruitment) return null;
  const participantIds = recruitmentParticipantIds(activeRecruitment);
  const selectedMembers = [...selectedIndices].map(index => members[index]);
  const selectedIds = new Set(selectedMembers.map(member => member.discordId));
  const membersByDiscordId = new Map(members.map(member => [member.discordId, member]));
  const reserves = participantIds
    .filter(id => !selectedIds.has(id))
    .map(id => ({ id, member: membersByDiscordId.get(id) || null }));

  return {
    participantIds,
    teamCount: selectedTeamCount,
    mainMembers: selectedMembers,
    reserves
  };
}

function refreshRecruitmentPreview() {
  const recruitment = selectedRecruitment();
  selectRecruitmentMembersBtn.disabled = true;

  if (!recruitment) {
    setRecruitmentStatus("모집을 선택하면 참가자를 자동으로 체크할 수 있어요.");
    return;
  }

  const participantCount = recruitmentParticipantIds(recruitment).length;
  const teamCount = Math.floor(participantCount / 5);
  if (!participantCount) {
    setRecruitmentStatus("아직 참가자가 없어요.", "warning");
    return;
  }

  selectRecruitmentMembersBtn.disabled = false;
  if (teamCount < 2) {
    setRecruitmentStatus(
      `${participantCount}명 참가 · 2팀 구성까지 ${10 - participantCount}명이 더 필요해요.`,
      "warning"
    );
    return;
  }

  const selectedCount = teamCount * 5;
  const reserveCount = participantCount - selectedCount;
  const reserveText = reserveCount ? ` · 대기 ${reserveCount}명` : "";
  setRecruitmentStatus(
    `${participantCount}명 참가 · 누르면 ${selectedCount}명이 자동 선택됩니다${reserveText}.`,
    "success"
  );
}

function renderRecruitmentOptions(previousId = "") {
  recruitmentSelectEl.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = recruitments.length ? "파티·발쫀전 모집을 선택하세요" : "불러올 모집이 없어요";
  recruitmentSelectEl.appendChild(placeholder);

  recruitments.forEach(recruitment => {
    const option = document.createElement("option");
    option.value = recruitment.id;
    const waitlistCount = recruitment.waitlistIds?.length || 0;
    const waitlistText = waitlistCount
      ? ` + 대기 ${waitlistCount}명`
      : "";
    const tierText = recruitment.kind === "party" && recruitment.maxMembers === 5
      ? ` · ${recruitmentPreferredTierLabel(recruitment)}`
      : "";
    option.textContent = `[${recruitmentTypeLabel(recruitment)}] ${recruitment.name} · 확정 ${recruitment.memberIds.length}명${waitlistText}${tierText} · ${formatRecruitmentTime(recruitment.scheduledAt)} · ${recruitmentStatusLabel(recruitment)}`;
    recruitmentSelectEl.appendChild(option);
  });

  recruitmentSelectEl.disabled = recruitments.length === 0;
  if (previousId && recruitments.some(item => item.id === previousId)) {
    recruitmentSelectEl.value = previousId;
  }
  refreshRecruitmentPreview();
}

async function loadRecruitments() {
  if (!isConfigReady() || !initFirebase()) {
    setRecruitmentStatus("Firebase 연결 설정을 확인해주세요.", "error");
    return;
  }

  const previousId = recruitmentSelectEl.value;
  reloadRecruitmentsBtn.disabled = true;
  recruitmentSelectEl.disabled = true;
  selectRecruitmentMembersBtn.disabled = true;
  setRecruitmentStatus("Discord 모집 참가자를 불러오는 중...");

  try {
    const snap = await firebase.firestore().collection(TOOLKIT_RECRUITMENT_COLLECTION).get();
    recruitments = snap.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        kind: data.kind === "event" ? "event" : "party",
        sourceId: String(data.source_id || ""),
        guildId: String(data.guild_id || ""),
        name: String(data.name || "이름 없는 모집"),
        scheduledAt: data.scheduled_at || null,
        status: String(data.status || "open"),
        maxMembers: Number(data.max_members) || null,
        memberIds: Array.isArray(data.member_ids) ? data.member_ids.map(String) : [],
        waitlistIds: Array.isArray(data.waitlist_ids) ? data.waitlist_ids.map(String) : [],
        preferredTier: String(data.preferred_tier || "free")
      };
    }).filter(recruitment =>
      recruitment.kind === "event" || [5, 10].includes(recruitment.maxMembers)
    ).sort((a, b) => timestampMillis(b.scheduledAt) - timestampMillis(a.scheduledAt));

    renderRecruitmentOptions(previousId);
    if (!recruitments.length) {
      setRecruitmentStatus("아직 불러올 파티나 발쫀전 모집이 없어요.");
    }
  } catch (error) {
    console.error("[toolkit_recruitments] 불러오기 실패:", error);
    recruitments = [];
    renderRecruitmentOptions();
    setRecruitmentStatus("모집을 불러오지 못했어요. 봇 업데이트와 Firestore 읽기 규칙을 확인해주세요.", "error");
  } finally {
    reloadRecruitmentsBtn.disabled = false;
  }
}

function multiTeamMetric(teams, scoreMode) {
  const scores = teams.map(team => teamScore(team, scoreMode));
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const deviation = scores.reduce((sum, score) => sum + Math.abs(score - average), 0);
  const sortedTeamScores = teams.map(team =>
    team.map(member => memberScore(member, scoreMode)).sort((a, b) => b - a)
  );
  let composition = 0;
  for (let slot = 0; slot < 5; slot++) {
    const slotScores = sortedTeamScores.map(scoresInTeam => scoresInTeam[slot]);
    composition += Math.max(...slotScores) - Math.min(...slotScores);
  }
  return { spread: highest - lowest, deviation, composition };
}

function compareMultiTeamMetrics(left, right) {
  return left.spread - right.spread
    || left.deviation - right.deviation
    || left.composition - right.composition;
}

function multiTeamCandidateKey(teams) {
  return teams
    .map(team => team.map(member => member.discordId).sort().join(","))
    .sort()
    .join("|");
}

function snakeMultiTeams(pool, teamCount, scoreMode) {
  const sorted = shuffle([...pool]).sort(
    (a, b) => memberScore(b, scoreMode) - memberScore(a, scoreMode)
  );
  const teams = Array.from({ length: teamCount }, () => []);
  sorted.forEach((member, index) => {
    const round = Math.floor(index / teamCount);
    const position = index % teamCount;
    const teamIndex = round % 2 === 0 ? position : teamCount - 1 - position;
    teams[teamIndex].push(member);
  });
  return teams;
}

function buildMultiTeamCandidates(pool, teamCount, scoreMode) {
  const candidates = new Map();
  const addCandidate = teams => {
    const key = multiTeamCandidateKey(teams);
    if (!candidates.has(key)) {
      candidates.set(key, { teams, key, metric: multiTeamMetric(teams, scoreMode) });
    }
  };

  addCandidate(snakeMultiTeams(pool, teamCount, scoreMode));
  for (let trial = 0; trial < MULTI_TEAM_CANDIDATE_TRIALS; trial++) {
    const shuffled = shuffle([...pool]);
    const teams = Array.from(
      { length: teamCount },
      (_, index) => shuffled.slice(index * 5, index * 5 + 5)
    );
    addCandidate(teams);
  }

  return [...candidates.values()].sort((a, b) => compareMultiTeamMetrics(a.metric, b.metric));
}

function multiTeamLabel(index) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function multiTeamGridHtml(teams, scoreMode) {
  return teams.map((team, index) => {
    const color = MULTI_TEAM_COLORS[index % MULTI_TEAM_COLORS.length];
    return `
      <div class="team-card card multi-team-card" style="--team-color:${color}">
        ${teamHeaderHtml(multiTeamLabel(index), team, scoreMode, true)}
        <div class="team-member-list">${teamRowsHtml(team, scoreMode)}</div>
      </div>
    `;
  }).join("");
}

function openRecruitmentBalanceModal(recruitment, analysis, scoreMode, reroll) {
  recruitmentBalanceContext = {
    recruitment, analysis, scoreMode, candidates: [],
    excludeKey: reroll ? lastRecruitmentResult?.candidateKey : null
  };
  modalTrio = [];
  balanceModalTitleEl.textContent = `${scoreModeLabel(scoreMode)} · ${analysis.teamCount}팀 밸런스 후보 3가지`;
  saveMinDiffBtn.classList.add("hidden");
  saveRandomBtn.classList.add("hidden");
  renderRecruitmentBalanceCandidates();
  balanceModalEl.classList.add("open");
  balanceModalEl.setAttribute("aria-hidden", "false");
}

function renderRecruitmentBalanceCandidates() {
  const context = recruitmentBalanceContext;
  if (!context) return;
  const { recruitment, analysis, scoreMode } = context;
  const all = buildMultiTeamCandidates(analysis.mainMembers, analysis.teamCount, scoreMode);
  const previousKeys = new Set(context.candidates.map(candidate => candidate.key));
  if (context.excludeKey) previousKeys.add(context.excludeKey);
  const fresh = all.filter(candidate => !previousKeys.has(candidate.key));
  const previous = all.filter(candidate => previousKeys.has(candidate.key));
  context.candidates = [...fresh, ...previous].slice(0, 3);

  if (!context.candidates.length) {
    balanceModalListEl.innerHTML = `<div class="modal-empty">팀 구성을 만들지 못했어요. 선택 인원을 확인한 뒤 다시 시도해주세요.</div>`;
    return;
  }
  balanceModalListEl.innerHTML = context.candidates.map((candidate, index) => {
    const teams = candidate.teams.map(team => sortByTier(team, scoreMode));
    return `
      <div class="modal-option" style="animation-delay:${index * 0.08}s">
        <div class="opt-head">
          <span class="opt-title">옵션 ${index + 1}</span>
          <span class="opt-diff">최대 점수차 ${candidate.metric.spread}</span>
        </div>
        <div class="team-result-grid">${multiTeamGridHtml(teams, scoreMode)}</div>
        <button class="primary-btn opt-apply" data-opt="${index}">이 구성 적용</button>
      </div>
    `;
  }).join("");
  balanceModalListEl.querySelectorAll(".opt-apply").forEach(button => {
    button.addEventListener("click", () => {
      const candidate = context.candidates[Number(button.dataset.opt)];
      if (!candidate) return;
      teamResultEl.classList.add("hidden");
      manualSectionEl.classList.add("hidden");
      renderRecruitmentResult(recruitment, analysis, candidate, scoreMode, "balance");
      closeBalanceModal();
    });
  });
}

function renderRecruitmentResult(recruitment, analysis, candidate, scoreMode, method) {
  const teams = candidate.teams.map(team => sortByTier(team, scoreMode));
  recruitmentResultLabelEl.textContent = method === "random"
    ? "🎲 모집 참가자 랜덤 편성"
    : `${scoreMode === SCORE_MODE_INTERNAL ? "🏆" : "⚖️"} ${scoreModeLabel(scoreMode)} 자동 편성`;
  recruitmentResultTitleEl.textContent = `${recruitmentTypeLabel(recruitment)} · ${recruitment.name}`;
  recruitmentResultSummaryEl.textContent = `${teams.length}팀 · 최대 점수차 ${candidate.metric.spread}점`;
  recruitmentTeamGridEl.innerHTML = multiTeamGridHtml(teams, scoreMode);

  if (analysis.reserves.length) {
    const knownReserves = analysis.reserves.filter(entry => entry.member).map(entry => entry.member);
    const unknownReserves = analysis.reserves.filter(entry => !entry.member);
    recruitmentReserveListEl.innerHTML = `
      <span class="recruitment-reserve-title">🪑 대기 ${analysis.reserves.length}명 · 현재 미선택</span>
      <div class="team-member-list">
        ${teamRowsHtml(knownReserves, scoreMode)}
        ${unknownReserves.map(entry => `
          <div class="team-member-row">
            <span class="team-member-portrait portrait-level internal-tier-unknown">?</span>
            <div class="team-member-info">
              <span class="team-member-name">정보 없는 참가자</span>
              <span class="team-member-sub"><span class="team-member-riot">Discord ID ${escapeHtml(entry.id)}</span></span>
            </div>
          </div>
        `).join("")}
      </div>
    `;
    recruitmentReserveListEl.classList.remove("hidden");
  } else {
    recruitmentReserveListEl.innerHTML = "";
    recruitmentReserveListEl.classList.add("hidden");
  }

  lastRecruitmentResult = {
    recruitment,
    analysis,
    teams,
    scoreMode,
    method,
    candidateKey: candidate.key
  };
  recruitmentResultEl.classList.remove("hidden");
  recruitmentResultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function buildSelectedRecruitmentTeams(scoreMode, reroll = false, method = "balance") {
  if (!activeRecruitment) return;
  setTeamBuilderNotice();
  const analysis = analyzeActiveRecruitment();
  const requiredCount = selectedTeamCount * 5;
  if (analysis.mainMembers.length !== requiredCount) {
    updateSelectedCount();
    return;
  }
  if (scoreMode === SCORE_MODE_INTERNAL) {
    const missing = analysis.mainMembers.filter(member => !INTERNAL_TIER_INFO[member.internalTier]);
    if (missing.length) {
      setTeamBuilderNotice(
        `⚠️ 내부 티어 미분류: ${missing.map(member => member.name).join(", ")} · Discord에서 /내부티어설정 후 새로고침해주세요.`
      );
      return;
    }
  }

  let candidate;
  if (method === "random") {
    const shuffled = shuffle([...analysis.mainMembers]);
    const teams = Array.from(
      { length: selectedTeamCount },
      (_, index) => shuffled.slice(index * 5, index * 5 + 5)
    );
    candidate = {
      teams,
      key: multiTeamCandidateKey(teams),
      metric: multiTeamMetric(teams, scoreMode)
    };
  } else {
    openRecruitmentBalanceModal(activeRecruitment, analysis, scoreMode, reroll);
    return;
  }

  teamResultEl.classList.add("hidden");
  manualSectionEl.classList.add("hidden");
  renderRecruitmentResult(activeRecruitment, analysis, candidate, scoreMode, method);
}

function buildRecruitmentResultText() {
  if (!lastRecruitmentResult) return "";
  const { recruitment, analysis, teams, scoreMode, method } = lastRecruitmentResult;
  const lines = [
    `[${recruitmentTypeLabel(recruitment)} · ${recruitment.name}]`,
    `[${method === "random" ? "랜덤" : scoreModeLabel(scoreMode)} 기준]`
  ];

  teams.forEach((team, index) => {
    lines.push("", `팀 ${multiTeamLabel(index)} (${teamScore(team, scoreMode)}점)`);
    lines.push(...team.map(member => memberLine(member, scoreMode)));
  });

  if (analysis.reserves.length) {
    lines.push("", `대기 (${analysis.reserves.length}명 · 현재 미선택)`);
    analysis.reserves.forEach(entry => {
      lines.push(entry.member ? memberLine(entry.member, scoreMode) : `  정보 없는 참가자 (${entry.id})`);
    });
  }
  return lines.join("\n");
}

recruitmentSelectEl.addEventListener("change", () => {
  if (activeRecruitment && activeRecruitment.id !== recruitmentSelectEl.value) {
    exitRecruitmentMode();
  }
  refreshRecruitmentPreview();
});
reloadRecruitmentsBtn.addEventListener("click", loadRecruitments);
selectRecruitmentMembersBtn.addEventListener("click", activateRecruitmentSelection);
exitRecruitmentModeBtn.addEventListener("click", exitRecruitmentMode);
rerollRecruitmentTeamsBtn.addEventListener("click", () => {
  if (!lastRecruitmentResult) return;
  buildSelectedRecruitmentTeams(
    lastRecruitmentResult.scoreMode,
    true,
    lastRecruitmentResult.method
  );
});
copyRecruitmentResultBtn.addEventListener("click", () => {
  copyTextToClipboard(buildRecruitmentResultText()).then(() => {
    copyRecruitmentResultBtn.textContent = "✅ 복사됨!";
    setTimeout(() => { copyRecruitmentResultBtn.textContent = "📋 결과 복사하기"; }, 2000);
  }).catch(() => {
    copyRecruitmentResultBtn.textContent = "복사 실패";
    setTimeout(() => { copyRecruitmentResultBtn.textContent = "📋 결과 복사하기"; }, 2000);
  });
});

// users 컬렉션 → 팀짜기용 members 배열
async function loadMembers() {
  if (!isConfigReady()) {
    showMemberMessage("⚙️ Firebase 설정이 필요해요. <code>config.js</code>의 apiKey·appId를 채워주세요.");
    return;
  }
  if (!initFirebase()) {
    showMemberMessage("Firebase SDK를 불러오지 못했어요. 인터넷 연결을 확인해주세요.");
    return;
  }

  showMemberMessage("멤버 불러오는 중...");
  if (reloadMembersBtn) reloadMembersBtn.disabled = true;
  copyInternalTiersBtn.disabled = true;

  try {
    const snap = await firebase.firestore().collection("users").get();
    const loaded = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (!d.name) return;
      const storedInternalTier = INTERNAL_TIER_INFO[d.internal_tier] ? d.internal_tier : null;
      loaded.push({
        discordId: String(d.discord_id || doc.id),
        name: d.name,
        studentId: d.student_id || "",
        riotId: d.riot_id || "",
        tier: d.tier || "언랭",
        internalTier: storedInternalTier,
        positions: Array.isArray(d.role) ? d.role : (d.role ? [d.role] : [])
      });
    });
    loaded.sort((a, b) => tierScore(b.tier) - tierScore(a.tier));

    members = loaded;
    selectedIndices.clear();

    if (members.length === 0) {
      showMemberMessage("등록된 멤버가 없어요. 디스코드에서 <code>/기본설정</code>을 먼저 진행해주세요.");
    } else if (activeRecruitment) {
      autoSelectActiveRecruitment();
    } else {
      renderMemberGrid();
      updateSelectedCount();
    }
    copyInternalTiersBtn.disabled = !members.some(member => member.internalTier);
    if (!activeRecruitment && recruitmentSelectEl.value) refreshRecruitmentPreview();
  } catch (e) {
    console.error("[users] 불러오기 실패:", e);
    showMemberMessage("멤버를 불러오지 못했어요. Firestore 권한(users 읽기)과 설정을 확인해주세요.");
  } finally {
    if (reloadMembersBtn) reloadMembersBtn.disabled = false;
  }
}

if (reloadMembersBtn) {
  reloadMembersBtn.addEventListener("click", loadMembers);
}

// 초기 로드
updateSelectedCount();

async function initializeTeamBuilder() {
  await loadMembers();
  await loadRecruitments();
}

initializeTeamBuilder();
