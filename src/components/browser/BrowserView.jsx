import React, { useEffect, useMemo, useRef, useState } from "react";

export default function BrowserView({
  tabs,
  activeTabId,
  isLoading,
  onLoadingChange,
  onTitleUpdate,
  onUrlUpdate,
  onNavStateChange,
  onWebviewReady,
  onConsoleMessage,
  onApiRequest,
  deviceSim,
  onPageContent,
  onSelectionAction,
}) {
  const webviewRefs = useRef({});
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [selectionInfo, setSelectionInfo] = useState(null);
  const [selectionPos, setSelectionPos] = useState(null);
  const webviewPreload = window.electronAPI?.webviewPreloadPath;
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const hasActiveUrl = Boolean(activeTab && activeTab.url);

  const viewport = useMemo(() => {
    if (!deviceSim?.enabled) return null;
    const width =
      deviceSim.orientation === "portrait" ? deviceSim.width : deviceSim.height;
    const height =
      deviceSim.orientation === "portrait" ? deviceSim.height : deviceSim.width;
    return { width, height };
  }, [deviceSim]);

  useEffect(() => {
    setSelectionInfo(null);
  }, [activeTabId]);

  useEffect(() => {
    if (!selectionInfo?.rect) {
      setSelectionPos(null);
      return;
    }
    const webview = webviewRefs.current[activeTabId];
    const container = containerRef.current;
    if (!webview || !container) {
      setSelectionPos(null);
      return;
    }

    const webviewRect = webview.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const rect = selectionInfo.rect || {};
    const left = Number.isFinite(rect.left) ? rect.left : 0;
    const top = Number.isFinite(rect.top) ? rect.top : 0;
    const width = Number.isFinite(rect.width) ? rect.width : 0;

    const rawX = webviewRect.left - containerRect.left + (left + width) * scale;
    const rawY = webviewRect.top - containerRect.top + top * scale - 34;
    const x = Math.max(8, Math.min(rawX, containerRect.width - 36));
    const y = Math.max(8, Math.min(rawY, containerRect.height - 36));
    setSelectionPos({ x, y });
  }, [selectionInfo, activeTabId, scale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const updateScale = () => {
      if (!viewport) {
        setScale(1);
        return;
      }
      const rect = container.getBoundingClientRect();
      const maxW = Math.max(0, rect.width - 24);
      const maxH = Math.max(0, rect.height - 24);
      const next = Math.min(1, maxW / viewport.width, maxH / viewport.height);
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [viewport]);

  useEffect(() => {
    const webview = webviewRefs.current[activeTabId];
    if (!webview) return undefined;
    const timeouts = [];

    const captureHtml = () => {
      if (!onPageContent) return;
      try {
        webview
          .executeJavaScript('document.body ? document.body.innerText : ""')
          .then((html) => {
            const safeHtml =
              typeof html === "string" ? html : String(html ?? "");
            onPageContent(activeTabId, safeHtml);
          })
          .catch(() => {});
      } catch {
        // ignore
      }
    };

    const scheduleCapture = (delayMs) => {
      if (!onPageContent) return;
      const id = setTimeout(captureHtml, delayMs);
      timeouts.push(id);
    };

    const updateNavState = () => {
      if (!onNavStateChange) return;
      try {
        onNavStateChange({
          canGoBack: webview.canGoBack(),
          canGoForward: webview.canGoForward(),
        });
      } catch {
        onNavStateChange({ canGoBack: false, canGoForward: false });
      }
    };

    const handleStart = () => onLoadingChange?.(true);
    const handleStop = () => {
      onLoadingChange?.(false);
      updateNavState();
      scheduleCapture(0);
      scheduleCapture(1500);
    };
    const handleTitle = (event) => onTitleUpdate?.(event.title);
    const handleNavigate = (event) => {
      onUrlUpdate?.(event.url);
      updateNavState();
      setSelectionInfo(null);
    };
    const handleDomReady = () => {
      scheduleCapture(0);
      scheduleCapture(1500);
    };
    const handleFinish = () => scheduleCapture(0);

    webview.addEventListener("did-start-loading", handleStart);
    webview.addEventListener("did-stop-loading", handleStop);
    webview.addEventListener("dom-ready", handleDomReady);
    webview.addEventListener("did-finish-load", handleFinish);
    webview.addEventListener("page-title-updated", handleTitle);
    webview.addEventListener("did-navigate", handleNavigate);
    webview.addEventListener("did-navigate-in-page", handleNavigate);

    updateNavState();

    return () => {
      webview.removeEventListener("did-start-loading", handleStart);
      webview.removeEventListener("did-stop-loading", handleStop);
      webview.removeEventListener("dom-ready", handleDomReady);
      webview.removeEventListener("did-finish-load", handleFinish);
      webview.removeEventListener("page-title-updated", handleTitle);
      webview.removeEventListener("did-navigate", handleNavigate);
      webview.removeEventListener("did-navigate-in-page", handleNavigate);
      timeouts.forEach((id) => clearTimeout(id));
    };
  }, [
    activeTabId,
    onLoadingChange,
    onNavStateChange,
    onTitleUpdate,
    onUrlUpdate,
    onPageContent,
  ]);

  if (!hasActiveUrl) {
    return (
      <div className="browser-view">
        <div className="browser-view__empty">
          <div className="browser-view__empty-logo">D</div>
          <div className="browser-view__empty-title">
            Mini Dev-Centric Browser
          </div>
          <div className="browser-view__empty-subtitle">
            Enter a URL above or open a new tab to start browsing
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="browser-view" ref={containerRef}>
      {isLoading && (
        <div className="browser-view__loading">
          <div className="browser-view__loading-bar" />
        </div>
      )}
      {viewport ? (
        <div className="browser-view__device-stage">
          <div
            className="browser-view__device-outer"
            style={{
              width: viewport.width * scale,
              height: viewport.height * scale,
            }}
          >
            <div
              className="browser-view__device-frame"
              style={{
                width: viewport.width,
                height: viewport.height,
                transform: `scale(${scale})`,
              }}
            >
              <webview
                key={activeTab.id}
                src={activeTab.url}
                preload={webviewPreload}
                style={{ width: "100%", height: "100%" }}
                ref={(el) => {
                  if (!el) return;
                  webviewRefs.current[activeTab.id] = el;
                  if (!el.__devcentricConsoleAttached) {
                    el.__devcentricConsoleAttached = true;
                    el.addEventListener("console-message", (event) => {
                      onConsoleMessage?.(activeTab.id, {
                        level: event.level,
                        message: event.message,
                        line: event.line,
                        sourceId: event.sourceId,
                      });
                    });
                  }
                  if (!el.__devcentricSelectionAttached) {
                    el.__devcentricSelectionAttached = true;
                    el.addEventListener("ipc-message", (event) => {
                      if (event.channel === "selection-change") {
                        const payload = event.args?.[0] || {};
                        const text =
                          typeof payload.text === "string"
                            ? payload.text.trim()
                            : "";
                        if (!text) {
                          setSelectionInfo(null);
                          return;
                        }
                        setSelectionInfo({
                          text,
                          rect: payload.rect || {},
                        });
                        return;
                      }
                      if (event.channel === "api-request") {
                        const payload = event.args?.[0] || {};
                        onApiRequest?.(activeTabId, payload);
                      }
                    });
                  }
                  if (!el.__devcentricReady) {
                    el.__devcentricReady = true;
                    el.addEventListener("dom-ready", () => {
                      const webContentsId = el.getWebContentsId?.();
                      if (typeof webContentsId === "number") {
                        onWebviewReady?.(activeTab.id, webContentsId, el);
                      }
                    });
                  }
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <webview
          key={activeTab.id}
          src={activeTab.url}
          preload={webviewPreload}
          style={{ width: "100%", height: "100%" }}
          ref={(el) => {
            if (!el) return;
            webviewRefs.current[activeTab.id] = el;
            if (!el.__devcentricConsoleAttached) {
              el.__devcentricConsoleAttached = true;
              el.addEventListener("console-message", (event) => {
                onConsoleMessage?.(activeTab.id, {
                  level: event.level,
                  message: event.message,
                  line: event.line,
                  sourceId: event.sourceId,
                });
              });
            }
            if (!el.__devcentricSelectionAttached) {
              el.__devcentricSelectionAttached = true;
              el.addEventListener("ipc-message", (event) => {
                if (event.channel !== "selection-change") return;
                const payload = event.args?.[0] || {};
                const text =
                  typeof payload.text === "string" ? payload.text.trim() : "";
                if (!text) {
                  setSelectionInfo(null);
                  return;
                }
                setSelectionInfo({
                  text,
                  rect: payload.rect || {},
                });
              });
            }
            if (!el.__devcentricReady) {
              el.__devcentricReady = true;
              el.addEventListener("dom-ready", () => {
                const webContentsId = el.getWebContentsId?.();
                if (typeof webContentsId === "number") {
                  onWebviewReady?.(activeTab.id, webContentsId, el);
                }
              });
            }
          }}
        />
      )}
      {selectionPos && selectionInfo?.text && (
        <button
          className="browser-view__selection-action"
          style={{ left: selectionPos.x, top: selectionPos.y }}
          title="Ask AI about selection"
          onClick={() => {
            onSelectionAction?.(selectionInfo);
            setSelectionInfo(null);
          }}
        >
          AI
        </button>
      )}
    </div>
  );
}
