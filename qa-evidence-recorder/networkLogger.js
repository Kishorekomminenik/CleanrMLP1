import { decodeBase64ToText, limitTextBody, MAX_BODY_BYTES } from "./utils.js";

const MAX_REQUESTS = 2000;

// Captures network activity via the Chrome DevTools Protocol.
export class NetworkLogger {
  constructor(store, options = {}) {
    this.store = store;
    this.attachedTabId = null;
    this.listening = false;
    this.maxRequests = options.maxRequests || MAX_REQUESTS;
    this.limitNotified = false;
    this.onEvent = this.onEvent.bind(this);
    this.onDetach = this.onDetach.bind(this);
  }

  async attach(tabId) {
    if (this.attachedTabId === tabId) {
      return;
    }
    await this.detach("re-attach");
    await new Promise((resolve, reject) => {
      chrome.debugger.attach({ tabId }, "1.3", () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });

    this.attachedTabId = tabId;
    this.store.clearRequests();
    this.limitNotified = false;

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

  async detach(reason = "detached") {
    if (this.attachedTabId == null) {
      return;
    }
    const tabId = this.attachedTabId;
    this.attachedTabId = null;
    this.flushPending(reason);
    await new Promise((resolve) => {
      chrome.debugger.detach({ tabId }, () => resolve());
    });
  }

  getPendingCount() {
    return this.store.getRequestMap().size;
  }

  flushPending(reason) {
    for (const record of this.store.getRequestMap().values()) {
      record.finishedTime = record.finishedTime ?? null;
      record.bodyError = record.bodyError || reason;
      this.store.addNetworkLog(record);
    }
    this.store.clearRequests();
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
    if (this.store.store.sessionState !== "recording") {
      return;
    }
    if (!["network", "all"].includes(this.store.store.mode)) {
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
      case "Network.loadingFailed":
        this.handleLoadingFailed(params);
        break;
      default:
        break;
    }
  }

  handleRequestWillBeSent(params) {
    const totalKnown =
      this.store.store.networkLogs.length + this.store.getRequestMap().size;
    if (totalKnown >= this.maxRequests) {
      if (!this.limitNotified) {
        this.store.setNetworkLimitReached();
        this.store.setMessage(
          "warning",
          "Network request limit reached (2000). New requests are ignored."
        );
        this.limitNotified = true;
      }
      return;
    }

    const { requestId, request, timestamp, wallTime } = params;
    const record = {
      requestId,
      url: request.url,
      method: request.method,
      requestHeaders: request.headers || {},
      requestPostData: request.postData || null,
      status: null,
      statusText: null,
      responseHeaders: {},
      responseBody: null,
      bodyTruncated: false,
      bodySkipped: false,
      bodyError: null,
      startTime: timestamp,
      responseTime: null,
      finishedTime: null,
      startOffsetMs: this.store.getElapsedMsForTimestamp(timestamp),
      responseOffsetMs: null,
      finishedOffsetMs: null,
      wallTime,
      wallTimeIso: wallTime ? new Date(wallTime * 1000).toISOString() : null,
      documentURL: params.documentURL || null,
      initiator: params.initiator || null,
      resourceType: params.type || null
    };

    this.store.setRequest(requestId, record);
  }

  handleResponseReceived(params) {
    const record = this.store.getRequest(params.requestId);
    if (!record) {
      return;
    }
    const response = params.response || {};
    record.status = response.status;
    record.statusText = response.statusText;
    record.responseHeaders = response.headers || {};
    record.responseTime = params.timestamp;
    record.responseOffsetMs = this.store.getElapsedMsForTimestamp(
      params.timestamp
    );
    record.responseMimeType = response.mimeType;
    record.responseProtocol = response.protocol;
    record.fromDiskCache = response.fromDiskCache;
    record.fromServiceWorker = response.fromServiceWorker;
    record.responseTiming = response.timing || null;
    record.encodedDataLength = response.encodedDataLength;
    record.remoteIPAddress = response.remoteIPAddress;
    record.remotePort = response.remotePort;
  }

  async handleLoadingFinished(params) {
    const record = this.store.getRequest(params.requestId);
    if (!record) {
      return;
    }
    record.finishedTime = params.timestamp;
    record.finishedOffsetMs = this.store.getElapsedMsForTimestamp(
      params.timestamp
    );
    record.encodedDataLength = params.encodedDataLength;

    try {
      const bodyResult = await this.sendCommand("Network.getResponseBody", {
        requestId: params.requestId
      });
      this.applyResponseBody(record, bodyResult);
    } catch (error) {
      record.bodyError = error.message;
    }

    if (
      Number.isFinite(record.startOffsetMs) &&
      Number.isFinite(record.finishedOffsetMs)
    ) {
      record.durationMs = record.finishedOffsetMs - record.startOffsetMs;
    }

    this.store.addNetworkLog(record);
    this.store.deleteRequest(params.requestId);
  }

  handleLoadingFailed(params) {
    const record = this.store.getRequest(params.requestId);
    if (!record) {
      return;
    }
    record.finishedTime = params.timestamp;
    record.finishedOffsetMs = this.store.getElapsedMsForTimestamp(
      params.timestamp
    );
    record.errorText = params.errorText;
    record.canceled = params.canceled;
    record.blockedReason = params.blockedReason || null;
    record.type = params.type || null;
    record.bodyError = record.bodyError || "loadingFailed";
    if (
      Number.isFinite(record.startOffsetMs) &&
      Number.isFinite(record.finishedOffsetMs)
    ) {
      record.durationMs = record.finishedOffsetMs - record.startOffsetMs;
    }
    this.store.addNetworkLog(record);
    this.store.deleteRequest(params.requestId);
  }

  applyResponseBody(record, bodyResult) {
    if (!bodyResult || typeof bodyResult.body !== "string") {
      return;
    }
    const { body, base64Encoded } = bodyResult;
    record.responseBody = null;
    record.bodyTruncated = false;
    record.bodySkipped = false;
    record.bodyError = record.bodyError || null;

    if (base64Encoded) {
      const decoded = decodeBase64ToText(body);
      if (!decoded.ok) {
        record.bodySkipped = true;
        record.bodyError = record.bodyError || "Binary response body skipped";
        return;
      }
      const limited = limitTextBody(decoded.text);
      record.responseBody = limited.text;
      record.bodyTruncated = limited.truncated;
      record.responseBodySizeBytes = limited.sizeBytes;
      return;
    }

    const limited = limitTextBody(body);
    record.responseBody = limited.text;
    record.bodyTruncated = limited.truncated;
    record.responseBodySizeBytes = limited.sizeBytes;
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
