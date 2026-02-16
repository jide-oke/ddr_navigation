(() => {
  const DIRECTIONS = ["left", "down", "up", "right"];
  const ARROW_KEY_TO_DIR = {
    ArrowLeft: "left",
    ArrowDown: "down",
    ArrowUp: "up",
    ArrowRight: "right"
  };
  const SEQUENCE_TIMEOUT_MS = 600;

  // ---------- Overlay ----------
  const overlay = document.createElement("div");
  overlay.id = "ddr-receptors-overlay";
  overlay.setAttribute("aria-hidden", "true");

  overlay.innerHTML = `
    <div class="ddr-receptors">
      <div class="ddr-receptor" data-dir="left">${arrowSvg("left")}</div>
      <div class="ddr-receptor" data-dir="down">${arrowSvg("down")}</div>
      <div class="ddr-receptor" data-dir="up">${arrowSvg("up")}</div>
      <div class="ddr-receptor" data-dir="right">${arrowSvg("right")}</div>
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
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(255,255,255,0.10);
      border: 2px solid rgba(255,255,255,0.55);
      display: grid;
      place-items: center;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
      transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
    }
    .ddr-receptor svg{
      width: 26px;
      height: 26px;
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
  let bindings = new Map();
  let prefixes = new Set();

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

    for (const [rawKey, rawTarget] of Object.entries(rawUrls)) {
      const target = String(rawTarget || "").trim();
      const key = normalizeSequenceKey(rawKey);
      if (!key || !target) continue;
      nextBindings.set(key, target);
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

  async function loadUrls() {
    const data = await chrome.storage.sync.get("ddrNavUrls");
    rawUrls = { ...(data.ddrNavUrls || {}) };
    rebuildBindings();
  }
  loadUrls();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.ddrNavUrls) {
      rawUrls = { ...(changes.ddrNavUrls.newValue || {}) };
      rebuildBindings();
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

  function activate(dir, target) {
    state.navigating = true;
    clearSequenceTimer();
    setActiveReceptor(dir);

    // keep DDR feel: light up, then fade away; navigate after the flash
    setTimeout(() => {
      hide();
      state.navigating = false;
      clearSequence();

      if (target) {
        // Navigate current tab
        window.location.assign(target);
      }
    }, 350);
  }

  function finalizeSequence() {
    if (state.navigating) return;
    clearSequenceTimer();

    const sequenceKey = state.sequence.join(",");
    if (!sequenceKey) return;

    const target = bindings.get(sequenceKey);
    if (target) {
      const parts = sequenceKey.split(",");
      activate(parts[parts.length - 1], target);
      return;
    }

    clearSequence();
  }

  function scheduleResolution(sequenceKey) {
    clearSequenceTimer();
    state.sequenceTimer = setTimeout(() => {
      if (state.navigating) return;
      if (state.sequence.join(",") !== sequenceKey) return;

      const target = bindings.get(sequenceKey);
      if (target) {
        const parts = sequenceKey.split(",");
        activate(parts[parts.length - 1], target);
        return;
      }

      clearSequence();
      if (!comboHeld()) hide();
    }, SEQUENCE_TIMEOUT_MS);
  }

  function handleArrowInput(dir) {
    state.sequence.push(dir);
    const sequenceKey = state.sequence.join(",");
    const exactTarget = bindings.get(sequenceKey);
    const hasLongerMatch = prefixes.has(sequenceKey);

    if (exactTarget && !hasLongerMatch) {
      activate(dir, exactTarget);
      return;
    }

    setActiveReceptor(dir);

    if (exactTarget || hasLongerMatch) {
      scheduleResolution(sequenceKey);
      return;
    }

    clearSequence();
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
