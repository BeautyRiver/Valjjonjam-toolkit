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
  renderMapList();
}

// "포함 맵" 목록은 maps 배열에서 그려 맵이 추가돼도 화면 글자가 따로 놀지 않게 함
const mapListNamesEl = document.getElementById("mapListNames");
const mapListExcludedEl = document.getElementById("mapListExcluded");

function renderMapList() {
  const included = maps.filter(map => !excludedMaps.has(map));
  const excluded = maps.filter(map => excludedMaps.has(map));
  mapListNamesEl.textContent = included.length ? included.join(", ") : "없음";
  mapListExcludedEl.textContent = excluded.length ? `제외: ${excluded.join(", ")}` : "";
  mapListExcludedEl.classList.toggle("hidden", !excluded.length);
}

// 뽑을 맵이 없을 때: 전부 수동 제외인지, 제외 모드로 다 나왔는지 구분해 해결 방법을 안내
function showNoMapsLeft() {
  if (maps.every(map => excludedMaps.has(map))) {
    resultText.textContent = "뽑을 맵 없음";
    drawStageEl.innerHTML = `<div class="draw-hint">모든 맵이 제외되어 있어요.<br><b>맵 제외 설정</b>에서 포함할 맵을 고르세요</div>`;
  } else {
    resultText.textContent = "모든 맵 완료!";
    drawStageEl.innerHTML = `<div class="draw-hint">남은 맵을 모두 뽑았어요.<br><b>초기화</b>를 누르면 처음부터 다시 뽑아요</div>`;
  }
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
    showNoMapsLeft();
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

      // 수동 제외 맵이 있어도 "남은 맵이 없음"을 기준으로 마지막 맵을 판단
      if (excludeModeCheckbox.checked && getAvailableMaps().length === 0) {
        resultText.textContent = `${pickedMap} (마지막 맵)`;
      }

      // 카드가 다 뒤집힌 직후 큰 리빌 팝업
      showMapReveal(pickedMap);
    }, DEAL_MS + FLIP_MS);
  }, SHUFFLE_MS);
}

// ===== 모달 공통 (맵 결과·맵 제외·밸런스 후보) =====
// 열면 포커스를 모달 안으로 옮기고 배경 스크롤을 막음. Tab은 모달 안에서만 돌고, 닫으면 연 버튼으로 포커스를 되돌림
const MODAL_LAYER_SELECTOR = ".modal-overlay.open, .map-reveal.open";
const modalFocusReturn = new Map();

function focusableIn(container) {
  return [...container.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")]
    .filter(el => el.offsetParent !== null);
}

function openModalLayer(overlayEl, fallbackReturnEl = null) {
  if (!modalFocusReturn.has(overlayEl)) {
    const active = document.activeElement;
    modalFocusReturn.set(overlayEl, active && active !== document.body ? active : fallbackReturnEl);
  }
  document.documentElement.classList.add("modal-open");
  const box = overlayEl.querySelector("[tabindex='-1']");
  (box || focusableIn(overlayEl)[0])?.focus({ preventScroll: true });
}

function closeModalLayer(overlayEl) {
  const othersOpen = [...document.querySelectorAll(MODAL_LAYER_SELECTOR)].some(el => el !== overlayEl);
  if (!othersOpen) document.documentElement.classList.remove("modal-open");
  const back = modalFocusReturn.get(overlayEl);
  modalFocusReturn.delete(overlayEl);
  if (back && document.contains(back) && !back.disabled) back.focus({ preventScroll: true });
}

document.addEventListener("keydown", event => {
  if (event.key !== "Tab") return;
  const layer = [...document.querySelectorAll(MODAL_LAYER_SELECTOR)].pop();
  if (!layer) return;
  const items = focusableIn(layer);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const outside = !layer.contains(document.activeElement);
  if (event.shiftKey && (outside || document.activeElement === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (outside || document.activeElement === last)) {
    event.preventDefault();
    first.focus();
  }
});

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
  openModalLayer(mapRevealEl, drawBtn);
}

function closeMapReveal() {
  if (!mapRevealEl.classList.contains("open")) return;
  mapRevealEl.classList.remove("open");
  mapRevealEl.setAttribute("aria-hidden", "true");
  closeModalLayer(mapRevealEl);
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
      <button class="exclude-map${ex ? " excluded" : ""}" data-map="${m}" aria-pressed="${ex}">
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
      excludeGridEl.querySelector(`.exclude-map[data-map="${m}"]`)?.focus();   // 다시 그려도 키보드 위치 유지
    });
  });
}

function openExcludeModal() {
  renderExcludeGrid();
  excludeModalEl.classList.add("open");
  excludeModalEl.setAttribute("aria-hidden", "false");
  openModalLayer(excludeModalEl, excludeMapsBtn);
}

