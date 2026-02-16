chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL("config.html"),
    type: "popup",
    width: 560,
    height: 620
  });
});
