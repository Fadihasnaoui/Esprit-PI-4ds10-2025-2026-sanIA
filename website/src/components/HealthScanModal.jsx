import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Activity, Shield, Zap, Droplets, Apple, Heart, Brain, AlertTriangle, CheckCircle, Camera } from 'lucide-react';
import { livestockService } from '../services/api';

const URGENCY_COLORS = { haute: '#ef4444', moyenne: '#fbbf24', basse: '#4ade80' };

const HealthScanModal = ({ isOpen, onClose, animal, onStatusUpdated }) => {
    const [status, setStatus] = useState('idle'); // idle | scanning | success | error
    const [previewUrl, setPreviewUrl] = useState(null);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [scanProgress, setScanProgress] = useState(0);
    const [animatedScores, setAnimatedScores] = useState(null);
    const [selectedSpecies, setSelectedSpecies] = useState(animal?.species || 'Bovin');
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (animal?.species) setSelectedSpecies(animal.species);
    }, [animal]);

    // Animate progress
    useEffect(() => {
        let interval;
        if (status === 'scanning') {
            setScanProgress(0);
            interval = setInterval(() => {
                setScanProgress(prev => (prev < 92 ? prev + 1.5 : prev));
            }, 40);
        } else if (status === 'success') {
            setScanProgress(100);
        } else {
            setScanProgress(0);
        }
        return () => clearInterval(interval);
    }, [status]);

    // Animate scores
    useEffect(() => {
        if (status === 'success' && results?.bcs_scores) {
            setAnimatedScores({ overall: 0, coat_quality: 0, hydration: 0, nutrition: 0, stress_resistance: 0 });
            const timer = setTimeout(() => {
                setAnimatedScores(results.bcs_scores);
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [status, results]);

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setPreviewUrl(URL.createObjectURL(file));
        setResults(null);
        setError(null);
        setStatus('scanning');

        try {
            const res = await livestockService.performHealthScan(file, selectedSpecies, animal?.id);
            const data = res.data;
            
            if (data.status === 'error') {
                setResults(data);
                setError(data.error || "L'IA a rencontré un problème.");
                setStatus('error');
            } else {
                setResults(data);
                setStatus('success');
                // Propagate the new medical status to the dashboard so the
                // animal card reflects the diagnostic (Sain / Critique /
                // Déshydraté / Sous-alimenté / Stressé) immediately.
                if (data.animal && typeof onStatusUpdated === 'function') {
                    onStatusUpdated(data.animal);
                }
            }
        } catch (err) {
            let msg = "Erreur lors de l'analyse.";
            if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
                msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
            } else {
                msg = err.message || msg;
            }
            setError(msg);
            setStatus('error');
        }
        e.target.value = '';
    };

    const handleReset = () => {
        setStatus('idle');
        setPreviewUrl(null);
        setResults(null);
        setError(null);
        setAnimatedScores(null);
    };

    if (!isOpen) return null;

    const theme = {
        bg: '#060810',
        card: '#0B0F1E',
        accent: '#a78bfa',
        accentGlow: 'rgba(167, 139, 250, 0.3)',
        success: '#4ade80',
        danger: '#ef4444',
        water: '#38bdf8',
        food: '#fbbf24',
        text: '#E8ECF4',
        dim: 'rgba(232, 236, 244, 0.45)',
        border: 'rgba(167, 139, 250, 0.15)',
        fontHeading: "'Rajdhani', sans-serif",
        fontData: "'JetBrains Mono', monospace"
    };

    const diagnosis = results?.diagnosis?.primary;
    const diagColor = diagnosis?.color || theme.accent;

    const ScoreGauge = ({ label, value, icon: Icon, color, delay = 0 }) => {
        const displayVal = animatedScores ? animatedScores[value] || 0 : 0;
        const actualVal = results?.bcs_scores?.[value] || 0;
        const gaugeColor = actualVal >= 70 ? '#4ade80' : actualVal >= 45 ? '#fbbf24' : '#ef4444';
        
        return (
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                padding: '14px',
                borderRadius: '14px',
                border: `1px solid rgba(255,255,255,0.05)`,
                transition: 'all 0.5s',
                transitionDelay: `${delay}ms`
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <Icon size={14} color={color || gaugeColor} />
                    <span style={{ fontSize: '0.7rem', color: theme.dim, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>{label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 900, color: gaugeColor, fontFamily: theme.fontData }}>
                        {displayVal.toFixed(0)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: theme.dim }}>/100</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${displayVal}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${gaugeColor}, ${gaugeColor}90)`,
                        borderRadius: '4px',
                        transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: `0 0 10px ${gaugeColor}40`
                    }} />
                </div>
            </div>
        );
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(25px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', color: theme.text, fontFamily: theme.fontHeading
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Rajdhani:wght@500;700;900&display=swap');
                
                @keyframes healthPulse {
                    0%, 100% { opacity: 0.4; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.05); }
                }
                @keyframes scanWave {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .health-fade-in { animation: fadeSlideUp 0.6s ease-out forwards; }
                .health-pulse { animation: healthPulse 2s ease-in-out infinite; }
                .health-btn:hover { 
                    background: ${theme.accent}30 !important;
                    box-shadow: 0 0 20px ${theme.accentGlow};
                    transform: translateY(-1px);
                }
            `}</style>

            <div style={{
                width: '100%', maxWidth: '1100px', height: '88vh',
                background: theme.card, borderRadius: '28px',
                border: `1px solid ${theme.border}`,
                display: 'flex', overflow: 'hidden',
                boxShadow: `0 0 80px ${theme.accentGlow}`
            }}>
                {/* ── LEFT: Image Viewport ── */}
                <div style={{ flex: 1, position: 'relative', background: '#000', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    
                    {/* Top HUD */}
                    <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ background: 'rgba(0,0,0,0.7)', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${theme.border}`, fontSize: '0.65rem', color: theme.accent, fontFamily: theme.fontData, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Brain size={12} /> BCS VISION ENGINE
                        </div>
                        <select
                            value={selectedSpecies}
                            onChange={e => setSelectedSpecies(e.target.value)}
                            style={{
                                background: 'rgba(0,0,0,0.7)', padding: '6px 12px', borderRadius: '8px',
                                border: `1px solid ${theme.border}`, fontSize: '0.65rem', color: theme.accent,
                                fontFamily: theme.fontData, cursor: 'pointer', outline: 'none'
                            }}
                        >
                            {['Bovin', 'Ovin', 'Caprin', 'Cheval', 'Volaille'].map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Close button */}
                    <button onClick={() => { handleReset(); onClose(); }} style={{
                        position: 'absolute', top: 16, right: 16, zIndex: 100,
                        background: 'rgba(255,255,255,0.05)', border: 'none',
                        color: '#fff', padding: '10px', borderRadius: '50%', cursor: 'pointer'
                    }}>
                        <X size={22} />
                    </button>

                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFile} />

                    {!previewUrl ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <div className="health-pulse" style={{
                                width: '120px', height: '120px', borderRadius: '50%',
                                border: `3px solid ${theme.accent}30`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 25px'
                            }}>
                                <Camera size={48} color={theme.accent} style={{ opacity: 0.6 }} />
                            </div>
                             <h2 style={{ letterSpacing: '4px', fontWeight: 900, fontSize: '1.2rem', marginBottom: '8px', color: '#fff' }}>
                                DIAGNOSTIC DE SANTÉ
                            </h2>
                            <p style={{ color: theme.dim, fontSize: '0.75rem', maxWidth: '300px', margin: '0 auto 25px', lineHeight: '1.6' }}>
                                Sélectionnez l'espèce ci-dessus et téléchargez une vue latérale de l'animal.
                            </p>
                            <br />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    background: `linear-gradient(135deg, ${theme.accent}, #7c3aed)`,
                                    color: '#fff', padding: '14px 40px', borderRadius: '12px',
                                    fontWeight: 900, cursor: 'pointer', border: 'none',
                                    letterSpacing: '2px', fontSize: '0.85rem',
                                    boxShadow: `0 8px 30px ${theme.accentGlow}`,
                                    transition: 'all 0.3s'
                                }}
                            >
                                📸 CHARGER L'IMAGE
                            </button>
                        </div>
                    ) : (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            <img
                                src={previewUrl}
                                style={{
                                    width: '100%', height: '100%', objectFit: 'cover',
                                    opacity: status === 'success' ? 0.5 : 1,
                                    transition: 'all 0.5s',
                                    filter: status === 'scanning' ? 'saturate(0.7) brightness(0.9)' : 'none'
                                }}
                                alt="Animal à analyser"
                            />

                            {/* Scan wave overlay */}
                            {status === 'scanning' && (
                                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                                    <div style={{
                                        position: 'absolute', top: 0, width: '50%', height: '100%',
                                        background: `linear-gradient(90deg, transparent, ${theme.accent}15, ${theme.accent}30, ${theme.accent}15, transparent)`,
                                        animation: 'scanWave 2s linear infinite'
                                    }} />
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'rgba(0,0,0,0.3)'
                                    }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <Activity size={48} color={theme.accent} className="health-pulse" />
                                            <div style={{ color: theme.accent, fontSize: '1rem', fontWeight: 900, marginTop: '15px', letterSpacing: '6px' }}>
                                                ANALYSE BCS EN COURS...
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Success overlay with diagnosis badge */}
                            {status === 'success' && diagnosis && (
                                <div className="health-fade-in" style={{
                                    position: 'absolute', bottom: 30, left: 30, right: 30,
                                    background: `linear-gradient(135deg, ${diagColor}20, ${diagColor}08)`,
                                    border: `2px solid ${diagColor}60`,
                                    borderRadius: '20px', padding: '24px',
                                    backdropFilter: 'blur(10px)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{
                                            fontSize: '2.5rem',
                                            background: `${diagColor}20`,
                                            width: '70px', height: '70px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            borderRadius: '16px', border: `1px solid ${diagColor}40`
                                        }}>
                                            {diagnosis.emoji}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', color: theme.dim, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>
                                                Diagnostic Principal
                                            </div>
                                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: diagColor, letterSpacing: '2px' }}>
                                                {diagnosis.label}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: theme.text, marginTop: '4px', opacity: 0.8 }}>
                                                Confiance : <span style={{ color: diagColor, fontFamily: theme.fontData, fontWeight: 700 }}>
                                                    {(diagnosis.confidence * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bottom HUD */}
                    <div style={{
                        position: 'absolute', bottom: status === 'success' ? 160 : 16, left: 16,
                        display: 'flex', gap: '20px', color: theme.dim, fontSize: '0.65rem',
                        fontFamily: theme.fontData, transition: 'all 0.5s'
                    }}>
                        <div>ENG: BCS-v1.0</div>
                        <div>PIPE: COLOR+TEXTURE</div>
                        {results?.latency_ms && <div>LAT: {results.latency_ms}ms</div>}
                    </div>
                </div>

                {/* ── RIGHT: Analysis Panel ── */}
                <div style={{
                    width: '420px', display: 'flex', flexDirection: 'column',
                    borderLeft: `1px solid ${theme.border}`,
                    padding: '24px 20px', overflow: 'hidden'
                }}>
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{
                                background: `${theme.accent}12`, padding: '10px',
                                borderRadius: '12px', border: `1px solid ${theme.border}`
                            }}>
                                <Heart color={theme.accent} size={22} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '2px', fontWeight: 900 }}>
                                    DIAGNOSTIC DE SANTÉ
                                </h3>
                                <div style={{ fontSize: '0.6rem', color: theme.dim, letterSpacing: '1px' }}>
                                    Body Condition Scoring • 5 Axes
                                </div>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div style={{
                            marginBottom: '20px', background: 'rgba(255,255,255,0.02)',
                            padding: '12px 16px', borderRadius: '12px',
                            border: `1px solid ${theme.border}`
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: status === 'error' ? theme.danger : status === 'success' ? theme.success : theme.accent,
                                        boxShadow: `0 0 8px ${status === 'error' ? theme.danger : status === 'success' ? theme.success : theme.accent}`
                                    }} />
                                    <span style={{
                                        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1px',
                                        color: status === 'error' ? theme.danger : status === 'success' ? theme.success : theme.accent
                                    }}>
                                        {status === 'idle' ? 'EN ATTENTE' : status === 'scanning' ? 'ANALYSE...' : status === 'success' ? 'TERMINÉ' : 'ERREUR'}
                                    </span>
                                </div>
                                {results?.latency_ms > 0 && (
                                    <span style={{ fontFamily: theme.fontData, fontSize: '0.7rem', color: theme.accent }}>
                                        <Zap size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                                        {results.latency_ms}ms
                                    </span>
                                )}
                            </div>
                            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${scanProgress}%`, height: '100%',
                                    background: `linear-gradient(90deg, ${theme.accent}, #7c3aed)`,
                                    transition: 'width 0.3s ease', borderRadius: '4px'
                                }} />
                            </div>
                        </div>

                        {/* Error */}
                        {(error || status === 'error') && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                padding: '12px 14px', borderRadius: '12px',
                                fontSize: '0.75rem', color: '#FF6B6B', marginBottom: '16px',
                                display: 'flex', flexDirection: 'column', gap: '8px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <AlertTriangle size={16} /> 
                                    <span style={{ fontWeight: 700 }}>Erreur Diagnostic</span>
                                </div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.8, lineHeight: '1.4' }}>
                                    {error || "Une erreur inconnue est survenue."}
                                </div>
                            </div>
                        )}

                        {/* ── RESULTS ── */}
                        {status === 'success' && results ? (
                            <div className="health-fade-in">
                                
                                {/* Overall BCS Score */}
                                <div style={{
                                    marginBottom: '20px', padding: '20px',
                                    background: `linear-gradient(135deg, ${diagColor}10, transparent)`,
                                    borderRadius: '16px', border: `1px solid ${diagColor}30`,
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '0.6rem', color: theme.dim, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
                                        Score Global BCS
                                    </div>
                                    <div style={{
                                        fontSize: '3rem', fontWeight: 900,
                                        fontFamily: theme.fontData,
                                        color: (animatedScores?.overall || 0) >= 70 ? '#4ade80' : (animatedScores?.overall || 0) >= 45 ? '#fbbf24' : '#ef4444',
                                        transition: 'color 0.5s'
                                    }}>
                                        {animatedScores ? animatedScores.overall.toFixed(0) : '0'}
                                        <span style={{ fontSize: '1rem', color: theme.dim }}>/100</span>
                                    </div>
                                </div>

                                {/* BCS Score Gauges */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '0.6rem', color: theme.dim, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>
                                        Analyse Multi-Facteur
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <ScoreGauge label="Pelage" value="coat_quality" icon={Shield} delay={0} />
                                        <ScoreGauge label="Hydratation" value="hydration" icon={Droplets} color={theme.water} delay={100} />
                                        <ScoreGauge label="Nutrition" value="nutrition" icon={Apple} color={theme.food} delay={200} />
                                        <ScoreGauge label="Anti-Stress" value="stress_resistance" icon={Brain} delay={300} />
                                    </div>
                                </div>

                                {/* Recommendations IA (Legacy) */}
                                {results.diagnosis?.recommendations && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '0.6rem', color: theme.dim, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>
                                            Analyse des besoins
                                        </label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {results.diagnosis.recommendations.map((rec, i) => (
                                                <div key={i} style={{
                                                    background: 'rgba(255,255,255,0.02)',
                                                    padding: '12px 14px', borderRadius: '12px',
                                                    border: `1px solid rgba(255,255,255,0.05)`,
                                                    borderLeft: `4px solid ${URGENCY_COLORS[rec.urgency] || theme.accent}`
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>
                                                            {rec.emoji} {rec.title}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.55rem', padding: '2px 8px',
                                                            borderRadius: '4px', fontWeight: 900,
                                                            textTransform: 'uppercase', letterSpacing: '1px',
                                                            background: `${URGENCY_COLORS[rec.urgency]}20`,
                                                            color: URGENCY_COLORS[rec.urgency],
                                                            border: `1px solid ${URGENCY_COLORS[rec.urgency]}40`
                                                        }}>
                                                            {rec.urgency}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: theme.dim, lineHeight: '1.5' }}>
                                                        {rec.detail}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* PRO ACTION PLAN */}
                                {results.diagnosis?.action_plan && (
                                    <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(167, 139, 250, 0.05)', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                                        <label style={{ display: 'block', fontSize: '0.7rem', color: theme.accent, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '15px', fontWeight: 900 }}>
                                            🛡️ Protocole d'Action Pro
                                        </label>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            {/* Immediate Actions */}
                                            {results.diagnosis.action_plan.immediate?.length > 0 && (
                                                <div>
                                                    <div style={{ fontSize: '0.65rem', color: theme.danger, fontWeight: 900, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Zap size={10} /> ACTIONS IMMÉDIATES
                                                    </div>
                                                    {results.diagnosis.action_plan.immediate.map((item, i) => (
                                                        <div key={i} style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.1)', marginBottom: '5px' }}>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>{item.task}</div>
                                                            <div style={{ fontSize: '0.65rem', color: theme.dim }}>{item.detail}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Short Term */}
                                            {results.diagnosis.action_plan.short_term?.length > 0 && (
                                                <div>
                                                    <div style={{ fontSize: '0.65rem', color: theme.food, fontWeight: 900, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Activity size={10} /> SUIVI COURT TERME
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: theme.text, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {results.diagnosis.action_plan.short_term.map((item, i) => (
                                                            <div key={i} style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                                {typeof item === 'string' ? item : (
                                                                    <>
                                                                        <div style={{ fontWeight: 700 }}>{item.task}</div>
                                                                        <div style={{ opacity: 0.6 }}>{item.detail}</div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Veterinary Actions */}
                                            {results.diagnosis.action_plan.veterinary?.length > 0 && (
                                                <div style={{ padding: '12px', background: 'rgba(167, 139, 250, 0.1)', borderRadius: '12px', border: `1px solid ${theme.accent}30` }}>
                                                    <div style={{ fontSize: '0.65rem', color: theme.accent, fontWeight: 900, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Shield size={12} /> PROTOCOLE VÉTÉRINAIRE
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#fff', fontStyle: 'italic', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {results.diagnosis.action_plan.veterinary.map((item, i) => (
                                                            <div key={i} style={{ display: 'flex', gap: '8px' }}>
                                                                <span>•</span>
                                                                <span>{typeof item === 'string' ? item : `${item.task}: ${item.detail}`}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* All Diagnoses */}
                                {results.diagnosis?.all_diagnoses?.length > 1 && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '0.6rem', color: theme.dim, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>
                                            Diagnostics Détectés
                                        </label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {results.diagnosis.all_diagnoses.map((d, i) => (
                                                <div key={i} style={{
                                                    display: 'flex', justifyContent: 'space-between',
                                                    alignItems: 'center', padding: '10px 12px',
                                                    background: i === 0 ? `${d.color}10` : 'rgba(255,255,255,0.02)',
                                                    borderRadius: '10px',
                                                    border: i === 0 ? `1px solid ${d.color}30` : '1px solid rgba(255,255,255,0.04)'
                                                }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '1.1rem' }}>{d.emoji}</span>
                                                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: i === 0 ? d.color : theme.dim }}>
                                                            {d.label}
                                                        </span>
                                                    </span>
                                                    <span style={{ fontFamily: theme.fontData, fontSize: '0.75rem', fontWeight: 700, color: d.color }}>
                                                        {(d.confidence * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Feature Metadata */}
                                {results.features && (
                                    <div style={{
                                        padding: '12px 14px', background: 'rgba(255,255,255,0.02)',
                                        borderRadius: '10px', border: `1px solid ${theme.border}`
                                    }}>
                                        <label style={{ fontSize: '0.55rem', color: theme.dim, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                                            Features Extraites
                                        </label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                            {Object.entries(results.features.color || {}).map(([k, v]) => (
                                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: theme.fontData, padding: '2px 0' }}>
                                                    <span style={{ color: theme.dim }}>{k}</span>
                                                    <span style={{ color: theme.accent }}>{typeof v === 'number' ? v.toFixed(1) : v}</span>
                                                </div>
                                            ))}
                                            {Object.entries(results.features.texture || {}).map(([k, v]) => (
                                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: theme.fontData, padding: '2px 0' }}>
                                                    <span style={{ color: theme.dim }}>{k}</span>
                                                    <span style={{ color: theme.accent }}>{typeof v === 'number' ? v.toFixed(1) : v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : status !== 'scanning' && (
                            <div style={{ textAlign: 'center', padding: '50px 0', opacity: 0.3 }}>
                                <Shield size={48} style={{ marginBottom: '20px' }} />
                                <div style={{ fontSize: '0.8rem', letterSpacing: '2px' }}>AWAITING BIOMETRIC INPUT</div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Actions */}
                    <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '16px', flexShrink: 0 }}>
                        <button
                            className="health-btn"
                            onClick={() => { handleReset(); fileInputRef.current?.click(); }}
                            style={{
                                width: '100%', padding: '14px', borderRadius: '14px',
                                background: 'transparent', border: `1px solid ${theme.accent}`,
                                color: theme.accent, fontWeight: 900, cursor: 'pointer',
                                letterSpacing: '2px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', gap: '10px',
                                fontSize: '0.75rem', fontFamily: theme.fontHeading,
                                transition: 'all 0.3s'
                            }}
                        >
                            <Upload size={16} /> {previewUrl ? 'NOUVEAU SCAN' : 'UPLOADER IMAGE'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HealthScanModal;
