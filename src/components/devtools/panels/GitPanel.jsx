import React, { useState } from 'react';
import { SAMPLE_GIT_FILES } from '../../../data/sampleData';

export default function GitPanel() {
  const [commitMsg, setCommitMsg] = useState('');

  return (
    <div className="tool-panel">
      <div className="git-panel__status">
        <div className="git-panel__branch">
          <span className="git-panel__branch-icon">⎇</span>
          main
          <span className="tool-panel__badge tool-panel__badge--success">● synced</span>
        </div>
      </div>
      <div className="tool-panel__header">
        <span className="tool-panel__title">Changed Files</span>
        <span className="tool-panel__badge tool-panel__badge--warn">{SAMPLE_GIT_FILES.length}</span>
      </div>
      <ul className="git-panel__file-list">
        {SAMPLE_GIT_FILES.map((file, i) => (
          <li key={i} className="git-panel__file">
            <span className={`git-panel__file-status git-panel__file-status--${file.status}`}>
              {file.status === 'modified' ? 'M' : file.status === 'added' ? 'A' : 'D'}
            </span>
            <span>{file.name}</span>
          </li>
        ))}
      </ul>
      <div className="git-panel__commit-area">
        <textarea
          className="git-panel__commit-input"
          placeholder="Commit message..."
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
        />
        <button className="git-panel__commit-btn">✓ Commit Changes</button>
      </div>
    </div>
  );
}
