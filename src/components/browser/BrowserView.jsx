import React, { useEffect, useRef } from 'react';

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
}) {
  const webviewRefs = useRef({});
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const hasActiveUrl = Boolean(activeTab && activeTab.url);

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
    <div className="browser-view">
      {isLoading && (
        <div className="browser-view__loading">
          <div className="browser-view__loading-bar" />
        </div>
      )}
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
  );
}
