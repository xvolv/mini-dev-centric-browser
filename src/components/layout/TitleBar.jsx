import React, { useEffect, useState } from "react";

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (window.electronAPI?.onMaximizedChange) {
      window.electronAPI.onMaximizedChange(setIsMaximized);
    }
    if (window.electronAPI?.isMaximized) {
      window.electronAPI.isMaximized().then(setIsMaximized);
    }
  }, []);

  return (
    <div className="titlebar">
      <div className="titlebar__logo">
        <div className="titlebar__logo-icon">D</div>
        <span className="titlebar__logo-text">Mini Dev-Centric</span>
      </div>
      <div className="titlebar__spacer" />
      <div className="titlebar__controls">
        <button
          className="titlebar__btn"
          onClick={() => window.electronAPI?.minimize()}
          title="Minimize"
        >
          ─
        </button>
        <button
          className="titlebar__btn"
          onClick={() => window.electronAPI?.maximize()}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? "❐" : "□"}
        </button>
        <button
          className="titlebar__btn titlebar__btn--close"
          onClick={() => window.electronAPI?.close()}
          title="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
