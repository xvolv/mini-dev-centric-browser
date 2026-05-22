import React, { useEffect, useRef, useState } from "react";
import { DEVICE_PRESETS } from "../../data/devicePresets";

export default function MultiPaneView({
  url,
  onWebviewReady,
  onConsoleMessage,
  onApiRequest,
  onUrlFallback,
  onFaviconUpdate,
}) {
  const webviewRefs = useRef({});
  const containerRef = useRef(null);
  const [scales, setScales] = useState({});
  const [paneWidths, setPaneWidths] = useState({});
  const webviewPreload = window.electronAPI?.webviewPreloadPath;

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
    return errorCode === -105 && !url.startsWith("https://www.google.com/search?q=");
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

  const collectFavicon = async (webview) => {
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
      onFaviconUpdate(resolved || fallback);
    } catch {
      const pageUrl = webview.getURL?.() || "";
      if (!pageUrl) return;
      try {
        onFaviconUpdate(new URL("/favicon.ico", pageUrl).href);
      } catch {
        // ignore
      }
    }
  };

  // Default devices for multi-pane: mobile and laptop (two panes)
  const defaultDevices = [
    DEVICE_PRESETS.find((d) => d.name === "iPhone 12") || DEVICE_PRESETS[0],
    DEVICE_PRESETS.find((d) => d.name === "Laptop") || DEVICE_PRESETS[6],
  ];

  // Pane weights: make the laptop pane larger so it has more space [mobile, laptop]
  const weights = [0.85, 2.65];

  // Calculate scales for each pane to fit in container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScales = () => {
      const containerRect = container.getBoundingClientRect();
      const padding = 16;
      const gap = 16;
      const availableWidth = containerRect.width - padding * 2;
      const availableHeight = containerRect.height - padding * 2;
      const totalWeight = weights.reduce((s, w) => s + w, 0);

      const baseAvailable = availableWidth - gap * (defaultDevices.length - 1);

      const newScales = {};
      const newWidths = {};
      defaultDevices.forEach((device, index) => {
        const paneWidth = (baseAvailable * weights[index]) / totalWeight;
        newWidths[index] = paneWidth;
        const maxScaleW = paneWidth / device.w;
        const maxScaleH = availableHeight / device.h;
        // Scale to fill viewport completely; no padding overhead
        const scale = maxScaleW < maxScaleH ? maxScaleW : maxScaleH;
        newScales[index] = Number.isFinite(scale) && scale > 0 ? scale : 1;
      });

      setPaneWidths(newWidths);
      setScales(newScales);
    };

    updateScales();
    const observer = new ResizeObserver(updateScales);
    observer.observe(container);
    return () => observer.disconnect();
  }, [defaultDevices]);

  // Each pane scrolls independently — no synchronization

  const handleWebviewRef = (index, el) => {
    if (!el) return;
    webviewRefs.current[index] = el;

    // Attach console message listener
    if (!el.__multiPaneConsoleAttached) {
      el.__multiPaneConsoleAttached = true;
      el.addEventListener("console-message", (event) => {
        if (shouldIgnoreConsoleMessage(event.message)) return;
        onConsoleMessage?.({
          level: event.level,
          message: event.message,
          line: event.line,
          sourceId: event.sourceId,
        });
      });
    }

    // Attach API request listener
    if (!el.__multiPaneApiAttached) {
      el.__multiPaneApiAttached = true;
      el.addEventListener("ipc-message", (event) => {
        if (event.channel === "api-request") {
          const payload = event.args?.[0] || {};
          onApiRequest?.(payload);
        }
      });
    }

    if (!el.__multiPaneFailAttached) {
      el.__multiPaneFailAttached = true;
      el.addEventListener(
        "did-fail-load",
        (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
          try {
            if (!isMainFrame) return;
            // Ignore aborted navigations (ERR_ABORTED / -3)
            if (errorCode === -3) return;
            if (!shouldFallbackToSearch(errorCode, validatedURL)) return;
            const fallbackUrl = buildSearchUrl(validatedURL || el.getURL?.() || "");
            try {
              el.setAttribute("src", fallbackUrl);
            } catch {
              el.src = fallbackUrl;
            }
            onUrlFallback?.(fallbackUrl);
          } catch (err) {
            console.warn("multi-pane did-fail-load handler error", err);
          }
        },
      );
    }

    // Notify parent when webview is ready
    if (!el.__multiPaneReady) {
      el.__multiPaneReady = true;
      el.addEventListener("dom-ready", () => {
        const webContentsId = el.getWebContentsId?.();
        if (typeof webContentsId === "number") {
          onWebviewReady?.(webContentsId, el);
        }
        collectFavicon(el);
      });
    }

    if (!el.__multiPaneFaviconAttached) {
      el.__multiPaneFaviconAttached = true;
      el.addEventListener("page-favicon-updated", (event) => {
        const favicon = Array.isArray(event?.favicons)
          ? event.favicons.find((item) => typeof item === "string" && item)
          : "";
        if (favicon) {
          onFaviconUpdate?.(favicon);
        }
      });
      el.addEventListener("did-finish-load", () => collectFavicon(el));
      el.addEventListener("did-navigate", () => collectFavicon(el));
      el.addEventListener("did-navigate-in-page", () => collectFavicon(el));
    }
  };

  if (!url) {
    return (
      <div className="multi-pane-view">
        <div className="multi-pane-view__empty">
          <div className="multi-pane-view__empty-text">
            Enter a URL to see multi-pane view
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="multi-pane-view" ref={containerRef}>
      {defaultDevices.map((device, index) => {
        const scale = scales[index] || 1;
        const weight = weights[index] || 1;
        return (
          <div
            key={device.name}
            className="multi-pane__pane"
            style={{ flex: `${weight} 0 0`, minWidth: 0 }}
          >
            <div className="multi-pane__pane-header">
              <span className="multi-pane__pane-title">{device.name}</span>
              <span className="multi-pane__pane-dimensions">
                {device.w} × {device.h}
              </span>
            </div>
            <div className="multi-pane__pane-viewport">
              <div
                className="multi-pane__pane-frame"
                style={{
                  width: "100%",
                  height: "100%",
                  transformOrigin: "top left",
                }}
              >
                <webview
                  src={url}
                  preload={webviewPreload}
                  style={{ width: "100%", height: "100%" }}
                  ref={(el) => handleWebviewRef(index, el)}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
