import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Clock,
  Loader2,
  Mic,
  MicOff,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ragService } from '../services/api';
import { useTranslation } from '../i18n';
import { createSpeechUtterance, speechLanguageFor, warmSpeechVoices } from '../utils/speech';

const Chat = () => {
  const { language, t } = useTranslation();
  const welcomeMessage = useMemo(() => ({
    id: 'welcome',
    sender: 'ai',
    text: t('chat.welcome'),
  }), [t]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  const speechRecognitionAvailable = typeof window !== 'undefined'
    && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const speechSynthesisAvailable = typeof window !== 'undefined'
    && Boolean(window.speechSynthesis);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => () => {
    recognitionRef.current?.stop?.();
    window.speechSynthesis?.cancel?.();
  }, []);

  useEffect(() => {
    warmSpeechVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = warmSpeechVoices;
    }
  }, []);

  const formatError = (err) => {
    if (err?.response?.status === 401) return t('chat.sessionExpired');
    if (err?.response?.status === 503) return err.response.data?.detail || t('chat.ragUnavailable');
    if (err?.response?.data?.detail) return String(err.response.data.detail);
    if (err?.request) return t('chat.backendOffline');
    return err?.message || t('chat.unknownError');
  };

  const loadConversations = useCallback(async () => {
    try {
      const res = await ragService.listConversations();
      setConversations(res.data?.conversations || []);
    } catch (err) {
      setError(formatError(err));
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const openConversation = async (conversationId) => {
    setActiveConversationId(conversationId);
    setLoadingHistory(true);
    setError(null);
    try {
      const res = await ragService.getConversation(conversationId);
      const history = res.data?.history || [];
      setMessages([
        welcomeMessage,
        ...history.map((item, index) => ({
          id: `${conversationId}-${index}`,
          sender: item.role === 'user' ? 'user' : 'ai',
          text: item.content,
        })),
      ]);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoadingHistory(false);
    }
  };

  const newConversation = () => {
    setActiveConversationId(null);
    setMessages([welcomeMessage]);
    setError(null);
  };

  const deleteConversation = async (conversationId, event) => {
    event.stopPropagation();
    try {
      await ragService.clearConversation(conversationId);
      setConversations((items) => items.filter((item) => item.id !== conversationId));
      if (activeConversationId === conversationId) newConversation();
    } catch (err) {
      setError(formatError(err));
    }
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || loading) return;

    setMessage('');
    setLoading(true);
    setError(null);
    setMessages((items) => [...items, { id: Date.now(), sender: 'user', text }]);

    try {
      const res = await ragService.ask(text, activeConversationId);
      const data = res.data;
      setActiveConversationId(data.conversation_id);
      setMessages((items) => [
        ...items,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: data.answer,
          sources: data.sources || [],
        },
      ]);
      await loadConversations();
    } catch (err) {
      setMessages((items) => [
        ...items,
        { id: Date.now() + 1, sender: 'ai', text: `${t('chat.ragError')}: ${formatError(err)}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleListening = () => {
    setError(null);
    if (!speechRecognitionAvailable) {
      setError(t('chat.sttUnavailable'));
      return;
    }

    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = speechLanguageFor(language);
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) setMessage(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      setError(t('chat.microphoneError'));
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const speakText = async (text, id = 'latest') => {
    setError(null);
    if (!speechSynthesisAvailable) {
      setError(t('chat.ttsUnavailable'));
      return;
    }

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = await createSpeechUtterance(text, language);
    utterance.rate = 0.95;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const speakLatestAssistantMessage = () => {
    const lastAnswer = [...messages].reverse().find((item) => item.sender === 'ai' && item.text);
    if (lastAnswer) speakText(lastAnswer.text, lastAnswer.id);
  };

  return (
    <section className="chat-shell" style={{
      minHeight: '76vh',
      display: 'grid',
      gridTemplateColumns: '300px minmax(0, 1fr)',
      border: '1px solid var(--glass-border)',
      borderRadius: '18px',
      overflow: 'hidden',
      background: 'var(--panel)',
      boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
      marginTop: '2rem',
    }}>
      <aside className="chat-sidebar" style={{
        borderRight: '1px solid var(--glass-border)',
        background: 'var(--panel-muted)',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <button className="btn btn-primary" onClick={newConversation} style={{ justifyContent: 'center' }}>
          <MessageSquarePlus size={18} /> {t('chat.newConversation')}
        </button>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={13} /> {t('chat.history')} ({conversations.length})
          </span>
          <button
            onClick={loadConversations}
            title={t('common.refresh')}
            style={{ background: 'transparent', border: 0, color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <RefreshCw size={15} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {conversations.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center' }}>
              {t('chat.noConversations')}
            </p>
          )}
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => openConversation(conversation.id)}
              style={{
                '--conversation-active': activeConversationId === conversation.id ? 1 : 0,
                textAlign: 'left',
                padding: '0.8rem',
                borderRadius: '12px',
                border: activeConversationId === conversation.id
                  ? '1px solid rgba(139, 195, 74, 0.35)'
                  : '1px solid transparent',
                background: activeConversationId === conversation.id
                  ? 'rgba(139, 195, 74, 0.14)'
                  : 'var(--panel-muted)',
                color: 'var(--text-light)',
                cursor: 'pointer',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '0.5rem',
                alignItems: 'center',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conversation.title}
              </span>
              <Trash2
                size={15}
                onClick={(event) => deleteConversation(conversation.id, event)}
                style={{ color: 'var(--terracotta)' }}
              />
              <small style={{ color: 'var(--text-dim)' }}>
                {conversation.message_count} {t('chat.messages')}
              </small>
            </button>
          ))}
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          padding: '1rem 1.4rem',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.8rem',
        }}>
          <span style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            overflow: 'hidden',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--glass-border)',
            flexShrink: 0,
          }}>
            <img src="/sania-logo.png" alt="" style={{ width: 40, height: 40, objectFit: 'cover' }} />
          </span>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-bright)', fontSize: '1.2rem' }}>{t('chat.title')}</h2>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '0.8rem' }}>
              {t('chat.subtitle')}
            </p>
          </div>
        </header>

        {error && (
          <div style={{
            margin: '1rem 1.4rem 0',
            padding: '0.8rem 1rem',
            borderRadius: 12,
            color: 'var(--terracotta)',
            background: 'rgba(199, 91, 57, 0.1)',
            border: '1px solid rgba(199, 91, 57, 0.25)',
          }}>
            {error}
          </div>
        )}

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.4rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          {loadingHistory ? (
            <div style={{ margin: 'auto', color: 'var(--text-dim)', display: 'flex', gap: '0.6rem' }}>
              <Loader2 className="animate-spin" size={18} /> {t('chat.loadingConversation')}
            </div>
          ) : messages.map((item) => (
            <div
              key={item.id}
              style={{
                alignSelf: item.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '82%',
                display: 'flex',
                gap: '0.7rem',
              }}
            >
              {item.sender === 'ai' && (
                <span style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--glass-border)',
                  flexShrink: 0,
                }}>
                  <img src="/sania-logo.png" alt="" style={{ width: 30, height: 30, objectFit: 'cover' }} />
                </span>
              )}
              <div style={{
                padding: '0.95rem 1.1rem',
                borderRadius: item.sender === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                background: item.sender === 'user' ? 'rgba(139, 195, 74, 0.18)' : 'rgba(255,255,255,0.04)',
                border: item.sender === 'user'
                  ? '1px solid rgba(139, 195, 74, 0.35)'
                  : '1px solid rgba(255,255,255,0.08)',
                color: 'var(--text-light)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {item.text}
                {item.sender === 'ai' && item.id !== 'welcome' && (
                  <button
                    type="button"
                    onClick={() => speakText(item.text, item.id)}
                    title={speakingId === item.id ? t('chat.stopReading') : t('chat.readAnswer')}
                    style={{
                      marginTop: '0.7rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      background: speakingId === item.id ? 'rgba(139, 195, 74, 0.16)' : 'rgba(255,255,255,0.04)',
                      color: 'var(--text-light)',
                      padding: '0.35rem 0.55rem',
                      cursor: 'pointer',
                    }}
                  >
                    {speakingId === item.id ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    {speakingId === item.id ? t('chat.stop') : t('chat.read')}
                  </button>
                )}
                {item.sources?.length > 0 && (
                  <div style={{
                    marginTop: '0.8rem',
                    paddingTop: '0.7rem',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'grid',
                    gap: '0.55rem',
                  }}>
                    {item.sources.slice(0, 4).map((source) => (
                      <div key={`${source.source}-${source.chunk_id}-${source.row || ''}`} style={{
                        display: 'grid',
                        gap: '0.35rem',
                        padding: '0.65rem 0.75rem',
                        borderRadius: 10,
                        fontSize: '0.76rem',
                        color: 'var(--text-muted)',
                        background: 'rgba(212, 168, 67, 0.08)',
                        border: '1px solid rgba(212, 168, 67, 0.16)',
                      }}>
                        <strong style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          color: 'var(--sand-gold)',
                        }}>
                          <BookOpen size={13} />
                          {source.source}
                          {source.row ? ` · ligne ${source.row}` : ` · section ${source.chunk_id}`}
                        </strong>
                        {(source.crop || source.disease || source.treatment) && (
                          <span style={{ color: 'var(--text-light)' }}>
                            {[source.crop, source.disease, source.treatment, source.dosage]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                        {source.snippet && (
                          <span style={{ lineHeight: 1.45 }}>
                            {source.snippet.slice(0, 180)}{source.snippet.length > 180 ? '...' : ''}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Loader2 className="animate-spin" size={17} /> {t('chat.thinking')}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '1rem 1.4rem', borderTop: '1px solid var(--glass-border)' }}>
          <div className="chat-input-row" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '0.8rem' }}>
            <button
              type="button"
              onClick={toggleListening}
              disabled={loading}
              title={listening ? t('chat.stopDictation') : t('chat.dictate')}
              style={{
                alignSelf: 'end',
                width: 56,
                height: 56,
                borderRadius: 14,
                border: listening ? '1px solid rgba(139, 195, 74, 0.45)' : '1px solid var(--glass-border)',
                background: listening ? 'rgba(139, 195, 74, 0.16)' : 'var(--panel-muted)',
                color: 'var(--text-bright)',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {listening ? <MicOff size={19} /> : <Mic size={19} />}
            </button>
            <textarea
              value={message}
              disabled={loading}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={t('chat.placeholder')}
              style={{
                minHeight: 56,
                maxHeight: 140,
                resize: 'vertical',
                borderRadius: 14,
                border: '1px solid var(--glass-border)',
                background: 'var(--panel-muted)',
                color: 'var(--text-bright)',
                padding: '0.9rem 1rem',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={speakLatestAssistantMessage}
              disabled={loading || !messages.some((item) => item.sender === 'ai' && item.id !== 'welcome')}
              title={speakingId ? t('chat.stopReading') : t('chat.readLatest')}
              style={{
                alignSelf: 'end',
                width: 56,
                height: 56,
                borderRadius: 14,
                border: speakingId ? '1px solid rgba(139, 195, 74, 0.45)' : '1px solid var(--glass-border)',
                background: speakingId ? 'rgba(139, 195, 74, 0.16)' : 'var(--panel-muted)',
                color: 'var(--text-bright)',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {speakingId ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
            <button
              onClick={sendMessage}
              disabled={loading || !message.trim()}
              className="btn btn-primary"
              style={{ alignSelf: 'end', minHeight: 56, paddingInline: '1.2rem' }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Chat;
