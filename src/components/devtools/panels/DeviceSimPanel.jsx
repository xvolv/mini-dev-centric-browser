import React from "react";

export default function DeviceSimPanel({ value, onChange }) {
  return (
    <div className="tool-panel" style={{ padding: 12 }}>
      <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
        Multi-pane viewer is active in the main browser area. Use the DevTools
        toolbar to switch tools or disable the multi-pane view.
      </div>
    </div>
  );
}
