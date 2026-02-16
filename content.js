(() => {
  const DIRECTIONS = ["left", "down", "up", "right"];
  const ARROW_KEY_TO_DIR = {
    ArrowLeft: "left",
    ArrowDown: "down",
    ArrowUp: "up",
    ArrowRight: "right"
  };
  const SEQUENCE_TIMEOUT_MS = 600;
  const DISPLAY_LABEL_MAX_CHARS = 28;

  // ---------- Overlay ----------
  const overlay = document.createElement("div");
  overlay.id = "ddr-receptors-overlay";
  overlay.setAttribute("aria-hidden", "true");

  overlay.innerHTML = `
    <div class="ddr-receptors">
      <div class="ddr-receptor" data-dir="left">
        <div class="ddr-choice ddr-empty" data-role="choice"></div>
        ${arrowSvg("left")}
      </div>
      <div class="ddr-receptor" data-dir="down">
        <div class="ddr-choice ddr-empty" data-role="choice"></div>
        ${arrowSvg("down")}
      </div>
      <div class="ddr-receptor" data-dir="up">
        <div class="ddr-choice ddr-empty" data-role="choice"></div>
        ${arrowSvg("up")}
      </div>
      <div class="ddr-receptor" data-dir="right">
        <div class="ddr-choice ddr-empty" data-role="choice"></div>
        ${arrowSvg("right")}
      </div>
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
    .ddr-receptors{
      display: inline-flex;
      gap: 8px;
      padding: 10px;
      border-radius: 14px;
      background: rgba(0,0,0,0.35);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
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
    .ddr-receptor svg{
      width: 22px;
      height: 22px;
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

  // ---------- URL mappings ----------
  let rawUrls = {};
  let rawNames = {};
  let rawOpenInNewTab = {};
  let legacyGlobalOpenInNewTab = false;
  let bindings = new Map();
  let prefixes = new Set();
  const shownChoices = Object.fromEntries(DIRECTIONS.map((dir) => [dir, ""]));

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
    const next = label || "";
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
      needsRebuild = true;
    }

    if (needsRebuild) {
      rebuildBindings();
      renderChoices(state.sequence, false);
    }
  });

  // ---------- Key state ----------
  const state = {
    meta: false,
    shift: false,
    y: false,
    sequence: [],
    sequenceTimer: null,
    navigating: false
  };

  function comboHeld() {
    return state.meta && state.shift && state.y;
  }

  function show() {
    overlay.classList.add("ddr-visible");
    renderChoices(state.sequence, false);
  }

  function hide() {
    overlay.classList.remove("ddr-visible");
    overlay.querySelectorAll(".ddr-receptor").forEach((el) => el.classList.remove("ddr-active"));
  }

  function clearSequenceTimer() {
    if (state.sequenceTimer) {
      clearTimeout(state.sequenceTimer);
      state.sequenceTimer = null;
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
  }

  function activate(dir, target, openInNewTab = false) {
    state.navigating = true;
    clearSequenceTimer();
    setActiveReceptor(dir);

    // keep DDR feel: light up, then fade away; navigate after the flash
    setTimeout(() => {
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
    state.sequenceTimer = setTimeout(() => {
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
    }, SEQUENCE_TIMEOUT_MS);
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

    if (exactEntry?.url || hasLongerMatch) {
      scheduleResolution(sequenceKey);
      return;
    }

    clearSequence();
    renderChoices([], true);
  }

  function resetAll() {
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
      if (e.key === "Meta") state.meta = true;
      if (e.key === "Shift") state.shift = true;
      if (e.key && e.key.toLowerCase() === "y") state.y = true;

      if (comboHeld()) show();

      if (!comboHeld() || state.navigating) return;

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
      if (e.key === "Meta") state.meta = false;
      if (e.key === "Shift") state.shift = false;
      if (e.key && e.key.toLowerCase() === "y") state.y = false;

      if (!comboHeld()) {
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

  function arrowSvg(dir) {
    const rotation =
      dir === "up" ? 0 :
      dir === "right" ? 90 :
      dir === "down" ? 180 :
      270;

    return `
      <svg viewBox="0 0 24 24" style="transform: rotate(${rotation}deg)">
        <path d="M12 3l7 7h-4v11H9V10H5l7-7z"
              fill="rgba(255,255,255,0.92)"/>
        <path d="M12 3l7 7h-4v11H9V10H5l7-7z"
              fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.2"/>
      </svg>
    `;
  }
})();
