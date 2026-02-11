import React, { useCallback, useEffect, useMemo, useState } from 'react';

export default function ApiTesterPanel({ latestRequest }) {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/posts/1');
  const [activeTab, setActiveTab] = useState('params');
  const [paramsText, setParamsText] = useState('');
  const [headersText, setHeadersText] = useState('{\n  "Accept": "application/json"\n}');
  const [authType, setAuthType] = useState('none');
  const [authToken, setAuthToken] = useState('');
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [response, setResponse] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [autoFill, setAutoFill] = useState(true);
  const [lastAppliedAt, setLastAppliedAt] = useState(null);
  const [sendViaMain, setSendViaMain] = useState(true);

  const allowsBody = useMemo(() => !['GET', 'HEAD'].includes(method), [method]);

  const applyLatest = useCallback((request) => {
    if (!request) return;
    if (request.method) setMethod(request.method);
    if (request.url) setUrl(request.url);
    if (request.headers && Object.keys(request.headers).length > 0) {
      setHeadersText(JSON.stringify(request.headers, null, 2));
    }
    if (request.body !== undefined && request.body !== null) {
      setBodyText(String(request.body));
    }
    if (request.receivedAt) {
      setLastAppliedAt(request.receivedAt);
    } else {
      setLastAppliedAt(Date.now());
    }
  }, []);

  useEffect(() => {
    if (!autoFill || !latestRequest) return;
    if (latestRequest.receivedAt && latestRequest.receivedAt === lastAppliedAt) return;
    applyLatest(latestRequest);
  }, [autoFill, latestRequest, lastAppliedAt, applyLatest]);

  const parseHeaders = () => {
    if (!headersText.trim()) return {};
    try {
      const parsed = JSON.parse(headersText);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      throw new Error('Headers must be valid JSON.');
    }
  };

  const buildUrl = () => {
    if (!paramsText.trim()) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${paramsText.trim()}`;
  };
  const handleSend = async () => {
    setResponse(null);
    setIsSending(true);
    const startedAt = performance.now();

    try {
      const headers = parseHeaders();
      if (authType === 'bearer' && authToken.trim()) {
        headers.Authorization = `Bearer ${authToken.trim()}`;
      }
      if (authType === 'basic' && (authUser || authPass)) {
        const token = btoa(`${authUser}:${authPass}`);
        headers.Authorization = `Basic ${token}`;
      }

      const finalUrl = buildUrl();
      const options = { method, headers: { ...headers } };
      if (allowsBody && bodyText.trim()) {
        options.body = bodyText;
        if (!options.headers['Content-Type']) {
          const trimmed = bodyText.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            options.headers['Content-Type'] = 'application/json';
          }
        }
      }
      if (sendViaMain && window.electronAPI?.apiSend) {
        const res = await window.electronAPI.apiSend({
          method,
          url: finalUrl,
          headers: options.headers,
          body: options.body,
        });
        if (!res?.ok) throw new Error(res?.error || 'Request failed');
        const elapsedMs = res.timeMs ?? Math.round(performance.now() - startedAt);
        const text = res.body || '';
        const headerPairs = Array.isArray(res.headers) ? res.headers : [];
        const contentType = headerPairs.find(([key]) => String(key).toLowerCase() === 'content-type')?.[1] || '';
        let displayBody = text;
        if (contentType.includes('application/json')) {
          try {
            displayBody = JSON.stringify(JSON.parse(text), null, 2);
          } catch {
            displayBody = text;
          }
        }
        setResponse({
          ok: true,
          status: res.status,
          statusText: res.statusText,
          timeMs: elapsedMs,
          size: res.size ?? text.length,
          headers: headerPairs,
          body: displayBody,
        });
      } else {
        const res = await fetch(finalUrl, options);
        const text = await res.text();
        const elapsedMs = Math.round(performance.now() - startedAt);
        const contentType = res.headers.get('content-type') || '';
        let displayBody = text;

        if (contentType.includes('application/json')) {
          try {
            displayBody = JSON.stringify(JSON.parse(text), null, 2);
          } catch {
            displayBody = text;
          }
        }

        setResponse({
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          timeMs: elapsedMs,
          size: text.length,
          headers: Array.from(res.headers.entries()),
          body: displayBody,
        });
      }
    } catch (error) {
      setResponse({
        ok: false,
        status: 'Error',
        statusText: error.message || 'Request failed',
        timeMs: Math.round(performance.now() - startedAt),
        size: 0,
        headers: [],
        body: '',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="tool-panel">
      <div className="api-tester__url-bar">
        <select className="api-tester__method-select" value={method} onChange={(e) => setMethod(e.target.value)}>
          {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="api-tester__url-input"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter request URL..."
        />
        <button className="api-tester__send-btn" onClick={handleSend} disabled={isSending}>
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
      <div className="api-tester__autofill">
        <label className="api-tester__autofill-toggle">
          <input
            type="checkbox"
            checked={autoFill}
            onChange={(e) => setAutoFill(e.target.checked)}
          />
          Auto-fill from latest request
        </label>
        <button
          className="api-tester__autofill-btn"
          onClick={() => applyLatest(latestRequest)}
          disabled={!latestRequest}
          type="button"
        >
          Use last request
        </button>
        <div className="api-tester__autofill-meta">
          {latestRequest ? `${latestRequest.method} ${latestRequest.url}` : 'No request captured yet'}
        </div>
      </div>
      <div className="api-tester__send-mode">
        <label className="api-tester__send-toggle">
          <input
            type="checkbox"
            checked={sendViaMain}
            onChange={(e) => setSendViaMain(e.target.checked)}
          />
          Send via app (no CORS, uses browser cookies)
        </label>
      </div>
      <div className="api-tester__tabs">
        {['params', 'headers', 'auth', 'body'].map((tab) => (
          <button
            key={tab}
            className={`api-tester__tab ${activeTab === tab ? 'api-tester__tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="api-tester__editor">
        {activeTab === 'params' && (
          <div className="api-tester__section">
            <div className="api-tester__section-title">Query Params</div>
            <textarea
              className="api-tester__textarea"
              rows={6}
              placeholder="foo=1&bar=2"
              value={paramsText}
              onChange={(e) => setParamsText(e.target.value)}
            />
          </div>
        )}
        {activeTab === 'headers' && (
          <div className="api-tester__section">
            <div className="api-tester__section-title">Headers (JSON)</div>
            <textarea
              className="api-tester__textarea"
              rows={8}
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
            />
          </div>
        )}
        {activeTab === 'auth' && (
          <div className="api-tester__section">
            <div className="api-tester__section-title">Authorization</div>
            <div className="api-tester__auth-row">
              <select className="api-tester__auth-select" value={authType} onChange={(e) => setAuthType(e.target.value)}>
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic</option>
              </select>
              {authType === 'bearer' && (
                <input
                  className="api-tester__auth-input"
                  type="password"
                  placeholder="Token"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                />
              )}
              {authType === 'basic' && (
                <>
                  <input
                    className="api-tester__auth-input"
                    type="text"
                    placeholder="Username"
                    value={authUser}
                    onChange={(e) => setAuthUser(e.target.value)}
                  />
                  <input
                    className="api-tester__auth-input"
                    type="password"
                    placeholder="Password"
                    value={authPass}
                    onChange={(e) => setAuthPass(e.target.value)}
                  />
                </>
              )}
            </div>
          </div>
        )}
        {activeTab === 'body' && (
          <div className="api-tester__section">
            <div className="api-tester__section-title">Body {allowsBody ? '' : '(not supported for this method)'}</div>
            <textarea
              className="api-tester__textarea"
              rows={8}
              placeholder="Raw body (JSON, text, etc)"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              disabled={!allowsBody}
            />
          </div>
        )}
      </div>
      <div className="api-tester__response">
        <div className="api-tester__response-header">
          <span className="tool-panel__title">Response</span>
          {response ? (
            <span className={`tool-panel__badge ${response.ok ? 'tool-panel__badge--success' : 'tool-panel__badge--warn'}`}>
              {response.status} {response.statusText}
            </span>
          ) : (
            <span className="tool-panel__badge tool-panel__badge--info">Ready</span>
          )}
        </div>
        <div className="api-tester__response-body">
          {!response && 'Click "Send" to execute the request and view the response here.'}
          {response && (
            <div className="api-tester__response-content">
              <div className="api-tester__response-meta">
                <span>Time: {response.timeMs} ms</span>
                <span>Size: {response.size} B</span>
              </div>
              <pre className="api-tester__response-text">{response.body || '(empty response)'}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
