import React, { useEffect, useRef, useState } from "react";
import { TOOLS } from "../../data/tools";

/* ── Inline SVG icon primitives ───────────────────────────────────────── */
const IconBack = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="10 3 5 8 10 13" />
  </svg>
);

const IconForward = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 3 11 8 6 13" />
  </svg>
);

const IconReload = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M13.5 8A5.5 5.5 0 1 1 10.2 3.1" />
    <polyline points="10 1 13.5 1 13.5 4.5" />
  </svg>
);

const IconLockSecure = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="7" width="10" height="8" rx="1.5" />
    <path d="M5 7V5a3 3 0 0 1 6 0v2" />
  </svg>
);

const IconLockInsecure = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="7" width="10" height="8" rx="1.5" />
    <path d="M5 7V5a3 3 0 0 1 6 0" />
    <line x1="11" y1="2" x2="13" y2="4" strokeWidth="1.5" />
  </svg>
);

const DEFAULT_SITE_ICON =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="#8b949e" stroke-width="1.2"/>
      <path d="M1.8 8h12.4" stroke="#8b949e" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M8 1.5c2 2 2 11 0 13" stroke="#8b949e" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M8 1.5c-2 2-2 11 0 13" stroke="#8b949e" stroke-width="1.2" stroke-linecap="round"/>
    </svg>
  `);
/* ───────────────────────────────────────────────────────────────────────── */

export default function AddressBar({
  url,
  title,
  favicon,
  onNavigate,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onReload,
  activeTool,
  onToolChange,
  onRegisterFocus,
  onBookmarkSaved,
}) {
  const [inputValue, setInputValue] = useState(url);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const typedRef = useRef("");
  const autofillLockedRef = useRef(false);
  const [bookmarkCardOpen, setBookmarkCardOpen] = useState(false);
  const [bookmarkName, setBookmarkName] = useState("");
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const bookmarkButtonRef = useRef(null);
  const bookmarkCardRef = useRef(null);
  const requestIdRef = useRef(0);
  const clearingRef = useRef(false);
  const searchBlockedRef = useRef(false);
  const registerFocusRef = useRef(null);

  useEffect(() => {
    if (onRegisterFocus) {
      registerFocusRef.current = () => {
        inputRef.current?.focus();
        inputRef.current?.select();
      };
      onRegisterFocus(registerFocusRef.current);
    }
    return () => {
      if (onRegisterFocus) onRegisterFocus(null);
    };
  }, [onRegisterFocus]);

  useEffect(() => {
    if (clearingRef.current) {
      clearingRef.current = false;
      return;
    }
    searchBlockedRef.current = true;
    typedRef.current = String(url || "");
    setInputValue(url);
  }, [url]);

  useEffect(() => {
    if (searchBlockedRef.current) {
      searchBlockedRef.current = false;
      return;
    }
    const query = inputValue.trim();
    if (!query) {
      setSuggestions([]);
      return undefined;
    }

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      const results = await window.api?.searchHistory?.(query);
      if (requestId !== requestIdRef.current) return;
      const list = Array.isArray(results) ? results.slice(0, 8) : [];
      setSuggestions(list);
      // reset active index when suggestions update
      setActiveIndex(-1);
    }, 180);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // Inline autofill: when suggestions update, autofill the top suggestion's URL
  useEffect(() => {
    try {
      if (!suggestions || suggestions.length === 0) return;
      if (activeIndex >= 0) return; // user is navigating suggestions manually
      if (autofillLockedRef.current) return;

      const top = suggestions[0];
      if (!top || !top.url) return;
      const raw = String(typedRef.current || "").trim();
      const candidate = String(top.url || "");
      if (!raw) return;

      // Normalize by removing protocol and leading www.
      const normalize = (s) =>
        String(s || "")
          .replace(/^[a-z]+:\/\//i, "")
          .replace(/^www\./i, "")
          .replace(/\/$/, "");

      const rawNorm = normalize(raw);
      const candNorm = normalize(candidate);

      // Only autofill when the normalized suggestion starts with the normalized raw text
      if (
        candNorm.toLowerCase().startsWith(rawNorm.toLowerCase()) &&
        candNorm !== rawNorm
      ) {
        // Show the autofill using the normalized form (no protocol), select the suffix
        clearingRef.current = false;
        searchBlockedRef.current = true;
        const display = candNorm;
        setInputValue(display);
        setTimeout(() => {
          try {
            const el = inputRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(raw.length, display.length);
            // lock to avoid re-triggering until user types again
            autofillLockedRef.current = true;
          } catch {}
        }, 0);
      }
    } catch {}
  }, [suggestions, activeIndex]);

  useEffect(() => {
    if (!bookmarkCardOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setBookmarkCardOpen(false);
      }
    };

    const handleOutsideClick = (event) => {
      if (
        bookmarkCardRef.current?.contains(event.target) ||
        bookmarkButtonRef.current?.contains(event.target)
      ) {
        return;
      }
      setBookmarkCardOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [bookmarkCardOpen]);

  useEffect(() => {
    if (bookmarkCardOpen) {
      setBookmarkName(title || url || inputValue || "");
      setTimeout(() => {
        bookmarkCardRef.current?.querySelector("input")?.focus();
        bookmarkCardRef.current?.querySelector("input")?.select?.();
      }, 0);
    }
  }, [bookmarkCardOpen, title, url, inputValue]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setSuggestions([]);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleSelectSuggestion = (suggestion) => {
    if (!suggestion?.url) return;
    clearingRef.current = true;
    searchBlockedRef.current = true;
    setInputValue(suggestion.url);
    setSuggestions([]);
    setActiveIndex(-1);
    onNavigate(suggestion.url);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event) => {
    // Helper: accept the top suggestion and navigate
    const acceptTopSuggestion = () => {
      if (!suggestions || suggestions.length === 0) return false;
      const top = suggestions[0];
      if (!top?.url) return false;
      clearingRef.current = true;
      searchBlockedRef.current = true;
      setInputValue(top.url);
      setSuggestions([]);
      setActiveIndex(-1);
      onNavigate(top.url);
      setTimeout(() => {
        try {
          inputRef.current?.setSelectionRange(top.url.length, top.url.length);
          inputRef.current?.blur();
        } catch {}
      }, 0);
      return true;
    };

    if (event.key === "ArrowDown") {
      if (!suggestions || suggestions.length === 0) return;
      event.preventDefault();
      const next = Math.min(activeIndex + 1, suggestions.length - 1);
      setActiveIndex(next);
      const s = suggestions[next];
      if (s?.url) {
        const cur = inputRef.current?.value || "";
        setInputValue(s.url);
        // select the autocompleted suffix
        setTimeout(() => {
          try {
            inputRef.current?.setSelectionRange(cur.length, s.url.length);
          } catch {}
        }, 0);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      if (!suggestions || suggestions.length === 0) return;
      event.preventDefault();
      const prev = Math.max(activeIndex - 1, 0);
      setActiveIndex(prev);
      const s = suggestions[prev];
      if (s?.url) {
        const cur = inputRef.current?.value || "";
        setInputValue(s.url);
        setTimeout(() => {
          try {
            inputRef.current?.setSelectionRange(cur.length, s.url.length);
          } catch {}
        }, 0);
      }
      return;
    }
    if (event.key === "Enter") {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        event.preventDefault();
        handleSelectSuggestion(suggestions[activeIndex]);
      }
      return;
    }
    if (event.key === "Tab") {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        event.preventDefault();
        const s = suggestions[activeIndex];
        clearingRef.current = true;
        searchBlockedRef.current = true;
        setInputValue(s.url);
        setSuggestions([]);
        setActiveIndex(-1);
        setTimeout(() => {
          try {
            inputRef.current?.setSelectionRange(s.url.length, s.url.length);
            inputRef.current?.focus();
          } catch {}
        }, 0);
      } else if (suggestions && suggestions.length > 0) {
        event.preventDefault();
        acceptTopSuggestion();
      }
    }

    if (event.key === "ArrowRight") {
      try {
        const el = inputRef.current;
        if (
          el &&
          el.selectionStart != null &&
          el.selectionEnd != null &&
          el.selectionEnd > el.selectionStart
        ) {
          event.preventDefault();
          // if user hasn't selected a suggestion in the list, accept top suggestion
          if (activeIndex === -1 && suggestions && suggestions.length > 0) {
            acceptTopSuggestion();
          } else if (activeIndex >= 0 && suggestions[activeIndex]) {
            handleSelectSuggestion(suggestions[activeIndex]);
          }
        }
      } catch {}
    }
  };

  const handleRemoveSuggestion = async (e, suggestionId) => {
    e.stopPropagation();
    e.preventDefault();
    await window.api?.removeHistory?.(suggestionId);
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
  };

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
    clearingRef.current = true;
    searchBlockedRef.current = true;
    setInputValue(target);
    setSuggestions([]);
    onNavigate(target);
    inputRef.current?.blur();
  };

  const handleOpenBookmarkCard = () => {
    if (!url) return;
    setBookmarkName(title || url);
    setBookmarkCardOpen((prev) => !prev);
  };

  const handleSaveBookmark = async () => {
    const currentUrl = url.trim();
    if (!currentUrl) return;

    const nextName = bookmarkName.trim() || title || currentUrl;

    try {
      await window.api?.addBookmark?.(currentUrl, nextName);
      setBookmarkCardOpen(false);
      onBookmarkSaved?.({
        url: currentUrl,
        title: nextName,
        created_at: Date.now(),
      });
    } catch (err) {
      console.error("Failed to add bookmark:", err);
      alert("Failed to save bookmark");
    }
  };

  const isSecure = url.startsWith("https://");

  return (
    <div className="addressbar" ref={rootRef}>
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
        title="Reload (Ctrl+R)"
      >
        <IconReload />
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
          onChange={(e) => {
            const v = e.target.value;
            typedRef.current = v;
            autofillLockedRef.current = false;
            setInputValue(v);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.target.select()}
          placeholder="Search or enter URL..."
          spellCheck={false}
        />
        {suggestions.length > 0 && inputValue.trim() && (
          <div className="addressbar__suggestions" role="listbox">
            {suggestions.map((suggestion, idx) => (
              <button
                key={suggestion.id}
                type="button"
                className={`addressbar__suggestion ${idx === activeIndex ? "addressbar__suggestion--active" : ""}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectSuggestion(suggestion);
                }}
              >
                <div className="addressbar__suggestion-content">
                  <div className="addressbar__suggestion-title">
                    {suggestion.title || suggestion.url}
                  </div>
                  <div className="addressbar__suggestion-url">
                    {suggestion.url}
                  </div>
                </div>
                <div
                  className="addressbar__suggestion-remove"
                  role="button"
                  aria-label="Remove from history"
                  onMouseDown={(e) => handleRemoveSuggestion(e, suggestion.id)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <line
                      x1="2"
                      y1="2"
                      x2="10"
                      y2="10"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                    <line
                      x1="10"
                      y1="2"
                      x2="2"
                      y2="10"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
        {bookmarkCardOpen && (
          <div className="addressbar__bookmark-card" ref={bookmarkCardRef}>
            <div className="addressbar__bookmark-card-head">
              <img
                className="addressbar__bookmark-card-icon"
                src={favicon || DEFAULT_SITE_ICON}
                alt=""
                aria-hidden="true"
                onError={(event) => {
                  event.currentTarget.src = DEFAULT_SITE_ICON;
                }}
              />
              <div className="addressbar__bookmark-card-meta">
                <div className="addressbar__bookmark-card-title">
                  Bookmark this page
                </div>
                <div className="addressbar__bookmark-card-url">{url}</div>
              </div>
            </div>
            <label className="addressbar__bookmark-card-label">
              Name
              <input
                className="addressbar__bookmark-card-input"
                type="text"
                value={bookmarkName}
                onChange={(event) => setBookmarkName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSaveBookmark();
                  }
                }}
              />
            </label>
            <div className="addressbar__bookmark-card-actions">
              <button
                type="button"
                className="addressbar__bookmark-card-btn addressbar__bookmark-card-btn--secondary"
                onClick={() => setBookmarkCardOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="addressbar__bookmark-card-btn addressbar__bookmark-card-btn--primary"
                onClick={handleSaveBookmark}
              >
                Save
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          className="addressbar__bookmark-input-btn"
          ref={bookmarkButtonRef}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpenBookmarkCard();
          }}
          title="Bookmark this page"
        >
          ★
        </button>
      </form>

      <div className="addressbar__tools">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              className={`addressbar-tab ${activeTool === tool.id ? "addressbar-tab--active" : ""}`}
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
    </div>
  );
}
