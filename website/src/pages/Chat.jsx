import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, Plus, Trash2, BookOpen, Leaf, Clock, Sparkles, Mic, Square, Volume2, RefreshCw } from 'lucide-react';
import { ragService } from '../services/api';

const WELCOME_MSG = {
    text: "Marhba bik! 🌿 Je suis SANIA, votre assistant agricole intelligent équipé pour l'analyse de vos données et le dialecte tunisien. Comment puis-je vous aider ?",
    sender: 'ai',
    id: 'welcome',
};

const Chat = () => {
    // ── Sidebar list of conversations (from backend) ──────────────────────────
    const [convList, setConvList] = useState([]);          // [{id, title, updated_at, message_count}]
    const [activeConvId, setActiveConvId] = useState(null);

    // ── Messages of the currently open conversation ───────────────────────────
    const [messages, setMessages] = useState([WELCOME_MSG]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // ── Input / UX state ──────────────────────────────────────────────────────
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [loadingConvList, setLoadingConvList] = useState(false);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const speechSynthRef = useRef(window.speechSynthesis);

    // ── Scroll to bottom ──────────────────────────────────────────────────────
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    // ── Load conversation list from backend on mount ───────────────────────────
    const fetchConvList = useCallback(async () => {
        setLoadingConvList(true);
        try {
            const res = await ragService.listConversations();
            const list = res?.data?.conversations ?? [];
            setConvList(list);
            // Auto-select first conversation if none active
            if (list.length > 0 && !activeConvId) {
                selectConversation(list[0].id);
            } else if (list.length === 0) {
                // No conversations yet — show welcome message
                setActiveConvId(null);
                setMessages([WELCOME_MSG]);
            }
        } catch (e) {
            console.warn('Could not load conversations:', e);
        } finally {
            setLoadingConvList(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchConvList();
    }, [fetchConvList]);

    // ── Load messages for a conversation ─────────────────────────────────────
    const selectConversation = async (convId) => {
        setActiveConvId(convId);
        setLoadingMessages(true);
        setMessages([]);
        try {
            const res = await ragService.getConversation(convId);
            const history = res?.data?.history ?? [];
            if (history.length === 0) {
                setMessages([WELCOME_MSG]);
            } else {
                const converted = history.map((m, i) => ({
                    id: i,
                    sender: m.role === 'user' ? 'user' : 'ai',
                    text: m.content,
                }));
                setMessages([WELCOME_MSG, ...converted]);
            }
        } catch (e) {
            console.warn('Could not load messages:', e);
            setMessages([WELCOME_MSG]);
        } finally {
            setLoadingMessages(false);
        }
    };

    // ── Create new conversation ───────────────────────────────────────────────
    const createNewConversation = () => {
        setActiveConvId(null);
        setMessages([WELCOME_MSG]);
    };

    // ── Delete conversation ───────────────────────────────────────────────────
    const deleteConversation = async (id, e) => {
        e.stopPropagation();
        try {
            await ragService.clearConversation(id);
        } catch (_) {}
        setConvList(prev => prev.filter(c => c.id !== id));
        if (activeConvId === id) {
            createNewConversation();
        }
    };

    // ── Error formatter ───────────────────────────────────────────────────────
    const formatRagError = (err) => {
        if (err?.code === 'ECONNABORTED') return 'Délai dépassé : le RAG a pris trop de temps. Réessayez.';
        if (err?.response?.data?.detail != null) {
            const d = err.response.data.detail;
            if (typeof d === 'string') return `Erreur RAG: ${d}`;
            if (Array.isArray(d)) return `Erreur RAG: ${d.map(x => x.msg || JSON.stringify(x)).join('; ')}`;
            return `Erreur RAG: ${JSON.stringify(d)}`;
        }
        if (err?.response?.status) return `Erreur RAG: HTTP ${err.response.status}`;
        if (err?.message) return `Erreur RAG: ${err.message}`;
        return "Impossible de joindre l'API (vérifiez que le backend tourne sur le port 8000).";
    };

    // ── Send message ──────────────────────────────────────────────────────────
    const handleSend = async () => {
        if (!message.trim() || isLoading) return;

        const userText = message.trim();
        setMessage('');
        setIsLoading(true);

        const userMsg = { id: Date.now(), sender: 'user', text: userText };
        setMessages(prev => [...prev, userMsg]);

        try {
            const response = await ragService.ask(userText, activeConvId);
            const data = response?.data;
            if (!data || typeof data.answer !== 'string') {
                throw new Error(`Réponse invalide: ${JSON.stringify(data)?.slice(0, 300)}`);
            }
            const { answer, sources, conversation_id: convId } = data;

            // If a new conversation was created server-side, update active id and refresh list
            if (convId && convId !== activeConvId) {
                setActiveConvId(convId);
                // Add to sidebar immediately (will be properly sorted on next fetch)
                setConvList(prev => [
                    {
                        id: convId,
                        title: userText.slice(0, 40) + (userText.length > 40 ? '...' : ''),
                        updated_at: new Date().toISOString(),
                        message_count: 2,
                    },
                    ...prev.filter(c => c.id !== convId),
                ]);
            } else if (activeConvId) {
                // Update the title/timestamp of existing conversation in sidebar
                setConvList(prev => prev.map(c =>
                    c.id === activeConvId
                        ? { ...c, updated_at: new Date().toISOString(), message_count: c.message_count + 2 }
                        : c
                ));
            }

            if (ttsEnabled && speechSynthRef.current) {
                speechSynthRef.current.cancel();
                const utterance = new SpeechSynthesisUtterance(answer);
                utterance.lang = /[\u0600-\u06FF]/.test(answer) ? 'ar-TN' : 'fr-FR';
                utterance.rate = 1;
                speechSynthRef.current.speak(utterance);
            }

            const aiMsg = {
                id: Date.now() + 1,
                sender: 'ai',
                text: answer,
                sources: sources ?? [],
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            console.error('RAG Error:', err);
            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: formatRagError(err) }]);
        } finally {
            setIsLoading(false);
        }
    };

    // ── Voice input ───────────────────────────────────────────────────────────
    const toggleListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('STT non supporté. Utilisez Chrome ou Edge.'); return; }
        if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); return; }
        const recognition = new SpeechRecognition();
        recognition.lang = 'fr-FR';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognition.onresult = (event) => {
            const transcript = event.results?.[0]?.[0]?.transcript || '';
            if (transcript.trim()) setMessage(prev => prev ? `${prev} ${transcript}` : transcript);
        };
        recognitionRef.current = recognition;
        recognition.start();
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={{
            display: 'flex',
            height: '100vh',
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
                {/* New conversation button */}
                <div style={{ padding: '1.5rem 1rem', display: 'flex', gap: '0.5rem' }}>
                    <button
                        className="btn btn-primary"
                        style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                        onClick={createNewConversation}
                    >
                        <Plus size={18} /> Nouvelle discussion
                    </button>
                    <button
                        onClick={fetchConvList}
                        disabled={loadingConvList}
                        title="Actualiser"
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-dim)',
                            borderRadius: '10px',
                            padding: '0 0.6rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        <RefreshCw size={15} style={{ animation: loadingConvList ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                </div>

                <div style={{ padding: '0 1rem', paddingBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={12} /> Historique ({convList.length})
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {loadingConvList && convList.length === 0 && (
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>
                            Chargement...
                        </div>
                    )}
                    {!loadingConvList && convList.length === 0 && (
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>
                            Aucune discussion précédente
                        </div>
                    )}
                    {convList.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => selectConversation(conv.id)}
                            style={{
                                padding: '0.8rem 1rem',
                                borderRadius: '10px',
                                background: activeConvId === conv.id ? 'rgba(139, 195, 74, 0.15)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${activeConvId === conv.id ? 'rgba(139, 195, 74, 0.3)' : 'transparent'}`,
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                            onMouseLeave={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                        >
                            <div style={{ overflow: 'hidden' }}>
                                <div style={{
                                    color: activeConvId === conv.id ? 'var(--text-bright)' : 'var(--text-light)',
                                    fontSize: '0.85rem',
                                    fontWeight: activeConvId === conv.id ? '600' : '400',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {conv.title}
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                                    {new Date(conv.updated_at).toLocaleDateString('fr-TN', { day: 'numeric', month: 'short' })}
                                    {' · '}{conv.message_count} msg
                                </div>
                            </div>
                            <button
                                onClick={(e) => deleteConversation(conv.id, e)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '5px', borderRadius: '5px', display: 'flex' }}
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
                    {loadingMessages ? (
                        <div style={{ margin: 'auto', color: 'var(--text-dim)', textAlign: 'center' }}>
                            <RefreshCw size={32} opacity={0.4} style={{ marginBottom: '0.5rem', animation: 'spin 1s linear infinite' }} />
                            <p>Chargement de la discussion...</p>
                        </div>
                    ) : (
                        messages.map((m) => (
                            <div key={m.id} style={{ display: 'flex', gap: '1rem', alignSelf: m.sender === 'ai' ? 'flex-start' : 'flex-end', maxWidth: '90%' }}>
                                {m.sender === 'ai' && (
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gradient-earth)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.2rem' }}>
                                        <Leaf size={14} color="#fff" />
                                    </div>
                                )}

                                <div 
                                    dir="auto"
                                    style={{
                                    background: m.sender === 'ai' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(139, 195, 74, 0.15)',
                                    padding: '1rem 1.25rem',
                                    borderRadius: m.sender === 'ai' ? '4px 16px 16px 16px' : '16px 16px 4px 16px',
                                    border: m.sender === 'ai' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(139, 195, 74, 0.3)',
                                    color: m.sender === 'ai' ? 'var(--text-light)' : '#fff',
                                    fontSize: '0.95rem',
                                    lineHeight: '1.6',
                                    boxShadow: m.sender === 'user' ? '0 8px 24px rgba(139, 195, 74, 0.1)' : '0 8px 24px rgba(0,0,0,0.2)'
                                }}>
                                    {m.text.split('\n').map((line, idx, arr) => (
                                        <React.Fragment key={idx}>
                                            {line}
                                            {idx !== arr.length - 1 && <br />}
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
                    )}

                    {isLoading && (
                        <div style={{ display: 'flex', gap: '1rem', maxWidth: '90%' }}>
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

                    {!loadingMessages && messages.length === 0 && (
                        <div style={{ margin: 'auto', color: 'var(--text-dim)', textAlign: 'center' }}>
                            <MessageSquare size={48} opacity={0.3} style={{ marginBottom: '1rem' }} />
                            <p>Sélectionnez ou créez une discussion</p>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid var(--glass-border)' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem', gap: '0.5rem' }}>
                            <button
                                onClick={() => setTtsEnabled(v => !v)}
                                style={{
                                    border: '1px solid var(--glass-border)',
                                    background: ttsEnabled ? 'rgba(139, 195, 74, 0.15)' : 'rgba(255,255,255,0.05)',
                                    color: ttsEnabled ? 'var(--primary)' : 'var(--text-dim)',
                                    borderRadius: '10px',
                                    padding: '0.35rem 0.6rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    cursor: 'pointer'
                                }}
                                title="Activer / Désactiver lecture vocale"
                            >
                                <Volume2 size={14} /> TTS
                            </button>
                        </div>
                        <textarea
                            placeholder={isLoading ? "Génération en cours..." : "Posez une question sur vos cultures, l'irrigation, ou les maladies (en français ou en darija)..."}
                            value={message}
                            disabled={isLoading || loadingMessages}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
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
                            disabled={isLoading || !message.trim()}
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
                                cursor: (isLoading || !message.trim()) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: (isLoading || !message.trim()) ? 'none' : '0 4px 15px rgba(139, 195, 74, 0.3)'
                            }}
                        >
                            <Send size={18} style={{ marginLeft: '2px' }} />
                        </button>
                        <button
                            disabled={isLoading}
                            onClick={toggleListening}
                            style={{
                                position: 'absolute',
                                right: '3.9rem',
                                bottom: '1rem',
                                width: '38px',
                                height: '38px',
                                borderRadius: '12px',
                                background: isListening ? 'rgba(227, 104, 81, 0.2)' : 'rgba(255,255,255,0.08)',
                                border: `1px solid ${isListening ? 'rgba(227, 104, 81, 0.5)' : 'var(--glass-border)'}`,
                                color: isListening ? 'var(--terracotta)' : 'var(--text-light)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                            }}
                            title={isListening ? "Arrêter l'écoute micro" : "Démarrer dictée vocale"}
                        >
                            {isListening ? <Square size={16} /> : <Mic size={16} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;