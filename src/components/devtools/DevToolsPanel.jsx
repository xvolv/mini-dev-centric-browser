import React, { useEffect, useRef, useState } from "react";
import { TOOLS } from "../../data/tools";
import { MoreHorizontal } from "lucide-react";
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
}) {
  const [panelWidth, setPanelWidth] = useState(420);
  const [visibleToolIds, setVisibleToolIds] = useState(TOOLS.map((tool) => tool.id));
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const isResizing = useRef(false);
  const tabsBarRef = useRef(null);
  const moreButtonRef = useRef(null);
  const tabButtonRefs = useRef({});
  const overflowMenuRef = useRef(null);

  const overflowTools = TOOLS.filter(
    (tool) => !visibleToolIds.includes(tool.id),
  );

  const handleMouseDown = () => {
    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    setPanelWidth(Math.max(360, Math.min(newWidth, window.innerWidth * 0.5)));
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const measureVisibleTools = () => {
    const container = tabsBarRef.current;
    if (!container) return;

    const availableWidth = container.clientWidth;
    const estimatedMoreButtonWidth = 44;
    const maxTabsWidth = Math.max(0, availableWidth - estimatedMoreButtonWidth);

    const widths = TOOLS.reduce((acc, tool) => {
      acc[tool.id] = tabButtonRefs.current[tool.id]?.offsetWidth || 96;
      return acc;
    }, {});

    const nextVisible = [];
    let usedWidth = 0;

    for (const tool of TOOLS) {
      const width = widths[tool.id] || 96;
      if (usedWidth + width <= maxTabsWidth) {
        nextVisible.push(tool.id);
        usedWidth += width;
      } else {
        break;
      }
    }

    if (!nextVisible.includes(activeTool)) {
      const activeWidth = widths[activeTool] || 96;
      while (nextVisible.length && usedWidth + activeWidth > maxTabsWidth) {
        const removedId = nextVisible.pop();
        usedWidth -= widths[removedId] || 96;
      }
      if (usedWidth + activeWidth <= maxTabsWidth) {
        nextVisible.push(activeTool);
      }
    }

    nextVisible.sort(
      (leftId, rightId) => TOOLS.findIndex((tool) => tool.id === leftId) - TOOLS.findIndex((tool) => tool.id === rightId),
    );

    setVisibleToolIds(nextVisible);
  };

  useEffect(() => {
    measureVisibleTools();
    const timeoutId = setTimeout(measureVisibleTools, 100);
    return () => clearTimeout(timeoutId);
  }, [activeTool, panelWidth]);

  useEffect(() => {
    const container = tabsBarRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver(() => {
      measureVisibleTools();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!isOverflowOpen) return;
      if (overflowMenuRef.current?.contains(event.target)) return;
      if (moreButtonRef.current?.contains(event.target)) return;
      setIsOverflowOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOverflowOpen]);

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
        return <ConsolePanel />;
    }
  };

  return (
    <div className="devtools-panel" style={{ width: panelWidth }}>
      <div className="devtools-panel__resize" onMouseDown={handleMouseDown} />

      <div className="devtools-panel__tabs" ref={tabsBarRef}>
        <div className="devtools-tabs__list">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;

          if (!visibleToolIds.includes(tool.id)) return null;

          return (
            <button
              key={tool.id}
              ref={(el) => {
                if (el) tabButtonRefs.current[tool.id] = el;
              }}
              className={`devtools-tab ${
                activeTool === tool.id ? "devtools-tab--active" : ""
              }`}
              onClick={() => onToolChange(tool.id)}
              title={tool.label}
            >
              <span className="devtools-tab__icon">
                <Icon size={18} />
              </span>
              <span>{tool.label}</span>
            </button>
          );
        })}
        </div>

        {overflowTools.length > 0 && (
          <div className="devtools-tabs__overflow" ref={overflowMenuRef}>
            <button
              ref={moreButtonRef}
              className={`devtools-tabs__more-button ${
                isOverflowOpen ? "devtools-tabs__more-button--active" : ""
              }`}
              onClick={() => setIsOverflowOpen((prev) => !prev)}
              title="More tools"
              aria-haspopup="menu"
              aria-expanded={isOverflowOpen}
            >
              <MoreHorizontal size={18} />
            </button>

            {isOverflowOpen && (
              <div className="devtools-tabs__menu" role="menu">
                {overflowTools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      className={`devtools-tabs__menu-item ${
                        activeTool === tool.id ? "devtools-tabs__menu-item--active" : ""
                      }`}
                      onClick={() => {
                        onToolChange(tool.id);
                        setIsOverflowOpen(false);
                      }}
                      role="menuitem"
                    >
                      <span className="devtools-tab__icon">
                        <Icon size={16} />
                      </span>
                      <span>{tool.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="devtools-panel__content">{renderContent()}</div>
    </div>
  );
}
