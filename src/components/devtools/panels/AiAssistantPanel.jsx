import React, { useState } from 'react';

export default function AiAssistantPanel() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: "👋 Hi! I'm your AI debugging assistant. I can help explain errors, suggest fixes, and generate test cases. Ask me anything!" },
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', text: input }]);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: "I'm in demo mode right now. Once connected to an AI API, I'll be able to:\n\n• Explain error messages\n• Suggest code fixes\n• Generate test cases\n• Help with debugging\n\nConfigure your API key in Settings to enable full AI capabilities.",
        },
      ]);
    }, 500);
    setInput('');
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
        />
        <button className="ai-assistant__send" onClick={handleSend}>➤</button>
      </div>
    </div>
  );
}
