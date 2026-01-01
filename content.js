(() => {
  const overlay = document.createElement("div");
  overlay.id = "ddr-receptors-overlay";

  overlay.innerHTML = `
    <div class="ddr-receptors">
      <div class="ddr-receptor">${arrow("left")}</div>
      <div class="ddr-receptor">${arrow("down")}</div>
      <div class="ddr-receptor">${arrow("up")}</div>
      <div class="ddr-receptor">${arrow("right")}</div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #ddr-receptors-overlay {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483647;
      opacity: 0;
      pointer-events: none;
      transition: opacity 150ms ease;
    }

    #ddr-receptors-overlay.visible {
      opacity: 1;
    }

    .ddr-receptors {
      display: flex;
      gap: 10px;
      padding: 10px;
      background: rgba(0,0,0,0.35);
      border-radius: 14px;
      backdrop-filter: blur(6px);
    }

    .ddr-receptor {
      width: 42px;
      height: 42px;
      background: rgba(255,255,255,0.15);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    svg {
      width: 26px;
      height: 26px;
      fill: white;
    }
  `;

  document.documentElement.append(style, overlay);

  const pressed = {
    meta: false,
    shift: false,
    y: false
  };

  function update() {
    overlay.classList.toggle(
      "visible",
      pressed.meta && pressed.shift && pressed.y
    );
  }

  window.addEventListener("keydown", e => {
    if (e.key === "Meta") pressed.meta = true;
    if (e.key === "Shift") pressed.shift = true;
    if (e.key.toLowerCase() === "y") pressed.y = true;
    update();
  });

  window.addEventListener("keyup", e => {
    if (e.key === "Meta") pressed.meta = false;
    if (e.key === "Shift") pressed.shift = false;
    if (e.key.toLowerCase() === "y") pressed.y = false;
    update();
  });

  function arrow(dir) {
    const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
    return `
      <svg viewBox="0 0 24 24" style="transform: rotate(${rot}deg)">
        <path d="M12 3l7 7h-4v11H9V10H5z"/>
      </svg>
    `;
  }
})();