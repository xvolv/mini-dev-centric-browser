import React, { useEffect, useRef, useState } from "react";
import { DEVICE_PRESETS } from "../../data/devicePresets";

export default function MultiPaneView({
  url,
  onWebviewReady,
  onConsoleMessage,
  onApiRequest,
}) {
  const webviewRefs = useRef({});
  const containerRef = useRef(null);
  const [scales, setScales] = useState({});
  const [paneWidths, setPaneWidths] = useState({});
  const webviewPreload = window.electronAPI?.webviewPreloadPath;

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

    // Notify parent when webview is ready
    if (!el.__multiPaneReady) {
      el.__multiPaneReady = true;
      el.addEventListener("dom-ready", () => {
        const webContentsId = el.getWebContentsId?.();
        if (typeof webContentsId === "number") {
          onWebviewReady?.(webContentsId, el);
        }
      });
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
