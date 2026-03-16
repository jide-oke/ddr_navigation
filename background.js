chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL("config.html"),
    type: "popup",
    width: 560,
    height: 620
  });
});

const COMMANDS = new Set([
  "close_other_tabs",
  "close_current_tab",
  "reload_tab",
  "duplicate_tab",
  "reopen_closed_tabs"
]);

function getSenderTabContext(sender) {
  const tabId = sender?.tab?.id;
  const windowId = sender?.tab?.windowId;
  if (typeof tabId !== "number" || typeof windowId !== "number") return null;
  return { tabId, windowId };
}

function sendOk(sendResponse) {
  sendResponse({ ok: true });
}

function sendError(sendResponse, error) {
  sendResponse({ ok: false, error: String(error || "unknown_error") });
}

function runCommand(command, sender, sendResponse) {
  if (!COMMANDS.has(command)) {
    sendError(sendResponse, "unsupported_command");
    return;
  }

  if (command === "reopen_closed_tabs") {
    chrome.sessions.restore((session) => {
      if (chrome.runtime.lastError) {
        sendError(sendResponse, chrome.runtime.lastError.message);
        return;
      }
      if (!session) {
        sendError(sendResponse, "no_recently_closed");
        return;
      }
      sendOk(sendResponse);
    });
    return;
  }

  const context = getSenderTabContext(sender);
  if (!context) {
    sendError(sendResponse, "missing_sender_tab");
    return;
  }

  const { tabId, windowId } = context;

  if (command === "reload_tab") {
    chrome.tabs.reload(tabId, () => {
      if (chrome.runtime.lastError) {
        sendError(sendResponse, chrome.runtime.lastError.message);
        return;
      }
      sendOk(sendResponse);
    });
    return;
  }

  if (command === "duplicate_tab") {
    chrome.tabs.duplicate(tabId, () => {
      if (chrome.runtime.lastError) {
        sendError(sendResponse, chrome.runtime.lastError.message);
        return;
      }
      sendOk(sendResponse);
    });
    return;
  }

  if (command === "close_current_tab") {
    chrome.tabs.remove(tabId, () => {
      if (chrome.runtime.lastError) {
        sendError(sendResponse, chrome.runtime.lastError.message);
        return;
      }
      sendOk(sendResponse);
    });
    return;
  }

  if (command === "close_other_tabs") {
    chrome.tabs.query({ windowId }, (tabs) => {
      if (chrome.runtime.lastError) {
        sendError(sendResponse, chrome.runtime.lastError.message);
        return;
      }

      const idsToClose = tabs
        .map((tab) => tab.id)
        .filter((id) => typeof id === "number" && id !== tabId);

      if (!idsToClose.length) {
        sendOk(sendResponse);
        return;
      }

      chrome.tabs.remove(idsToClose, () => {
        if (chrome.runtime.lastError) {
          sendError(sendResponse, chrome.runtime.lastError.message);
          return;
        }
        sendOk(sendResponse);
      });
    });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ddr-open-url-new-tab") {
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
  }

  if (message?.type === "ddr-run-command") {
    runCommand(String(message.command || "").trim(), _sender, sendResponse);
    return true;
  }

  return undefined;
});
