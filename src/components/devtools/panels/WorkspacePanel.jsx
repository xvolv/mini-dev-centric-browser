import React from "react";
import { SAMPLE_WORKSPACES } from "../../../data/sampleData";

export default function WorkspacePanel() {
  return (
    <div className="tool-panel">
      <div className="workspace__actions">
        <button className="workspace__action-btn workspace__action-btn--primary">
          + New Workspace
        </button>
        <button className="workspace__action-btn">Save Current</button>
        <button className="workspace__action-btn">Import</button>
      </div>
      <div className="workspace__list">
        {SAMPLE_WORKSPACES.map((ws) => (
          <div key={ws.id} className="workspace__card">
            <div className="workspace__card-name">{ws.name}</div>
            <div className="workspace__card-meta">
              <span>🗂 {ws.tabs} tabs</span>
              <span>🕐 {ws.lastOpened}</span>
              <span>🏷 {ws.tag}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
