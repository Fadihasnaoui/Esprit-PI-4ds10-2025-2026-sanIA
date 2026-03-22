import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Sparkles, Leaf, Paperclip, Loader2, Trash2, Eye, FileText, Image as ImageIcon } from 'lucide-react';
import { aiService } from '../services/api';

const AIAssistant = ({ isOpen, setIsOpen }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contextInfo, setContextInfo] = useState({ documents: [], images_indexed: 0 });
  const [messages, setMessages] = useState([
    { 
      text: "Marhba bik! 🌿 Je suis SANIA Pro, votre expert Agri-IA. Je peux lire vos PDF, analyser vos photos de récoltes et répondre à vos questions complexes. Comment puis-je vous aider ?", 
      sender: 'ai' 
    }
  ]);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      fetchContext();
    }
  }, [isOpen]);

  const fetchContext = async () => {
    try {
      const res = await aiService.getContext();
      setContextInfo(res.data);
    } catch (err) {
      console.error("Failed to fetch context", err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      await aiService.uploadDoc(file);
      await fetchContext();
      setMessages(prev => [...prev, { 
        text: `Fichier "${file.name}" indexé avec succès dans ma base de connaissances ! 📚`, 
        sender: 'ai' 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        text: `Erreur lors de l'upload: ${err.response?.data?.detail || err.message}`, 
        sender: 'ai' 
      }]);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || isTyping) return;
    
    const userMessage = { text: message, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);

    // Prepare history for backend
    const history = messages.map(m => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.text
    }));

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('message', message);
      formData.append('history', JSON.stringify(history));

      const response = await fetch(aiService.getChatUrl(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Erreur serveur (${response.status})`);
      }

      // Handle streaming
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponseText = "";
      
      // Add a placeholder message for the AI response
      setMessages(prev => [...prev, { text: "", sender: 'ai', isStreaming: true }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        aiResponseText += chunk;
        
        // Update the last message (the AI's streaming response)
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text = aiResponseText;
          return newMessages;
        });
      }
      
      // Mark streaming as finished
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].isStreaming = false;
        return newMessages;
      });

    } catch (err) {
      setMessages(prev => [...prev, { 
        text: `Oups! Une erreur est survenue: ${err.message}`, 
        sender: 'ai' 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearKB = async () => {
    if (window.confirm("Voulez-vous vraiment vider votre base de connaissances IA ?")) {
      try {
        await aiService.clearContext();
        setContextInfo({ documents: [], images_indexed: 0 });
        setMessages(prev => [...prev, { text: "Base de connaissances vidée. Je suis prêt pour de nouveaux documents !", sender: 'ai' }]);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000 }}>
      {isOpen ? (
        <div 
          className="animate-scale-in"
          style={{ 
            width: '420px', 
            height: '600px', 
            display: 'flex', 
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(139, 195, 74, 0.1)',
            borderRadius: '24px',
            border: '1px solid var(--glass-border)',
            overflow: 'hidden',
            background: 'rgba(11, 15, 13, 0.98)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
          }}
        >
          {/* Header */}
          <div style={{ 
            padding: '1.2rem 1.5rem', 
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(139, 195, 74, 0.12), rgba(107, 142, 35, 0.08))',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <div style={{
                padding: '0.5rem',
                borderRadius: '12px',
                background: 'var(--gradient-earth)',
                display: 'flex',
                boxShadow: '0 4px 12px rgba(139, 195, 74, 0.3)',
              }}>
                <Sparkles size={18} color="#fff" />
              </div>
              <div>
                <h3 style={{ 
                  fontSize: '1rem', 
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: '700',
                  color: 'var(--text-bright)',
                  letterSpacing: '0.5px'
                }}>
                  SANIA Expert
                  <span style={{ 
                    fontSize: '0.6rem', 
                    marginLeft: '8px', 
                    padding: '2px 6px', 
                    background: 'var(--primary)', 
                    borderRadius: '4px',
                    color: '#fff',
                    verticalAlign: 'middle'
                  }}>PRO</span>
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <div className="status-dot online" style={{ width: '6px', height: '6px' }}></div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', opacity: 0.8 }}>SYSTEME RAG ACTIF</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={clearKB}
                  title="Vider la mémoire"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '0.45rem',
                    cursor: 'pointer',
                    color: 'var(--text-dim)',
                    display: 'flex',
                  }}
                >
                  <Trash2 size={15} />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '0.45rem',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                  }}
                >
                  <X size={16} />
                </button>
            </div>
          </div>

          {/* Context Banner */}
          {(contextInfo.documents.length > 0 || contextInfo.images_indexed > 0) && (
            <div style={{ 
                padding: '0.6rem 1.2rem', 
                background: 'rgba(255,255,255,0.03)', 
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '0.7rem',
                color: 'var(--primary)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={12} />
                    <span>{contextInfo.documents.length} Docs</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ImageIcon size={12} />
                    <span>{contextInfo.images_indexed} Images</span>
                </div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>• Mémoire active</span>
            </div>
          )}
          
          {/* Messages */}
          <div style={{ 
            flex: 1, 
            padding: '1.5rem', 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.2rem',
            background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.2))'
          }}>
            {messages.map((m, i) => (
              <div 
                key={i} 
                style={{ 
                  alignSelf: m.sender === 'ai' ? 'flex-start' : 'flex-end', 
                  maxWidth: '88%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ 
                    background: m.sender === 'ai' 
                        ? 'rgba(255, 255, 255, 0.04)' 
                        : 'var(--gradient-earth)', 
                    padding: '0.85rem 1.1rem', 
                    borderRadius: m.sender === 'ai' 
                        ? '4px 18px 18px 18px' 
                        : '18px 18px 4px 18px',
                    fontSize: '0.9rem',
                    color: m.sender === 'ai' ? 'var(--text-light)' : '#fff',
                    lineHeight: '1.6',
                    border: m.sender === 'ai' ? '1px solid var(--glass-border)' : 'none',
                    boxShadow: m.sender === 'user' ? '0 6px 16px rgba(139, 195, 74, 0.2)' : 'none',
                    whiteSpace: 'pre-wrap'
                }}>
                  {m.text}
                  {m.isStreaming && <span className="streaming-cursor">|</span>}
                </div>
                {m.sender === 'ai' && i === messages.length - 1 && isTyping && !m.text && (
                   <div style={{ display: 'flex', gap: '4px', padding: '10px' }}>
                        <div className="dot-pulse"></div>
                   </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ 
            padding: '1.2rem', 
            borderTop: '1px solid var(--glass-border)', 
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    accept=".pdf,image/*"
                />
                <button 
                    onClick={() => fileInputRef.current.click()}
                    disabled={uploading}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '12px',
                        width: '42px',
                        height: '42px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: uploading ? 'var(--primary)' : 'var(--text-muted)',
                        transition: 'all 0.3s'
                    }}
                >
                    {uploading ? <Loader2 className="animate-spin" size={18} /> : <Paperclip size={18} />}
                </button>
                
                <div style={{ position: 'relative', flex: 1 }}>
                    <input 
                      type="text" 
                      placeholder={uploading ? "Indexation en cours..." : "Posez une question technique..."}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      disabled={isTyping || uploading}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '14px',
                        padding: '0.8rem 1.2rem',
                        color: 'var(--text-light)',
                        width: '100%',
                        outline: 'none',
                        fontSize: '0.9rem',
                        transition: 'all 0.3s',
                      }}
                    />
                </div>

                <button 
                  className="btn btn-primary" 
                  disabled={!message.trim() || isTyping || uploading}
                  style={{ 
                    width: '42px',
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '12px',
                    padding: 0,
                    opacity: (!message.trim() || isTyping || uploading) ? 0.5 : 1
                  }} 
                  onClick={handleSend}
                >
                  {isTyping ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                </button>
            </div>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textAlign: 'center', opacity: 0.6 }}>
                L'IA peut faire des erreurs. Vérifiez les informations médicales importantes.
            </p>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '20px',
            border: 'none',
            cursor: 'pointer',
            background: 'var(--gradient-earth)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 40px rgba(139, 195, 74, 0.4), 0 0 0 5px rgba(139, 195, 74, 0.1)',
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            position: 'relative',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.08) translateY(-5px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
          }}
        >
          <Sparkles size={26} />
          <div style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            width: '12px',
            height: '12px',
            background: 'var(--primary)',
            borderRadius: '50%',
            border: '2px solid #000',
            animation: 'pulse-glow 1.5s infinite'
          }} />
        </button>
      )}
      
      <style>{`
        @keyframes pulse-glow {
          0% { box-shadow: 0 0 0 0 rgba(139, 195, 74, 0.7); opacity: 0.8; }
          70% { box-shadow: 0 0 0 10px rgba(139, 195, 74, 0); opacity: 1; }
          100% { box-shadow: 0 0 0 0 rgba(139, 195, 74, 0); opacity: 0.8; }
        }
        .streaming-cursor {
            display: inline-block;
            width: 2px;
            height: 15px;
            background: var(--primary);
            margin-left: 2px;
            animation: blink 1s infinite;
        }
        @keyframes blink {
            50% { opacity: 0; }
        }
        .dot-pulse {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: var(--primary);
            box-shadow: 0 0 10px var(--primary);
            animation: dotPulse 1.5s infinite ease-in-out;
        }
        @keyframes dotPulse {
            0%, 100% { transform: scale(0.5); opacity: 0.5; }
            50% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AIAssistant;
