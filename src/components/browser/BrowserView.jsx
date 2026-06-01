import React, { useEffect, useMemo, useRef, useState } from "react";
import logo from "../../public/mini-dec-centric-logo.png";
import MultiPaneView from "./MultiPaneView";
import { Sparkles } from "lucide-react";
export default function BrowserView({
  tabs,
  activeTabId,
  onTitleUpdate,
  onUrlUpdate,
  onFaviconUpdate,
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
  const activeTabIdRef = useRef(activeTabId);
  const tabsWithUrl = useMemo(
    () => tabs.filter((tab) => Boolean(tab.url)),
    [tabs],
  );

  const shouldIgnoreConsoleMessage = (message) => {
    const text = String(message || "");
    return (
      text.includes("Electron Security Warning") ||
      text.includes("Minified React error #418")
    );
  };

  const buildSearchUrl = (value) =>
    `https://www.google.com/search?q=${encodeURIComponent(String(value || "").trim())}`;

  const shouldFallbackToSearch = (errorCode, validatedURL) => {
    const url = String(validatedURL || "");
    return (
      errorCode === -105 && !url.startsWith("https://www.google.com/search?q=")
    );
  };

  const resolveFaviconUrl = (candidate, pageUrl) => {
    const value = String(candidate || "").trim();
    if (!value) return "";
    try {
      return new URL(value, pageUrl || "").href;
    } catch {
      return "";
    }
  };

  const collectFavicon = async (webview, tabId) => {
    if (!onFaviconUpdate) return;
    try {
      const pageUrl = webview.getURL?.() || "";
      const result = await webview.executeJavaScript(
        `(() => {
          const selectors = [
            'link[rel~="icon"][href]',
            'link[rel="shortcut icon"][href]',
            'link[rel="apple-touch-icon"][href]',
            'link[rel="mask-icon"][href]'
          ];
          const icons = Array.from(document.querySelectorAll(selectors.join(',')))
            .map((link) => link.href || link.getAttribute('href'))
            .filter(Boolean);
          return { icons, pageUrl: location.href };
        })()`,
        true,
      );

      const icons = Array.isArray(result?.icons) ? result.icons : [];
      const resolved = resolveFaviconUrl(icons[0], result?.pageUrl || pageUrl);
      const fallback = pageUrl ? new URL("/favicon.ico", pageUrl).href : "";
      onFaviconUpdate(tabId, resolved || fallback);
    } catch {
      const pageUrl = webview.getURL?.() || "";
      if (!pageUrl) return;
      try {
        onFaviconUpdate(tabId, new URL("/favicon.ico", pageUrl).href);
      } catch {
        // ignore
      }
    }
  };

  const viewport = useMemo(() => {
    if (!deviceSim?.enabled || deviceSim?.multiPane) return null;
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
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    const validTabIds = new Set(tabs.map((tab) => tab.id));
    Object.keys(webviewRefs.current).forEach((tabId) => {
      const numericId = Number(tabId);
      if (!validTabIds.has(numericId)) {
        delete webviewRefs.current[tabId];
      }
    });
  }, [tabs]);

  const registerWebview = (tabId) => (el) => {
    if (!el) return;
    webviewRefs.current[tabId] = el;

    if (!el.__devcentricConsoleAttached) {
      el.__devcentricConsoleAttached = true;
      el.addEventListener("console-message", (event) => {
        if (shouldIgnoreConsoleMessage(event.message)) return;
        onConsoleMessage?.(tabId, {
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
          if (tabId !== activeTabIdRef.current) return;
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
          return;
        }

        if (event.channel === "api-request") {
          const payload = event.args?.[0] || {};
          onApiRequest?.(tabId, payload);
          return;
        }

        if (event.channel === "page-error") {
          const payload = event.args?.[0] || {};
          onConsoleMessage?.(tabId, {
            level: 2,
            message: payload.message || "Page error",
            line: payload.line || 0,
            sourceId: payload.sourceId || "",
            stack: payload.stack || "",
            timestamp: payload.capturedAt || Date.now(),
          });
          return;
        }
      });
    }

    if (!el.__devcentricFaviconAttached) {
      el.__devcentricFaviconAttached = true;
      el.addEventListener("page-favicon-updated", (event) => {
        const favicon = Array.isArray(event?.favicons)
          ? event.favicons.find((item) => typeof item === "string" && item)
          : "";
        if (favicon) {
          onFaviconUpdate?.(tabId, favicon);
        }
      });
    }

    if (!el.__devcentricFailAttached) {
      el.__devcentricFailAttached = true;
      el.addEventListener(
        "did-fail-load",
        (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
          try {
            if (!isMainFrame) return;
            // Ignore aborted navigations (ERR_ABORTED) which are normal when
            // a navigation is cancelled by another navigation or redirect.
            if (errorCode === -3) return;
            if (!shouldFallbackToSearch(errorCode, validatedURL)) return;
            const fallbackUrl = buildSearchUrl(
              validatedURL || el.getURL?.() || "",
            );
            onUrlUpdate?.(tabId, fallbackUrl);
            onTitleUpdate?.("Search");
          } catch (err) {
            // Swallow errors from the handler to avoid bubbling into Electron internals
            console.warn("did-fail-load handler error", err);
          }
        },
      );
    }

    if (!el.__devcentricReady) {
      el.__devcentricReady = true;
      el.addEventListener("dom-ready", () => {
        const webContentsId = el.getWebContentsId?.();
        if (typeof webContentsId === "number") {
          onWebviewReady?.(tabId, webContentsId, el);
        }
      });
    }
  };

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
      if (deviceSim?.zoom && deviceSim.zoom !== "fit") {
        const customZoom = Number(deviceSim.zoom);
        if (Number.isFinite(customZoom) && customZoom > 0) {
          setScale(customZoom);
          return;
        }
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
  }, [viewport, deviceSim?.zoom]);

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

    const handleStop = () => {
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
    const handleFailLoad = (
      _event,
      errorCode,
      _errorDescription,
      validatedURL,
      isMainFrame,
    ) => {
      if (!isMainFrame) return;
      if (!shouldFallbackToSearch(errorCode, validatedURL)) return;
      const fallbackUrl = buildSearchUrl(
        validatedURL || webview.getURL?.() || "",
      );
      onUrlUpdate?.(fallbackUrl);
      onTitleUpdate?.("Search");
    };
    const handleDomReady = () => {
      scheduleCapture(0);
      scheduleCapture(1500);
      collectFavicon(webview, activeTabId);
    };
    const handleFinish = () => {
      scheduleCapture(0);
      collectFavicon(webview, activeTabId);
    };
    const handleNavigateFavicon = () => collectFavicon(webview, activeTabId);

    webview.addEventListener("did-stop-loading", handleStop);
    webview.addEventListener("dom-ready", handleDomReady);
    webview.addEventListener("did-finish-load", handleFinish);
    webview.addEventListener("did-fail-load", handleFailLoad);
    webview.addEventListener("page-title-updated", handleTitle);
    webview.addEventListener("did-navigate", handleNavigate);
    webview.addEventListener("did-navigate-in-page", handleNavigate);
    webview.addEventListener("did-navigate", handleNavigateFavicon);
    webview.addEventListener("did-navigate-in-page", handleNavigateFavicon);

    updateNavState();

    return () => {
      webview.removeEventListener("did-stop-loading", handleStop);
      webview.removeEventListener("dom-ready", handleDomReady);
      webview.removeEventListener("did-finish-load", handleFinish);
      webview.removeEventListener("did-fail-load", handleFailLoad);
      webview.removeEventListener("page-title-updated", handleTitle);
      webview.removeEventListener("did-navigate", handleNavigate);
      webview.removeEventListener("did-navigate-in-page", handleNavigate);
      webview.removeEventListener("did-navigate", handleNavigateFavicon);
      webview.removeEventListener(
        "did-navigate-in-page",
        handleNavigateFavicon,
      );
      timeouts.forEach((id) => clearTimeout(id));
    };
  }, [
    activeTabId,
    onNavStateChange,
    onTitleUpdate,
    onUrlUpdate,
    onPageContent,
  ]);

  // Render multi-pane view when multi-pane mode is enabled
  if (deviceSim?.enabled && deviceSim?.multiPane) {
    return (
      <div className="browser-view">
        {hasActiveUrl ? (
          <MultiPaneView
            url={activeTab.url}
            onUrlFallback={(fallbackUrl) => {
              onUrlUpdate?.(fallbackUrl);
            }}
            onFaviconUpdate={(favicon) => {
              onFaviconUpdate?.(activeTab.id, favicon);
            }}
            onWebviewReady={(webContentsId, webview) => {
              webviewRefs.current[activeTab.id] = webview;
              onWebviewReady?.(activeTab.id, webContentsId, webview);
            }}
            onConsoleMessage={(entry) => {
              onConsoleMessage?.(activeTab.id, entry);
            }}
            onApiRequest={(payload) => {
              onApiRequest?.(activeTab.id, payload);
            }}
          />
        ) : (
          <div className="browser-view__empty">
            <img
              className="browser-view__empty-logo"
              src={logo}
              alt="Mini Dev-Centric"
            />
            <div className="browser-view__empty-title">
              Mini Dev-Centric Browser
            </div>
            <div className="browser-view__empty-subtitle">
              Enter a URL above or open a new tab to start browsing
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="browser-view" ref={containerRef}>
      {viewport ? (
        <div className="browser-view__device-stage">
          <div className="browser-view__device-stage-inner">
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
              {tabsWithUrl.map((tab) => (
                <webview
                  key={tab.id}
                  src={tab.url}
                  preload={webviewPreload}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: hasActiveUrl && tab.id === activeTabId ? 1 : 0,
                    visibility:
                      hasActiveUrl && tab.id === activeTabId
                        ? "visible"
                        : "hidden",
                    pointerEvents:
                      hasActiveUrl && tab.id === activeTabId ? "auto" : "none",
                  }}
                  ref={registerWebview(tab.id)}
                />
              ))}
            </div>
          </div>
          </div>
        </div>
      ) : (
        tabsWithUrl.map((tab) => (
          <webview
            key={tab.id}
            src={tab.url}
            preload={webviewPreload}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: hasActiveUrl && tab.id === activeTabId ? 1 : 0,
              visibility:
                hasActiveUrl && tab.id === activeTabId ? "visible" : "hidden",
              pointerEvents:
                hasActiveUrl && tab.id === activeTabId ? "auto" : "none",
            }}
            ref={registerWebview(tab.id)}
          />
        ))
      )}
      {!hasActiveUrl && (
        <div className="browser-view__empty">
          <img
            className="browser-view__empty-logo"
            src={logo}
            alt="Mini Dev-Centric"
          />
          <div className="browser-view__empty-title">
            Mini Dev-Centric Browser
          </div>
          <div className="browser-view__empty-subtitle">
            Enter a URL above or open a new tab to start browsing
          </div>
        </div>
      )}
      {selectionPos && selectionInfo?.text && (
        <button
          className="browser-view__selection-action"
          style={{
            backgroundColor: "gray",
            left: selectionPos.x,
            top: selectionPos.y,
          }}
          title="Ask AI about selection"
          onClick={() => {
            onSelectionAction?.(selectionInfo);
            setSelectionInfo(null);
          }}
        >
          <Sparkles width={20} height={20} />
        </button>
      )}
    </div>
  );
}
