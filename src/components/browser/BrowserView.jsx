import React, { useEffect, useMemo, useRef, useState } from 'react';

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
  deviceSim,
}) {
  const webviewRefs = useRef({});
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const hasActiveUrl = Boolean(activeTab && activeTab.url);

  const viewport = useMemo(() => {
    if (!deviceSim?.enabled) return null;
    const width = deviceSim.orientation === 'portrait' ? deviceSim.width : deviceSim.height;
    const height = deviceSim.orientation === 'portrait' ? deviceSim.height : deviceSim.width;
    return { width, height };
  }, [deviceSim]);

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
    };
    const handleTitle = (event) => onTitleUpdate?.(event.title);
    const handleNavigate = (event) => {
      onUrlUpdate?.(event.url);
      updateNavState();
    };

    webview.addEventListener('did-start-loading', handleStart);
    webview.addEventListener('did-stop-loading', handleStop);
    webview.addEventListener('page-title-updated', handleTitle);
    webview.addEventListener('did-navigate', handleNavigate);
    webview.addEventListener('did-navigate-in-page', handleNavigate);

    updateNavState();

    return () => {
      webview.removeEventListener('did-start-loading', handleStart);
      webview.removeEventListener('did-stop-loading', handleStop);
      webview.removeEventListener('page-title-updated', handleTitle);
      webview.removeEventListener('did-navigate', handleNavigate);
      webview.removeEventListener('did-navigate-in-page', handleNavigate);
    };
  }, [activeTabId, onLoadingChange, onNavStateChange, onTitleUpdate, onUrlUpdate]);

  if (!hasActiveUrl) {
    return (
      <div className="browser-view">
        <div className="browser-view__empty">
          <div className="browser-view__empty-logo">D</div>
          <div className="browser-view__empty-title">Mini Dev-Centric Browser</div>
          <div className="browser-view__empty-subtitle">Enter a URL above or open a new tab to start browsing</div>
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
            style={{ width: viewport.width * scale, height: viewport.height * scale }}
          >
            <div
              className="browser-view__device-frame"
              style={{ width: viewport.width, height: viewport.height, transform: `scale(${scale})` }}
            >
              <webview
                key={activeTab.id}
                src={activeTab.url}
                style={{ width: '100%', height: '100%' }}
                ref={(el) => {
                  if (!el) return;
                  webviewRefs.current[activeTab.id] = el;
                  if (!el.__devcentricConsoleAttached) {
                    el.__devcentricConsoleAttached = true;
                    el.addEventListener('console-message', (event) => {
                      onConsoleMessage?.(activeTab.id, {
                        level: event.level,
                        message: event.message,
                        line: event.line,
                        sourceId: event.sourceId,
                      });
                    });
                  }
                  if (!el.__devcentricReady) {
                    el.__devcentricReady = true;
                    el.addEventListener('dom-ready', () => {
                      const webContentsId = el.getWebContentsId?.();
                      if (typeof webContentsId === 'number') {
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
          style={{ width: '100%', height: '100%' }}
          ref={(el) => {
            if (!el) return;
            webviewRefs.current[activeTab.id] = el;
            if (!el.__devcentricConsoleAttached) {
              el.__devcentricConsoleAttached = true;
              el.addEventListener('console-message', (event) => {
                onConsoleMessage?.(activeTab.id, {
                  level: event.level,
                  message: event.message,
                  line: event.line,
                  sourceId: event.sourceId,
                });
              });
            }
            if (!el.__devcentricReady) {
              el.__devcentricReady = true;
              el.addEventListener('dom-ready', () => {
                const webContentsId = el.getWebContentsId?.();
                if (typeof webContentsId === 'number') {
                  onWebviewReady?.(activeTab.id, webContentsId, el);
                }
              });
            }
          }}
        />
      )}
    </div>
  );
}
