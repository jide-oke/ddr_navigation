const KEYS = ["left", "down", "up", "right"];

function normalizeUrl(value) {
  const v = (value || "").trim();
  if (!v) return "";

  // If user types example.com, assume https://
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return `https://${v}`;

  return v;
}

async function load() {
  const data = await chrome.storage.sync.get("ddrNavUrls");
  const urls = data.ddrNavUrls || {};

  for (const k of KEYS) {
    document.getElementById(k).value = urls[k] || "";
  }
}

async function save() {
  const urls = {};
  for (const k of KEYS) {
    urls[k] = normalizeUrl(document.getElementById(k).value);
  }

  await chrome.storage.sync.set({ ddrNavUrls: urls });

  const status = document.getElementById("status");
  status.textContent = "Saved ✓";
  setTimeout(() => (status.textContent = ""), 1200);
}

document.getElementById("save").addEventListener("click", save);
load();