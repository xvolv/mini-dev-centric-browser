import React from "react";

export default function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}) {
  return (
    <div className="tabbar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? "tab--active" : ""}`}
          onClick={() => onSelectTab(tab.id)}
        >
          <span className="tab__title">{tab.title || "New Tab"}</span>
          <button
            className="tab__close"
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <div className="tab tab--new" onClick={onNewTab} title="New Tab (Ctrl+T)">
        +
      </div>
    </div>
  );
}
