import React, { useMemo, useState } from 'react';

export default function ConsolePanel({ entries = [], onClear }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const typeIcons = { log: '●', warn: '⚠', error: '✕', info: 'ℹ' };

  const counts = useMemo(() => {
    return entries.reduce(
      (acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      },
      { log: 0, warn: 0, error: 0, info: 0 }
    );
  }, [entries]);

  const filtered = useMemo(
    () =>
      entries.filter((m) => {
        if (filter !== 'all' && m.type !== filter) return false;
        if (search && !m.text.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [entries, filter, search]
  );

  return (
    <div className="tool-panel">
      <div className="console__filters">
        {['all', 'log', 'warn', 'error', 'info'].map((f) => (
          <button
            key={f}
            className={`console__filter-btn ${filter === f ? 'console__filter-btn--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && <span> ({counts[f] || 0})</span>}
          </button>
        ))}
        <input
          className="console__search"
          type="text"
          placeholder="Filter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-icon" title="Clear" onClick={onClear}>🗑</button>
      </div>
      <div className="console__messages">
        {filtered.map((msg, i) => (
          <div key={`${msg.time}-${i}`} className={`console__msg console__msg--${msg.type}`}>
            <span className="console__msg-type">{typeIcons[msg.type]}</span>
            <span className="console__msg-text">{msg.text}</span>
            <span className="console__msg-time">{msg.time}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="tool-panel__empty" style={{ padding: '40px 24px' }}>
            <div className="tool-panel__empty-icon">📋</div>
            <div className="tool-panel__empty-title">No messages</div>
            <div className="tool-panel__empty-desc">Console output from web pages will appear here</div>
          </div>
        )}
      </div>
    </div>
  );
}
