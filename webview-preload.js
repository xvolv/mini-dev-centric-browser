const { ipcRenderer } = require('electron');

let pendingTimer = null;

const safeToString = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
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
  if (typeof headers === 'object') {
    return Object.keys(headers).reduce((acc, key) => {
      acc[key] = String(headers[key]);
      return acc;
    }, {});
  }
  return {};
};

const normalizeBody = (body) => {
  if (body == null) return undefined;
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (typeof body === 'object') return safeToString(body);
  return String(body);
};

const sendApiRequest = (payload) => {
  if (!payload || !payload.url || !payload.method) return;
  ipcRenderer.sendToHost('api-request', payload);
};

const sendSelection = () => {
  const selection = window.getSelection?.();
  const text = selection ? selection.toString().trim() : '';

  if (!text || !selection || selection.rangeCount === 0) {
    ipcRenderer.sendToHost('selection-change', { text: '' });
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

  ipcRenderer.sendToHost('selection-change', payload);
};

const scheduleSelection = () => {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
  }
  pendingTimer = setTimeout(sendSelection, 80);
};

window.addEventListener('mouseup', scheduleSelection, true);
window.addEventListener('keyup', scheduleSelection, true);
window.addEventListener('selectionchange', scheduleSelection, true);
window.addEventListener('scroll', scheduleSelection, true);

const originalFetch = window.fetch?.bind(window);

if (originalFetch) {
  window.fetch = async (input, init = {}) => {
    try {
      const request = input instanceof Request ? input : null;
      const method = (init.method || request?.method || 'GET').toUpperCase();
      const url = typeof input === 'string' ? input : request?.url || '';
      const headers = serializeHeaders(init.headers || request?.headers);
      const body = normalizeBody(init.body);
      sendApiRequest({ method, url, headers, body, source: 'fetch', capturedAt: Date.now() });
    } catch {
      // ignore capture errors
    }
    return originalFetch(input, init);
  };
}

const originalXhrOpen = XMLHttpRequest.prototype.open;
const originalXhrSend = XMLHttpRequest.prototype.send;
const originalXhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;

XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
  this.__devcentricMethod = method ? String(method).toUpperCase() : 'GET';
  this.__devcentricUrl = url ? String(url) : '';
  this.__devcentricHeaders = {};
  return originalXhrOpen.call(this, method, url, ...rest);
};

XMLHttpRequest.prototype.setRequestHeader = function setRequestHeader(name, value) {
  if (name) {
    this.__devcentricHeaders = this.__devcentricHeaders || {};
    this.__devcentricHeaders[String(name)] = String(value);
  }
  return originalXhrSetHeader.call(this, name, value);
};

XMLHttpRequest.prototype.send = function send(body) {
  try {
    sendApiRequest({
      method: this.__devcentricMethod || 'GET',
      url: this.__devcentricUrl || '',
      headers: this.__devcentricHeaders || {},
      body: normalizeBody(body),
      source: 'xhr',
      capturedAt: Date.now(),
    });
  } catch {
    // ignore capture errors
  }
  return originalXhrSend.call(this, body);
};
