const DIRECTIONS = ["left", "down", "up", "right"];

function normalizeSequence(value) {
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

function normalizeUrl(value) {
  const v = (value || "").trim();
  if (!v) return "";

  // If user types example.com, assume https://
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return `https://${v}`;

  return v;
}

function createComboRow(sequence = "", url = "") {
  const row = document.createElement("div");
  row.className = "combo-row";
  row.innerHTML = `
    <input class="combo-seq" type="text" placeholder="left,left" />
    <input class="combo-url" type="text" placeholder="https://example.com" />
    <button type="button" class="ghost combo-remove">Remove</button>
  `;

  row.querySelector(".combo-seq").value = sequence;
  row.querySelector(".combo-url").value = url;
  row.querySelector(".combo-remove").addEventListener("click", () => row.remove());

  return row;
}

async function load() {
  const data = await chrome.storage.sync.get("ddrNavUrls");
  const urls = data.ddrNavUrls || {};
  const combosList = document.getElementById("combosList");

  combosList.innerHTML = "";

  for (const k of DIRECTIONS) {
    document.getElementById(k).value = urls[k] || "";
  }

  for (const [rawSequence, rawUrl] of Object.entries(urls)) {
    const sequence = normalizeSequence(rawSequence);
    const url = String(rawUrl || "").trim();
    if (!sequence || !url) continue;
    if (DIRECTIONS.includes(sequence)) continue;
    combosList.appendChild(createComboRow(sequence, url));
  }
}

async function save() {
  const urls = {};
  for (const k of DIRECTIONS) {
    urls[k] = normalizeUrl(document.getElementById(k).value);
  }

  let invalidComboCount = 0;
  const rows = document.querySelectorAll(".combo-row");
  for (const row of rows) {
    const sequenceInput = row.querySelector(".combo-seq");
    const urlInput = row.querySelector(".combo-url");
    const rawSequence = sequenceInput.value;
    const sequence = normalizeSequence(rawSequence);
    const target = normalizeUrl(urlInput.value);

    sequenceInput.classList.remove("invalid");

    if (!rawSequence.trim() && !target) continue;
    if (!sequence) {
      invalidComboCount += 1;
      sequenceInput.classList.add("invalid");
      continue;
    }
    if (!target) continue;
    if (DIRECTIONS.includes(sequence)) continue;

    urls[sequence] = target;
  }

  await chrome.storage.sync.set({ ddrNavUrls: urls });

  const status = document.getElementById("status");
  if (invalidComboCount) {
    status.textContent = `Saved ✓ (${invalidComboCount} invalid combo${invalidComboCount > 1 ? "s were" : " was"} skipped)`;
  } else {
    status.textContent = "Saved ✓";
  }
  setTimeout(() => (status.textContent = ""), 1800);
}

document.getElementById("addCombo").addEventListener("click", () => {
  document.getElementById("combosList").appendChild(createComboRow());
});
document.getElementById("save").addEventListener("click", save);
load();
