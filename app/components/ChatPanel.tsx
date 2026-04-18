'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/components/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Quick prompts shown when chat is empty ───────────────────────────────────

const QUICK_PROMPTS = [
  "What's critically low on stock right now?",
  "Draft a Sincerely Laundry order for today",
  "How many bath towels for 80 departures?",
  "Which items need reordering this week?",
];

// ─── Inline icons ─────────────────────────────────────────────────────────────

const SendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const SparkleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

// ─── Message renderer — handles basic markdown-ish formatting ─────────────────

function renderContent(text: string) {
  // Split into lines, apply basic formatting
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bold via **text** or *text*
    const formatted = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+?)\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px;font-family:JetBrains Mono,monospace;font-size:11px">$1</code>');

    const isBullet = formatted.trimStart().startsWith('•') || formatted.trimStart().startsWith('-') || formatted.trimStart().startsWith('*');

    return (
      <span key={i}>
        {isBullet ? (
          <span style={{ display: 'flex', gap: 6, paddingLeft: 4 }}>
            <span style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }}>•</span>
            <span dangerouslySetInnerHTML={{ __html: formatted.replace(/^[\s•\-*]+/, '') }} />
          </span>
        ) : (
          <span dangerouslySetInnerHTML={{ __html: formatted }} />
        )}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '10px 14px', alignItems: 'center' }} aria-label="Assistant is typing">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--text-muted)',
            animation: `chat-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── ChatPanel Component ──────────────────────────────────────────────────────

export default function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const { role } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  // Escape to close (only while panel is open)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    // Placeholder for streaming AI response
    const aiMsgId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      { id: aiMsgId, role: 'model', content: '', timestamp: new Date() },
    ]);

    abortRef.current = new AbortController();

    try {
      const history = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, role }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Request failed');
      }

      // Stream response body
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snapshot = accumulated;
        setMessages(prev =>
          prev.map(m => m.id === aiMsgId ? { ...m, content: snapshot } : m)
        );
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled — keep whatever was streamed
      } else {
        setMessages(prev =>
          prev.map(m =>
            m.id === aiMsgId
              ? { ...m, content: `⚠ ${err.message ?? 'Something went wrong'}` }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, isStreaming, role]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    if (isStreaming) abortRef.current?.abort();
    setMessages([]);
    setInput('');
    setIsStreaming(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Floating panel */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Inventory AI Assistant"
        className="chat-panel"
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(227,25,55,0.06)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}>
              <SparkleIcon />
            </div>
            <div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                Inventory AI
              </div>
              <div
                aria-live="polite"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {isStreaming ? '● Responding…' : '● Live data · Gemini 2.0 Flash'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                aria-label="Clear conversation"
                title="Clear conversation"
                className="chat-icon-btn"
              >
                <TrashIcon />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close assistant"
              title="Close (Esc)"
              className="chat-icon-btn"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {/* Empty state — quick prompts */}
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{
                textAlign: 'center',
                padding: '20px 0 10px',
                color: 'var(--text-muted)',
              }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>📦</div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--text-muted)',
                }}>
                  Ask me anything about your inventory
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {QUICK_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="chat-quick-prompt"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                maxWidth: '88%',
                padding: '9px 13px',
                borderRadius: msg.role === 'user'
                  ? '12px 12px 3px 12px'
                  : '12px 12px 12px 3px',
                background: msg.role === 'user'
                  ? 'var(--red)'
                  : 'rgba(255,255,255,0.05)',
                border: msg.role === 'user'
                  ? 'none'
                  : '1px solid var(--card-border)',
                color: msg.role === 'user' ? 'white' : 'var(--text)',
                fontSize: 13,
                lineHeight: 1.55,
                fontFamily: 'Inter, sans-serif',
              }}>
                {msg.role === 'model' && msg.content === '' ? (
                  <TypingDots />
                ) : (
                  renderContent(msg.content)
                )}
              </div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9,
                color: 'var(--text-muted)',
                marginTop: 3,
                paddingLeft: msg.role === 'user' ? 0 : 4,
                paddingRight: msg.role === 'user' ? 4 : 0,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                {msg.role === 'user' ? 'You' : 'AI'} ·{' '}
                {msg.timestamp.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 12px',
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          background: 'var(--bg-sub)',
          flexShrink: 0,
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about stock, orders, linen…"
            aria-label="Ask the inventory assistant"
            rows={1}
            disabled={isStreaming}
            className="chat-textarea"
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 100) + 'px';
            }}
          />
          <button
            onClick={() => {
              if (isStreaming) {
                abortRef.current?.abort();
              } else {
                sendMessage(input);
              }
            }}
            aria-label={isStreaming ? 'Stop generating' : 'Send message'}
            title={isStreaming ? 'Stop' : 'Send (Enter)'}
            className="chat-send-btn"
            data-streaming={isStreaming || undefined}
          >
            {isStreaming ? (
              <div style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--red)' }} />
            ) : (
              <SendIcon />
            )}
          </button>
        </div>
      </div>
    </>
  );
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        