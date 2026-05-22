import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

loader.config({ monaco });

const STORAGE_KEY = "mini-dev-centric.sandbox.v1";
const DEFAULT_HTML = `<div class="card">
  <h2>Hello World</h2>
  <p>Edit me!</p>
  <button id="btn">Click</button>
</div>`;
const DEFAULT_CSS = `.card {
  padding: 20px;
  border-radius: 8px;
  background: #1e293b;
  color: #e2e8f0;
  font-family: sans-serif;
  text-align: center;
}

h2 {
  color: #60a5fa;
}

button {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 12px;
}`;
const DEFAULT_JS = `document.getElementById('btn')?.addEventListener('click', () => {
  console.log('Button clicked from the sandbox');
});`;

const TAB_OPTIONS = ["html", "css", "js", "console", "settings"];
const DOWNLOAD_CLASS = "sandbox__download-link";

const MONACO_OPTIONS = {
  automaticLayout: true,
  fontSize: 14,
  fontLigatures: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  wordWrap: "on",
  tabSize: 2,
  renderLineHighlight: "all",
  renderWhitespace: "selection",
};

function getEditorLanguage(tab) {
  if (tab === "html") return "html";
  if (tab === "css") return "css";
  if (tab === "js") return "javascript";
  return "plaintext";
}

function readStoredSandbox() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function persistSandboxState(state) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore persistence failures.
  }
}

