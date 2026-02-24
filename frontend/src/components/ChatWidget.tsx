import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { MessageCircle, X, Send, Bot, User, ArrowRight, Sparkles } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  action?: string;
  actionTarget?: string;
  suggestions?: string[];
  timestamp: Date;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  let nextId = useRef(1);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  // Stop pulse after first open
  useEffect(() => {
    if (open) setPulse(false);
  }, [open]);

  const addBotMessage = useCallback((reply: string, action?: string, actionTarget?: string, suggestions?: string[]) => {
    setMessages(prev => [...prev, {
      id: nextId.current++,
      text: reply,
      sender: 'bot',
      action,
      actionTarget,
      suggestions,
      timestamp: new Date(),
    }]);
  }, []);

  const handleOpen = () => {
    setOpen(true);
    if (messages.length === 0) {
      // Send initial greeting
      sendMessage('Olá', true);
    }
  };

  const sendMessage = async (text: string, silent = false) => {
    if (!text.trim()) return;

    if (!silent) {
      setMessages(prev => [...prev, {
        id: nextId.current++,
        text,
        sender: 'user',
        timestamp: new Date(),
      }]);
    }

    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/api/v1/chatbot/message', { message: text });
      const data = res.data;
      addBotMessage(
        data.reply,
        data.action,
        data.action_target,
        data.suggestions,
      );
    } catch {
      addBotMessage('Desculpe, ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) sendMessage(input);
  };

  const handleSuggestion = (text: string) => {
    if (!loading) sendMessage(text);
  };

  const handleNavigate = (target: string) => {
    navigate(target);
    setOpen(false);
  };

  // Simple markdown-like bold rendering
  const renderText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <>
      {/* Chat Bubble */}
      {!open && (
        <button
          className={`chat-bubble${pulse ? ' chat-bubble-pulse' : ''}`}
          onClick={handleOpen}
          aria-label="Abrir assistente"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div className="chat-window">
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-avatar">
                <Sparkles size={16} />
              </div>
              <div>
                <div className="chat-header-title">Assistente Health</div>
                <div className="chat-header-status">
                  <span className="chat-status-dot" /> Online
                </div>
              </div>
            </div>
            <button className="chat-close" onClick={() => setOpen(false)} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`chat-msg chat-msg-${msg.sender}`}>
                <div className="chat-msg-icon">
                  {msg.sender === 'bot' ? <Bot size={14} /> : <User size={14} />}
                </div>
                <div className="chat-msg-content">
                  <div className="chat-msg-bubble">
                    {msg.text.split('\n').map((line, i) => (
                      <span key={i}>
                        {renderText(line)}
                        {i < msg.text.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </div>

                  {/* Navigate action */}
                  {msg.action === 'navigate' && msg.actionTarget && (
                    <button
                      className="chat-action-btn"
                      onClick={() => handleNavigate(msg.actionTarget!)}
                    >
                      Ir para a página <ArrowRight size={12} />
                    </button>
                  )}

                  {/* Suggestions */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="chat-suggestions">
                      {msg.suggestions.map((s, i) => (
                        <button
                          key={i}
                          className="chat-suggestion-btn"
                          onClick={() => handleSuggestion(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="chat-msg chat-msg-bot">
                <div className="chat-msg-icon"><Bot size={14} /></div>
                <div className="chat-msg-content">
                  <div className="chat-msg-bubble chat-typing">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form className="chat-input-area" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder="Escreva a sua mensagem..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="chat-send"
              disabled={!input.trim() || loading}
              aria-label="Enviar"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
