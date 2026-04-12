chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    message.type === "START_CONSOLE_CAPTURE" ||
    message.type === "STOP_CONSOLE_CAPTURE"
  ) {
    sendResponse({ ok: true, disabled: true });
  }
});
