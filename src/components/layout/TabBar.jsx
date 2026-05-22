import React, { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_TAB_ICON =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="#8b949e" stroke-width="1.2"/>
      <path d="M1.8 8h12.4" stroke="#8b949e" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M8 1.5c2 2 2 11 0 13" stroke="#8b949e" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M8 1.5c-2 2-2 11 0 13" stroke="#8b949e" stroke-width="1.2" stroke-linecap="round"/>
    </svg>
  `);

function TabFavicon({ src, title }) {
  const safeSrc = src || DEFAULT_TAB_ICON;

  return (
    <img
      className="tab__favicon"
      src={safeSrc}
      alt=""
      aria-hidden="true"
      onError={(event) => {
        const target = event.currentTarget;
        if (target.dataset.fallbackApplied === "1") return;
        target.dataset.fallbackApplied = "1";
        target.src = DEFAULT_TAB_ICON;
      }}
      title={title}
    />
  );
}

export default function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}) {
  const reservedRightGutter = 40;
  const containerRef = useRef(null);
  const newTabRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const measure = () => {
      setContainerWidth(container.clientWidth);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => {
    const tabCount = tabs.length;
    if (tabCount === 0) {
      return {
        width: 180,
        overlap: 0,
        compact: false,
        stacked: false,
      };
    }

  const maxWidth = 160;
  const minWidth = 60;
  const minVisibleWhenStacked = 20;
  const rightSpacing = 6;
  const fallbackNewTabWidth = 28;
    const newTabWidth = newTabRef.current?.offsetWidth || fallbackNewTabWidth;
    const available = Math.max(
      0,
      containerWidth - newTabWidth - rightSpacing - reservedRightGutter,
    );

    if (available <= 0) {
      return {
        width: minWidth,
        overlap: minWidth - minVisibleWhenStacked,
        compact: true,
        stacked: true,
      };
    }

    const idealWidth = available / tabCount;
    const width = Math.max(minWidth, Math.min(maxWidth, idealWidth));
    const compact = width < 138;

    if (idealWidth >= minWidth) {
      return {
        width,
        overlap: 0,
        compact,
        stacked: false,
      };
    }

    const visiblePerTab =
      tabCount > 1 ? (available - minWidth) / (tabCount - 1) : minWidth;
    const clampedVisible = Math.max(
      minVisibleWhenStacked,
      Math.min(minWidth, visiblePerTab),
    );
    const overlap = Math.max(0, minWidth - clampedVisible);

    return {
      width: minWidth,
      overlap,
      compact: true,
      stacked: true,
    };
  }, [tabs, containerWidth, reservedRightGutter]);

  const tabsStripWidth = useMemo(() => {
    const count = tabs.length;
    if (count === 0) return 0;
    const visiblePerTab = Math.max(0, layout.width - layout.overlap);
    return layout.width + (count - 1) * visiblePerTab;
  }, [tabs, layout]);

  return (
    <div className="tabbar" ref={containerRef}>
      <div
        className="tabbar__tabs"
        role="tablist"
        aria-label="Browser tabs"
        style={{ width: `${tabsStripWidth}px` }}
      >
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? "tab--active" : ""} ${layout.compact ? "tab--compact" : ""} ${layout.stacked ? "tab--stacked" : ""}`}
            onClick={() => onSelectTab(tab.id)}
            role="tab"
            aria-selected={tab.id === activeTabId}
            style={{
              width: `${layout.width}px`,
              marginLeft: index === 0 ? 0 : `-${layout.overlap}px`,
              zIndex: tab.id === activeTabId ? tabs.length + 2 : index + 1,
            }}
          >
            <TabFavicon src={tab.favicon} title={tab.title || "New Tab"} />
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
      </div>
      <div
        ref={newTabRef}
        className="tab tab--new"
        onClick={onNewTab}
        title="New Tab (Ctrl+T)"
      >
        +
      </div>
    </div>
  );
}
