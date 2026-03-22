import React, { useState } from 'react';
import { MessageSquare, Send, X, Sparkles, Leaf, BookOpen, Quote } from 'lucide-react';
import { ragService } from '../services/api';

const AIAssistant = ({ isOpen, setIsOpen }) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      text: "Marhba bik! 🌿 Je suis SANIA, votre assistant agricole intelligent. Comment puis-je vous aider avec votre exploitation aujourd'hui ?",
      sender: 'ai'
    }
  ]);

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    const newMessages = [...messages, { text: userMessage, sender: 'user' }];
    setMessages(newMessages);
    setMessage('');
    setIsLoading(true);

    try {
      const response = await ragService.ask(userMessage);
      const { answer, sources } = response.data;

      setMessages(prev => [...prev, {
        text: answer,
        sender: 'ai',
        sources: sources
      }]);
    } catch (err) {
      console.error("RAG Error:", err);
      setMessages(prev => [...prev, {
        text: "Désolé, j'ai rencontré une erreur en consultant ma base de connaissances. Vérifiez que le service Ollama est bien lancé.",
        sender: 'ai'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000 }}>
      {isOpen ? (
        <div
          className="animate-scale-in"
          style={{
            width: '380px',
            height: '520px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(139, 195, 74, 0.08)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--glass-border)',
            overflow: 'hidden',
            background: 'rgba(11, 15, 13, 0.95)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '1.2rem 1.5rem',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(139, 195, 74, 0.08), rgba(107, 142, 35, 0.05))',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
              <div style={{
                padding: '0.4rem',
                borderRadius: '10px',
                background: 'var(--gradient-earth)',
                display: 'flex',
              }}>
                <Leaf size={16} color="#fff" />
              </div>
              <div>
                <h3 style={{
                  fontSize: '0.95rem',
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: '700',
                  color: 'var(--text-bright)',
                }}>
                  SANIA Assistant
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <div className="status-dot online" style={{ width: '5px', height: '5px' }}></div>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '1px' }}>EN LIGNE</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '0.4rem',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            padding: '1.2rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
          }}>
            {messages.map((m, i) => (
              <div
                key={i}
                className="animate-slide-up"
                style={{
                  alignSelf: m.sender === 'ai' ? 'flex-start' : 'flex-end',
                  background: m.sender === 'ai'
                    ? 'rgba(255, 255, 255, 0.04)'
                    : 'var(--gradient-earth)',
                  padding: '0.75rem 1rem',
                  borderRadius: m.sender === 'ai'
                    ? '4px 14px 14px 14px'
                    : '14px 14px 4px 14px',
                  maxWidth: '85%',
                  fontSize: '0.85rem',
                  color: m.sender === 'ai' ? 'var(--text-light)' : '#fff',
                  lineHeight: '1.5',
                  border: m.sender === 'ai' ? '1px solid var(--glass-border)' : 'none',
                  boxShadow: m.sender === 'user' ? '0 4px 12px rgba(139, 195, 74, 0.15)' : 'none',
                }}
              >
                {m.text}

                {m.sender === 'ai' && m.sources && m.sources.length > 0 && (
                  <div style={{
                    marginTop: '0.8rem',
                    paddingTop: '0.6rem',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem'
                  }}>
                    <div style={{
                      fontSize: '0.65rem',
                      color: 'var(--text-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      <BookOpen size={10} /> Sources consultées
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {m.sources.slice(0, 3).map((s, si) => (
                        <div key={si} style={{
                          fontSize: '0.65rem',
                          background: 'rgba(139, 195, 74, 0.1)',
                          color: 'var(--primary)',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          border: '1px solid rgba(139, 195, 74, 0.2)',
                        }}>
                          {s.filename}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div style={{
                alignSelf: 'flex-start',
                background: 'rgba(255,255,255,0.02)',
                padding: '0.75rem 1rem',
                borderRadius: '4px 14px 14px 14px',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                gap: '0.4rem',
                alignItems: 'center',
              }}>
                <div className="shimmer" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                <div className="shimmer" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', animationDelay: '0.2s' }}></div>
                <div className="shimmer" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', animationDelay: '0.4s' }}></div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            padding: '1rem 1.2rem',
            borderTop: '1px solid var(--glass-border)',
            display: 'flex',
            gap: '0.6rem',
            background: 'rgba(0,0,0,0.2)',
          }}>
            <input
              type="text"
              placeholder={isLoading ? "SANIA réfléchit..." : "Posez une question..."}
              value={message}
              disabled={isLoading}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--glass-border)',
                borderRadius: '10px',
                padding: '0.65rem 1rem',
                color: 'var(--text-light)',
                flex: 1,
                outline: 'none',
                fontSize: '0.85rem',
                transition: 'border-color 0.3s',
                opacity: isLoading ? 0.6 : 1,
              }}
            />
            <button
              className="btn btn-primary"
              disabled={isLoading || !message.trim()}
              style={{
                padding: '0.65rem 0.8rem',
                borderRadius: '10px',
                minWidth: '42px',
                opacity: (isLoading || !message.trim()) ? 0.5 : 1,
                cursor: (isLoading || !message.trim()) ? 'not-allowed' : 'pointer',
              }}
              onClick={handleSend}
            >
              {isLoading ? <div className="spinner-small"></div> : <Send size={16} />}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '58px',
            height: '58px',
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            background: 'var(--gradient-earth)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(139, 195, 74, 0.3), 0 0 0 4px rgba(139, 195, 74, 0.08)',
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            position: 'relative',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(139, 195, 74, 0.4), 0 0 0 6px rgba(139, 195, 74, 0.12)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(139, 195, 74, 0.3), 0 0 0 4px rgba(139, 195, 74, 0.08)';
          }}
        >
          <Sparkles size={22} />
          {/* Pulse ring */}
          <div style={{
            position: 'absolute',
            inset: '-4px',
            borderRadius: '50%',
            border: '2px solid var(--primary)',
            opacity: 0.3,
            animation: 'pulse-glow 2s ease-in-out infinite',
          }} />
        </button>
      )}
    </div>
  );
};

export default AIAssistant;
