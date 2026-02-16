const DIRECTIONS = ["left", "down", "up", "right"];
const MAX_LABEL_LENGTH = 28;

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

function normalizeNickname(value) {
  return String(value || "").trim().slice(0, MAX_LABEL_LENGTH);
}

function createComboRow(sequence = "", url = "", nickname = "", openInNewTab = false) {
  const row = document.createElement("div");
  row.className = "combo-row";
  row.innerHTML = `
    <input class="combo-seq" type="text" placeholder="left,left" />
    <input class="combo-url" type="text" placeholder="https://example.com" />
    <input class="combo-name" type="text" placeholder="Nickname (optional)" />
    <label class="combo-toggle">
      <input class="combo-newtab" type="checkbox" />
      <span>New tab</span>
    </label>
    <button type="button" class="ghost combo-remove">Remove</button>
  `;

  row.querySelector(".combo-seq").value = sequence;
  row.querySelector(".combo-url").value = url;
  row.querySelector(".combo-name").value = nickname;
  row.querySelector(".combo-newtab").checked = openInNewTab;
  row.querySelector(".combo-remove").addEventListener("click", () => row.remove());

  return row;
}

async function load() {
  const data = await chrome.storage.sync.get(["ddrNavUrls", "ddrNavNames", "ddrNavOpenInNewTab", "ddrNavSettings"]);
  const urls = data.ddrNavUrls || {};
  const names = data.ddrNavNames || {};
  const openInNewTabByKey = data.ddrNavOpenInNewTab || {};
  const settings = data.ddrNavSettings || {};
  const globalOpenInNewTab = Boolean(settings.openInNewTab);
  const combosList = document.getElementById("combosList");

  combosList.innerHTML = "";

  for (const k of DIRECTIONS) {
    const target = urls[k] || "";
    document.getElementById(k).value = target;
    document.getElementById(`${k}-name`).value = names[k] || "";
    document.getElementById(`${k}-newtab`).checked = Boolean(
      openInNewTabByKey[k] ?? (globalOpenInNewTab && target)
    );
  }

  for (const [rawSequence, rawUrl] of Object.entries(urls)) {
    const sequence = normalizeSequence(rawSequence);
    const url = String(rawUrl || "").trim();
    const nickname = normalizeNickname(names[sequence] || names[rawSequence] || "");
    const openInNewTab = Boolean(
      openInNewTabByKey[sequence] ?? openInNewTabByKey[rawSequence] ?? (globalOpenInNewTab && url)
    );
    if (!sequence || !url) continue;
    if (DIRECTIONS.includes(sequence)) continue;
    combosList.appendChild(createComboRow(sequence, url, nickname, openInNewTab));
  }
}

async function save() {
  const urls = {};
  const names = {};
  const openInNewTabByKey = {};
  for (const k of DIRECTIONS) {
    const target = normalizeUrl(document.getElementById(k).value);
    const nickname = normalizeNickname(document.getElementById(`${k}-name`).value);
    const openInNewTab = document.getElementById(`${k}-newtab`).checked;
    urls[k] = target;
    if (target && nickname) {
      names[k] = nickname;
    }
    if (target && openInNewTab) {
      openInNewTabByKey[k] = true;
    }
  }

  let invalidComboCount = 0;
  const rows = document.querySelectorAll(".combo-row");
  for (const row of rows) {
    const sequenceInput = row.querySelector(".combo-seq");
    const urlInput = row.querySelector(".combo-url");
    const nameInput = row.querySelector(".combo-name");
    const newTabInput = row.querySelector(".combo-newtab");
    const rawSequence = sequenceInput.value;
    const sequence = normalizeSequence(rawSequence);
    const target = normalizeUrl(urlInput.value);
    const nickname = normalizeNickname(nameInput.value);
    const openInNewTab = Boolean(newTabInput?.checked);

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
    if (nickname) {
      names[sequence] = nickname;
    }
    if (openInNewTab) {
      openInNewTabByKey[sequence] = true;
    }
  }

  await chrome.storage.sync.set({
    ddrNavUrls: urls,
    ddrNavNames: names,
    ddrNavOpenInNewTab: openInNewTabByKey,
    ddrNavSettings: {
      openInNewTab: false
    }
  });

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
