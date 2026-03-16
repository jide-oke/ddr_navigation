const DIRECTIONS = ["left", "down", "up", "right"];
const PRESETS = [
  { id: "preset1", label: "Preset 1" },
  { id: "preset2", label: "Preset 2" }
];
const PRESET_IDS = PRESETS.map((preset) => preset.id);
const ACTION_TYPES = {
  URL: "url",
  COMMAND: "command"
};
const COMMAND_OPTIONS = [
  { id: "close_other_tabs", label: "Close Other Tabs" },
  { id: "close_current_tab", label: "Close Current Tab" },
  { id: "reload_tab", label: "Reload Current Tab" },
  { id: "duplicate_tab", label: "Duplicate Current Tab" },
  { id: "reopen_closed_tabs", label: "Reopen Closed Tabs" }
];
const COMMAND_IDS = new Set(COMMAND_OPTIONS.map((command) => command.id));
const MAX_LABEL_LENGTH = 28;
const DEFAULT_COMBO_WINDOW_MS = 600;
const MIN_COMBO_WINDOW_MS = 200;
const MAX_COMBO_WINDOW_MS = 10000;
const EXPORT_FORMAT = "ddr-navigation-presets";
const EXPORT_VERSION = 2;
const STATS_STORAGE_KEY = "ddrNavStats";
const STATS_TABLE_LIMIT = 30;
const COMMAND_LABEL_BY_ID = Object.fromEntries(COMMAND_OPTIONS.map((command) => [command.id, command.label]));

let presetState = null;
let activePresetId = PRESET_IDS[0];
let activeSettingsTab = "mappings";
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

