import React, { useState } from 'react';

export default function SettingsPanel() {
  const [darkMode, setDarkMode] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [autoSave, setAutoSave] = useState(true);

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
            placeholder="sk-..."
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
