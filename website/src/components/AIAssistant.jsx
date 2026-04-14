import React, { useState } from 'react';
import { MessageSquare, Send, X, Sparkles, Leaf } from 'lucide-react';

const AIAssistant = ({ isOpen, setIsOpen }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { 
      text: "Marhba bik! 🌿 Je suis SANIA, votre assistant agricole intelligent. Comment puis-je vous aider avec votre exploitation aujourd'hui ?", 
      sender: 'ai' 
    }
  ]);

  const handleSend = () => {
    if (!message.trim()) return;
    
    const newMessages = [...messages, { text: message, sender: 'user' }];
    setMessages(newMessages);
    setMessage('');

    setTimeout(() => {
      setMessages(prev => [...prev, { 
        text: "Je traite votre demande... En tant qu'assistant SANIA, je peux analyser vos capteurs, programmer l'irrigation ou diagnostiquer vos cultures. 🌱", 
        sender: 'ai' 
      }]);
    }, 1000);
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
                  fontFamily: "'Newsreader', serif",
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
              </div>
            ))}
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
              placeholder="Posez une question..." 
              value={message}
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
              }}
            />
            <button 
              className="btn btn-primary" 
              style={{ 
                padding: '0.65rem 0.8rem', 
                borderRadius: '10px',
                minWidth: '42px',
              }} 
              onClick={handleSend}
            >
              <Send size={16} />
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
