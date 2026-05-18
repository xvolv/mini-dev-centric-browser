import React, { useEffect, useRef, useState } from "react";
import { TOOLS } from "../../data/tools";
import { MoreHorizontal } from "lucide-react";

/* ── Inline SVG icon primitives ───────────────────────────────────────── */
const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="10 3 5 8 10 13" />
  </svg>
);

const IconForward = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 3 11 8 6 13" />
  </svg>
);

const IconReload = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.5 8A5.5 5.5 0 1 1 10.2 3.1" />
    <polyline points="10 1 13.5 1 13.5 4.5" />
  </svg>
);

const IconStop = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="3" y1="3" x2="13" y2="13" />
    <line x1="13" y1="3" x2="3" y2="13" />
  </svg>
);

const IconLockSecure = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="7" width="10" height="8" rx="1.5" />
    <path d="M5 7V5a3 3 0 0 1 6 0v2" />
  </svg>
);

const IconLockInsecure = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="7" width="10" height="8" rx="1.5" />
    <path d="M5 7V5a3 3 0 0 1 6 0" />
    <line x1="11" y1="2" x2="13" y2="4" strokeWidth="1.5" />
  </svg>
);

const IconDevTools = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 6 1 8 4 10" />
    <polyline points="12 6 15 8 12 10" />
    <line x1="9" y1="3" x2="7" y2="13" />
  </svg>
);
/* ───────────────────────────────────────────────────────────────────────── */

export default function AddressBar({
  url,
  onNavigate,
  isLoading,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onReload,
  activeTool,
  onToolChange,
  devToolsOpen,
  onToggleDevTools,
}) {
  const [inputValue, setInputValue] = useState(url);
  const inputRef = useRef(null);
  const [visibleToolIds, setVisibleToolIds] = useState(TOOLS.map((tool) => tool.id));
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const tabsBarRef = useRef(null);
  const moreButtonRef = useRef(null);
  const tabButtonRefs = useRef({});
  const overflowMenuRef = useRef(null);

  const overflowTools = TOOLS.filter(
    (tool) => !visibleToolIds.includes(tool.id),
  );

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
  }, [activeTool]);

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

  useEffect(() => {
    setInputValue(url);
  }, [url]);

  const handleSubmit = (e) => {
    e.preventDefault();
    let target = inputValue.trim();
    if (target && !target.match(/^[a-zA-Z]+:\/\//)) {
      if (target.includes(".") && !target.includes(" ")) {
        target = "https://" + target;
      } else {
        target =
          "https://www.google.com/search?q=" + encodeURIComponent(target);
      }
    }
    onNavigate(target);
    inputRef.current?.blur();
  };

  const isSecure = url.startsWith("https://");

  return (
    <div className="addressbar">
      <button
        className="addressbar__btn"
        onClick={onBack}
        disabled={!canGoBack}
        title="Back (Alt+←)"
      >
        <IconBack />
      </button>
      <button
        className="addressbar__btn"
        onClick={onForward}
        disabled={!canGoForward}
        title="Forward (Alt+→)"
      >
        <IconForward />
      </button>
      <button
        className="addressbar__btn"
        onClick={onReload}
        title={isLoading ? "Stop (Esc)" : "Reload (Ctrl+R)"}
      >
        {isLoading ? <IconStop /> : <IconReload />}
      </button>
      <form onSubmit={handleSubmit} className="addressbar__input-wrapper">
        <span
          className={`addressbar__lock ${isSecure ? "addressbar__lock--secure" : "addressbar__lock--insecure"}`}
          title={isSecure ? "Connection is secure" : "Connection is not secure"}
        >
          {isSecure ? <IconLockSecure /> : <IconLockInsecure />}
        </span>
        <input
          ref={inputRef}
          className="addressbar__input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="Search or enter URL..."
          spellCheck={false}
        />
      </form>

      <div className="addressbar__tools" ref={tabsBarRef}>
        <div className="addressbar-tabs__list">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;

            if (!visibleToolIds.includes(tool.id)) return null;

            return (
              <button
                key={tool.id}
                ref={(el) => {
                  if (el) tabButtonRefs.current[tool.id] = el;
                }}
                className={`addressbar-tab ${
                  activeTool === tool.id ? "addressbar-tab--active" : ""
                }`}
                onClick={() => onToolChange(tool.id)}
                title={tool.label}
              >
                <span className="addressbar-tab__icon">
                  <Icon size={16} />
                </span>
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>

        {overflowTools.length > 0 && (
          <div className="addressbar-tabs__overflow" ref={overflowMenuRef}>
            <button
              ref={moreButtonRef}
              className={`addressbar-tabs__more-button ${
                isOverflowOpen ? "addressbar-tabs__more-button--active" : ""
              }`}
              onClick={() => setIsOverflowOpen((prev) => !prev)}
              title="More tools"
              aria-haspopup="menu"
              aria-expanded={isOverflowOpen}
            >
              <MoreHorizontal size={16} />
            </button>

            {isOverflowOpen && (
              <div className="addressbar-tabs__menu" role="menu">
                {overflowTools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      className={`addressbar-tabs__menu-item ${
                        activeTool === tool.id ? "addressbar-tabs__menu-item--active" : ""
                      }`}
                      onClick={() => {
                        onToolChange(tool.id);
                        setIsOverflowOpen(false);
                      }}
                      role="menuitem"
                    >
                      <span className="addressbar-tab__icon">
                        <Icon size={14} />
                      </span>
                      <span>{tool.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button
          className={`addressbar__devtools-toggle ${
            devToolsOpen ? "addressbar__devtools-toggle--active" : ""
          }`}
          onClick={onToggleDevTools}
          title={devToolsOpen ? "Close DevTools (F12)" : "Open DevTools (F12)"}
        >
          <span className="addressbar__devtools-toggle-icon">
            <IconDevTools />
          </span>
          <span>DevTools</span>
        </button>
      </div>
    </div>
  );
}
