// chrome-extension/src/background/service-worker.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
if (msg && msg.type === "jh-export") {
    const { filename, jsonText } = msg;
    // MV3 service worker 中没有 URL.createObjectURL，用 data URL
    const dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(jsonText);
    chrome.downloads.download(
      { url: dataUrl, filename: filename, saveAs: false },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true, downloadId });
        }
      }
    );
    return true;
  }
});
