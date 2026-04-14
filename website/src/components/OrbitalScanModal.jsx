import React, { useState, useEffect, useRef } from 'react';
import { X, Activity, Shield, Download, Radio, Crosshair, Cpu, Zap, Eye } from 'lucide-react';
import { useAnimalDetection } from '../services/useAnimalDetection';

const SPECIES_COLORS = {
    'Bovin': '#00FFB3',
    'Ovin':  '#FF6B6B',
    'Caprin': '#4ECDC4',
    'Cheval': '#FFE66D',
};

const OrbitalScanModal = ({ isOpen, onClose, user, farmLocation, manualCaptureLocation, forceManual }) => {
    const { scanImage, status, results, error, latency, reset } = useAnimalDetection();
    const [autoScanLaunched, setAutoScanLaunched] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [scanProgress, setScanProgress] = useState(0);
    const [animatedProbs, setAnimatedProbs] = useState([]);
    const fileInputRef = useRef(null);

    // Animate progress bar
    useEffect(() => {
        let interval;
        if (status === 'scanning' || status === 'processing') {
            setScanProgress(0);
            interval = setInterval(() => {
                setScanProgress(prev => (prev < 95 ? prev + 1 : prev));
            }, 30);
        } else if (status === 'success') {
            setScanProgress(100);
        } else {
            setScanProgress(0);
        }
        return () => clearInterval(interval);
    }, [status]);

    // Animate probability bars on result
    useEffect(() => {
        if (status === 'success' && results?.all_probabilities) {
            // Start from 0 and animate to real values
            setAnimatedProbs(results.all_probabilities.map(p => ({ ...p, displayProb: 0 })));
            const timer = setTimeout(() => {
                setAnimatedProbs(results.all_probabilities.map(p => ({ ...p, displayProb: p.probability })));
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [status, results]);

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPreviewUrl(URL.createObjectURL(file));
            setAnimatedProbs([]);
            setAutoScanLaunched(true); // Bloque l'auto-scan s'il n'est pas déjà fait
            scanImage(file);
        }
        e.target.value = ''; // Important: Clear the input so selecting the same file again triggers onChange
    };

    const handleReset = () => {
        reset();
        setPreviewUrl(null);
        setAnimatedProbs([]);
        // Do NOT setAutoScanLaunched(false) here, to prevent infinite re-scan loops
    };

    const getSatelliteUrl = (lat, lon) => {
        // Conversion précise Lat/Lon vers coordonnées de Tile OSM/ESRI (Zoom 18)
        const zoom = 18;
        const n = Math.pow(2, zoom);
        const xtile = Math.floor(((lon + 180) / 360) * n);
        const ytile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + (1 / Math.cos(lat * Math.PI / 180))) / Math.PI) / 2 * n);
        
        // On retourne l'URL d'une tuile spécifiquement centrée
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ytile}/${xtile}`;
    };

    // Auto-trigger only on manual map capture, not general farm location
    useEffect(() => {
        if (isOpen && !autoScanLaunched && status === 'idle' && !forceManual) {
            // Only trigger if specifically requested via map capture
            const activeLoc = manualCaptureLocation; 
            if (activeLoc) {
                const [lat, lon] = activeLoc.split(',').map(s => parseFloat(s.trim()));
                if (!isNaN(lat) && !isNaN(lon)) {
                    setAutoScanLaunched(true);
                    
                    // Récupération de l'image satellite réelle pour les coordonnées
                    const dynamicUrl = getSatelliteUrl(lat, lon);
                    setPreviewUrl(dynamicUrl);
                    
                    // Simulate a slight delay for downlink establishment
                    setTimeout(() => {
                        scanImage(null, { lat, lon });
                    }, 800);
                }
            }
        }
    }, [isOpen, manualCaptureLocation, autoScanLaunched, status, scanImage, forceManual]);

    if (!isOpen) return null;

    const theme = {
        bg: '#05070A',
        card: '#0A0E1A',
        accent: '#00FFB3',
        text: '#E0E6ED',
        dim: 'rgba(224, 230, 237, 0.5)',
        border: 'rgba(0, 255, 179, 0.2)',
        fontHeading: "'Rajdhani', sans-serif",
        fontData: "'JetBrains Mono', monospace"
    };

    const prediction = results?.prediction;
    const predColor = prediction ? (SPECIES_COLORS[prediction.species] || theme.accent) : theme.accent;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', color: theme.text, fontFamily: theme.fontHeading
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Rajdhani:wght@500;700;900&display=swap');
                
                @keyframes scanline {
                    0% { top: 0%; opacity: 0; }
                    5% { opacity: 1; }
                    95% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .scanline {
                    position: absolute; width: 100%; height: 4px;
                    background: ${theme.accent}; box-shadow: 0 0 20px ${theme.accent};
                    z-index: 10; animation: scanline 3s linear infinite;
                }
                .radar-pulse {
                    position: absolute; border-radius: 50%;
                    border: 1px solid ${theme.accent}; opacity: 0;
                    animation: pulse 4s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(0.1); opacity: 0.8; }
                    100% { transform: scale(3); opacity: 0; }
                }
                @keyframes glow {
                    0%, 100% { box-shadow: 0 0 15px ${theme.accent}40; }
                    50% { box-shadow: 0 0 30px ${theme.accent}80; }
                }
                .result-glow {
                    animation: glow 2s ease-in-out infinite;
                }
                .btn-svi-hud:hover {
                    background: ${theme.accent}30 !important;
                    box-shadow: 0 0 15px ${theme.accent}40;
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }
            `}</style>

            <div style={{
                width: '100%', maxWidth: '1200px', height: '85vh',
                background: theme.card, borderRadius: '32px',
                border: `1px solid ${theme.border}`, display: 'flex',
                overflow: 'hidden', boxShadow: `0 0 100px rgba(0, 255, 179, 0.1)`
            }}>
                {/* Main Viewport */}
                <div style={{ flex: 1, position: 'relative', background: '#000', overflow: 'hidden' }}>
                    
                    {/* Top HUD */}
                    <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 20, display: 'flex', gap: '10px' }}>
                        <div style={{ background: 'rgba(0,0,0,0.6)', padding: '8px 15px', borderRadius: '8px', border: `1px solid ${theme.border}`, fontSize: '0.7rem', color: theme.accent, fontFamily: theme.fontData }}>
                            LAT: {(manualCaptureLocation || farmLocation)?.split(',')[0]} N | LNG: {(manualCaptureLocation || farmLocation)?.split(',')[1]} E
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.6)', padding: '8px 15px', borderRadius: '8px', border: `1px solid ${theme.border}`, fontSize: '0.7rem', color: theme.accent, fontFamily: theme.fontData }}>
                            TARGET: {manualCaptureLocation ? 'MAP ZONE' : 'LIVE FARM'}
                        </div>
                        <button 
                            onClick={() => {
                                fileInputRef.current?.click();
                            }}
                            className="btn-svi-hud"
                            style={{ 
                                background: 'rgba(0,255,179,0.1)', 
                                border: `1px solid ${theme.accent}`, 
                                color: theme.accent, 
                                padding: '8px 15px', 
                                borderRadius: '8px', 
                                fontSize: '0.7rem', 
                                fontWeight: 900, 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.3s'
                            }}
                        >
                            <Download size={14} /> MANUAL UPLINK
                        </button>
                    </div>

                    <button onClick={() => { handleReset(); setAutoScanLaunched(false); onClose(); }} style={{ position: 'absolute', top: 20, right: 20, zIndex: 100, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>

                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        accept="image/*" 
                        onChange={handleFile} 
                    />

                    {/* Image / Radar View */}
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {!previewUrl ? (
                            <div style={{ textAlign: 'center', position: 'relative' }}>
                                <div className="radar-pulse" style={{ width: '200px', height: '200px' }}></div>
                                <div className="radar-pulse" style={{ width: '200px', height: '200px', animationDelay: '1s' }}></div>
                                <div className="radar-pulse" style={{ width: '200px', height: '200px', animationDelay: '2s' }}></div>
                                <Radio size={120} color={theme.accent} style={{ opacity: 0.3 }} />
                                <h2 style={{ marginTop: '20px', letterSpacing: '4px', fontWeight: 900 }}>AWAITING UPLINK</h2>
                                <p style={{ color: theme.dim, fontSize: '0.8rem', marginTop: '8px', maxWidth: '300px' }}>
                                    Transférez une image satellite pour lancer la classification SVI
                                </p>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        fileInputRef.current?.click();
                                    }}
                                    style={{ 
                                        background: theme.accent, color: '#000', 
                                        padding: '15px 40px', borderRadius: '15px', 
                                        fontWeight: 900, marginTop: '25px', cursor: 'pointer', 
                                        border: 'none', letterSpacing: '2px', fontSize: '0.9rem',
                                        position: 'relative', zIndex: 50
                                    }}
                                >
                                    INITIALIZE UPLINK
                                </button>
                            </div>
                        ) : (
                             <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                <img 
                                    src={previewUrl} 
                                    style={{ 
                                        width: '100%', height: '100%', 
                                        objectFit: 'cover', 
                                        opacity: status === 'success' ? 0.6 : 1, 
                                        transition: 'all 0.5s',
                                        filter: manualCaptureLocation ? `brightness(1.1) contrast(1.2) sepia(0.2) hue-rotate(-15deg)` : 'none'
                                    }} 
                                    alt="SVI Satellite Feed"
                                    onError={(e) => {
                                        console.warn("SVI Preview Load Failed, using fallback");
                                        e.target.src = 'http://127.0.0.1:8000/Data/Raw/SVI_Assets/demo_orbital_frame.jpg';
                                    }}
                                />
                                
                                {(status === 'scanning' || status === 'processing') && <div className="scanline"></div>}

                                {/* Object Detection Bounding Boxes */}
                                {status === 'success' && results?.detections && results.detections.map((det, idx) => {
                                    const cx = det.box[0], cy = det.box[1], bw = det.box[2], bh = det.box[3];
                                    const rectLeft = (cx - bw/2) * 100;
                                    const rectTop = (cy - bh/2) * 100;
                                    const rectW = bw * 100;
                                    const rectH = bh * 100;
                                    const color = SPECIES_COLORS[det.species] || theme.accent;

                                    return (
                                        <div key={idx} className="fade-in-up" style={{
                                            position: 'absolute',
                                            left: `${rectLeft}%`, top: `${rectTop}%`,
                                            width: `${rectW}%`, height: `${rectH}%`,
                                            border: `3px solid ${color}`,
                                            boxShadow: `0 0 15px ${color}80, inset 0 0 15px ${color}40`,
                                            backgroundColor: 'rgba(0, 0, 0, 0.1)',
                                            pointerEvents: 'none',
                                            animationDelay: `${idx * 0.2}s`
                                        }}>
                                            {/* Target corners wrapper */}
                                            <div style={{ position: 'absolute', top: -3, left: -3, width: 10, height: 10, borderTop: `3px solid ${color}`, borderLeft: `3px solid ${color}` }}></div>
                                            <div style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderTop: `3px solid ${color}`, borderRight: `3px solid ${color}` }}></div>
                                            <div style={{ position: 'absolute', bottom: -3, left: -3, width: 10, height: 10, borderBottom: `3px solid ${color}`, borderLeft: `3px solid ${color}` }}></div>
                                            <div style={{ position: 'absolute', bottom: -3, right: -3, width: 10, height: 10, borderBottom: `3px solid ${color}`, borderRight: `3px solid ${color}` }}></div>
                                            
                                            {/* Label HUD */}
                                            <div style={{
                                                position: 'absolute', top: '-30px', left: '-3px',
                                                background: color, color: '#000',
                                                padding: '4px 10px', fontSize: '0.8rem', fontWeight: 900,
                                                display: 'flex', alignItems: 'center', gap: '5px',
                                                boxShadow: `0 0 10px ${color}`
                                            }}>
                                                <span>{det.emoji}</span>
                                                <span style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>{det.species}</span>
                                                <span style={{ fontFamily: theme.fontData }}>{(det.confidence * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {(status === 'scanning' || status === 'processing') && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 255, 179, 0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <Crosshair size={64} color={theme.accent} className="floating" />
                                            <div style={{ color: theme.accent, fontSize: '1.2rem', fontWeight: 900, marginTop: '20px', letterSpacing: '8px' }}>
                                                {status === 'processing' ? 'CLASSIFYING...' : manualCaptureLocation ? 'LOCKING ON TARGET...' : 'LOCKING FARM ASSETS...'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer HUD */}
                    <div style={{ position: 'absolute', bottom: 20, left: 20, display: 'flex', gap: '30px', color: theme.dim, fontSize: '0.75rem', fontFamily: theme.fontData }}>
                        <div>PWR: 98.4%</div>
                        <div>TEMP: -12.2°C</div>
                        <div>LINK: AES-256</div>
                        <div>MDL: EfficientNet-B0</div>
                    </div>
                </div>

                {/* Sidebar Data Control */}
                <div style={{ width: '400px', display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${theme.border}`, padding: '30px 25px', overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px' }}>
                            <div style={{ background: `${theme.accent}15`, padding: '10px', borderRadius: '12px', border: `1px solid ${theme.border}` }}>
                                <Cpu color={theme.accent} size={22} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '2px', fontWeight: 900 }}>SVI CLASSIFIER</h3>
                                <div style={{ fontSize: '0.65rem', color: theme.dim, letterSpacing: '1px' }}>EfficientNet-B0 • 4 Classes</div>
                            </div>
                        </div>

                        {/* Status */}
                        <div style={{ marginBottom: '25px', background: 'rgba(255,255,255,0.02)', padding: '15px 18px', borderRadius: '14px', border: `1px solid ${theme.border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: status === 'error' ? '#FF4D4D' : status === 'success' ? theme.accent : '#FFE66D',
                                        boxShadow: `0 0 8px ${status === 'error' ? '#FF4D4D' : status === 'success' ? theme.accent : '#FFE66D'}`
                                    }} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: status === 'error' ? '#FF4D4D' : theme.accent, letterSpacing: '1px' }}>
                                        {status === 'idle' ? 'STANDBY' : status.toUpperCase()}
                                    </span>
                                </div>
                                {latency > 0 && (
                                    <span style={{ fontFamily: theme.fontData, fontSize: '0.75rem', color: theme.accent }}>
                                        <Zap size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                                        {latency}ms
                                    </span>
                                )}
                            </div>
                            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${scanProgress}%`, height: '100%',
                                    background: `linear-gradient(90deg, ${theme.accent}, #4ECDC4)`,
                                    transition: 'width 0.3s ease', borderRadius: '4px'
                                }} />
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{ background: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.3)', padding: '12px 15px', borderRadius: '12px', fontSize: '0.8rem', color: '#FF6B6B', marginBottom: '20px' }}>
                                ⚠ {error}
                            </div>
                        )}

                        {/* Source info */}
                        {results?.source && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', padding: '10px 14px', background: 'rgba(0, 255, 179, 0.05)', borderRadius: '10px', border: `1px solid ${theme.border}` }}>
                                <Eye size={14} color={theme.accent} />
                                <span style={{ fontSize: '0.65rem', fontFamily: theme.fontData, color: theme.dim }}>{results.source}</span>
                            </div>
                        )}

                        {/* Classification Results */}
                        {status === 'success' && results ? (
                            <div className="fade-in-up">
                                {/* Main prediction */}
                                <div style={{ marginBottom: '25px' }}>
                                    <label style={{ fontSize: '0.65rem', color: theme.dim, textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '12px' }}>
                                        Espèce Détectée
                                    </label>
                                    <div style={{
                                        background: `linear-gradient(135deg, ${predColor}10, ${predColor}05)`,
                                        border: `1px solid ${predColor}40`,
                                        padding: '20px', borderRadius: '16px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '4px' }}>
                                            {prediction?.emoji}
                                        </div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: predColor, letterSpacing: '2px' }}>
                                            {prediction?.species}
                                        </div>
                                        <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: theme.fontData, color: '#fff', marginTop: '2px' }}>
                                            {prediction ? (prediction.confidence * 100).toFixed(1) : 0}%
                                        </div>
                                    </div>
                                </div>

                                {/* All Probabilities - Bar Chart */}
                                <div>
                                    <label style={{ fontSize: '0.65rem', color: theme.dim, textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '12px' }}>
                                        Distribution des Probabilités
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {(animatedProbs.length > 0 ? animatedProbs : results.all_probabilities || []).map((p, i) => {
                                            const barColor = SPECIES_COLORS[p.species] || theme.accent;
                                            const displayProb = p.displayProb !== undefined ? p.displayProb : p.probability;
                                            const pct = (displayProb * 100);
                                            const isTop = i === 0;
                                            
                                            return (
                                                <div key={p.species} style={{
                                                    background: isTop ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                                                    padding: '12px 14px', borderRadius: '12px',
                                                    border: isTop ? `1px solid ${barColor}30` : '1px solid rgba(255,255,255,0.04)',
                                                    transition: 'all 0.3s'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '1.1rem' }}>{p.emoji}</span>
                                                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: isTop ? '#fff' : theme.dim }}>
                                                                {p.species}
                                                            </span>
                                                        </span>
                                                        <span style={{
                                                            fontFamily: theme.fontData, fontSize: '0.8rem',
                                                            fontWeight: 700, color: barColor
                                                        }}>
                                                            {pct.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    <div style={{
                                                        width: '100%', height: '6px',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        borderRadius: '4px', overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            width: `${pct}%`, height: '100%',
                                                            background: `linear-gradient(90deg, ${barColor}, ${barColor}90)`,
                                                            borderRadius: '4px',
                                                            transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                                                            boxShadow: isTop ? `0 0 10px ${barColor}40` : 'none'
                                                        }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Metadata */}
                                {results.metadata && (
                                    <div style={{ marginTop: '20px', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: `1px solid ${theme.border}` }}>
                                        <label style={{ fontSize: '0.6rem', color: theme.dim, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>Pipeline Metadata</label>
                                        {Object.entries(results.metadata).map(([k, v]) => (
                                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '3px 0', fontFamily: theme.fontData }}>
                                                <span style={{ color: theme.dim }}>{k}</span>
                                                <span style={{ color: theme.accent }}>{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Warning message for demo mode */}
                                {results.message && (
                                    <div style={{ marginTop: '15px', padding: '10px 14px', background: 'rgba(255, 230, 109, 0.08)', border: '1px solid rgba(255, 230, 109, 0.2)', borderRadius: '10px', fontSize: '0.7rem', color: '#FFE66D' }}>
                                        {results.message}
                                    </div>
                                )}
                            </div>
                        ) : status !== 'scanning' && status !== 'processing' && (
                            <div style={{ textAlign: 'center', padding: '50px 0', opacity: 0.3 }}>
                                <Shield size={48} style={{ marginBottom: '20px' }} />
                                <div style={{ fontSize: '0.8rem', letterSpacing: '2px' }}>AWAITING BIOMETRIC SCAN</div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Actions */}
                    <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '20px', flexShrink: 0 }}>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            style={{ 
                                width: '100%', padding: '16px', borderRadius: '14px', 
                                background: 'transparent', border: `1px solid ${theme.accent}`, 
                                color: theme.accent, fontWeight: 900, cursor: 'pointer',
                                letterSpacing: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                fontSize: '0.8rem', fontFamily: theme.fontHeading,
                                transition: 'all 0.3s'
                            }}
                        >
                            <Download size={18} /> {previewUrl ? 'NEW SCAN' : 'SYNC FRAME'}
                        </button>
                        <p style={{ fontSize: '0.55rem', color: theme.dim, marginTop: '12px', textAlign: 'center', opacity: 0.5, fontFamily: theme.fontData }}>
                            SYSTEM AUTHORIZED FOR {user?.full_name?.toUpperCase() || 'ROOT'} ACCESS
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrbitalScanModal;
