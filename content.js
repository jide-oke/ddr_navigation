(() => {
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
  let urls = { left: "", down: "", up: "", right: "" };

  async function loadUrls() {
    const data = await chrome.storage.sync.get("ddrNavUrls");
    urls = { left: "", down: "", up: "", right: "", ...(data.ddrNavUrls || {}) };
  }
  loadUrls();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.ddrNavUrls) {
      urls = { left: "", down: "", up: "", right: "", ...(changes.ddrNavUrls.newValue || {}) };
    }
  });

  // ---------- Key state ----------
  const state = {
    meta: false,
    shift: false,
    y: false,
    consumed: false // only one arrow per activation
  };

  function comboHeld() {
    return state.meta && state.shift && state.y;
  }

  function show() {
    overlay.classList.add("ddr-visible");
  }

  function hide() {
    overlay.classList.remove("ddr-visible");
    overlay.querySelectorAll(".ddr-receptor").forEach(el => el.classList.remove("ddr-active"));
  }

  function activate(dir) {
    const el = overlay.querySelector(`.ddr-receptor[data-dir="${dir}"]`);
    if (el) el.classList.add("ddr-active");

    // keep DDR feel: light up, then fade away; navigate after the flash
    const target = (urls[dir] || "").trim();

    setTimeout(() => {
      hide();
      state.consumed = false;

      if (target) {
        // Navigate current tab
        window.location.assign(target);
      }
    }, 350);
  }

  function resetAll() {
    state.meta = false;
    state.shift = false;
    state.y = false;
    state.consumed = false;
    hide();
  }

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Meta") state.meta = true;
      if (e.key === "Shift") state.shift = true;
      if (e.key && e.key.toLowerCase() === "y") state.y = true;

      if (comboHeld()) show();

      // One-arrow input while combo is held
      if (comboHeld() && !state.consumed) {
        const map = {
          ArrowLeft: "left",
          ArrowDown: "down",
          ArrowUp: "up",
          ArrowRight: "right"
        };

        const dir = map[e.key];
        if (dir) {
          state.consumed = true;

          // Stop page scroll while using the DDR input
          e.preventDefault();
          e.stopPropagation();

          activate(dir);
        }
      }
    },
    true
  );

  window.addEventListener(
    "keyup",
    (e) => {
      if (e.key === "Meta") state.meta = false;
      if (e.key === "Shift") state.shift = false;
      if (e.key && e.key.toLowerCase() === "y") state.y = false;

      // If you let go of the combo before choosing an arrow, fade away
      if (!comboHeld()) {
        state.consumed = false;
        hide();
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