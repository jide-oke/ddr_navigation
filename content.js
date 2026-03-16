(() => {
  const DIRECTIONS = ["left", "down", "up", "right"];
  const ARROW_KEY_TO_DIR = {
    ArrowLeft: "left",
    ArrowDown: "down",
    ArrowUp: "up",
    ArrowRight: "right"
  };
  const DIRECTION_KEY_IMAGE_PATHS = {
    left: "assets/ddr-keys/left.png",
    down: "assets/ddr-keys/down.png",
    up: "assets/ddr-keys/up.png",
    right: "assets/ddr-keys/right.png"
  };
  const DEFAULT_COMBO_WINDOW_MS = 600;
  const MIN_COMBO_WINDOW_MS = 200;
  const MAX_COMBO_WINDOW_MS = 10000;
  const DISPLAY_LABEL_MAX_CHARS = 28;

  // ---------- Overlay ----------
  const overlay = document.createElement("div");
  overlay.id = "ddr-receptors-overlay";
  overlay.setAttribute("aria-hidden", "true");

  overlay.innerHTML = `
    <div class="ddr-panel">
      <div class="ddr-combo-window" aria-hidden="true">
        <div class="ddr-combo-window-fill"></div>
      </div>
      <div class="ddr-receptors">
        <div class="ddr-receptor" data-dir="left">
          <div class="ddr-choice ddr-empty" data-role="choice"></div>
          ${directionalKeyImage("left")}
        </div>
        <div class="ddr-receptor" data-dir="down">
          <div class="ddr-choice ddr-empty" data-role="choice"></div>
          ${directionalKeyImage("down")}
        </div>
        <div class="ddr-receptor" data-dir="up">
          <div class="ddr-choice ddr-empty" data-role="choice"></div>
          ${directionalKeyImage("up")}
        </div>
        <div class="ddr-receptor" data-dir="right">
          <div class="ddr-choice ddr-empty" data-role="choice"></div>
          ${directionalKeyImage("right")}
        </div>
      </div>
      <div class="ddr-current-choice ddr-hidden" aria-live="polite"></div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #ddr-receptors-overlay{
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483647;
      pointer-events: none;
      opacity: 0;
      transform: translateY(-6px);
      transition: opacity 180ms ease, transform 180ms ease;
    }
    #ddr-receptors-overlay.ddr-visible{
      opacity: 1;
      transform: translateY(0);
    }
    .ddr-panel{
      display: grid;
      gap: 6px;
    }
    .ddr-combo-window{
      height: 4px;
      border-radius: 999px;
      background: rgba(255,255,255,0.24);
      overflow: hidden;
      opacity: 0;
      transition: opacity 90ms ease;
    }
    .ddr-combo-window.ddr-active{
      opacity: 1;
    }
    .ddr-combo-window-fill{
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, rgba(105,255,198,0.95), rgba(75,188,255,0.95));
      transform-origin: left center;
      transform: scaleX(0);
      will-change: transform;
    }
    .ddr-receptors{
      display: inline-flex;
      gap: 8px;
      padding: 10px;
      border-radius: 14px;
      background: rgba(0,0,0,0.35);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
    .ddr-current-choice{
      min-height: 20px;
      margin-top: 4px;
      padding: 2px 6px;
      text-align: center;
      color: rgba(255,255,255,0.95);
      font: 700 28px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      -webkit-text-stroke: 2px rgba(0,0,0,0.98);
      paint-order: stroke fill;
      opacity: 1;
      transform: translateY(0);
      transition: opacity 120ms ease, transform 120ms ease;
      text-shadow: 0 1px 2px rgba(0,0,0,0.45);
    }
    .ddr-current-choice.ddr-loading{
      color: transparent;
      background: linear-gradient(
        90deg,
        rgba(87,180,255,0.98) 0%,
        rgba(121,131,255,0.98) 18%,
        rgba(196,108,255,0.98) 36%,
        rgba(255,112,196,0.98) 54%,
        rgba(255,164,96,0.98) 72%,
        rgba(255,220,115,0.98) 86%,
        rgba(126,242,172,0.98) 100%
      );
      background-size: 220% 100%;
      background-position: calc((1 - var(--ddr-load-ratio-2x, 0)) * 180%) 0;
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .ddr-current-choice.ddr-hidden{
      opacity: 0;
      transform: translateY(-2px);
    }
    .ddr-receptor{
      width: clamp(84px, 16vw, 122px);
      min-height: 68px;
      padding: 6px 8px 8px;
      border-radius: 12px;
      background: rgba(255,255,255,0.10);
      border: 2px solid rgba(255,255,255,0.55);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      perspective: 500px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
      transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
    }
    .ddr-choice{
      width: 100%;
      min-height: 16px;
      padding: 2px 6px;
      border-radius: 8px;
      background: rgba(0,0,0,0.26);
      color: rgba(255,255,255,0.96);
      font: 600 10px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transform-origin: 50% 0%;
      backface-visibility: hidden;
      -webkit-font-smoothing: antialiased;
    }
    .ddr-choice.ddr-empty{
      opacity: 0.25;
      background: rgba(0,0,0,0.16);
    }
    .ddr-choice.ddr-roll{
      animation: ddr-roll 220ms ease;
    }
    @keyframes ddr-roll {
      0% { transform: rotateX(-88deg); opacity: 0; }
      100% { transform: rotateX(0deg); opacity: 1; }
    }
    .ddr-key-image{
      width: 36px;
      height: 36px;
      object-fit: contain;
      opacity: 0.95;
      filter: drop-shadow(0 2px 2px rgba(0,0,0,0.35));
    }
    .ddr-receptor.ddr-active{
      background: rgba(0,255,180,0.65);
      border-color: rgba(255,255,255,0.85);
      transform: scale(1.12);
    }
  `;

  document.documentElement.appendChild(style);
  document.documentElement.appendChild(overlay);
  const comboWindowEl = overlay.querySelector(".ddr-combo-window");
  const comboWindowFillEl = overlay.querySelector(".ddr-combo-window-fill");
  const currentChoiceEl = overlay.querySelector(".ddr-current-choice");

  // ---------- URL mappings ----------
  let rawUrls = {};
  let rawNames = {};
  let rawOpenInNewTab = {};
  let legacyGlobalOpenInNewTab = false;
  let comboWindowMs = DEFAULT_COMBO_WINDOW_MS;
  let bindings = new Map();
  let prefixes = new Set();
  const shownChoices = Object.fromEntries(DIRECTIONS.map((dir) => [dir, ""]));
  let comboWindowRafId = null;

  function normalizeComboWindowMs(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_COMBO_WINDOW_MS;
    return Math.min(MAX_COMBO_WINDOW_MS, Math.max(MIN_COMBO_WINDOW_MS, Math.round(n)));
  }

  function normalizeSequenceKey(value) {
    const cleaned = String(value || "")
      .toLowerCase()
      .replace(/arrow/g, "")
      .replace(/←/g, "left")
      .replace(/↓/g, "down")
      .replace(/↑/g, "up")
      .replace(/→/g, "right")
      .trim();

    if (!cleaned) return "";

    const parts = cleaned
      .split(/[\s,>+|/\\-]+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (!parts.length || parts.some((part) => !DIRECTIONS.includes(part))) return "";

    return parts.join(",");
  }

  function rebuildBindings() {
    const nextBindings = new Map();
    const nextPrefixes = new Set();
    const normalizedNames = new Map();
    const normalizedOpenInNewTab = new Set();

    for (const [rawKey, rawLabel] of Object.entries(rawNames)) {
      const key = normalizeSequenceKey(rawKey);
      const label = clipLabel(String(rawLabel || "").trim());
      if (!key || !label) continue;
      normalizedNames.set(key, label);
    }

    for (const [rawKey, rawOpen] of Object.entries(rawOpenInNewTab)) {
      if (!rawOpen) continue;
      const key = normalizeSequenceKey(rawKey);
      if (!key) continue;
      normalizedOpenInNewTab.add(key);
    }

    const useLegacyGlobal = legacyGlobalOpenInNewTab && normalizedOpenInNewTab.size === 0;

    for (const [rawKey, rawTarget] of Object.entries(rawUrls)) {
      const target = String(rawTarget || "").trim();
      const key = normalizeSequenceKey(rawKey);
      if (!key || !target) continue;
      nextBindings.set(key, {
        url: target,
        label: normalizedNames.get(key) || "",
        openInNewTab: normalizedOpenInNewTab.has(key) || useLegacyGlobal
      });
    }

    for (const key of nextBindings.keys()) {
      const parts = key.split(",");
      for (let i = 1; i < parts.length; i += 1) {
        nextPrefixes.add(parts.slice(0, i).join(","));
      }
    }

    bindings = nextBindings;
    prefixes = nextPrefixes;
  }

  function clipLabel(text) {
    if (text.length <= DISPLAY_LABEL_MAX_CHARS) return text;
    return `${text.slice(0, DISPLAY_LABEL_MAX_CHARS - 1)}...`;
  }

  function formatTargetLabel(target) {
    const value = String(target || "").trim();
    if (!value) return "";

    try {
      const parsed = new URL(value);
      const host = parsed.hostname.replace(/^www\./, "");
      const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
      return clipLabel(`${host}${path}`);
    } catch {
      return clipLabel(value);
    }
  }

  function getEntryLabel(entry) {
    if (!entry) return "";
    if (entry.label) return clipLabel(entry.label);
    return formatTargetLabel(entry.url);
  }

  function setChoiceLabel(dir, label, animate = false) {
    const next = (label || "").toUpperCase();
    const el = overlay.querySelector(`.ddr-receptor[data-dir="${dir}"] .ddr-choice`);
    if (!el) return;

    const changed = shownChoices[dir] !== next;
    shownChoices[dir] = next;
    el.textContent = next || " ";
    el.classList.toggle("ddr-empty", !next);

    if (animate && changed) {
      el.classList.remove("ddr-roll");
      void el.offsetWidth;
      el.classList.add("ddr-roll");
    }
  }

  function renderChoices(prefixParts, animate = false) {
    for (const dir of DIRECTIONS) {
      const key = [...prefixParts, dir].join(",");
      const entry = bindings.get(key) || null;
      setChoiceLabel(dir, getEntryLabel(entry), animate);
    }
  }

  async function loadUrls() {
    const data = await chrome.storage.sync.get([
      "ddrNavUrls",
      "ddrNavNames",
      "ddrNavOpenInNewTab",
      "ddrNavSettings"
    ]);
    rawUrls = { ...(data.ddrNavUrls || {}) };
    rawNames = { ...(data.ddrNavNames || {}) };
    rawOpenInNewTab = { ...(data.ddrNavOpenInNewTab || {}) };
    legacyGlobalOpenInNewTab = Boolean(data.ddrNavSettings?.openInNewTab);
    comboWindowMs = normalizeComboWindowMs(data.ddrNavSettings?.comboWindowMs);
    rebuildBindings();
    renderChoices([], false);
  }
  loadUrls();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    let needsRebuild = false;
    if (changes.ddrNavUrls) {
      rawUrls = { ...(changes.ddrNavUrls.newValue || {}) };
      needsRebuild = true;
    }
    if (changes.ddrNavNames) {
      rawNames = { ...(changes.ddrNavNames.newValue || {}) };
      needsRebuild = true;
    }
    if (changes.ddrNavOpenInNewTab) {
      rawOpenInNewTab = { ...(changes.ddrNavOpenInNewTab.newValue || {}) };
      needsRebuild = true;
    }
    if (changes.ddrNavSettings) {
      legacyGlobalOpenInNewTab = Boolean(changes.ddrNavSettings.newValue?.openInNewTab);
      comboWindowMs = normalizeComboWindowMs(changes.ddrNavSettings.newValue?.comboWindowMs);
      needsRebuild = true;
    }

    if (needsRebuild) {
      rebuildBindings();
      renderChoices(state.sequence, false);
      renderCurrentSequenceChoice();
    }
  });

  // ---------- Key state ----------
  const state = {
    meta: false,
    shift: false,
    y: false,
    sequence: [],
    sequenceTimer: null,
    navigating: false,
    navigationTimer: null
  };

  function comboHeld() {
    return state.meta && state.shift && state.y;
  }

  function modifiersHeld() {
    return state.meta && state.shift;
  }

  function show() {
    overlay.classList.add("ddr-visible");
    renderChoices(state.sequence, false);
    renderCurrentSequenceChoice();
  }

  function hide() {
    overlay.classList.remove("ddr-visible");
    overlay.querySelectorAll(".ddr-receptor").forEach((el) => el.classList.remove("ddr-active"));
    hideComboWindow();
    setCurrentChoiceLabel("");
  }

  function clearSequenceTimer() {
    if (state.sequenceTimer) {
      clearTimeout(state.sequenceTimer);
      state.sequenceTimer = null;
    }
    hideComboWindow();
  }

  function hideComboWindow() {
    if (comboWindowRafId) {
      cancelAnimationFrame(comboWindowRafId);
      comboWindowRafId = null;
    }
    comboWindowEl?.classList.remove("ddr-active");
    if (comboWindowFillEl) {
      comboWindowFillEl.style.transform = "scaleX(0)";
    }
  }

  function setCurrentChoiceProgress(progressRatio) {
    if (!currentChoiceEl) return;
    const ratio = Math.min(1, Math.max(0, Number(progressRatio) || 0));
    const twoPassRatio = ratio >= 1 ? 1 : (ratio * 2) % 1;
    currentChoiceEl.style.setProperty("--ddr-load-ratio-2x", twoPassRatio.toFixed(3));
    currentChoiceEl.style.setProperty("--ddr-load-ratio", ratio.toFixed(3));
    currentChoiceEl.style.setProperty("--ddr-load-progress", `${(ratio * 100).toFixed(2)}%`);
  }

  function startComboWindow(durationMs) {
    hideComboWindow();
    if (!comboWindowEl || !comboWindowFillEl || durationMs <= 0) return;

    comboWindowEl.classList.add("ddr-active");
    const startedAt = performance.now();
    comboWindowFillEl.style.transform = "scaleX(1)";
    setCurrentChoiceProgress(0);

    const tick = (now) => {
      const elapsed = now - startedAt;
      const remaining = Math.max(0, durationMs - elapsed);
      const progress = remaining / durationMs;
      comboWindowFillEl.style.transform = `scaleX(${progress})`;
      setCurrentChoiceProgress(1 - progress);

      if (remaining > 0) {
        comboWindowRafId = requestAnimationFrame(tick);
      } else {
        setCurrentChoiceProgress(1);
        comboWindowRafId = null;
      }
    };

    comboWindowRafId = requestAnimationFrame(tick);
  }

  function clearNavigationTimer() {
    if (state.navigationTimer) {
      clearTimeout(state.navigationTimer);
      state.navigationTimer = null;
    }
  }

  function clearReceptorHighlights() {
    overlay.querySelectorAll(".ddr-receptor").forEach((el) => el.classList.remove("ddr-active"));
  }

  function setActiveReceptor(dir) {
    clearReceptorHighlights();
    const el = overlay.querySelector(`.ddr-receptor[data-dir="${dir}"]`);
    if (el) el.classList.add("ddr-active");
  }

  function clearSequence() {
    state.sequence = [];
    clearSequenceTimer();
    clearReceptorHighlights();
    setCurrentChoiceLabel("");
  }

  function setCurrentChoiceLabel(text) {
    if (!currentChoiceEl) return;
    const value = String(text || "").trim();
    const loading = /^loading:/i.test(value);
    currentChoiceEl.textContent = value;
    currentChoiceEl.classList.toggle("ddr-hidden", !value);
    currentChoiceEl.classList.toggle("ddr-loading", Boolean(value) && loading);
    if (!loading) {
      setCurrentChoiceProgress(0);
    }
  }

  function renderCurrentSequenceChoice() {
    if (!state.sequence.length) {
      setCurrentChoiceLabel("");
      return;
    }

    const sequenceKey = state.sequence.join(",");
    const entry = bindings.get(sequenceKey);
    if (entry?.url) {
      setCurrentChoiceLabel(`Loading: ${getEntryLabel(entry)}`);
      return;
    }

    setCurrentChoiceLabel(`Combo: ${sequenceKey.replace(/,/g, " + ")}`);
  }

  function activate(dir, target, openInNewTab = false) {
    state.navigating = true;
    clearSequenceTimer();
    clearNavigationTimer();
    setActiveReceptor(dir);

    // keep DDR feel: light up, then fade away; navigate after the flash
    state.navigationTimer = setTimeout(() => {
      state.navigationTimer = null;
      hide();
      state.navigating = false;
      clearSequence();

      if (target) {
        if (openInNewTab) {
          chrome.runtime.sendMessage({ type: "ddr-open-url-new-tab", url: target }, (response) => {
            if (chrome.runtime.lastError || !response?.ok) {
              window.location.assign(target);
            }
          });
        } else {
          window.location.assign(target);
        }
      }
    }, 350);
  }

  function finalizeSequence() {
    if (state.navigating) return;
    clearSequenceTimer();

    const sequenceKey = state.sequence.join(",");
    if (!sequenceKey) return;

    const entry = bindings.get(sequenceKey);
    if (entry?.url) {
      const parts = sequenceKey.split(",");
      activate(parts[parts.length - 1], entry.url, entry.openInNewTab);
      return;
    }

    clearSequence();
  }

  function scheduleResolution(sequenceKey) {
    clearSequenceTimer();
    startComboWindow(comboWindowMs);
    state.sequenceTimer = setTimeout(() => {
      state.sequenceTimer = null;
      hideComboWindow();
      if (state.navigating) return;
      if (state.sequence.join(",") !== sequenceKey) return;

      const entry = bindings.get(sequenceKey);
      if (entry?.url) {
        const parts = sequenceKey.split(",");
        activate(parts[parts.length - 1], entry.url, entry.openInNewTab);
        return;
      }

      clearSequence();
      if (comboHeld()) {
        renderChoices([], true);
      } else {
        hide();
      }
    }, comboWindowMs);
  }

  function handleArrowInput(dir) {
    state.sequence.push(dir);
    const sequenceKey = state.sequence.join(",");
    const exactEntry = bindings.get(sequenceKey);
    const hasLongerMatch = prefixes.has(sequenceKey);

    if (exactEntry?.url && !hasLongerMatch) {
      activate(dir, exactEntry.url, exactEntry.openInNewTab);
      return;
    }

    setActiveReceptor(dir);
    renderChoices(state.sequence, true);
    renderCurrentSequenceChoice();

    if (exactEntry?.url || hasLongerMatch) {
      scheduleResolution(sequenceKey);
      return;
    }

    clearSequence();
    renderChoices([], true);
  }

  function resetAll() {
    clearNavigationTimer();
    state.meta = false;
    state.shift = false;
    state.y = false;
    state.navigating = false;
    clearSequence();
    hide();
  }

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        const ddrActive =
          overlay.classList.contains("ddr-visible") ||
          state.navigating ||
          state.sequence.length > 0 ||
          comboHeld();

        if (ddrActive) {
          e.preventDefault();
          e.stopPropagation();
          resetAll();
        }
        return;
      }

      state.meta = e.metaKey;
      state.shift = e.shiftKey;
      if (!modifiersHeld()) state.y = false;
      if (e.key && e.key.toLowerCase() === "y") {
        state.y = true;
      }

      if (comboHeld()) {
        show();
      }

      const comboModeActive = modifiersHeld() && overlay.classList.contains("ddr-visible");
      if (!comboModeActive || state.navigating) return;

      const dir = ARROW_KEY_TO_DIR[e.key];
      if (!dir) return;

      // Ignore OS key-repeat to avoid accidental duplicate sequence entries.
      if (e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Stop page scroll while using the DDR input
      e.preventDefault();
      e.stopPropagation();

      handleArrowInput(dir);
    },
    true
  );

  window.addEventListener(
    "keyup",
    (e) => {
      state.meta = e.metaKey;
      state.shift = e.shiftKey;
      if (e.key && e.key.toLowerCase() === "y") state.y = false;
      if (!modifiersHeld()) state.y = false;

      if (!modifiersHeld()) {
        finalizeSequence();
        if (!state.navigating) {
          clearSequence();
          hide();
        }
      }
    },
    true
  );

  window.addEventListener("blur", resetAll);

  function directionalKeyImage(dir) {
    const src = chrome.runtime.getURL(DIRECTION_KEY_IMAGE_PATHS[dir]);
    return `<img class="ddr-key-image" src="${src}" alt="" />`;
  }
})();
