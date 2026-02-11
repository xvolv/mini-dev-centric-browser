import React, { useEffect, useRef, useState } from "react";

export default function AddressBar({
  url,
  onNavigate,
  isLoading,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onReload,
  devToolsOpen,
  onToggleDevTools,
}) {
  const [inputValue, setInputValue] = useState(url);
  const inputRef = useRef(null);

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
        ←
      </button>
      <button
        className="addressbar__btn"
        onClick={onForward}
        disabled={!canGoForward}
        title="Forward (Alt+→)"
      >
        →
      </button>
      <button
        className="addressbar__btn"
        onClick={onReload}
        title="Reload (Ctrl+R)"
      >
        {isLoading ? "✕" : "↻"}
      </button>
      <form onSubmit={handleSubmit} className="addressbar__input-wrapper">
        <span
          className={`addressbar__lock ${isSecure ? "addressbar__lock--secure" : ""}`}
        >
          {isSecure ? "🔒" : "🔓"}
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
      <button
        className={`addressbar__devtools-toggle ${devToolsOpen ? "addressbar__devtools-toggle--active" : ""}`}
        onClick={onToggleDevTools}
        title="Toggle DevTools (F12)"
      >
        {devToolsOpen ? "✦ DevTools" : "✦ DevTools"}
      </button>
    </div>
  );
}
