const DIRECTIONS = ["left", "down", "up", "right"];
const PRESETS = [
  { id: "preset1", label: "Preset 1" },
  { id: "preset2", label: "Preset 2" }
];
const PRESET_IDS = PRESETS.map((preset) => preset.id);
const MAX_LABEL_LENGTH = 28;
const DEFAULT_COMBO_WINDOW_MS = 600;
const MIN_COMBO_WINDOW_MS = 200;
const MAX_COMBO_WINDOW_MS = 10000;

let presetState = null;
let activePresetId = PRESET_IDS[0];
let statusTimer = null;

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

function normalizeComboWindowMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_COMBO_WINDOW_MS;
  return Math.min(MAX_COMBO_WINDOW_MS, Math.max(MIN_COMBO_WINDOW_MS, Math.round(n)));
}

function parseComboWindowSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return DEFAULT_COMBO_WINDOW_MS;
  return normalizeComboWindowMs(seconds * 1000);
}

function formatComboWindowSeconds(ms) {
  return (normalizeComboWindowMs(ms) / 1000).toFixed(1);
}

function getPresetLabel(presetId) {
  return PRESETS.find((preset) => preset.id === presetId)?.label || presetId;
}

function flashStatus(text, durationMs = 1800) {
  const status = document.getElementById("status");
  status.textContent = text;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    status.textContent = "";
    statusTimer = null;
  }, durationMs);
}

function emptyPreset() {
  const urls = {};
  for (const dir of DIRECTIONS) {
    urls[dir] = "";
  }

  return {
    urls,
    names: {},
    openInNewTabByKey: {},
    comboWindowMs: DEFAULT_COMBO_WINDOW_MS
  };
}

function hasPresetData(preset) {
  return Object.values(preset.urls || {}).some(Boolean);
}

function normalizePreset(rawPreset) {
  const base = emptyPreset();
  const urls = rawPreset?.urls || {};
  const names = rawPreset?.names || {};
  const openInNewTabByKey = rawPreset?.openInNewTabByKey || {};

  for (const [rawSequence, rawUrl] of Object.entries(urls)) {
    const sequence = normalizeSequence(rawSequence);
    const target = normalizeUrl(rawUrl);
    if (!sequence || !target) continue;
    base.urls[sequence] = target;
  }

  for (const [rawSequence, rawName] of Object.entries(names)) {
    const sequence = normalizeSequence(rawSequence);
    const nickname = normalizeNickname(rawName);
    if (!sequence || !nickname || !base.urls[sequence]) continue;
    base.names[sequence] = nickname;
  }

  for (const [rawSequence, rawFlag] of Object.entries(openInNewTabByKey)) {
    const sequence = normalizeSequence(rawSequence);
    if (!sequence || !base.urls[sequence] || !rawFlag) continue;
    base.openInNewTabByKey[sequence] = true;
  }

  base.comboWindowMs = normalizeComboWindowMs(rawPreset?.comboWindowMs);
  return base;
}

function buildLegacyPreset(data) {
  return normalizePreset({
    urls: data.ddrNavUrls || {},
    names: data.ddrNavNames || {},
    openInNewTabByKey: data.ddrNavOpenInNewTab || {},
    comboWindowMs: data.ddrNavSettings?.comboWindowMs
  });
}

