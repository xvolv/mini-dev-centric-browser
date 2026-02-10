import React, { useState } from 'react';

const DEFAULT_MODEL = 'llama-3.1-8b-instant';

export default function AiAssistantPanel() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "👋 Hi! I'm your AI debugging assistant. I can help explain errors, suggest fixes, and generate test cases. Ask me anything!",
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

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
      const payload = {
        apiKey: settings.apiKey,
        model: settings.model || DEFAULT_MODEL,
        messages: buildMessages([...messages, { role: 'user', text: question }]),
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
      <div className="ai-assistant__chat">
        {messages.map((msg, i) => (
          <div key={i} className={`ai-assistant__msg ai-assistant__msg--${msg.role}`}>
            {msg.text}
          </div>
        ))}
      </div>
      <div className="ai-assistant__input-bar">
        <input
          className="ai-assistant__input"
          type="text"
          placeholder="Ask about an error or request help..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isSending}
        />
        <button className="ai-assistant__send" onClick={handleSend} disabled={isSending}>➤</button>
      </div>
    </div>
  );
}
