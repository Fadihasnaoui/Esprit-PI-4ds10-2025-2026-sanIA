import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Send, Paperclip, Loader2, Trash2, 
  FileText, Image as ImageIcon, BookOpen, 
  History, Info, ChevronRight, Download,
  CheckCircle2, AlertTriangle, Lightbulb
} from 'lucide-react';
import { aiService } from '../services/api';

const AIChatPage = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { 
      text: "Bienvenue dans l'espace SANIA Pro. 🌾 Je suis votre expert dédié en intelligence artificielle agricole.\n\nVous pouvez:\n• Télécharger des guides vétérinaires (PDF)\n• Envoyer des photos de vos animaux pour diagnostic\n• Demander des conseils de gestion d'exploitation\n\nMa base de connaissances est prête. Que souhaitez-vous analyser ?", 
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [context, setContext] = useState({ documents: [], images_indexed: 0 });
  const [activeTab, setActiveTab] = useState('chat');

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await aiService.getContext();
        setContext(res.data);
      } catch (err) {}
    };
    fetchContext();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      await aiService.uploadDoc(file);
      const res = await aiService.getContext();
      setContext(res.data);
      setMessages(prev => [...prev, { 
        text: `Fichier **${file.name}** intégré avec succès. Je peux maintenant répondre à vos questions en me basant sur ce document.`, 
        sender: 'ai',
        timestamp: new Date()
      }]);
    } catch (err) {
      alert("Erreur upload: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || isTyping) return;
    
    const userMsg = { text: message, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setMessage('');
    setIsTyping(true);

    const history = messages.slice(-10).map(m => ({
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
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Erreur serveur (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      
      setMessages(prev => [...prev, { text: "", sender: 'ai', timestamp: new Date(), isStreaming: true }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value, { stream: true });
        
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].text = aiText;
          return newMsgs;
        });
      }
      
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1].isStreaming = false;
        return newMsgs;
      });

    } catch (err) {
      setMessages(prev => [...prev, { text: "Erreur: " + err.message, sender: 'ai', timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ 
      display: 'grid', 
      gridTemplateColumns: '300px 1fr', 
      height: 'calc(100vh - 120px)',
      gap: '1.5rem',
      paddingBottom: '2rem'
    }}>
      {/* Sidebar Knowledge Pane */}
      <aside style={{
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '24px',
        border: '1px solid var(--glass-border)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        <div>
          <h2 style={{ 
            fontSize: '1.1rem', 
            fontFamily: "'Playfair Display', serif", 
            fontWeight: '700',
            color: 'var(--text-bright)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <BookOpen size={20} className="text-primary" />
            Connaissances RAG
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>
            Documents et images chargés dans la mémoire active de l'IA.
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {context.documents.map((doc, i) => (
            <div key={i} style={{
              padding: '0.75rem',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <FileText size={16} className="text-primary" />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc}
              </span>
            </div>
          ))}
          {context.images_indexed > 0 && (
            <div style={{
              padding: '0.75rem',
              background: 'rgba(139, 195, 74, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(139, 195, 74, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <ImageIcon size={16} className="text-primary" />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                {context.images_indexed} Images Analysées
              </span>
            </div>
          )}
          
          {context.documents.length === 0 && context.images_indexed === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', opacity: 0.5 }}>
              <div style={{ marginBottom: '1rem' }}><Info size={32} style={{ margin: '0 auto' }} /></div>
              <p style={{ fontSize: '0.8rem' }}>Aucun document chargé.</p>
            </div>
          )}
        </div>

        <button 
          onClick={async () => {
            if (window.confirm("Vider la mémoire ?")) {
                await aiService.clearContext();
                setContext({ documents: [], images_indexed: 0 });
            }
          }}
          disabled={context.documents.length === 0 && context.images_indexed === 0}
          style={{
            padding: '0.8rem',
            borderRadius: '12px',
            border: '1px solid rgba(255, 100, 100, 0.2)',
            background: 'rgba(255, 100, 100, 0.05)',
            color: '#ff6b6b',
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Trash2 size={14} /> Vider la mémoire
        </button>
      </aside>

      {/* Main Chat Interface */}
      <main style={{
        background: 'rgba(11, 15, 13, 0.6)',
        borderRadius: '24px',
        border: '1px solid var(--glass-border)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '1.2rem 2rem',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: 'var(--gradient-earth)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(139, 195, 74, 0.3)'
            }}>
              <Sparkles color="#fff" size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.2rem', fontFamily: "'Playfair Display', serif", fontWeight: '700', color: 'var(--text-bright)' }}>
                SANIA Intelligence Pro
              </h1>
              <span style={{ fontSize: '0.7rem', color: 'var(--primary)', letterSpacing: '1px' }}>VERSION 2.0 EXPERT</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
             <div style={{ 
                padding: '0.5rem 1rem', 
                borderRadius: '20px', 
                background: 'rgba(139, 195, 74, 0.1)', 
                border: '1px solid rgba(139, 195, 74, 0.2)',
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                fontSize: '0.75rem',
                color: 'var(--primary)'
             }}>
                <CheckCircle2 size={14} />
                Connecté au Cloud Agri-IA
             </div>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div style={{
          flex: 1,
          padding: '2rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: '1rem',
              alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              flexDirection: 'column',
              alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                padding: '1.2rem 1.5rem',
                borderRadius: m.sender === 'user' ? '24px 24px 4px 24px' : '4px 24px 24px 24px',
                background: m.sender === 'user' ? 'var(--gradient-earth)' : 'rgba(255,255,255,0.03)',
                border: m.sender === 'ai' ? '1px solid var(--glass-border)' : 'none',
                color: m.sender === 'user' ? '#fff' : 'var(--text-light)',
                fontSize: '1rem',
                lineHeight: '1.6',
                boxShadow: m.sender === 'user' ? '0 10px 25px rgba(139, 195, 74, 0.2)' : 'none',
                whiteSpace: 'pre-wrap',
                position: 'relative'
              }}>
                {m.text}
                {m.isStreaming && <span className="streaming-cursor">|</span>}
              </div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', opacity: 0.6 }}>
                {m.sender === 'user' ? 'Vous' : 'SANIA IA'} • {m.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '1.5rem 2rem',
          background: 'rgba(0,0,0,0.3)',
          borderTop: '1px solid var(--glass-border)',
        }}>
          <div style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.04)',
            padding: '8px',
            borderRadius: '20px',
            border: '1px solid var(--glass-border)',
            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)'
          }}>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              style={{ display: 'none' }} 
              accept=".pdf,image/*" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '15px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--primary)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(139, 195, 74, 0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <Paperclip size={20} />}
            </button>

            <textarea 
              placeholder={uploading ? "Indexation des données..." : "Décrivez votre problème ou posez une question sur vos documents..."}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows="1"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-light)',
                padding: '12px',
                fontSize: '1rem',
                outline: 'none',
                resize: 'none',
                maxHeight: '150px'
              }}
            />

            <button 
              onClick={handleSend}
              disabled={!message.trim() || isTyping || uploading}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '15px',
                background: 'var(--gradient-earth)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#fff',
                opacity: (!message.trim() || isTyping || uploading) ? 0.5 : 1,
                transition: 'all 0.3s'
              }}
            >
              {isTyping ? <Loader2 className="animate-spin" /> : <Send size={20} />}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                <Lightbulb size={12} className="text-primary" />
                <span>Astuce: Glissez un PDF pour donner du contexte à l'IA</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                <AlertTriangle size={12} style={{ color: '#ea4335' }} />
                <span>Analyse multimodal 1.5 Pro</span>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .streaming-cursor {
          display: inline-block;
          width: 2px;
          height: 1.1em;
          background: var(--primary);
          margin-left: 2px;
          animation: blink 1s infinite;
          vertical-align: middle;
        }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};

export default AIChatPage;