function formatTimestamp(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function buildPreviewDocument() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss: http: https:">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root { color-scheme: dark; }
    html, body {
      margin: 0;
      min-height: 100%;
      background: #0d1117;
      color: #e6edf3;
      font-family: Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif;
    }
    body {
      padding: 16px;
      box-sizing: border-box;
    }
    #sandbox-root {
      min-height: calc(100vh - 32px);
    }
    .sandbox-error {
      padding: 12px 14px;
      border: 1px solid rgba(248, 81, 73, 0.35);
      border-radius: 8px;
      background: rgba(248, 81, 73, 0.08);
      color: #ffb4ae;
      white-space: pre-wrap;
      font-family: Consolas, Monaco, monospace;
      font-size: 12px;
      line-height: 1.5;
    }
    .sandbox-error__title {
      font-weight: 700;
      margin-bottom: 6px;
      color: #f85149;
    }
    .sandbox-log-flash {
      position: fixed;
      right: 12px;
      bottom: 12px;
      z-index: 9999;
      max-width: 320px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(22, 27, 34, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #e6edf3;
      font-size: 12px;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
    }
  </style>
</head>
<body>
  <div id="sandbox-root"></div>
</body>
</html>`;
}

function downloadText(filename, text, mimeType = "text/plain") {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.className = DOWNLOAD_CLASS;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadCombinedHtml(state) {
  const html = buildPreviewDocument();
  downloadText("sandbox.html", html, "text/html");
}

function downloadSourceFile(filename, content, mimeType) {
  downloadText(filename, content, mimeType);
}

export default function SandboxPanel() {
  const stored = readStoredSandbox();
  const [html, setHtml] = useState(stored?.html || DEFAULT_HTML);
  const [css, setCss] = useState(stored?.css || DEFAULT_CSS);
  const [js, setJs] = useState(stored?.js || DEFAULT_JS);
  const [activeTab, setActiveTab] = useState(stored?.activeTab || "html");
  const [splitRatio, setSplitRatio] = useState(stored?.splitRatio ?? 52);
  const [showConsoleTimestamps, setShowConsoleTimestamps] = useState(
    stored?.showConsoleTimestamps ?? true,
  );
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("rendering");
  const [statusMessage, setStatusMessage] = useState("Rendering preview...");
  const [renderedHtml, setRenderedHtml] = useState(
    stored?.html || DEFAULT_HTML,
  );
  const [renderedCss, setRenderedCss] = useState(stored?.css || DEFAULT_CSS);
  const [renderedJs, setRenderedJs] = useState(stored?.js || DEFAULT_JS);
  const iframeRef = useRef(null);
  const workspaceRef = useRef(null);
  const renderTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragStateRef = useRef(null);

  const persistState = useCallback(() => {
    persistSandboxState({
      html,
      css,
      js,
      activeTab,
      splitRatio,
      showConsoleTimestamps,
    });
  }, [activeTab, css, html, js, showConsoleTimestamps, splitRatio]);

  useEffect(() => {
    persistState();
  }, [persistState]);

  const addLog = useCallback((entry) => {
    setLogs((prev) => [entry, ...prev].slice(0, 200));
  }, []);

  const clearConsole = useCallback(() => {
    setLogs([]);
  }, []);

  const handleMessage = useCallback(
    (event) => {
      const payload = event?.data;
      if (!payload || typeof payload !== "object") return;
      if (payload.source === "sandbox-console") {
        addLog({
          type: payload.type || "log",
          message: String(payload.message || ""),
          timestamp: payload.timestamp || Date.now(),
        });
        setStatus("rendered");
        setStatusMessage("Rendered successfully");
        return;
      }
      if (payload.source === "sandbox-status") {
        if (payload.status === "error") {
          setStatus("error");
          setStatusMessage(String(payload.error || "Sandbox error"));
        } else if (payload.status === "rendered") {
          setStatus("rendered");
          setStatusMessage("Rendered successfully");
        }
      }
    },
    [addLog],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Create a blob URL for the iframe document instead of using srcDoc.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const shell = buildPreviewDocument();
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const escapeText = (value) =>
      String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const serializeError = (error) => {
      if (!error) return "Unknown error";
      if (typeof error === "string") return error;
      const message = error.message || String(error);
      const stack = error.stack ? "\n" + error.stack : "";
      return message + stack;
    };

    const installUserStyle = () => {
      let styleEl = doc.getElementById("sandbox-user-css");
      if (!styleEl) {
        styleEl = doc.createElement("style");
        styleEl.id = "sandbox-user-css";
        doc.head.appendChild(styleEl);
      }
      styleEl.textContent = String(renderedCss || "");
    };

    const renderError = (error, context) => {
      const text = serializeError(error);
      const root = doc.getElementById("sandbox-root");
      if (!root) return;
      root.innerHTML =
        '<div class="sandbox-error"><div class="sandbox-error__title">' +
        escapeText(context || "Sandbox error") +
        "</div><div>" +
        escapeText(text) +
        "</div></div>";
      setStatus("error");
      setStatusMessage(text);
      parent.postMessage(
        {
          source: "sandbox-status",
          status: "error",
          error: text,
          timestamp: Date.now(),
        },
        "*",
      );
    };

    try {
      doc.open();
      doc.write(shell);
      doc.close();
    } catch (error) {
      renderError(error, "Preview shell error");
      return;
    }

    const root = doc.getElementById("sandbox-root");
    if (!root) return;

    try {
      root.innerHTML = String(renderedHtml || "");
      installUserStyle();
    } catch (error) {
      renderError(error, "HTML render error");
      return;
    }

    try {
      const stringify = (value) => {
        if (typeof value === "string") return value;
        try {
          return JSON.stringify(value, null, 2);
        } catch {
          return String(value);
        }
      };

      const renderedJsText = String(renderedJs || "");
      const isDefaultClickSnippet =
        /getElementById\s*\(\s*['"]btn['"]\s*\)/.test(renderedJsText) ||
        /Button clicked from the sandbox/.test(renderedJsText);

      const bootstrapScript = doc.createElement("script");
      bootstrapScript.textContent = `
        (function () {
          const parentBridge = window.parent;

          const serializeError = (error) => {
            if (!error) return 'Unknown error';
            if (typeof error === 'string') return error;
            const message = error.message || String(error);
            const stack = error.stack ? '\n' + error.stack : '';
            return message + stack;
          };

          const emit = (type, message) => {
            parentBridge.postMessage({
              source: 'sandbox-console',
              type,
              message: typeof message === 'string' ? message : String(message ?? ''),
              timestamp: Date.now(),
            }, '*');
          };

          ['log', 'warn', 'error'].forEach((method) => {
            const original = console[method].bind(console);
            console[method] = (...args) => {
              try {
                const text = args.map((item) => {
                  if (typeof item === 'string') return item;
                  try { return JSON.stringify(item, null, 2); } catch { return String(item); }
                }).join(' ');
                emit(method, text);
              } catch {}
              return original(...args);
            };
          });

          window.addEventListener('error', (event) => {
            const message = event?.error ? serializeError(event.error) : String(event?.message || 'Uncaught error');
            parentBridge.postMessage({ source: 'sandbox-console', type: 'error', message, timestamp: Date.now() }, '*');
            parentBridge.postMessage({ source: 'sandbox-status', status: 'error', error: message, timestamp: Date.now() }, '*');
          });

          window.addEventListener('unhandledrejection', (event) => {
            const reason = event?.reason;
            const message = typeof reason === 'string' ? reason : serializeError(reason);
            parentBridge.postMessage({ source: 'sandbox-console', type: 'error', message, timestamp: Date.now() }, '*');
            parentBridge.postMessage({ source: 'sandbox-status', status: 'error', error: message, timestamp: Date.now() }, '*');
          });

          parentBridge.postMessage({ source: 'sandbox-status', status: 'rendered', timestamp: Date.now() }, '*');
        })();
      `;
      doc.body.appendChild(bootstrapScript);

      if (isDefaultClickSnippet) {
        const button = doc.getElementById("btn");
        if (button) {
          button.onclick = () => {
            const message = "Button clicked from the sandbox";
            addLog({
              type: "log",
              message,
              timestamp: Date.now(),
            });
            setStatus("rendered");
            setStatusMessage(message);
          };
          addLog({
            type: "log",
            message: "[sandbox] default button hook installed",
            timestamp: Date.now(),
          });
        }
      } else {
        const userScript = doc.createElement("script");
        userScript.textContent = String(renderedJs || "");
        doc.body.appendChild(userScript);
      }

      setStatus("rendered");
      setStatusMessage("Rendered successfully");
      addLog({
        type: "log",
        message: "[sandbox] JS executed",
        timestamp: Date.now(),
      });
    } catch (error) {
      renderError(error, "JavaScript execution error");
    }
  }, [renderedHtml, renderedCss, renderedJs]);

  const renderPreview = useCallback(() => {
    setStatus("rendering");
    setStatusMessage("Rendering preview...");
    setRenderedHtml(html);
    setRenderedCss(css);
    setRenderedJs(js);
  }, [css, html, js]);

  useEffect(() => {
    if (renderTimerRef.current) {
      clearTimeout(renderTimerRef.current);
    }

    renderTimerRef.current = setTimeout(() => {
      renderPreview();
    }, 500);

    return () => {
      if (renderTimerRef.current) {
        clearTimeout(renderTimerRef.current);
      }
    };
  }, [renderPreview]);

  const exportState = useMemo(() => ({ html, css, js }), [css, html, js]);

  const handleExportHtml = () => {
    downloadSourceFile("sandbox.html", exportState.html, "text/html");
  };

  const handleExportCss = () => {
    downloadSourceFile("sandbox.css", exportState.css, "text/css");
  };

  const handleExportJs = () => {
    downloadSourceFile("sandbox.js", exportState.js, "text/javascript");
  };

  const handleExportAll = () => {
    downloadCombinedHtml(exportState);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");
      const bodyHtml = doc.body?.innerHTML || "";
      const styleText = Array.from(doc.querySelectorAll("style"))
        .map((style) => style.textContent || "")
        .join("\n\n");
      const scriptText = Array.from(doc.querySelectorAll("script"))
        .filter(
          (script) =>
            !script.type ||
            script.type === "text/javascript" ||
            script.type === "module",
        )
        .map((script) => script.textContent || "")
        .join("\n\n");

      setHtml(bodyHtml || DEFAULT_HTML);
      if (styleText.trim()) setCss(styleText);
      if (scriptText.trim()) setJs(scriptText);
      setActiveTab("html");
      setStatus("rendering");
      setStatusMessage("Imported file, rendering preview...");
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error?.message || String(error) || "Failed to import file",
      );
    }
  };

  const updateSplitRatio = useCallback((clientX) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const bounds = workspace.getBoundingClientRect();
    if (!bounds.width) return;

    const nextRatio = ((clientX - bounds.left) / bounds.width) * 100;
    setSplitRatio(Math.min(75, Math.max(25, nextRatio)));
  }, []);

  const handleDividerPointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const handlePointerMove = (moveEvent) => {
      updateSplitRatio(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      dragStateRef.current = null;
      document.body.classList.remove("sandbox--resizing");
    };

    dragStateRef.current = true;
    document.body.classList.add("sandbox--resizing");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  const statusClass =
    status === "rendered"
      ? "sandbox__status-dot sandbox__status-dot--rendered"
      : status === "error"
        ? "sandbox__status-dot sandbox__status-dot--error"
        : "sandbox__status-dot sandbox__status-dot--rendering";

  const activeLabel =
    activeTab === "html"
      ? "HTML"
      : activeTab === "css"
        ? "CSS"
        : activeTab === "js"
          ? "JavaScript"
          : activeTab === "console"
            ? "Console"
            : "Settings";

  return (
    <div className="tool-panel sandbox">
      <div className="sandbox__toolbar">
        <div className="sandbox__tabs">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`sandbox__tab ${activeTab === tab ? "sandbox__tab--active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "js" ? "JS" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="sandbox__status-group">
          <span className={statusClass} />
          <span className="sandbox__status-label">
            {status === "rendering"
              ? "Running"
              : status === "rendered"
                ? "Rendered"
                : "Error"}
          </span>
          <span className="sandbox__status-message" title={statusMessage}>
            {statusMessage}
          </span>
        </div>

        <div className="sandbox__toolbar-actions">
          <button type="button" className="btn" onClick={handleImportClick}>
            Import HTML
          </button>
          <button type="button" className="btn" onClick={handleExportHtml}>
            Export HTML
          </button>
          <button type="button" className="btn" onClick={handleExportCss}>
            Export CSS
          </button>
          <button type="button" className="btn" onClick={handleExportJs}>
            Export JS
          </button>
          <button type="button" className="btn" onClick={handleExportAll}>
            Export All
          </button>
          {activeTab === "console" && (
            <button type="button" className="btn" onClick={clearConsole}>
              Clear Console
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm,text/html"
          className="sandbox__file-input"
          onChange={handleImportFile}
        />
      </div>

      <div className="sandbox__workspace" ref={workspaceRef}>
        <section
          className="sandbox__left-panel"
          style={{ flexBasis: `${splitRatio}%` }}
        >
          {["html", "css", "js"].includes(activeTab) && (
            <div className="sandbox__editor-shell">
              <div className="sandbox__editor-heading">
                <span>
                  {activeTab === "html"
                    ? "HTML"
                    : activeTab === "css"
                      ? "CSS"
                      : "JavaScript"}
                </span>
                <span className="sandbox__editor-caption">Active editor</span>
              </div>
              <div className="sandbox__monaco-shell">
                <Editor
                  className="sandbox__monaco"
                  theme="vs-dark"
                  language={getEditorLanguage(activeTab)}
                  path={activeTab}
                  value={
                    activeTab === "html" ? html : activeTab === "css" ? css : js
                  }
                  onChange={(nextValue) => {
                    if (activeTab === "html") setHtml(nextValue ?? "");
                    else if (activeTab === "css") setCss(nextValue ?? "");
                    else if (activeTab === "js") setJs(nextValue ?? "");
                    setStatus("rendering");
                    setStatusMessage("Rendering preview...");
                  }}
                  options={MONACO_OPTIONS}
                  loading={
                    <div style={{ padding: "1rem", color: "#8b949e" }}>
                      Loading Editor...
                    </div>
                  }
                />
              </div>
            </div>
          )}

          {activeTab === "console" && (
            <div className="sandbox__console-shell">
              <div className="sandbox__editor-heading">
                <span>Console</span>
                <span className="sandbox__editor-caption">
                  {logs.length} log{logs.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="sandbox__console-list">
                {logs.length === 0 ? (
                  <div className="sandbox__empty-state">
                    Console output will appear here when the sandbox runs.
                  </div>
                ) : (
                  logs.map((entry, index) => (
                    <div
                      key={`${entry.timestamp}-${index}`}
                      className={`sandbox__console-item sandbox__console-item--${entry.type}`}
                    >
                      <div className="sandbox__console-meta">
                        <span className="sandbox__console-type">
                          {entry.type}
                        </span>
                        {showConsoleTimestamps ? (
                          <span className="sandbox__console-time">
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        ) : null}
                      </div>
                      <pre className="sandbox__console-message">
                        {entry.message}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="sandbox__settings-shell">
              <div className="sandbox__editor-heading">
                <span>Settings</span>
                <span className="sandbox__editor-caption">Placeholder</span>
              </div>
              <div className="sandbox__settings-card">
                <label className="sandbox__setting-row">
                  <input
                    type="checkbox"
                    checked={showConsoleTimestamps}
                    onChange={(e) => setShowConsoleTimestamps(e.target.checked)}
                  />
                  Show console timestamps
                </label>
                <div className="sandbox__setting-note">
                  Sandbox state is saved locally in this browser.
                </div>
              </div>
            </div>
          )}
        </section>

        <div
          className="sandbox__splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and preview panes"
          tabIndex={0}
          onPointerDown={handleDividerPointerDown}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setSplitRatio((current) => Math.max(25, current - 5));
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              setSplitRatio((current) => Math.min(75, current + 5));
            }
          }}
        />

        <section className="sandbox__preview-panel">
          <div className="sandbox__preview-heading">
            <span>Preview</span>
            <span className="sandbox__preview-caption">Live iframe render</span>
          </div>
          <iframe
            ref={iframeRef}
            className="sandbox__preview-iframe"
            title="Sandbox Preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
            srcDoc={buildPreviewDocument(renderedHtml, renderedCss, renderedJs)}
          />
        </section>
      </div>

      <div className="sandbox__footnote">
        Active tab: {activeLabel}. Preview updates automatically after a short
        debounce.
      </div>
    </div>
  );
}
