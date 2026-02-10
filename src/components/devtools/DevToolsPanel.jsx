import React, { useRef, useState } from 'react';
import { TOOLS } from '../../data/tools';
import ConsolePanel from './panels/ConsolePanel';
import NetworkPanel from './panels/NetworkPanel';
import ApiTesterPanel from './panels/ApiTesterPanel';
import SandboxPanel from './panels/SandboxPanel';
import DeviceSimPanel from './panels/DeviceSimPanel';
import AiAssistantPanel from './panels/AiAssistantPanel';
import GitPanel from './panels/GitPanel';
import WorkspacePanel from './panels/WorkspacePanel';
import SettingsPanel from './panels/SettingsPanel';

export default function DevToolsPanel({
  activeTool,
  onToolChange,
  consoleEntries,
  onClearConsole,
  networkEntries,
  onClearNetwork,
  deviceSim,
  onDeviceSimChange,
}) {
  const [panelWidth, setPanelWidth] = useState(420);
  const isResizing = useRef(false);

  const handleMouseDown = () => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    setPanelWidth(Math.max(360, Math.min(newWidth, window.innerWidth * 0.5)));
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const renderContent = () => {
    switch (activeTool) {
      case 'console':
        return <ConsolePanel entries={consoleEntries} onClear={onClearConsole} />;
      case 'network':
        return <NetworkPanel entries={networkEntries} onClear={onClearNetwork} />;
      case 'api':
        return <ApiTesterPanel />;
      case 'sandbox':
        return <SandboxPanel />;
      case 'device':
        return <DeviceSimPanel value={deviceSim} onChange={onDeviceSimChange} />;
      case 'ai':
        return <AiAssistantPanel />;
      case 'git':
        return <GitPanel />;
      case 'workspace':
        return <WorkspacePanel />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <ConsolePanel />;
    }
  };

  return (
    <div className="devtools-panel" style={{ width: panelWidth }}>
      <div className="devtools-panel__resize" onMouseDown={handleMouseDown} />
      <div className="devtools-panel__tabs">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`devtools-tab ${activeTool === tool.id ? 'devtools-tab--active' : ''}`}
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
          >
            <span className="devtools-tab__icon">{tool.icon}</span>
            <span>{tool.label}</span>
          </button>
        ))}
      </div>
      <div className="devtools-panel__content">{renderContent()}</div>
    </div>
  );
}
