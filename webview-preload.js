const { ipcRenderer } = require("electron");

let pendingTimer = null;
let scrollTimeout = null;

const safeToString = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const serializeHeaders = (headers) => {
  if (!headers) return {};
  try {
    if (headers instanceof Headers) {
      return Object.fromEntries(headers.entries());
    }
  } catch {
    // ignore
  }
  if (Array.isArray(headers)) {
    return headers.reduce((acc, pair) => {
      if (Array.isArray(pair) && pair.length >= 2) {
        acc[String(pair[0])] = String(pair[1]);
      }
      return acc;
    }, {});
  }
  if (typeof headers === "object") {
    return Object.keys(headers).reduce((acc, key) => {
      acc[key] = String(headers[key]);
      return acc;
    }, {});
  }
  return {};
};

const parseHeaderBlock = (headerBlock) => {
  if (typeof headerBlock !== "string" || !headerBlock.trim()) return {};

  return headerBlock.split(/\r?\n/).reduce((acc, line) => {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) return acc;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) return acc;
    acc[key] = value;
    return acc;
  }, {});
};

const normalizeBody = (body) => {
  if (body == null) return undefined;
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (typeof body === "object") return safeToString(body);
  return String(body);
};

const sendApiRequest = (payload) => {
  if (!payload || !payload.url || !payload.method) return;
  ipcRenderer.sendToHost("api-request", payload);
};

const sendSelection = () => {
  const selection = window.getSelection?.();
  const text = selection ? selection.toString().trim() : "";

  if (!text || !selection || selection.rangeCount === 0) {
    ipcRenderer.sendToHost("selection-change", { text: "" });
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const payload = {
    text: text.slice(0, 4000),
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
  };

  ipcRenderer.sendToHost("selection-change", payload);
};

const sendPageError = (payload) => {
  try {
    ipcRenderer.sendToHost("page-error", payload);
  } catch {
    // ignore capture errors
  }
};

window.addEventListener("error", (event) => {
  sendPageError({
    type: "error",
    message: event?.message || "Uncaught error",
    sourceId: event?.filename || event?.source || "",
    line: Number.isFinite(event?.lineno) ? event.lineno : 0,
    column: Number.isFinite(event?.colno) ? event.colno : 0,
    stack: event?.error?.stack || "",
    capturedAt: Date.now(),
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason;
  const message =
    typeof reason === "string"
      ? reason
      : reason?.message || "Unhandled promise rejection";

  sendPageError({
    type: "error",
    message,
    sourceId: "unhandledrejection",
    line: 0,
    column: 0,
    stack: reason?.stack || "",
    capturedAt: Date.now(),
  });
});

const scheduleSelection = () => {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
  }
  pendingTimer = setTimeout(sendSelection, 80);
};

const sendScrollEvent = () => {
  const scrollY = window.scrollY || 0;
  ipcRenderer.sendToHost("scroll-event", scrollY);
};

const scheduleScrollEvent = () => {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  scrollTimeout = setTimeout(sendScrollEvent, 16);
};

window.addEventListener("mouseup", scheduleSelection, true);
window.addEventListener("keyup", scheduleSelection, true);
window.addEventListener("selectionchange", scheduleSelection, true);
window.addEventListener("scroll", scheduleSelection, true);
window.addEventListener("scroll", scheduleScrollEvent, true);

const originalFetch = window.fetch?.bind(window);

if (originalFetch) {
  window.fetch = async (input, init = {}) => {
    const startedAt = Date.now();
    try {
      const request = input instanceof Request ? input : null;
      const method = (init.method || request?.method || "GET").toUpperCase();
      const url = typeof input === "string" ? input : request?.url || "";
      const headers = serializeHeaders(init.headers || request?.headers);
      let body = normalizeBody(init.body);
      if (body == null && request?.clone) {
        try {
          body = normalizeBody(await request.clone().text());
        } catch {
          body = undefined;
        }
      }
      const response = await originalFetch(input, init);
      let responseBody = "";
      try {
        responseBody = await response.clone().text();
      } catch {
        responseBody = "";
      }
      sendApiRequest({
        method,
        url,
        headers,
        body,
        source: "fetch",
        capturedAt: startedAt,
        status: response.status,
        statusText: response.statusText,
        responseHeaders: serializeHeaders(response.headers),
        responseBody,
        contentType: response.headers.get("content-type") || "",
      });
      return response;
    } catch (error) {
      // ignore capture errors
      throw error;
    }
  };
}

const originalXhrOpen = XMLHttpRequest.prototype.open;
const originalXhrSend = XMLHttpRequest.prototype.send;
const originalXhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;

XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
  this.__devcentricMethod = method ? String(method).toUpperCase() : "GET";
  this.__devcentricUrl = url ? String(url) : "";
  this.__devcentricHeaders = {};
  return originalXhrOpen.call(this, method, url, ...rest);
};

XMLHttpRequest.prototype.setRequestHeader = function setRequestHeader(
  name,
  value,
) {
  if (name) {
    this.__devcentricHeaders = this.__devcentricHeaders || {};
    this.__devcentricHeaders[String(name)] = String(value);
  }
  return originalXhrSetHeader.call(this, name, value);
};

XMLHttpRequest.prototype.send = function send(body) {
  const startedAt = Date.now();
  try {
    const finalizeRequest = () => {
      this.removeEventListener("loadend", finalizeRequest);
      this.removeEventListener("error", finalizeRequest);
      let responseHeaders = {};
      try {
        responseHeaders = parseHeaderBlock(this.getAllResponseHeaders?.() || "");
      } catch {
        responseHeaders = {};
      }

      sendApiRequest({
        method: this.__devcentricMethod || "GET",
        url: this.__devcentricUrl || "",
        headers: this.__devcentricHeaders || {},
        body: normalizeBody(body),
        source: "xhr",
        capturedAt: startedAt,
        status: this.status,
        statusText: this.statusText || "",
        responseHeaders,
        responseBody: typeof this.responseText === "string" ? this.responseText : "",
        contentType:
          responseHeaders["content-type"] || responseHeaders["Content-Type"] || "",
      });
    };

    this.addEventListener("loadend", finalizeRequest, { once: true });
    this.addEventListener("error", finalizeRequest, { once: true });
  } catch {
    // ignore capture errors
  }
  return originalXhrSend.call(this, body);
};