function closeExcludeModal() {
  if (!excludeModalEl.classList.contains("open")) return;
  excludeModalEl.classList.remove("open");
  excludeModalEl.setAttribute("aria-hidden", "true");
  closeModalLayer(excludeModalEl);
  updateModeUI();   // 남은 맵 수·포함 맵 목록 갱신
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
      <div class="member-card${isSelected ? " selected" : ""}" data-index="${m.index}" role="checkbox" tabindex="0" aria-checked="${isSelected}">
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
      card.setAttribute("aria-checked", String(selectedIndices.has(idx)));
      if (activeRecruitment) renderMemberGrid();
      handleSelectionChange();
    });
    // 키보드로도 선택: 카드에 포커스한 뒤 Space·Enter
    card.addEventListener("keydown", event => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      const idx = card.dataset.index;
      card.click();
      memberGridEl.querySelector(`.member-card[data-index="${idx}"]`)?.focus();
    });
  });
}

// 선택이 바뀌면 이전 결과는 지금 선택과 맞지 않으므로 숨김 (직접 선택 결과는 저장 보드에서 다시 불러올 수 있음)
function handleSelectionChange() {
  endTeamEdit();
  recruitmentResultEl.classList.add("hidden");
  lastRecruitmentResult = null;
  teamResultEl.classList.add("hidden");
  updateSelectedCount();
  if (!manualSectionEl.classList.contains("hidden")) renderManualSection();
}

