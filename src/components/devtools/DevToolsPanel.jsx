import React, { useRef, useState } from "react";
import ConsolePanel from "./panels/ConsolePanel";
import NetworkPanel from "./panels/NetworkPanel";
import ApiTesterPanel from "./panels/ApiTesterPanel";
import SandboxPanel from "./panels/SandboxPanel";
import DeviceSimPanel from "./panels/DeviceSimPanel";
import AiAssistantPanel from "./panels/AiAssistantPanel";
import GitPanel from "./panels/GitPanel";
import WorkspacePanel from "./panels/WorkspacePanel";
import SettingsPanel from "./panels/SettingsPanel";

export default function DevToolsPanel({
  activeTool,
  onToolChange,
  consoleEntries,
  onClearConsole,
  networkEntries,
  onClearNetwork,
  deviceSim,
  onDeviceSimChange,
  activeTabTitle,
  activeTabHtml,
  activeTabHtmlUpdatedAt,
  aiDraft,
  latestApiRequest,
  activeTabId,
  activeTabUrl,
  onDevToolsWebviewReady,
  onDevToolsConsoleMessage,
  onDevToolsApiRequest,
  onClose,
}) {
  const MIN_PANEL_WIDTH = 520;
  const [panelWidth, setPanelWidth] = useState(520);
  const isResizing = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(520);
  const activePointerId = useRef(null);
  const maxPanelWidth = () => window.innerWidth * 0.5;

  const handlePointerDown = (event) => {
    event.preventDefault();
    isResizing.current = true;
    activePointerId.current = event.pointerId;
    dragStartX.current = event.clientX;
    dragStartWidth.current = panelWidth;
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handlePointerMove = (event) => {
    if (!isResizing.current || event.pointerId !== activePointerId.current)
      return;
    const delta = dragStartX.current - event.clientX;
    const nextWidth = dragStartWidth.current + delta;
    setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(nextWidth, maxPanelWidth())));
  };

  const handlePointerUp = () => {
    isResizing.current = false;
    activePointerId.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const renderContent = () => {
    switch (activeTool) {
      case "console":
        return (
          <ConsolePanel entries={consoleEntries} onClear={onClearConsole} />
        );
      case "network":
        return (
          <NetworkPanel entries={networkEntries} onClear={onClearNetwork} />
        );
      case "api":
        return <ApiTesterPanel latestRequest={latestApiRequest} />;
      case "sandbox":
        return <SandboxPanel />;
      case "device":
        return (
          <DeviceSimPanel
            value={deviceSim}
            onChange={onDeviceSimChange}
            url={activeTabUrl}
            activeTabId={activeTabId}
            onWebviewReady={onDevToolsWebviewReady}
            onConsoleMessage={onDevToolsConsoleMessage}
            onApiRequest={onDevToolsApiRequest}
          />
        );
      case "ai":
        return (
          <AiAssistantPanel
            activeTabTitle={activeTabTitle}
            activeTabHtml={activeTabHtml}
            activeTabHtmlUpdatedAt={activeTabHtmlUpdatedAt}
            aiDraft={aiDraft}
          />
        );
      case "git":
        return <GitPanel />;
      case "workspace":
        return <WorkspacePanel />;
      case "settings":
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="devtools-panel" style={{ width: panelWidth }}>
      <div
        className="devtools-panel__resize"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
      />
      <div className="devtools-panel__content">{renderContent()}</div>
    </div>
  );
}
