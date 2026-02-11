import React, { useEffect, useRef, useState } from 'react';

const DEFAULT_MODEL = 'llama-3.1-8b-instant';

export default function AiAssistantPanel({ activeTabTitle, activeTabHtml, activeTabHtmlUpdatedAt, aiDraft }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "👋 Hi! I'm your AI debugging assistant. I can help explain errors, suggest fixes, and generate test cases. Ask me anything!",
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef(null);

  const renderInline = (text) => {
    const nodes = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text))) {
      if (match.index > lastIndex) {
        nodes.push(text.slice(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**')) {
        nodes.push(<strong key={`${match.index}-b`}>{token.slice(2, -2)}</strong>);
      } else {
        nodes.push(<code key={`${match.index}-c`}>{token.slice(1, -1)}</code>);
      }
      lastIndex = match.index + token.length;
    }
    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }
    return nodes;
  };

  const renderTextSegment = (content, keyBase) => {
    const lines = content.split('\n');
    const blocks = [];
    let paragraph = [];
    let i = 0;

    const flushParagraph = () => {
      if (paragraph.length === 0) return;
      const parts = [];
      paragraph.forEach((line, idx) => {
        if (idx > 0) parts.push(<br key={`${keyBase}-br-${idx}`} />);
        parts.push(...renderInline(line));
      });
      blocks.push(
        <p className="ai-assistant__para" key={`${keyBase}-p-${blocks.length}`}>
          {parts}
        </p>
      );
      paragraph = [];
    };

    const readList = (isOrdered) => {
      const items = [];
      const regex = isOrdered ? /^\s*\d+\.\s+/ : /^\s*-\s+/;
      while (i < lines.length && regex.test(lines[i])) {
        const text = lines[i].replace(regex, '');
        items.push(
          <li className="ai-assistant__list-item" key={`${keyBase}-li-${i}`}>
            {renderInline(text)}
          </li>
        );
        i += 1;
      }
      blocks.push(
        isOrdered ? (
          <ol className="ai-assistant__list" key={`${keyBase}-ol-${blocks.length}`}>
            {items}
          </ol>
        ) : (
          <ul className="ai-assistant__list" key={`${keyBase}-ul-${blocks.length}`}>
            {items}
          </ul>
        )
      );
    };

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        flushParagraph();
        i += 1;
        continue;
      }
      if (/^\s*-\s+/.test(line)) {
        flushParagraph();
        readList(false);
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        flushParagraph();
        readList(true);
        continue;
      }
      paragraph.push(line);
      i += 1;
    }
    flushParagraph();
    return blocks;
  };

  const renderMessageText = (text) => {
    const segments = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let idx = 0;

    while ((match = regex.exec(text))) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      segments.push({ type: 'code', lang: match[1] || '', content: match[2] || '' });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      segments.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return segments.map((segment) => {
      if (segment.type === 'code') {
        return (
          <pre className="ai-assistant__code" key={`code-${idx++}`}>
            <code>{segment.content.trimEnd()}</code>
          </pre>
        );
      }
      return (
        <div className="ai-assistant__text" key={`text-${idx++}`}>
          {renderTextSegment(segment.content, `seg-${idx}`)}
        </div>
      );
    });
  };

  useEffect(() => {
    if (!aiDraft?.id || !aiDraft?.text) return;
    const formatted = `Selected text:\n${aiDraft.text}\n\nQuestion: `;
    setInput(formatted);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [aiDraft?.id, aiDraft?.text]);

  const buildMessages = (items) => {
    return items.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.text,
    }));
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');

    const settingsRes = await window.electronAPI?.aiGetSettings?.();
    const settings = settingsRes?.settings || { enabled: true, model: DEFAULT_MODEL, apiKey: '' };

    if (!settings.enabled) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'AI is disabled in Settings.' },
      ]);
      return;
    }
    if (!settings.apiKey) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Add your Groq API key in Settings to enable AI.' },
      ]);
      return;
    }

    setIsSending(true);
    try {
      const includeTitle = settings.includeActiveTabTitle !== false;
      const includeHtml = settings.includeActiveTabContent !== false;
      const titleContext = includeTitle && activeTabTitle ? `\n\nActive tab title: ${activeTabTitle}` : '';
      let htmlContext = '';
      if (includeHtml && activeTabHtml) {
        const maxChars = 12000;
        const trimmedHtml = activeTabHtml.length > maxChars ? activeTabHtml.slice(0, maxChars) : activeTabHtml;
        const truncatedNote = activeTabHtml.length > maxChars ? `\n\n(Text truncated to ${maxChars} chars)` : '';
        htmlContext = `\n\nActive tab text:\n${trimmedHtml}${truncatedNote}`;
      }
      const questionWithContext = `${question}${titleContext}${htmlContext}`;
      const payload = {
        apiKey: settings.apiKey,
        model: settings.model || DEFAULT_MODEL,
        messages: buildMessages([...messages, { role: 'user', text: questionWithContext }]),
      };
      const res = await window.electronAPI?.aiChat?.(payload);
      if (!res?.ok) throw new Error(res?.error || 'AI request failed.');
      setMessages((prev) => [...prev, { role: 'assistant', text: res.content || '(empty response)' }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Error: ${error.message || String(error)}` },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="tool-panel">
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border-muted)',
          color: 'var(--text-muted)',
          fontSize: 'var(--font-xs)',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span>Active tab: {activeTabTitle || '(none)'}</span>
        <span>Text size: {activeTabHtml ? `${activeTabHtml.length} chars` : '0 chars'}</span>
        <span>
          Captured:{' '}
          {activeTabHtmlUpdatedAt
            ? new Date(activeTabHtmlUpdatedAt).toLocaleTimeString('en-US', { hour12: false })
            : 'never'}
        </span>
      </div>
      <div className="ai-assistant__chat">
        {messages.map((msg, i) => (
          <div key={i} className={`ai-assistant__msg ai-assistant__msg--${msg.role}`}>
            {renderMessageText(msg.text)}
          </div>
        ))}
      </div>
      <div className="ai-assistant__input-bar">
        <textarea
          className="ai-assistant__input"
          rows={2}
          placeholder="Ask about an error or request help... (Ctrl+Enter to send)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isSending}
          ref={inputRef}
        />
        <button className="ai-assistant__send" onClick={handleSend} disabled={isSending}>➤</button>
      </div>
    </div>
  );
}