function setTeamBuilderNotice(message = "") {
  teamBuilderNoticeEl.textContent = message;
  teamBuilderNoticeEl.classList.toggle("hidden", !message);
  if (message) teamBuilderNoticeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// 선택이 바뀌면 이전 안내는 지움. 한도 경고가 끝난 뒤 배지만 되돌릴 때는 keepNotice로 안내를 유지
function updateSelectedCount({ keepNotice = false } = {}) {
  if (!keepNotice) setTeamBuilderNotice();
  syncManualAssign();   // 선택에서 빠진 사람의 직접 팀짜기 배정은 지움 (다시 고르면 미배정부터)
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
  // 직접 선택은 네 가지 편성 모두 2명부터 사용 (발쫀잼 티어 밸런스도 인게임 밸런스와 같은 조건)
  const canBuild = count >= 2;
  balanceTeamBtn.disabled = !canBuild;
  internalBalanceTeamBtn.disabled = !canBuild;
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
    updateSelectedCount({ keepNotice: true });
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

// 이름 아래 학번·Riot ID (결과 행·직접 팀짜기 행 공통)
function memberInfoHtml(m) {
  const sid = m.studentId ? `<span class="team-member-sid">${escapeHtml(m.studentId)}</span>` : "";
  const riot = m.riotId ? `<span class="team-member-riot">${escapeHtml(m.riotId)}</span>` : "";
  const sub = sid || riot ? `<span class="team-member-sub">${sid}${riot}</span>` : "";
  return `
      <div class="team-member-info">
        <span class="team-member-name">${escapeHtml(m.name)}</span>
        ${sub}
      </div>`;
}

// 팀 멤버 행들의 HTML (재사용: 결과 화면 + 모달 + 대기 명단)
// data-member-id는 팀 편집에서 맞바꿀 사람을 찾는 데, --i는 다시 짜기 때 한 줄씩 나눠 주는 순서에 씀
function teamRowsHtml(team, scoreMode = activeScoreMode) {
  return team.map((m, i) => `
    <div class="team-member-row" data-member-id="${escapeHtml(m.discordId)}" style="--i:${i}">
      ${memberPortraitHtml(m, scoreMode)}
      ${memberInfoHtml(m)}
      <span class="team-member-tier">${memberTierLabelHtml(m, scoreMode)}</span>
    </div>
  `).join("");
}

// 편성 방식 이름: 결과 화면·복사 문구·저장 보드에서 같은 말을 씀
const TEAM_METHOD_LABELS = { balance: "밸런스 편성", random: "랜덤 편성", manual: "직접 편성" };

// edited: 팀 편집으로 사람을 맞바꾼 결과면 "(수정됨)"을 붙임
function teamMethodLabel(method, edited = false) {
  return `${TEAM_METHOD_LABELS[method] || TEAM_METHOD_LABELS.balance}${edited ? "(수정됨)" : ""}`;
}

// 결과의 기준 문구: "밸런스 편성 · 인게임 티어 기준"
function teamBasisText(scoreMode, method, edited = false) {
  return `${teamMethodLabel(method, edited)} · ${scoreModeLabel(scoreMode)} 기준`;
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
// basisText를 주면 점수차 옆에 기준 문구를 함께 표시
function scoreboardHtml(sA, sB, basisText = "") {
  const total = sA + sB;
  const share = total > 0 ? (sA / total) * 100 : 50;
  const basis = basisText ? `<span class="sb-basis">${escapeHtml(basisText)}</span>` : "";
  return `
    <div class="scoreboard" style="--a-share:${share.toFixed(2)}%">
      <span class="sb-side sb-a"><span class="sb-letter">A</span><span class="sb-score">${sA}</span></span>
      <span class="sb-bar" aria-hidden="true"><span class="sb-fill sb-fill-a"></span><span class="sb-fill sb-fill-b"></span></span>
      <span class="sb-side sb-b"><span class="sb-score">${sB}</span><span class="sb-letter">B</span></span>
      <span class="sb-caption"><span class="sb-diff">점수차 ${Math.abs(sA - sB)}</span>${basis}</span>
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

// 복사 문구의 팀 줄: 2팀·다중팀 모두 "팀 A (5명 · 112점)"
function teamCopyHeading(label, team, scoreMode) {
  return `팀 ${label} (${team.length}명 · ${teamScore(team, scoreMode)}점)`;
}

function renderTeamList(container, team, scoreMode = activeScoreMode) {
  container.innerHTML = teamRowsHtml(team, scoreMode);
}

// 결과 복사용으로 마지막 팀 구성 보관
let lastTeams = { teamA: [], teamB: [], scoreMode: SCORE_MODE_GAME, method: "balance", edited: false };

// 팀 내부를 티어 내림차순으로 정렬
function sortByTier(team, scoreMode = activeScoreMode) {
  return [...team].sort((a, b) => memberScore(b, scoreMode) - memberScore(a, scoreMode));
}

// method: "balance" | "random" | "manual", edited: 팀 편집으로 맞바꾼 적이 있는지
function displayTeams(teamA, teamB, scoreMode = activeScoreMode, method = "balance", edited = false) {
  activeScoreMode = scoreMode;
  lastTeams = {
    teamA: sortByTier(teamA, scoreMode),
    teamB: sortByTier(teamB, scoreMode),
    scoreMode, method, edited
  };
  endTeamEdit();
  renderDirectTeams();
  teamResultEl.classList.remove("hidden");
  teamResultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// lastTeams를 화면에 그림 (팀 편집으로 맞바꾼 뒤에도 이 함수로 다시 그림)
function renderDirectTeams() {
  const { teamA, teamB, scoreMode, method, edited } = lastTeams;
  const sA = teamScore(teamA, scoreMode), sB = teamScore(teamB, scoreMode);
  teamScoreboardEl.innerHTML = scoreboardHtml(sA, sB, teamBasisText(scoreMode, method, edited));
  teamAMetaEl.textContent = `${teamA.length}명`;
  teamBMetaEl.textContent = `${teamB.length}명`;
  renderTeamList(teamAListEl, teamA, scoreMode);
  renderTeamList(teamBListEl, teamB, scoreMode);
  decorateEditRows("direct");
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
  handleSelectionChange();
});

// 디버그: 전체 멤버 중 아무나 10명(부족하면 있는 만큼) 즉시 선택
// 공개 사이트에서는 숨기고, 로컬 실행이거나 주소에 ?debug가 있을 때만 보임
const debugPick10Btn = document.getElementById("debugPick10Btn");
debugPick10Btn.hidden = !(
  ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)
  || new URLSearchParams(location.search).has("debug")
);
debugPick10Btn.addEventListener("click", () => {
  selectedIndices.clear();
  const pool = shuffle(members
    .map((member, index) => ({ member, index }))
    .filter(({ member }) => !activeRecruitmentParticipantIds || activeRecruitmentParticipantIds.has(member.discordId))
    .map(({ index }) => index))
    .slice(0, currentSelectionLimit());
  pool.forEach(i => selectedIndices.add(i));
  renderMemberGrid();
  handleSelectionChange();
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
  balanceModalListEl.classList.remove("is-dealing");   // 처음 열 때는 원래 등장 애니메이션, 다시 짜기면 이후 playDealAnimation이 다시 붙임
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
      <div class="modal-option" style="animation-delay:${idx * 0.08}s;--opt:${idx}" data-opt="${idx}">
        <div class="opt-head">
          <span class="opt-title">옵션 ${idx + 1}</span>
        </div>
        ${scoreboardHtml(teamScore(teamA), teamScore(teamB))}
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
  openModalLayer(balanceModalEl);
}

function closeBalanceModal() {
  recruitmentBalanceContext = null;
  if (!balanceModalEl.classList.contains("open")) return;
  balanceModalEl.classList.remove("open");
  balanceModalEl.setAttribute("aria-hidden", "true");
  closeModalLayer(balanceModalEl);
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

// ===== 다시 짜기 연출 =====
// 후보·결과는 바로(동기적으로) 바꾸고, 화면만 카드를 다시 나눠 주듯 보이게 함.
// 멤버 줄이 팀별로 한 줄씩 들어오고, 점수 숫자는 0부터 올라가며 멈춤. 전체 0.7초 안쪽.
// OS의 움직임 줄이기(prefers-reduced-motion) 설정과 상관없이 모두에게 같은 연출을 보여줌 (사용자 결정, 2026-11-04)

// keepClass: 후보 목록처럼 원래 등장 애니메이션이 있는 곳은 클래스를 떼는 순간 그 애니메이션이 다시 재생되므로
// 시간이 지나도 떼지 않고, 다음에 목록을 다시 그릴 때 뗌 (결과 화면은 팀 편집으로 다시 그릴 때 재생되지 않게 0.9초 뒤 뗌)
function playDealAnimation(container, { keepClass = false } = {}) {
  if (!container) return;
  container.classList.remove("is-dealing");
  void container.offsetWidth;   // 연속으로 눌러도 처음부터 다시 재생
  container.classList.add("is-dealing");
  clearTimeout(container._dealTimer);
  if (!keepClass) container._dealTimer = setTimeout(() => container.classList.remove("is-dealing"), 900);
  countUpScores(container);
}

function countUpScores(container) {
  const targets = [...container.querySelectorAll(".sb-score, .team-score-num")]
    .map(el => [el, Number(el.textContent)])
    .filter(([, value]) => Number.isFinite(value));
  if (!targets.length) return;
  const start = performance.now();
  const duration = 520;
  const tick = now => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    targets.forEach(([el, value]) => {
      if (el.isConnected) el.textContent = String(Math.round(value * eased));
    });
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

rerollBalanceBtn.addEventListener("click", () => {
  rerollBalanceBtn.classList.remove("rolling");
  void rerollBalanceBtn.offsetWidth;
  rerollBalanceBtn.classList.add("rolling");
  clearTimeout(rerollBalanceBtn._rollTimer);
  rerollBalanceBtn._rollTimer = setTimeout(() => rerollBalanceBtn.classList.remove("rolling"), 600);
  if (recruitmentBalanceContext) renderRecruitmentBalanceCandidates();
  else renderModalTrio();
  // 모바일에서 아래로 내려 본 상태여도 바뀐 후보가 바로 보이게 맨 위로
  balanceModalEl.querySelector(".modal-box")?.scrollTo({ top: 0, behavior: "smooth" });
  playDealAnimation(balanceModalListEl, { keepClass: true });
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
  displayTeams(teamA, teamB, SCORE_MODE_GAME, "random");
  playDealAnimation(teamResultEl);   // 랜덤은 누를 때마다 새로 섞이므로 같은 연출
});

// 직접 팀짜기
// 배정은 Discord ID로 기억: 멤버를 새로 불러와 정렬(인덱스)이 바뀌어도 다른 사람에게 옮겨 가지 않음
const manualAssign = {}; // discordId -> 'A' | 'B' | null

function manualAssignOf(index) {
  return manualAssign[members[index]?.discordId] ?? null;
}

// 선택된 멤버만 남기고 기존 배정은 유지
function syncManualAssign() {
  const selectedIds = new Set([...selectedIndices].map(i => members[i]?.discordId).filter(Boolean));
  selectedIds.forEach(id => {
    if (!(id in manualAssign)) manualAssign[id] = null;
  });
  Object.keys(manualAssign).forEach(id => {
    if (!selectedIds.has(id)) delete manualAssign[id];
  });
}

function openManualTeam() {
  setTeamBuilderNotice();
  syncManualAssign();
  endTeamEdit();
  teamResultEl.classList.add("hidden");
  manualSectionEl.classList.remove("hidden");
  renderManualSection();
  manualSectionEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function manualChipsHtml(indices) {
  return indices.length
    ? indices.map(i => `<span class="manual-chip">${escapeHtml(members[i].name)}</span>`).join("")
    : `<span class="manual-chip-empty">없음</span>`;
}

function renderManualSection() {
  const selected = [...selectedIndices];
  const aIdx = selected.filter(i => manualAssignOf(i) === "A");
  const bIdx = selected.filter(i => manualAssignOf(i) === "B");
  const unassigned = selected.length - aIdx.length - bIdx.length;

  manualACountEl.textContent = `${aIdx.length}명`;
  manualBCountEl.textContent = `${bIdx.length}명`;
  manualAChipsEl.innerHTML = manualChipsHtml(aIdx);
  manualBChipsEl.innerHTML = manualChipsHtml(bIdx);

  manualMemberListEl.innerHTML = selected.map(i => {
    const m = members[i];
    const assigned = manualAssignOf(i);
    const rowClass = assigned === "A" ? " assigned-a" : assigned === "B" ? " assigned-b" : "";
    return `
      <div class="manual-row${rowClass}" data-index="${i}">
        ${memberPortraitHtml(m, SCORE_MODE_GAME)}
        ${memberInfoHtml(m)}
        <div class="manual-assign-btns" role="group" aria-label="${escapeHtml(m.name)} 팀 배정">
          <button class="assign-btn${assigned === "A" ? " assign-active-a" : ""}" data-team="A" aria-pressed="${assigned === "A"}">팀 A</button>
          <button class="assign-btn${assigned === "B" ? " assign-active-b" : ""}" data-team="B" aria-pressed="${assigned === "B"}">팀 B</button>
        </div>
      </div>
    `;
  }).join("");

  manualMemberListEl.querySelectorAll(".assign-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.closest(".manual-row").dataset.index);
      const id = members[idx]?.discordId;
      if (!id) return;
      const team = btn.dataset.team;
      manualAssign[id] = manualAssign[id] === team ? null : team;
      renderManualSection();
      manualMemberListEl
        .querySelector(`.manual-row[data-index="${idx}"] .assign-btn[data-team="${team}"]`)
        ?.focus();
    });
  });

  // 배정하지 않은 사람이 남아 있으면 확정하지 않음 (말없이 빠지는 일 방지)
  confirmManualBtn.disabled = unassigned > 0 || aIdx.length === 0 || bIdx.length === 0;
  confirmManualBtn.textContent = unassigned > 0 ? `확정하기 · 미배정 ${unassigned}명` : "확정하기";
}

manualTeamBtn.addEventListener("click", openManualTeam);

confirmManualBtn.addEventListener("click", () => {
  const selected = [...selectedIndices];
  const teamA = selected.filter(i => manualAssignOf(i) === "A").map(i => members[i]);
  const teamB = selected.filter(i => manualAssignOf(i) === "B").map(i => members[i]);
  if (teamA.length + teamB.length !== selected.length) return;
  manualSectionEl.classList.add("hidden");
  displayTeams(teamA, teamB, SCORE_MODE_GAME, "manual");
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

// 직접 선택 결과 복사 문구 (모집 결과 복사와 같은 형식)
function buildTeamResultText() {
  const { teamA, teamB, scoreMode, method, edited } = lastTeams;
  const diff = Math.abs(teamScore(teamA, scoreMode) - teamScore(teamB, scoreMode));
  return [
    `[${teamBasisText(scoreMode, method, edited)} · 점수차 ${diff}점]`,
    "",
    teamCopyHeading("A", teamA, scoreMode),
    ...teamA.map(m => memberLine(m, scoreMode)),
    "",
    teamCopyHeading("B", teamB, scoreMode),
    ...teamB.map(m => memberLine(m, scoreMode))
  ].join("\n");
}

copyResultBtn.addEventListener("click", () => {
  copyTextToClipboard(buildTeamResultText()).then(() => {
    copyResultBtn.textContent = "✅ 복사됨!";
    setTimeout(() => { copyResultBtn.textContent = "📋 결과 복사하기"; }, 2000);
  }).catch(() => {
    copyResultBtn.textContent = "복사 실패";
    setTimeout(() => { copyResultBtn.textContent = "📋 결과 복사하기"; }, 2000);
  });
});

// ===== 저장 보드 (최대 5개) =====

const MAX_SAVED = 5;
let savedResults = [];   // { teamA, teamB, sA, sB, diff, key, scoreMode, method }

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
function saveTeams(teamA, teamB, scoreMode = activeScoreMode, method = "balance", edited = false) {
  if (!teamA.length && !teamB.length) return "empty";
  const key = teamsKey(teamA, teamB);
  if (savedResults.some(r => r.key === key)) return "dup";
  if (savedResults.length >= MAX_SAVED) return "full";
  const sA = teamScore(teamA, scoreMode), sB = teamScore(teamB, scoreMode);
  savedResults.push({ teamA, teamB, sA, sB, diff: Math.abs(sA - sB), key, scoreMode, method, edited });
  renderSavedBoard();
  return "ok";
}

saveResultBtn.addEventListener("click", () => {
  const status = saveTeams(lastTeams.teamA, lastTeams.teamB, lastTeams.scoreMode, lastTeams.method, lastTeams.edited);
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

  const namesOf = team => team.map(m => escapeHtml(m.name)).join(", ");
  const teamLineHtml = (letter, team) => `
        <div class="saved-team team-${letter.toLowerCase()}-card">
          <span class="saved-team-label">팀 ${letter} <span class="saved-team-count">${team.length}명</span></span>
          <span class="saved-team-names">${namesOf(team)}</span>
        </div>`;

  // 결과 화면과 같은 스코어보드·팀 색을 써서 저장한 구성을 한눈에 비교
  savedBoardEl.innerHTML = `
    <div class="saved-board-head">
      <span class="saved-board-title">💾 저장된 구성</span>
      <span class="saved-board-count">${savedResults.length} / ${MAX_SAVED}</span>
    </div>
    ${savedResults.map((r, idx) => `
      <div class="saved-item card" data-idx="${idx}">
        <div class="saved-item-head">
          <span class="saved-item-title">#${idx + 1}</span>
          <span class="saved-item-basis">${teamBasisText(r.scoreMode, r.method, r.edited)}</span>
        </div>
        ${scoreboardHtml(r.sA, r.sB)}
        <div class="saved-teams">
          ${teamLineHtml("A", r.teamA)}
          ${teamLineHtml("B", r.teamB)}
        </div>
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
      if (r) displayTeams(r.teamA, r.teamB, r.scoreMode, r.method, r.edited);
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

  endTeamEdit();
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
  endTeamEdit();
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

// 자동 선택 중에 모집을 새로고침하면: 참가자 표시(대기 배지·대기 명단)는 새 명단으로 바꾸되
// 사람이 직접 고친 선택과 팀 수는 건드리지 않고, 명단이 바뀌었으면 다시 자동 선택하는 방법을 안내
function syncActiveRecruitmentAfterReload() {
  const updated = recruitments.find(item => item.id === activeRecruitment.id);
  if (!updated) {
    setRecruitmentStatus("자동 선택 중인 모집이 목록에서 사라졌어요. 현재 선택은 그대로 두었습니다.", "warning");
    return;
  }
  const before = recruitmentParticipantIds(activeRecruitment);
  const after = recruitmentParticipantIds(updated);
  const changed = before.join(",") !== after.join(",");
  activeRecruitment = updated;
  activeRecruitmentParticipantIds = new Set(after);
  renderMemberGrid();
  updateSelectedCount({ keepNotice: true });
  setRecruitmentStatus(
    changed
      ? `참가자 명단이 바뀌었어요 (${before.length}명 → ${after.length}명). 새 명단으로 다시 고르려면 '참가자들 자동 선택'을 누르세요. 지금 선택은 그대로입니다.`
      : "모집 정보를 새로 불러왔어요. 참가자 변동이 없어 현재 선택을 유지합니다.",
    changed ? "warning" : "success"
  );
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
    if (activeRecruitment) syncActiveRecruitmentAfterReload();
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
        <div class="team-member-list" data-team-index="${index}">${teamRowsHtml(team, scoreMode)}</div>
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
  openModalLayer(balanceModalEl);
}

function renderRecruitmentBalanceCandidates() {
  const context = recruitmentBalanceContext;
  if (!context) return;
  balanceModalListEl.classList.remove("is-dealing");
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
      <div class="modal-option" style="animation-delay:${index * 0.08}s;--opt:${index}">
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
  lastRecruitmentResult = {
    recruitment,
    analysis,
    teams: candidate.teams.map(team => sortByTier(team, scoreMode)),
    scoreMode,
    method,
    edited: false,
    candidateKey: candidate.key
  };
  endTeamEdit();
  renderRecruitmentTeams();

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

  recruitmentResultEl.classList.remove("hidden");
  recruitmentResultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// lastRecruitmentResult의 팀·제목·요약을 그림 (팀 편집으로 맞바꾼 뒤에도 이 함수로 다시 그림)
function renderRecruitmentTeams() {
  const { recruitment, teams, scoreMode, method, edited } = lastRecruitmentResult;
  const icon = method === "random" ? "🎲" : scoreMode === SCORE_MODE_INTERNAL ? "🏆" : "⚖️";
  recruitmentResultLabelEl.textContent = `${icon} ${teamBasisText(scoreMode, method, edited)}`;
  recruitmentResultTitleEl.textContent = `${recruitmentTypeLabel(recruitment)} · ${recruitment.name}`;
  recruitmentResultSummaryEl.textContent = `${teams.length}팀 · 최대 점수차 ${multiTeamMetric(teams, scoreMode).spread}점`;
  recruitmentTeamGridEl.innerHTML = multiTeamGridHtml(teams, scoreMode);
  decorateEditRows("recruitment");
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
  playDealAnimation(recruitmentResultEl);   // 여기까지 오는 것은 랜덤 편성뿐: 누를 때마다 새로 섞임
}

function buildRecruitmentResultText() {
  if (!lastRecruitmentResult) return "";
  const { recruitment, analysis, teams, scoreMode, method, edited } = lastRecruitmentResult;
  const spread = multiTeamMetric(teams, scoreMode).spread;
  const lines = [
    `[${recruitmentTypeLabel(recruitment)} · ${recruitment.name}]`,
    `[${teamBasisText(scoreMode, method, edited)} · 최대 점수차 ${spread}점]`
  ];

  teams.forEach((team, index) => {
    lines.push("", teamCopyHeading(multiTeamLabel(index), team, scoreMode));
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

// ===== 팀 편집 (완성된 결과에서 두 사람 맞바꾸기) =====
// 한 명을 누른 뒤 다른 팀 사람을 누르면 맞바꿈. 같은 팀 사람을 누르면 선택만 바뀜.
// 맞바꿀 때마다 점수·점수차를 다시 계산하고, 편성 방식에 "(수정됨)"을 붙임. 인원이 달라지지 않도록 이동은 없고 맞바꾸기만.
const editTeamsBtn = document.getElementById("editTeamsBtn");
const undoTeamSwapBtn = document.getElementById("undoTeamSwapBtn");
const teamEditHintEl = document.getElementById("teamEditHint");
const editRecruitmentTeamsBtn = document.getElementById("editRecruitmentTeamsBtn");
const undoRecruitmentSwapBtn = document.getElementById("undoRecruitmentSwapBtn");
const recruitmentTeamEditHintEl = document.getElementById("recruitmentTeamEditHint");

// target: "direct"(직접 선택 2팀) | "recruitment"(모집 결과). picked: { teamIndex, memberId }
const teamEditState = { target: null, picked: null, history: [], lastSwap: null, startSpread: 0, startEdited: false };

function getTeamEditor(target) {
  if (target === "direct") {
    return {
      root: teamResultEl,
      editBtn: editTeamsBtn,
      undoBtn: undoTeamSwapBtn,
      hintEl: teamEditHintEl,
      diffLabel: "점수차",
      teams: () => [lastTeams.teamA, lastTeams.teamB],
      scoreMode: () => lastTeams.scoreMode,
      edited: () => lastTeams.edited,
      setTeams: (teams, edited) => {
        lastTeams.teamA = sortByTier(teams[0], lastTeams.scoreMode);
        lastTeams.teamB = sortByTier(teams[1], lastTeams.scoreMode);
        lastTeams.edited = edited;
      },
      render: renderDirectTeams
    };
  }
  return {
    root: recruitmentTeamGridEl,
    editBtn: editRecruitmentTeamsBtn,
    undoBtn: undoRecruitmentSwapBtn,
    hintEl: recruitmentTeamEditHintEl,
    diffLabel: "최대 점수차",
    teams: () => lastRecruitmentResult?.teams || [],
    scoreMode: () => lastRecruitmentResult?.scoreMode,
    edited: () => Boolean(lastRecruitmentResult?.edited),
    setTeams: (teams, edited) => {
      const scoreMode = lastRecruitmentResult.scoreMode;
      lastRecruitmentResult.teams = teams.map(team => sortByTier(team, scoreMode));
      lastRecruitmentResult.candidateKey = multiTeamCandidateKey(lastRecruitmentResult.teams);
      lastRecruitmentResult.edited = edited;
    },
    render: renderRecruitmentTeams
  };
}

function teamsSpread(teams, scoreMode) {
  if (!teams.length) return 0;
  const scores = teams.map(team => teamScore(team, scoreMode));
  return Math.max(...scores) - Math.min(...scores);
}

// 편집 중인 결과의 멤버 줄에 버튼 역할·선택·방금 바뀜 표시를 붙이거나 뗌 (다시 그릴 때마다 호출)
function decorateEditRows(target) {
  const root = getTeamEditor(target).root;
  const editing = teamEditState.target === target;
  root.classList.toggle("is-editing", editing);
  root.querySelectorAll("[data-team-index] .team-member-row").forEach(row => {
    const id = row.dataset.memberId;
    const picked = editing && teamEditState.picked?.memberId === id;
    row.classList.toggle("is-picked", picked);
    row.classList.toggle("just-swapped", editing && !picked && Boolean(teamEditState.lastSwap?.includes(id)));
    if (editing) {
      row.setAttribute("role", "button");
      row.tabIndex = 0;
      row.setAttribute("aria-pressed", String(picked));
    } else {
      row.removeAttribute("role");
      row.removeAttribute("tabindex");
      row.removeAttribute("aria-pressed");
    }
  });
}

function teamEditHintText(editor) {
  const { picked, history } = teamEditState;
  if (picked) {
    const member = editor.teams().flat().find(m => m.discordId === picked.memberId);
    return `${member?.name ?? ""} 선택됨 · 다른 팀에서 맞바꿀 사람을 누르세요. 다시 누르면 선택을 취소합니다.`;
  }
  if (!history.length) return "바꿀 사람을 누른 뒤, 다른 팀에서 맞바꿀 사람을 누르세요.";
  const last = history[history.length - 1];
  const now = teamsSpread(editor.teams(), editor.scoreMode());
  return `${last.names[0]} ↔ ${last.names[1]} 교체 · ${editor.diffLabel} ${teamEditState.startSpread} → ${now} · 맞바꾼 횟수 ${history.length}`;
}

function updateTeamEditControls() {
  ["direct", "recruitment"].forEach(target => {
    const editor = getTeamEditor(target);
    const editing = teamEditState.target === target;
    editor.editBtn.textContent = editing ? "✅ 편집 완료" : "✏️ 팀 편집";
    editor.editBtn.setAttribute("aria-pressed", String(editing));
    editor.undoBtn.hidden = !editing;
    editor.undoBtn.disabled = !editing || !teamEditState.history.length;
    editor.hintEl.hidden = !editing;
    editor.hintEl.textContent = editing ? teamEditHintText(editor) : "";
  });
}

function startTeamEdit(target) {
  endTeamEdit();
  const editor = getTeamEditor(target);
  if (!editor.teams().length) return;
  Object.assign(teamEditState, {
    target,
    picked: null,
    history: [],
    lastSwap: null,
    startSpread: teamsSpread(editor.teams(), editor.scoreMode()),
    startEdited: editor.edited()
  });
  decorateEditRows(target);
  updateTeamEditControls();
}

// 편집 종료: 결과가 바뀌거나 숨겨질 때도 호출해 편집 표시가 남지 않게 함
function endTeamEdit() {
  const target = teamEditState.target;
  Object.assign(teamEditState, { target: null, picked: null, history: [], lastSwap: null });
  if (target) decorateEditRows(target);
  updateTeamEditControls();
}

function activateEditRow(target, row) {
  const editor = getTeamEditor(target);
  const teamIndex = Number(row.closest("[data-team-index]")?.dataset.teamIndex);
  const memberId = row.dataset.memberId;
  if (!Number.isInteger(teamIndex) || !memberId) return;

  const picked = teamEditState.picked;
  if (!picked || picked.teamIndex === teamIndex) {
    // 첫 선택, 같은 팀 다른 사람으로 선택 변경, 같은 사람 다시 누르면 취소
    teamEditState.picked = picked?.memberId === memberId ? null : { teamIndex, memberId };
    teamEditState.lastSwap = null;
    decorateEditRows(target);
    updateTeamEditControls();
    return;
  }

  const before = editor.teams().map(team => [...team]);
  const teams = editor.teams().map(team => [...team]);
  const from = teams[picked.teamIndex];
  const to = teams[teamIndex];
  const fromIndex = from.findIndex(m => m.discordId === picked.memberId);
  const toIndex = to.findIndex(m => m.discordId === memberId);
  if (fromIndex < 0 || toIndex < 0) return;
  const a = from[fromIndex];
  const b = to[toIndex];
  from[fromIndex] = b;
  to[toIndex] = a;

  teamEditState.history.push({ before, names: [a.name, b.name], ids: [a.discordId, b.discordId] });
  teamEditState.picked = null;
  teamEditState.lastSwap = [a.discordId, b.discordId];
  editor.setTeams(teams, true);
  editor.render();
  updateTeamEditControls();
  // 키보드로 바꿨다면 옮겨 간 사람에게 포커스를 둬서 위치를 잃지 않게
  editor.root.querySelector(`.team-member-row[data-member-id="${CSS.escape(a.discordId)}"]`)?.focus({ preventScroll: true });
}

function undoTeamSwap() {
  const target = teamEditState.target;
  if (!target) return;
  const last = teamEditState.history.pop();
  if (!last) return;
  const editor = getTeamEditor(target);
  teamEditState.picked = null;
  teamEditState.lastSwap = last.ids;
  editor.setTeams(last.before, teamEditState.history.length ? true : teamEditState.startEdited);
  editor.render();
  updateTeamEditControls();
}

["direct", "recruitment"].forEach(target => {
  const { root, editBtn, undoBtn } = getTeamEditor(target);
  editBtn.addEventListener("click", () => {
    if (teamEditState.target === target) endTeamEdit();
    else startTeamEdit(target);
  });
  undoBtn.addEventListener("click", undoTeamSwap);
  root.addEventListener("click", event => {
    if (teamEditState.target !== target) return;
    const row = event.target.closest("[data-team-index] .team-member-row");
    if (row && root.contains(row)) activateEditRow(target, row);
  });
  root.addEventListener("keydown", event => {
    if (teamEditState.target !== target || (event.key !== "Enter" && event.key !== " ")) return;
    const row = event.target.closest?.("[data-team-index] .team-member-row");
    if (!row || !root.contains(row)) return;
    event.preventDefault();
    activateEditRow(target, row);
  });
});

// Esc: 고른 사람이 있으면 선택만 취소 (모달이 열려 있으면 모달 닫기가 우선)
document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || !teamEditState.picked || document.querySelector(MODAL_LAYER_SELECTOR)) return;
  teamEditState.picked = null;
  decorateEditRows(teamEditState.target);
  updateTeamEditControls();
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

    // 새로고침 전 선택(모집 모드의 교체 포함)을 Discord ID로 기억해 새 목록에서 다시 체크
    const previousSelectedIds = [...selectedIndices].map(i => members[i]?.discordId).filter(Boolean);
    members = loaded;
    selectedIndices.clear();

    if (members.length === 0) {
      showMemberMessage("등록된 멤버가 없어요. 디스코드에서 <code>/기본설정</code>을 먼저 진행해주세요.");
    } else if (activeRecruitment && !previousSelectedIds.length) {
      autoSelectActiveRecruitment();
    } else {
      const indexById = new Map(members.map((member, index) => [member.discordId, index]));
      previousSelectedIds.forEach(id => {
        const index = indexById.get(id);
        if (index !== undefined && selectedIndices.size < currentSelectionLimit()) selectedIndices.add(index);
      });
      renderMemberGrid();
      updateSelectedCount();
      if (!manualSectionEl.classList.contains("hidden")) renderManualSection();
      const lost = previousSelectedIds.length - selectedIndices.size;
      if (activeRecruitment) {
        setRecruitmentStatus(
          lost
            ? `멤버 정보를 새로 불러왔어요. ${lost}명은 멤버 목록에서 찾지 못해 선택에서 빠졌어요.`
            : "멤버 정보를 새로 불러왔어요. 교체한 멤버를 포함해 현재 선택을 그대로 유지합니다.",
          lost ? "warning" : "success"
        );
      } else if (lost) {
        setTeamBuilderNotice(`⚠️ 새로고침 후 ${lost}명을 멤버 목록에서 찾지 못해 선택에서 뺐어요.`);
      }
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
