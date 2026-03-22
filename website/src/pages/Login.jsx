import React, { useState } from 'react';
import { Leaf, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { authService } from '../services/api';

const Login = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await authService.login(email, password);
            const userRes = await authService.getMe();
            onLoginSuccess(userRes.data);
        } catch (err) {
            console.error("Login error:", err);
            if (err.response) {
                if (err.response.status === 401) {
                    setError("Email ou mot de passe incorrect.");
                } else {
                    setError(`Erreur Serveur (${err.response.status}): ${err.response.data?.detail || 'Erreur inconnue'}`);
                }
            } else if (err.request) {
                setError("Serveur inaccessible (Pas de réponse). Vérifiez que le backend tourne sur le port 8000.");
            } else {
                setError(`Erreur: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-deepest)',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Decorative background elements */}
            <div style={{
                position: 'absolute',
                width: '500px',
                height: '500px',
                background: 'radial-gradient(circle, rgba(139, 195, 74, 0.05) 0%, transparent 70%)',
                top: '-100px',
                right: '-100px',
                zIndex: 0
            }} />
            <div style={{
                position: 'absolute',
                width: '400px',
                height: '400px',
                background: 'radial-gradient(circle, rgba(199, 91, 57, 0.03) 0%, transparent 70%)',
                bottom: '-100px',
                left: '-100px',
                zIndex: 0
            }} />

            <div className="glass-card animate-scale-in" style={{
                width: '100%',
                maxWidth: '420px',
                padding: '3rem 2.5rem',
                zIndex: 1,
                borderTop: '4px solid var(--primary)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div className="floating" style={{
                        display: 'inline-flex',
                        padding: '1rem',
                        borderRadius: '16px',
                        background: 'var(--gradient-earth)',
                        boxShadow: '0 8px 32px rgba(139, 195, 74, 0.3)',
                        marginBottom: '1.5rem'
                    }}>
                        <Leaf size={32} color="#fff" />
                    </div>
                    <h1 style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: '2rem',
                        fontWeight: '800',
                        color: 'var(--text-bright)',
                        marginBottom: '0.5rem'
                    }}>
                        SANIA Smart Farm
                    </h1>
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                        Accédez à votre exploitation intelligente
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(199, 91, 57, 0.1)',
                        border: '1px solid rgba(199, 91, 57, 0.2)',
                        color: 'var(--terracotta)',
                        padding: '0.8rem 1rem',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.7rem'
                    }}>
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-light)', marginLeft: '4px' }}>
                            Email Professionnel
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                <Mail size={18} />
                            </div>
                            <input
                                type="email"
                                required
                                placeholder="fellah@sania.ai"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.9rem 1rem 0.9rem 3rem',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '14px',
                                    color: 'var(--text-bright)',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    transition: 'all 0.3s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-light)', marginLeft: '4px' }}>
                            Mot de passe
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                <Lock size={18} />
                            </div>
                            <input
                                type="password"
                                required
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.9rem 1rem 0.9rem 3rem',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '14px',
                                    color: 'var(--text-bright)',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    transition: 'all 0.3s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            justifyContent: 'center',
                            fontSize: '1rem',
                            fontWeight: '700',
                            borderRadius: '14px'
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Se connecter'}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Besoin d'aide ? <a href="#" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Contacter le support</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
