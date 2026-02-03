import { decodeBase64ToText, limitTextBody, MAX_BODY_BYTES } from "./utils.js";

// Captures network activity via the Chrome DevTools Protocol.
export class NetworkLogger {
  constructor() {
    this.attachedTabId = null;
    this.requests = new Map();
    this.logs = [];
    this.listening = false;
    this.onEvent = this.onEvent.bind(this);
    this.onDetach = this.onDetach.bind(this);
  }

  async attach(tabId) {
    if (this.attachedTabId === tabId) {
      return;
    }
    await this.detach();
    this.attachedTabId = tabId;
    this.requests.clear();
    this.logs = [];

    await new Promise((resolve, reject) => {
      chrome.debugger.attach({ tabId }, "1.3", () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });

    if (!this.listening) {
      chrome.debugger.onEvent.addListener(this.onEvent);
      chrome.debugger.onDetach.addListener(this.onDetach);
      this.listening = true;
    }

    await this.sendCommand("Network.enable", {
      maxTotalBufferSize: MAX_BODY_BYTES * 4,
      maxResourceBufferSize: MAX_BODY_BYTES
    });
  }

  async detach() {
    if (this.attachedTabId == null) {
      return;
    }
    const tabId = this.attachedTabId;
    this.attachedTabId = null;
    this.flushPending("detached");
    await new Promise((resolve) => {
      chrome.debugger.detach({ tabId }, () => resolve());
    });
  }

  getLogs() {
    return [...this.logs];
  }

  getLogCount() {
    return this.logs.length;
  }

  getPendingCount() {
    return this.requests.size;
  }

  clear() {
    this.requests.clear();
    this.logs = [];
  }

  flushPending(reason) {
    for (const record of this.requests.values()) {
      record.finishedTimestamp = record.finishedTimestamp ?? null;
      record.error = record.error || reason;
      this.logs.push(record);
    }
    this.requests.clear();
  }

  onDetach(source, reason) {
    if (source.tabId !== this.attachedTabId) {
      return;
    }
    this.flushPending(reason);
    this.attachedTabId = null;
  }

  onEvent(source, method, params) {
    if (source.tabId !== this.attachedTabId) {
      return;
    }
    switch (method) {
      case "Network.requestWillBeSent":
        this.handleRequestWillBeSent(params);
        break;
      case "Network.responseReceived":
        this.handleResponseReceived(params);
        break;
      case "Network.loadingFinished":
        this.handleLoadingFinished(params).catch((error) => {
          console.warn("Failed to capture response body", error);
        });
        break;
      default:
        break;
    }
  }

  handleRequestWillBeSent(params) {
    const { requestId, request, timestamp, wallTime } = params;
    const record = {
      requestId,
      url: request.url,
      method: request.method,
      requestHeaders: request.headers || {},
      requestBody: null,
      requestBodyTruncated: false,
      requestTimestamp: timestamp,
      wallTime,
      documentURL: params.documentURL || null
    };

    if (request.postData) {
      const limited = limitTextBody(request.postData);
      record.requestBody = limited.text;
      record.requestBodyTruncated = limited.truncated;
    }

    this.requests.set(requestId, record);
  }

  handleResponseReceived(params) {
    const record = this.ensureRecord(params.requestId);
    const response = params.response || {};
    record.status = response.status;
    record.statusText = response.statusText;
    record.responseHeaders = response.headers || {};
    record.responseTimestamp = params.timestamp;
    record.responseMimeType = response.mimeType;
    record.responseProtocol = response.protocol;
    record.fromDiskCache = response.fromDiskCache;
    record.fromServiceWorker = response.fromServiceWorker;
    record.responseTiming = response.timing || null;
  }

  async handleLoadingFinished(params) {
    const record = this.ensureRecord(params.requestId);
    record.encodedDataLength = params.encodedDataLength;
    record.finishedTimestamp = params.timestamp;

    try {
      const bodyResult = await this.sendCommand("Network.getResponseBody", {
        requestId: params.requestId
      });
      this.applyResponseBody(record, bodyResult);
    } catch (error) {
      record.responseBodyError = error.message;
    }

    if (
      record.requestTimestamp != null &&
      record.finishedTimestamp != null
    ) {
      record.durationMs =
        (record.finishedTimestamp - record.requestTimestamp) * 1000;
    }

    this.logs.push(record);
    this.requests.delete(params.requestId);
  }

  applyResponseBody(record, bodyResult) {
    if (!bodyResult || typeof bodyResult.body !== "string") {
      return;
    }
    const { body, base64Encoded } = bodyResult;
    record.responseBody = null;
    record.responseBodyTruncated = false;
    record.responseBodyEncoding = base64Encoded ? "base64" : "utf8";
    record.responseBodySkipped = false;

    if (base64Encoded) {
      // Skip binary bodies when decoding fails.
      const decoded = decodeBase64ToText(body);
      if (!decoded.ok) {
        record.responseBodySkipped = true;
        return;
      }
      const limited = limitTextBody(decoded.text);
      record.responseBody = limited.text;
      record.responseBodyTruncated = limited.truncated;
      record.responseBodyEncoding = "utf8";
      return;
    }

    const limited = limitTextBody(body);
    record.responseBody = limited.text;
    record.responseBodyTruncated = limited.truncated;
  }

  ensureRecord(requestId) {
    if (!this.requests.has(requestId)) {
      this.requests.set(requestId, { requestId });
    }
    return this.requests.get(requestId);
  }

  sendCommand(method, params) {
    return new Promise((resolve, reject) => {
      if (this.attachedTabId == null) {
        reject(new Error("Debugger is not attached."));
        return;
      }
      chrome.debugger.sendCommand(
        { tabId: this.attachedTabId },
        method,
        params,
        (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(result);
        }
      );
    });
  }
}
