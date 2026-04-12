import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Plus, Trash2, BookOpen, Leaf, Clock, Sparkles } from 'lucide-react';
import { ragService } from '../services/api';

const Chat = () => {
  // State for all conversations
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  
  // State for active conversation typing
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sania_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConversations(parsed);
        if (parsed.length > 0) {
          setActiveConversationId(parsed[0].id);
        } else {
          createNewConversation();
        }
      } catch (e) {
        createNewConversation();
      }
    } else {
      createNewConversation();
    }
  }, []);

  // Save to localStorage whenever conversations change
  useEffect(() => {
    localStorage.setItem('sania_chat_history', JSON.stringify(conversations));
  }, [conversations]);

  // Scroll to bottom when messages in active conversation change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversations, activeConversationId, isLoading]);

  const createNewConversation = () => {
    const newId = Date.now().toString();
    const newConv = {
      id: newId,
      title: "Nouvelle discussion",
      updatedAt: new Date().toISOString(),
      messages: [
        {
          text: "Marhba bik! 🌿 Je suis SANIA, votre assistant agricole intelligent équipé pour l'analyse de vos données et le dialecte tunisien. Comment puis-je vous aider ?",
          sender: 'ai',
          id: Date.now() + 1
        }
      ]
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newId);
  };

  const deleteConversation = (id, e) => {
    e.stopPropagation();
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== id);
      if (activeConversationId === id) {
        if (updated.length > 0) setActiveConversationId(updated[0].id);
        else setActiveConversationId(null);
      }
      return updated;
    });
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const handleSend = async () => {
    if (!message.trim() || isLoading || !activeConversation) return;

    const userMessage = message.trim();
    setMessage('');
    setIsLoading(true);

    // Add user message
    const newMessage = {
      text: userMessage,
      sender: 'user',
      id: Date.now()
    };

    setConversations(prev => prev.map(c => {
      if (c.id === activeConversationId) {
        // Auto-generate title if it's the first user message
        let newTitle = c.title;
        if (c.messages.length === 1 && c.messages[0].sender === 'ai') {
          newTitle = userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '');
        }
        return {
          ...c,
          title: newTitle,
          updatedAt: new Date().toISOString(),
          messages: [...c.messages, newMessage]
        };
      }
      return c;
    }));

    // Fetch AI response
    try {
      const response = await ragService.ask(userMessage);
      const { answer, sources } = response.data;

      setConversations(prev => prev.map(c => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            updatedAt: new Date().toISOString(),
            messages: [...c.messages, {
              text: answer,
              sender: 'ai',
              sources: sources,
              id: Date.now() + 1
            }]
          };
        }
        return c;
      }));
    } catch (err) {
      console.error("RAG Error:", err);
      setConversations(prev => prev.map(c => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            messages: [...c.messages, {
              text: "Désolé, j'ai rencontré une erreur en consultant ma base de connaissances. Vérifiez la connexion au service Ollama.",
              sender: 'ai',
              id: Date.now() + 1
            }]
          };
        }
        return c;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 150px)', // Adjust based on navbar height
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--glass-border)',
      overflow: 'hidden',
      background: 'rgba(11, 15, 13, 0.4)',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      marginTop: '2rem'
    }}>
      {/* ───── SIDEBAR ───── */}
      <div style={{
        width: '300px',
        background: 'rgba(0,0,0,0.4)',
        borderRight: '1px solid var(--glass-border)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '1.5rem 1rem' }}>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
            onClick={createNewConversation}
          >
            <Plus size={18} /> Nouvelle discussion
          </button>
        </div>
        
        <div style={{ padding: '0 1rem', paddingBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Clock size={12} /> Historique
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {conversations.map(conv => (
            <div 
              key={conv.id}
              onClick={() => setActiveConversationId(conv.id)}
              style={{
                padding: '0.8rem 1rem',
                borderRadius: '10px',
                background: activeConversationId === conv.id ? 'rgba(139, 195, 74, 0.15)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${activeConversationId === conv.id ? 'rgba(139, 195, 74, 0.3)' : 'transparent'}`,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => { if (activeConversationId !== conv.id) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { if (activeConversationId !== conv.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
            >
              <div style={{ overflow: 'hidden' }}>
                <div style={{ 
                  color: activeConversationId === conv.id ? 'var(--text-bright)' : 'var(--text-light)', 
                  fontSize: '0.85rem', 
                  fontWeight: activeConversationId === conv.id ? '600' : '400',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {conv.title}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                  {new Date(conv.updatedAt).toLocaleDateString('fr-TN', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <button 
                onClick={(e) => deleteConversation(conv.id, e)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', 
                  padding: '5px', borderRadius: '5px', display: 'flex'
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--terracotta)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ───── MAIN CHAT AREA ───── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Header */}
        <div style={{
          padding: '1.2rem 2rem',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          background: 'linear-gradient(135deg, rgba(8, 11, 9, 0.8), rgba(0,0,0,0))'
        }}>
          <div style={{ padding: '0.6rem', borderRadius: '12px', background: 'var(--gradient-earth)', display: 'flex' }}>
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontFamily: "'Playfair Display', serif", fontWeight: '700', color: 'var(--text-bright)' }}>
              SANIA Chat
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div className="status-dot online" style={{ width: '6px', height: '6px', background: 'var(--primary)' }}></div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Modèle RAG Tunisien Actif</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {activeConversation ? (
            activeConversation.messages.map((m) => (
              <div key={m.id} style={{ display: 'flex', gap: '1rem', alignSelf: m.sender === 'ai' ? 'flex-start' : 'flex-end', maxWidth: '80%' }}>
                {m.sender === 'ai' && (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gradient-earth)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.2rem' }}>
                    <Leaf size={14} color="#fff" />
                  </div>
                )}
                
                <div style={{
                  background: m.sender === 'ai' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(139, 195, 74, 0.15)',
                  padding: '1rem 1.25rem',
                  borderRadius: m.sender === 'ai' ? '4px 16px 16px 16px' : '16px 16px 4px 16px',
                  border: m.sender === 'ai' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(139, 195, 74, 0.3)',
                  color: m.sender === 'ai' ? 'var(--text-light)' : '#fff',
                  fontSize: '0.95rem',
                  lineHeight: '1.6',
                  boxShadow: m.sender === 'user' ? '0 8px 24px rgba(139, 195, 74, 0.1)' : '0 8px 24px rgba(0,0,0,0.2)'
                }}>
                  {/* Split by newline and render paragraphs or line breaks */}
                  {m.text.split('\n').map((line, idx) => (
                    <React.Fragment key={idx}>
                      {line}
                      {idx !== m.text.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}

                  {m.sender === 'ai' && m.sources && m.sources.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                        <BookOpen size={12} color="var(--sand-gold)" /> Sources de la base de connaissances
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {m.sources.slice(0, 4).map((s, si) => (
                          <div key={si} style={{
                            fontSize: '0.7rem',
                            background: 'rgba(212, 168, 67, 0.1)',
                            color: 'var(--sand-gold)',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(212, 168, 67, 0.2)',
                          }}>
                            {s.filename}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{ margin: 'auto', color: 'var(--text-dim)', textAlign: 'center' }}>
              <MessageSquare size={48} opacity={0.3} style={{ marginBottom: '1rem' }} />
              <p>Sélectionnez ou créez une discussion</p>
            </div>
          )}

          {isLoading && (
            <div style={{ display: 'flex', gap: '1rem', maxWidth: '80%' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gradient-earth)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.2rem' }}>
                <Leaf size={14} color="#fff" />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem 1.25rem', borderRadius: '4px 16px 16px 16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div className="shimmer" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                <div className="shimmer" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', animationDelay: '0.2s' }}></div>
                <div className="shimmer" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid var(--glass-border)' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
            <textarea
              placeholder={isLoading ? "Génération en cours..." : "Posez une question sur vos cultures, l'irrigation, ou les maladies (en français ou en darija)..."}
              value={message}
              disabled={isLoading || !activeConversation}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                padding: '1rem 4rem 1rem 1.5rem',
                color: 'var(--text-bright)',
                fontSize: '0.95rem',
                lineHeight: '1.5',
                resize: 'none',
                minHeight: '60px',
                maxHeight: '150px',
                outline: 'none',
                transition: 'border-color 0.3s, box-shadow 0.3s',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)'
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(139, 195, 74, 0.2)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--glass-border)'; e.target.style.boxShadow = 'none'; }}
            />
            <button
              disabled={isLoading || !message.trim() || !activeConversation}
              onClick={handleSend}
              style={{
                position: 'absolute',
                right: '1rem',
                bottom: '1rem',
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: (isLoading || !message.trim()) ? 'rgba(255,255,255,0.1)' : 'var(--gradient-earth)',
                border: 'none',
                color: (isLoading || !message.trim()) ? 'rgba(255,255,255,0.3)' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: (isLoading || !message.trim() || !activeConversation) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: (isLoading || !message.trim()) ? 'none' : '0 4px 15px rgba(139, 195, 74, 0.3)'
              }}
            >
              <Send size={18} style={{ marginLeft: '2px' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
