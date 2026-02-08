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

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value, true);
}

export async function createZipBlob(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const data = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(data);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, 0);
    writeUint16(localView, 12, 0);
    writeUint32(localView, 14, crc);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);

    localParts.push(localHeader, nameBytes, data);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, 0);
    writeUint16(centralView, 14, 0);
    writeUint32(centralView, 16, crc);
    writeUint32(centralView, 20, data.length);
    writeUint32(centralView, 24, data.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);

    centralParts.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = offset;

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, centralOffset);
  writeUint16(endView, 20, 0);

  return new Blob([...localParts, ...centralParts, endRecord], {
    type: "application/zip"
  });
}
