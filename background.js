chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL("config.html"),
    type: "popup",
    width: 560,
    height: 620
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "ddr-open-url-new-tab") return;

  const url = String(message.url || "").trim();
  if (!url) {
    sendResponse({ ok: false });
    return;
  }

  chrome.tabs.create({ url }, () => {
    sendResponse({ ok: !chrome.runtime.lastError });
  });

  // Keep the message channel open for async sendResponse.
  return true;
});
