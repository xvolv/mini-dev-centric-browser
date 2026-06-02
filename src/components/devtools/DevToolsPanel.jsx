import React, { useRef, useState } from "react";
import ConsolePanel from "./panels/ConsolePanel";
import NetworkPanel from "./panels/NetworkPanel";
import ApiTesterPanel from "./panels/ApiTesterPanel";
import SandboxPanel from "./panels/SandboxPanel";
import DeviceSimPanel from "./panels/DeviceSimPanel";
import AiAssistantPanel from "./panels/AiAssistantPanel";
import GitPanel from "./panels/GitPanel";
import SettingsPanel from "./panels/SettingsPanel";

import { ChevronRight, ChevronLeft } from "lucide-react";

export default function DevToolsPanel({
  activeTool,
  onToolChange,
  consoleEntries,
  onClearConsole,
  networkEntries,
  onClearNetwork,
  onExportNetwork,
  networkHistoryEntries,
  onRefreshNetworkHistory,
  deviceSim,
  onDeviceSimChange,
  activeTabTitle,
  activeTabHtml,
  activeTabHtmlUpdatedAt,
  aiDraft,
  apiTesterDraftRequest,
  activeTabId,
  activeTabUrl,
  onDevToolsWebviewReady,
  onDevToolsConsoleMessage,
  onDevToolsApiRequest,
  autoPopulateNetworkToApiTester,
  onSendToApiTester,
  onConsumeApiTesterDraft,
  onClose,
}) {
  const MIN_PANEL_WIDTH = 520;
  const [panelWidth, setPanelWidth] = useState(520);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isResizing = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(520);
  const activePointerId = useRef(null);
  const maxPanelWidth = () =>
    Math.max(window.innerWidth * 0.6, window.innerWidth - 320);

  const handlePointerDown = (event) => {
    if (isCollapsed) return;
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
    setPanelWidth(
      Math.max(MIN_PANEL_WIDTH, Math.min(nextWidth, maxPanelWidth())),
    );
  };

  const handlePointerUp = () => {
    isResizing.current = false;
    activePointerId.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const renderContent = () => {
    if (isCollapsed) return null;
    
    switch (activeTool) {
      case "console":
        return (
          <ConsolePanel entries={consoleEntries} onClear={onClearConsole} />
        );
      case "network":
        return (
          <NetworkPanel
            entries={networkEntries}
            onClear={onClearNetwork}
            onExport={onExportNetwork}
            autoPopulateEnabled={autoPopulateNetworkToApiTester}
            onSendToApiTester={onSendToApiTester}
          />
        );
      case "api":
        return (
          <ApiTesterPanel
            pendingRequest={apiTesterDraftRequest}
            onConsumePendingRequest={onConsumeApiTesterDraft}
          />
        );
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
      case "settings":
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  return (
    <div className={`devtools-panel ${isCollapsed ? 'devtools-panel--collapsed' : ''}`} style={{ width: isCollapsed ? 0 : panelWidth }}>
      {!isCollapsed && (
        <div
          className="devtools-panel__resize"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
        />
      )}
      
      <button 
        className="devtools-panel__collapse-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expand panel" : "Collapse panel"}
      >
        {isCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      <div className="devtools-panel__content">{renderContent()}</div>
    </div>
  );
}