function makeTimestamp() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  const second = String(d.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
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

function emptyStats() {
  return {
    totalExecutions: 0,
    bySequence: {}
  };
}

function normalizeStats(rawStats) {
  const stats = rawStats && typeof rawStats === "object" ? rawStats : {};
  const bySequenceRaw = stats.bySequence && typeof stats.bySequence === "object" ? stats.bySequence : {};
  const bySequence = {};
  let derivedTotal = 0;

  for (const [rawSequence, rawEntry] of Object.entries(bySequenceRaw)) {
    const sequence = normalizeSequence(rawSequence);
    if (!sequence) continue;
    const count = Math.max(0, Number(rawEntry?.count) || 0);
    if (!count) continue;
    const label = normalizeNickname(rawEntry?.label || "");
    const lastUsedAt = typeof rawEntry?.lastUsedAt === "string" ? rawEntry.lastUsedAt : "";
    bySequence[sequence] = { count, label, lastUsedAt };
    derivedTotal += count;
  }

  const storedTotal = Math.max(0, Number(stats.totalExecutions) || 0);
  return {
    totalExecutions: Math.max(storedTotal, derivedTotal),
    bySequence
  };
}

function formatSequenceForDisplay(sequence) {
  return sequence.split(",").join(" + ").toUpperCase();
}

function formatLastUsed(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function getStatsEntryLabel(sequence, entry) {
  const preferred = normalizeNickname(entry?.label || "");
  if (preferred) return preferred;

  const preset = getActivePreset();
  const presetName = normalizeNickname(preset.names?.[sequence] || "");
  if (presetName) return presetName;

  const commandId = preset.commands?.[sequence];
  if (commandId) return COMMAND_LABEL_BY_ID[commandId] || commandId;

  const url = preset.urls?.[sequence] || "";
  return url || "—";
}

async function loadStats() {
  const data = await chrome.storage.local.get([STATS_STORAGE_KEY]);
  return normalizeStats(data[STATS_STORAGE_KEY]);
}

async function renderStats() {
  const stats = await loadStats();
  const totalEl = document.getElementById("statsTotal");
  const emptyEl = document.getElementById("statsEmpty");
  const rowsEl = document.getElementById("statsRows");

  if (totalEl) totalEl.textContent = String(stats.totalExecutions);
  if (!rowsEl || !emptyEl) return;

  const entries = Object.entries(stats.bySequence)
    .map(([sequence, value]) => ({ sequence, ...value }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(b.lastUsedAt || "").localeCompare(String(a.lastUsedAt || ""));
    })
    .slice(0, STATS_TABLE_LIMIT);

  rowsEl.innerHTML = "";
  if (!entries.length) {
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  for (const entry of entries) {
    const tr = document.createElement("tr");

    const seqTd = document.createElement("td");
    seqTd.className = "stats-seq";
    seqTd.textContent = formatSequenceForDisplay(entry.sequence);

    const labelTd = document.createElement("td");
    labelTd.textContent = getStatsEntryLabel(entry.sequence, entry);

    const countTd = document.createElement("td");
    countTd.textContent = String(entry.count);

    const lastTd = document.createElement("td");
    lastTd.textContent = formatLastUsed(entry.lastUsedAt);

    tr.append(seqTd, labelTd, countTd, lastTd);
    rowsEl.appendChild(tr);
  }
}

async function resetStats() {
  await chrome.storage.local.set({ [STATS_STORAGE_KEY]: emptyStats() });
  await renderStats();
  flashStatus("Stats reset ✓", 1400);
}

async function setSettingsTab(nextTabId) {
  const tabId = nextTabId === "stats" ? "stats" : "mappings";
  activeSettingsTab = tabId;

  const mappingsBtn = document.getElementById("tabMappings");
  const statsBtn = document.getElementById("tabStats");
  const mappingsPanel = document.getElementById("panelMappings");
  const statsPanel = document.getElementById("panelStats");
  const showStats = tabId === "stats";

  mappingsBtn?.classList.toggle("is-active", !showStats);
  statsBtn?.classList.toggle("is-active", showStats);
  if (mappingsPanel) mappingsPanel.hidden = showStats;
  if (statsPanel) statsPanel.hidden = !showStats;

  if (showStats) {
    await renderStats();
  }
}

function emptyPreset() {
  const urls = {};
  for (const dir of DIRECTIONS) {
    urls[dir] = "";
  }

  return {
    urls,
    commands: {},
    names: {},
    openInNewTabByKey: {},
    comboWindowMs: DEFAULT_COMBO_WINDOW_MS
  };
}

function hasPresetData(preset) {
  return Object.values(preset.urls || {}).some(Boolean) || Object.values(preset.commands || {}).some(Boolean);
}

function normalizePreset(rawPreset) {
  const base = emptyPreset();
  const urls = rawPreset?.urls || {};
  const commands = rawPreset?.commands || {};
  const names = rawPreset?.names || {};
  const openInNewTabByKey = rawPreset?.openInNewTabByKey || {};

  for (const [rawSequence, rawUrl] of Object.entries(urls)) {
    const sequence = normalizeSequence(rawSequence);
    const target = normalizeUrl(rawUrl);
    if (!sequence || !target) continue;
    base.urls[sequence] = target;
  }

  for (const [rawSequence, rawCommand] of Object.entries(commands)) {
    const sequence = normalizeSequence(rawSequence);
    const command = String(rawCommand || "").trim();
    if (!sequence || !COMMAND_IDS.has(command)) continue;
    base.commands[sequence] = command;
  }

  for (const [rawSequence, rawName] of Object.entries(names)) {
    const sequence = normalizeSequence(rawSequence);
    const nickname = normalizeNickname(rawName);
    const hasAction = Boolean(base.urls[sequence] || base.commands[sequence]);
    if (!sequence || !nickname || !hasAction) continue;
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
    commands: data.ddrNavCommands || {},
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

function commandOptionsHtml() {
  return COMMAND_OPTIONS.map((command) => `<option value="${command.id}">${command.label}</option>`).join("");
}

function syncComboRowActionUI(row) {
  const actionSelect = row.querySelector(".combo-action");
  const actionType = actionSelect?.value || ACTION_TYPES.URL;
  const urlInput = row.querySelector(".combo-url");
  const commandSelect = row.querySelector(".combo-command");
  const newTabLabel = row.querySelector(".combo-toggle");

  const isUrlAction = actionType === ACTION_TYPES.URL;
  if (urlInput) urlInput.hidden = !isUrlAction;
  if (commandSelect) commandSelect.hidden = isUrlAction;
  if (newTabLabel) newTabLabel.hidden = !isUrlAction;
}

function createComboRow({
  sequence = "",
  actionType = ACTION_TYPES.URL,
  url = "",
  command = COMMAND_OPTIONS[0].id,
  nickname = "",
  openInNewTab = false
} = {}) {
  const row = document.createElement("div");
  row.className = "combo-row";
  row.innerHTML = `
    <input class="combo-seq" type="text" placeholder="left,left" />
    <select class="combo-action">
      <option value="${ACTION_TYPES.URL}">URL</option>
      <option value="${ACTION_TYPES.COMMAND}">Command</option>
    </select>
    <input class="combo-url" type="text" placeholder="https://example.com" />
    <select class="combo-command">${commandOptionsHtml()}</select>
    <input class="combo-name" type="text" placeholder="Nickname (optional)" />
    <label class="combo-toggle">
      <input class="combo-newtab" type="checkbox" />
      <span>New tab</span>
    </label>
    <button type="button" class="ghost combo-remove">Remove</button>
  `;

  row.querySelector(".combo-seq").value = sequence;
  row.querySelector(".combo-action").value =
    actionType === ACTION_TYPES.COMMAND ? ACTION_TYPES.COMMAND : ACTION_TYPES.URL;
  row.querySelector(".combo-url").value = url;
  row.querySelector(".combo-command").value = COMMAND_IDS.has(command) ? command : COMMAND_OPTIONS[0].id;
  row.querySelector(".combo-name").value = nickname;
  row.querySelector(".combo-newtab").checked = openInNewTab;
  row.querySelector(".combo-action").addEventListener("change", () => {
    syncComboRowActionUI(row);
  });
  row.querySelector(".combo-remove").addEventListener("click", () => row.remove());
  syncComboRowActionUI(row);

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

  const comboKeySet = new Set([
    ...Object.keys(preset.urls || {}),
    ...Object.keys(preset.commands || {})
  ]);
  const comboKeys = [...comboKeySet].filter((sequence) => !DIRECTIONS.includes(sequence)).sort();

  for (const sequence of comboKeys) {
    const url = preset.urls[sequence] || "";
    const command = preset.commands?.[sequence] || "";
    const isCommand = Boolean(command);
    if (!url && !isCommand) continue;
    combosList.appendChild(
      createComboRow({
        sequence,
        actionType: isCommand ? ACTION_TYPES.COMMAND : ACTION_TYPES.URL,
        url,
        command: command || COMMAND_OPTIONS[0].id,
        nickname: preset.names[sequence] || "",
        openInNewTab: Boolean(!isCommand && preset.openInNewTabByKey[sequence])
      })
    );
  }

  document.getElementById("comboWindowSeconds").value = formatComboWindowSeconds(preset.comboWindowMs);
}

function collectPresetFromForm({ markInvalid = true } = {}) {
  const urls = {};
  const commands = {};
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
    const actionInput = row.querySelector(".combo-action");
    const urlInput = row.querySelector(".combo-url");
    const commandInput = row.querySelector(".combo-command");
    const nameInput = row.querySelector(".combo-name");
    const newTabInput = row.querySelector(".combo-newtab");
    const rawSequence = sequenceInput.value;
    const rawUrl = urlInput.value;
    const rawName = nameInput.value;
    const sequence = normalizeSequence(rawSequence);
    const actionType = actionInput?.value === ACTION_TYPES.COMMAND ? ACTION_TYPES.COMMAND : ACTION_TYPES.URL;
    const target = normalizeUrl(rawUrl);
    const command = COMMAND_IDS.has(String(commandInput?.value || "")) ? String(commandInput.value) : "";
    const nickname = normalizeNickname(rawName);
    const openInNewTab = Boolean(newTabInput?.checked);
    const hasPayload = actionType === ACTION_TYPES.COMMAND ? Boolean(command) : Boolean(target);
    const isUntouchedRow = !rawSequence.trim() && !rawUrl.trim() && !rawName.trim();

    if (markInvalid) sequenceInput.classList.remove("invalid");

    if (isUntouchedRow) continue;
    if (!rawSequence.trim() && !hasPayload) continue;
    if (!sequence) {
      invalidComboCount += 1;
      if (markInvalid) sequenceInput.classList.add("invalid");
      continue;
    }
    if (!hasPayload) continue;
    if (DIRECTIONS.includes(sequence)) continue;

    if (actionType === ACTION_TYPES.COMMAND) {
      commands[sequence] = command;
    } else {
      urls[sequence] = target;
      if (openInNewTab) openInNewTabByKey[sequence] = true;
    }

    if (nickname) names[sequence] = nickname;
  }

  return {
    preset: normalizePreset({
      urls,
      commands,
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
    ddrNavCommands: activePreset.commands,
    ddrNavNames: activePreset.names,
    ddrNavOpenInNewTab: activePreset.openInNewTabByKey,
    ddrNavSettings: {
      openInNewTab: false,
      comboWindowMs: activePreset.comboWindowMs
    }
  });
}

function buildExportPayload() {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      activePresetId,
      presets: presetState.presets
    }
  };
}

function syncActivePresetDraftFromForm() {
  if (!presetState) return;
  const draft = collectPresetFromForm({ markInvalid: false }).preset;
  presetState.presets[activePresetId] = draft;
}

function exportSettingsJson() {
  if (!presetState) return;
  syncActivePresetDraftFromForm();

  const payload = buildExportPayload();
  const content = JSON.stringify(payload, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ddr-navigation-presets-${makeTimestamp()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  flashStatus("Exported presets ✓", 1400);
}

function normalizeImportedPresetState(raw) {
  const state = raw?.data && raw?.format === EXPORT_FORMAT ? raw.data : raw;
  if (!state || typeof state !== "object") {
    throw new Error("Invalid preset file format");
  }
  return ensurePresetState({ ddrNavPresetState: state });
}

async function importSettingsFromFile(file) {
  if (!file) return;
  const text = await file.text();
  const parsed = JSON.parse(text);
  const imported = normalizeImportedPresetState(parsed);

  presetState = imported;
  activePresetId = imported.activePresetId;
  renderPresetSelect();
  loadPresetIntoForm(getActivePreset());
  await persistPresetState();
  flashStatus("Imported presets ✓", 1600);
}

async function load() {
  const data = await chrome.storage.sync.get([
    "ddrNavUrls",
    "ddrNavCommands",
    "ddrNavNames",
    "ddrNavOpenInNewTab",
    "ddrNavSettings",
    "ddrNavPresetState"
  ]);

  presetState = ensurePresetState(data);
  activePresetId = presetState.activePresetId;
  renderPresetSelect();
  loadPresetIntoForm(getActivePreset());
  await setSettingsTab(activeSettingsTab);

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
document.querySelectorAll(".tab-btn").forEach((button) => {
  button.addEventListener("click", () => {
    void setSettingsTab(button.dataset.tab);
  });
});
document.getElementById("addCombo").addEventListener("click", () => {
  document.getElementById("combosList").appendChild(createComboRow());
});
document.getElementById("refreshStats").addEventListener("click", () => {
  void renderStats();
});
document.getElementById("resetStats").addEventListener("click", () => {
  const confirmed = window.confirm("Are you sure? This will reset your stats.");
  if (!confirmed) return;
  void resetStats();
});
document.getElementById("exportSettings").addEventListener("click", () => {
  exportSettingsJson();
});
document.getElementById("importSettings").addEventListener("click", () => {
  document.getElementById("importFile").click();
});
document.getElementById("importFile").addEventListener("change", (event) => {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;
  void importSettingsFromFile(file).catch(() => {
    flashStatus("Import failed: invalid JSON file", 2200);
  }).finally(() => {
    input.value = "";
  });
});
document.getElementById("save").addEventListener("click", () => {
  void save();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STATS_STORAGE_KEY] && activeSettingsTab === "stats") {
    void renderStats();
  }
});
void load();
