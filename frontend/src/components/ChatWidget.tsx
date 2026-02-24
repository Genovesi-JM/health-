import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { MessageCircle, X, Send, Bot, User, ArrowRight, Sparkles } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

/* ── Types ────────────────────────────────────────────────── */

/** Role-based message for conversation history (sent to backend) */
interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

/** UI message with extra rendering data */
interface UIMessage {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  action?: string;
  actionTarget?: string;
  suggestions?: string[];
  timestamp: Date;
}

/* ── Page title mapping ────────────────────────────────────── */

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/triage': 'Triagem Digital',
  '/consultations': 'Consultas',
  '/patient/profile': 'Perfil do Paciente',
  '/settings': 'Definições',
  '/admin/patients': 'Gestão de Pacientes',
  '/admin/doctors': 'Gestão de Médicos',
};

function getPageTitle(pathname: string): string {
  return PAGE_TITLES[pathname] || document.title || '';
}

/* ── Component ─────────────────────────────────────────────── */

export default function ChatWidget() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [uiMessages, setUiMessages] = useState<UIMessage[]>([]);
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const nextId = useRef(1);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [uiMessages]);

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

  /** Append a bot message to the UI list */
  const addBotMessage = useCallback(
    (reply: string, action?: string, actionTarget?: string, suggestions?: string[]) => {
      setUiMessages(prev => [
        ...prev,
        {
          id: nextId.current++,
          text: reply,
          sender: 'bot',
          action,
          actionTarget,
          suggestions,
          timestamp: new Date(),
        },
      ]);
    },
    [],
  );

  /** Open the widget — send initial greeting on first open */
  const handleOpen = () => {
    setOpen(true);
    if (history.length === 0) {
      sendMessage('Olá', true);
    }
  };

  /**
   * GeoVision-style: send full conversation history + page context.
   * @param text  User message text
   * @param silent  If true, don't show user bubble (e.g. initial greeting)
   */
  const sendMessage = async (text: string, silent = false) => {
    if (!text.trim()) return;

    // Build updated history with the new user message
    const userItem: ChatHistoryItem = { role: 'user', content: text.trim() };
    const updatedHistory = [...history, userItem];

    // Update history state immediately
    setHistory(updatedHistory);

    // Show user bubble (unless silent greeting)
    if (!silent) {
      setUiMessages(prev => [
        ...prev,
        { id: nextId.current++, text, sender: 'user', timestamp: new Date() },
      ]);
    }

    setInput('');
    setLoading(true);

    try {
      // GeoVision-style: send full messages[] + page context
      const res = await api.post('/api/v1/chatbot/chat', {
        messages: updatedHistory,
        page: location.pathname,
        page_title: getPageTitle(location.pathname),
      });

      const data = res.data;

      // Append assistant reply to history
      setHistory(prev => [...prev, { role: 'assistant', content: data.reply }]);

      addBotMessage(data.reply, data.action, data.action_target, data.suggestions);
    } catch {
      addBotMessage(t('chat.error'));
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

  /** Simple markdown bold rendering */
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
          aria-label={t('chat.open')}
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
                <div className="chat-header-title">{t('chat.title')}</div>
                <div className="chat-header-status">
                  <span className="chat-status-dot" /> Online
                </div>
              </div>
            </div>
            <button className="chat-close" onClick={() => setOpen(false)} aria-label={t('chat.close')}>
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {uiMessages.map(msg => (
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
                      {t('common.go_to_page')} <ArrowRight size={12} />
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
              placeholder={t('chat.placeholder')}
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="chat-send"
              disabled={!input.trim() || loading}
              aria-label={t('chat.send')}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
