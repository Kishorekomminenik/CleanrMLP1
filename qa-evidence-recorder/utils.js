export const MAX_BODY_BYTES = 200 * 1024;

export function limitTextBody(text, maxBytes = MAX_BODY_BYTES) {
  if (typeof text !== "string") {
    return { text: null, truncated: false, sizeBytes: 0 };
  }
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  if (encoded.length <= maxBytes) {
    return { text, truncated: false, sizeBytes: encoded.length };
  }
  const truncatedBytes = encoded.slice(0, maxBytes);
  const truncatedText = new TextDecoder().decode(truncatedBytes);
  return { text: truncatedText, truncated: true, sizeBytes: encoded.length };
}

export function decodeBase64ToText(base64) {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return { text: decoder.decode(bytes), ok: true };
  } catch (error) {
    return { text: null, ok: false };
  }
}

export function dataUrlToBlob(dataUrl) {
  const [meta, data] = dataUrl.split(",");
  const match = /data:(.*?);base64/.exec(meta);
  const mime = match?.[1] || "application/octet-stream";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function padNumber(value, length = 3) {
  return String(value).padStart(length, "0");
}

export function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "00:00";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

export function formatTimestampForFilename(value = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate()
  )}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function isRestrictedUrl(url) {
  if (!url || typeof url !== "string") {
    return true;
  }
  const blockedPrefixes = [
    "chrome://",
    "chrome-extension://",
    "chrome-devtools://",
    "edge://",
    "about:",
    "view-source:"
  ];
  if (blockedPrefixes.some((prefix) => url.startsWith(prefix))) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (
      (parsed.hostname === "chrome.google.com" &&
        parsed.pathname.startsWith("/webstore")) ||
      parsed.hostname === "chromewebstore.google.com"
    ) {
      return true;
    }
  } catch (error) {
    return true;
  }
  return false;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        URL.revokeObjectURL(url);
        reject(
          new Error(
            chrome.runtime.lastError?.message || "Download failed to start."
          )
        );
        return;
      }
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      resolve(downloadId);
    });
  });
}
