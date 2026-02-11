import React, { useEffect, useState } from 'react';

const MODEL_OPTIONS = [
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
  { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile' },
  { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B' },
];

export default function SettingsPanel() {
  const [darkMode, setDarkMode] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiModel, setAiModel] = useState('llama-3.1-8b-instant');
  const [apiKey, setApiKey] = useState('');
  const [includeActiveTabTitle, setIncludeActiveTabTitle] = useState(true);
  const [includeActiveTabContent, setIncludeActiveTabContent] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await window.electronAPI?.aiGetSettings?.();
      if (res?.ok && res.settings) {
        setApiKey(res.settings.apiKey || '');
        setAiModel(res.settings.model || aiModel);
        setAiEnabled(res.settings.enabled !== false);
        setIncludeActiveTabTitle(res.settings.includeActiveTabTitle !== false);
        setIncludeActiveTabContent(res.settings.includeActiveTabContent !== false);
      }
      setLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.electronAPI?.aiSetSettings?.({
      apiKey,
      model: aiModel,
      enabled: aiEnabled,
      includeActiveTabTitle,
      includeActiveTabContent,
    });
  }, [apiKey, aiModel, aiEnabled, includeActiveTabTitle, includeActiveTabContent, loaded]);

  return (
    <div className="tool-panel" style={{ overflow: 'auto' }}>
      <div className="settings__section">
        <div className="settings__section-title">Appearance</div>
        <div className="settings__row">
          <span className="settings__label">Dark Mode</span>
          <button
            className={`settings__toggle ${darkMode ? 'settings__toggle--on' : ''}`}
            onClick={() => setDarkMode(!darkMode)}
          />
        </div>
      </div>
      <div className="settings__section">
        <div className="settings__section-title">AI Assistant</div>
        <div className="settings__row">
          <span className="settings__label">Enable AI Features</span>
          <button
            className={`settings__toggle ${aiEnabled ? 'settings__toggle--on' : ''}`}
            onClick={() => setAiEnabled(!aiEnabled)}
          />
        </div>
        <div className="settings__row">
          <span className="settings__label">Include Active Tab Title</span>
          <button
            className={`settings__toggle ${includeActiveTabTitle ? 'settings__toggle--on' : ''}`}
            onClick={() => setIncludeActiveTabTitle(!includeActiveTabTitle)}
          />
        </div>
        <div className="settings__row">
          <span className="settings__label">Include Active Tab Text</span>
          <button
            className={`settings__toggle ${includeActiveTabContent ? 'settings__toggle--on' : ''}`}
            onClick={() => setIncludeActiveTabContent(!includeActiveTabContent)}
          />
        </div>
        <div className="settings__row">
          <span className="settings__label">Model</span>
          <select
            className="settings__select"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="settings__row">
          <span className="settings__label">API Key</span>
          <input
            style={{
              width: 180,
              height: 26,
              padding: '0 8px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--font-xs)',
              outline: 'none',
            }}
            type="password"
            placeholder="gsk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      </div>
      <div className="settings__section">
        <div className="settings__section-title">Workspace</div>
        <div className="settings__row">
          <span className="settings__label">Auto-Save</span>
          <button
            className={`settings__toggle ${autoSave ? 'settings__toggle--on' : ''}`}
            onClick={() => setAutoSave(!autoSave)}
          />
        </div>
        <div className="settings__row">
          <span className="settings__label">Auto-Save Interval</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>5 minutes</span>
        </div>
      </div>
      <div className="settings__section">
        <div className="settings__section-title">Keyboard Shortcuts</div>
        <div className="settings__row">
          <span className="settings__label">New Tab</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Ctrl+T</span>
        </div>
        <div className="settings__row">
          <span className="settings__label">Toggle DevTools</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>F12</span>
        </div>
        <div className="settings__row">
          <span className="settings__label">Network Inspector</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Ctrl+Shift+I</span>
        </div>
      </div>
    </div>
  );
}
