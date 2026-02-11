import React, { useCallback, useEffect, useRef, useState } from "react";

export default function SandboxPanel() {
  const [html, setHtml] = useState(
    '<div class="card">\n  <h2>Hello World</h2>\n  <p>Edit me!</p>\n  <button id="btn">Click</button>\n</div>',
  );
  const [css, setCss] = useState(
    ".card {\n  padding: 20px;\n  border-radius: 8px;\n  background: #1e293b;\n  color: #e2e8f0;\n  font-family: sans-serif;\n  text-align: center;\n}\nh2 { color: #60a5fa; }\nbutton {\n  padding: 8px 16px;\n  background: #3b82f6;\n  color: white;\n  border: none;\n  border-radius: 6px;\n  cursor: pointer;\n  margin-top: 12px;\n}",
  );
  const [js, setJs] = useState(
    "document.getElementById('btn').addEventListener('click', () => {\n  alert('Hello from Sandbox!');\n});",
  );
  const iframeRef = useRef(null);

  const updatePreview = useCallback(() => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(
      `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`,
    );
    doc.close();
  }, [html, css, js]);

  useEffect(() => {
    const timer = setTimeout(updatePreview, 500);
    return () => clearTimeout(timer);
  }, [updatePreview]);

  return (
    <div className="tool-panel">
      <div className="sandbox__editors">
        <div className="sandbox__editor-section">
          <div className="sandbox__editor-header">
            <span className="sandbox__editor-header-dot sandbox__editor-header-dot--html" />
            HTML
          </div>
          <textarea
            className="sandbox__textarea"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="sandbox__editor-section">
          <div className="sandbox__editor-header">
            <span className="sandbox__editor-header-dot sandbox__editor-header-dot--css" />
            CSS
          </div>
          <textarea
            className="sandbox__textarea"
            value={css}
            onChange={(e) => setCss(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="sandbox__editor-section">
          <div className="sandbox__editor-header">
            <span className="sandbox__editor-header-dot sandbox__editor-header-dot--js" />
            JavaScript
          </div>
          <textarea
            className="sandbox__textarea"
            value={js}
            onChange={(e) => setJs(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>
      <div className="sandbox__preview-container">
        <div className="sandbox__preview-header">▶ Preview</div>
        <iframe
          ref={iframeRef}
          className="sandbox__preview-iframe"
          title="Sandbox Preview"
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );
}
