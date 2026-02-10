import React, { useMemo, useState } from 'react';

const DEFAULT_MODEL = 'llama-3.1-8b-instant';

export default function ConsolePanel({ entries = [], onClear }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [explainingId, setExplainingId] = useState(null);
  const [explainText, setExplainText] = useState('');
  const [selectedId, setSelectedId] = useState(null);

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

  const handleExplain = async (msg, id) => {
    const settingsRes = await window.electronAPI?.aiGetSettings?.();
    const settings = settingsRes?.settings || { enabled: true, model: DEFAULT_MODEL, apiKey: '' };
    if (!settings.enabled) {
      setExplainText('AI is disabled in Settings.');
      setExplainingId(id);
      return;
    }
    if (!settings.apiKey) {
      setExplainText('Add your Groq API key in Settings to enable AI.');
      setExplainingId(id);
      return;
    }

    setExplainingId(id);
    setExplainText('Explaining...');

    const prompt = `Explain this browser console message, suggest likely cause, and provide a fix or next steps:\n\nMessage: ${msg.text}\nSource: ${msg.sourceId || 'unknown'}:${msg.line || 'n/a'}\nType: ${msg.type}`;

    try {
      const res = await window.electronAPI?.aiChat?.({
        apiKey: settings.apiKey,
        model: settings.model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: 'You are a senior web developer. Respond with concise debugging guidance.' },
          { role: 'user', content: prompt },
        ],
      });
      if (!res?.ok) throw new Error(res?.error || 'AI request failed.');
      setExplainText(res.content || '(empty response)');
    } catch (error) {
      setExplainText(`Error: ${error.message || String(error)}`);
    }
  };

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
        {filtered.map((msg, i) => {
          const id = `${msg.time}-${i}`;
          const canExplain = msg.type === 'error' || msg.type === 'warn';
          const isSelected = selectedId === id;
          return (
            <div key={id} className="console__msg-wrap">
              <div
                className={`console__msg console__msg--${msg.type} ${isSelected ? 'console__msg--selected' : ''}`}
                onClick={() => setSelectedId(id)}
              >
                <span className="console__msg-type">{typeIcons[msg.type]}</span>
                <span className="console__msg-text">{msg.text}</span>
                <span className="console__msg-time">{msg.time}</span>
                {canExplain && isSelected && (
                  <button
                    className="console__explain-btn"
                    onClick={() => handleExplain(msg, id)}
                    title="Explain with AI"
                  >
                    Explain
                  </button>
                )}
              </div>
              {explainingId === id && explainText && (
                <div className="console__explain">
                  {explainText}
                </div>
              )}
            </div>
          );
        })}
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
