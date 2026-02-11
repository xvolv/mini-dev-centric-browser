import React, { useMemo, useState } from "react";

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ms) {
  if (!ms && ms !== 0) return "-";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export default function NetworkPanel({ entries = [], onClear }) {
  const [filterText, setFilterText] = useState("");

  const getMethodClass = (m) =>
    `network__method network__method--${m.toLowerCase()}`;
  const getStatusClass = (s) => {
    if (s >= 200 && s < 300) return "network__status--2xx";
    if (s >= 300 && s < 400) return "network__status--3xx";
    if (s >= 400 && s < 500) return "network__status--4xx";
    return "network__status--5xx";
  };

  const filtered = useMemo(
    () =>
      entries.filter(
        (r) =>
          !filterText || r.url.toLowerCase().includes(filterText.toLowerCase()),
      ),
    [entries, filterText],
  );

  return (
    <div className="tool-panel">
      <div className="network__toolbar">
        <input
          className="network__filter-input"
          type="text"
          placeholder="Filter by URL..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <button className="btn-icon" title="Clear" onClick={onClear}>
          🗑
        </button>
      </div>
      <div className="network__table">
        <div className="network__row network__row-header">
          <span>Method</span>
          <span>URL</span>
          <span>Status</span>
          <span>Size</span>
          <span>Time</span>
        </div>
        {filtered.map((req, i) => (
          <div
            key={`${req.method}-${req.url}-${req.timeMs ?? i}-${i}`}
            className="network__row"
          >
            <span className={getMethodClass(req.method)}>{req.method}</span>
            <span className="network__url">{req.url}</span>
            <span className={getStatusClass(req.status)}>{req.status}</span>
            <span>{formatSize(req.size)}</span>
            <span>{formatTime(req.timeMs)}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="tool-panel__empty" style={{ padding: "40px 24px" }}>
            <div className="tool-panel__empty-icon">🌐</div>
            <div className="tool-panel__empty-title">No requests yet</div>
            <div className="tool-panel__empty-desc">
              Browse to a page to see network activity here.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