function ensurePresetState(data) {
  const legacyPreset = buildLegacyPreset(data);
  const rawState = data.ddrNavPresetState || {};
  const rawPresets = rawState.presets || {};
  const presets = {};

  for (const presetId of PRESET_IDS) {
    if (rawPresets[presetId]) {
      presets[presetId] = normalizePreset(rawPresets[presetId]);
      continue;
    }

    if (presetId === "preset1" && hasPresetData(legacyPreset)) {
      presets[presetId] = legacyPreset;
      continue;
    }

    presets[presetId] = emptyPreset();
  }

  const selectedPresetId = PRESET_IDS.includes(rawState.activePresetId)
    ? rawState.activePresetId
    : PRESET_IDS[0];

  return {
    activePresetId: selectedPresetId,
    presets
  };
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

function renderPresetSelect() {
  const presetSelect = document.getElementById("presetSelect");
  presetSelect.innerHTML = PRESETS
    .map((preset) => `<option value="${preset.id}">${preset.label}</option>`)
    .join("");
  presetSelect.value = activePresetId;
}

function getActivePreset() {
  return presetState?.presets?.[activePresetId] || emptyPreset();
}

function loadPresetIntoForm(preset) {
  const combosList = document.getElementById("combosList");
  combosList.innerHTML = "";

  for (const dir of DIRECTIONS) {
    const target = preset.urls[dir] || "";
    document.getElementById(dir).value = target;
    document.getElementById(`${dir}-name`).value = preset.names[dir] || "";
    document.getElementById(`${dir}-newtab`).checked = Boolean(preset.openInNewTabByKey[dir] && target);
  }

  const comboKeys = Object.keys(preset.urls)
    .filter((sequence) => !DIRECTIONS.includes(sequence))
    .sort();

  for (const sequence of comboKeys) {
    const target = preset.urls[sequence] || "";
    if (!target) continue;
    combosList.appendChild(
      createComboRow(
        sequence,
        target,
        preset.names[sequence] || "",
        Boolean(preset.openInNewTabByKey[sequence])
      )
    );
  }

  document.getElementById("comboWindowSeconds").value = formatComboWindowSeconds(preset.comboWindowMs);
}

function collectPresetFromForm({ markInvalid = true } = {}) {
  const urls = {};
  const names = {};
  const openInNewTabByKey = {};
  let invalidComboCount = 0;

  for (const dir of DIRECTIONS) {
    const target = normalizeUrl(document.getElementById(dir).value);
    const nickname = normalizeNickname(document.getElementById(`${dir}-name`).value);
    const openInNewTab = document.getElementById(`${dir}-newtab`).checked;

    urls[dir] = target;
    if (target && nickname) names[dir] = nickname;
    if (target && openInNewTab) openInNewTabByKey[dir] = true;
  }

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

    if (markInvalid) sequenceInput.classList.remove("invalid");

    if (!rawSequence.trim() && !target) continue;
    if (!sequence) {
      invalidComboCount += 1;
      if (markInvalid) sequenceInput.classList.add("invalid");
      continue;
    }
    if (!target) continue;
    if (DIRECTIONS.includes(sequence)) continue;

    urls[sequence] = target;
    if (nickname) names[sequence] = nickname;
    if (openInNewTab) openInNewTabByKey[sequence] = true;
  }

  return {
    preset: normalizePreset({
      urls,
      names,
      openInNewTabByKey,
      comboWindowMs: parseComboWindowSeconds(document.getElementById("comboWindowSeconds").value)
    }),
    invalidComboCount
  };
}

async function persistPresetState() {
  const activePreset = getActivePreset();

  await chrome.storage.sync.set({
    ddrNavPresetState: {
      activePresetId,
      presets: presetState.presets
    },
    ddrNavUrls: activePreset.urls,
    ddrNavNames: activePreset.names,
    ddrNavOpenInNewTab: activePreset.openInNewTabByKey,
    ddrNavSettings: {
      openInNewTab: false,
      comboWindowMs: activePreset.comboWindowMs
    }
  });
}

async function load() {
  const data = await chrome.storage.sync.get([
    "ddrNavUrls",
    "ddrNavNames",
    "ddrNavOpenInNewTab",
    "ddrNavSettings",
    "ddrNavPresetState"
  ]);

  presetState = ensurePresetState(data);
  activePresetId = presetState.activePresetId;
  renderPresetSelect();
  loadPresetIntoForm(getActivePreset());

  // Ensure migrated/new preset data is persisted.
  await persistPresetState();
}

async function onPresetChange(nextPresetId) {
  if (!PRESET_IDS.includes(nextPresetId) || nextPresetId === activePresetId) return;

  // Keep current edits as the draft for the current preset before switching.
  const currentDraft = collectPresetFromForm({ markInvalid: false }).preset;
  presetState.presets[activePresetId] = currentDraft;

  activePresetId = nextPresetId;
  presetState.activePresetId = nextPresetId;
  loadPresetIntoForm(getActivePreset());
  await persistPresetState();
  flashStatus(`Loaded ${getPresetLabel(nextPresetId)} ✓`, 1400);
}

async function save() {
  const { preset, invalidComboCount } = collectPresetFromForm();
  presetState.presets[activePresetId] = preset;
  presetState.activePresetId = activePresetId;
  await persistPresetState();

  if (invalidComboCount) {
    flashStatus(`Saved ✓ (${invalidComboCount} invalid combo${invalidComboCount > 1 ? "s were" : " was"} skipped)`);
  } else {
    flashStatus(`Saved ${getPresetLabel(activePresetId)} ✓`);
  }
}

document.getElementById("presetSelect").addEventListener("change", (event) => {
  void onPresetChange(event.target.value);
});
document.getElementById("addCombo").addEventListener("click", () => {
  document.getElementById("combosList").appendChild(createComboRow());
});
document.getElementById("save").addEventListener("click", () => {
  void save();
});
void load();
