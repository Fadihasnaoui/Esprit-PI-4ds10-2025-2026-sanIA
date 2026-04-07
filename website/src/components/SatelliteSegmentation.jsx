import React, { useState } from 'react';
import { Upload, Microscope, Scan, CheckCircle2, AlertCircle, Map as MapIcon, ChevronRight } from 'lucide-react';
import { segmentationService } from '../services/api';

const SatelliteSegmentation = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResult(null);
            setError(null);
        }
    };

    const handleAnalyze = async () => {
        if (!selectedFile) return;
        setLoading(true);
        setError(null);
        
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const res = await segmentationService.autoDetect(formData);
            setResult(res.data);
        } catch (err) {
            setError("Échec de l'analyse satellite. Vérifiez votre connexion.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-card animate-scale-in" style={{ padding: '2rem', marginTop: '2rem', border: '1px solid var(--primary-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: 'var(--primary-soft)', padding: '0.8rem', borderRadius: '12px' }}>
                    <Scan size={24} color="var(--primary)" />
                </div>
                <div>
                    <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-bright)' }}>
                        Pillar 2: <span className="gradient-text">Segmentation Satellite</span>
                    </h2>
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Détection automatique des limites de parcelles par IA</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Upload Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div 
                        onClick={() => document.getElementById('sat-upload').click()}
                        style={{ 
                            border: '2px dashed var(--glass-border)', 
                            borderRadius: 'var(--radius-lg)', 
                            height: '250px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            position: 'relative',
                            transition: 'all 0.3s'
                        }}
                    >
                        {previewUrl ? (
                            <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <>
                                <Upload size={32} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cliquez pour uploader une image satellite</p>
                            </>
                        )}
                        <input id="sat-upload" type="file" hidden onChange={handleFileChange} />
                    </div>
                    
                    <button 
                        disabled={!selectedFile || loading}
                        onClick={handleAnalyze}
                        className="btn btn-primary" 
                        style={{ width: '100%', justifyContent: 'center', padding: '1rem' }}
                    >
                        {loading ? 'Analyse en cours...' : <><Microscope size={18} /> Lancer la Détection IA</>}
                    </button>
                </div>

                {/* Results Section */}
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', border: '1px solid var(--glass-border)' }}>
                    {!result && !error && !loading && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-dim)' }}>
                            <MapIcon size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <p>Les résultats de la segmentation apparaîtront ici après l'analyse.</p>
                        </div>
                    )}

                    {loading && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="pulsing" style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '50%', opacity: 0.5 }}></div>
                            <p style={{ marginTop: '1rem', color: 'var(--primary)' }}>L'IA identifie les tracés...</p>
                        </div>
                    )}

                    {error && (
                        <div style={{ color: 'var(--sand-gold)', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', height: '100%' }}>
                            <AlertCircle size={20} />
                            <p>{error}</p>
                        </div>
                    )}

                    {result && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginBottom: '1.5rem' }}>
                                <CheckCircle2 size={24} />
                                <h4 style={{ fontWeight: '700' }}>Analyse Terminée</h4>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                                    <span style={{ color: 'var(--text-dim)' }}>Parcelles Détectées</span>
                                    <span style={{ color: 'var(--text-bright)', fontWeight: '700' }}>{result.fields_detected}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                    {result.polygons.map((poly, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                                                <span style={{ fontSize: '0.85rem' }}>Zone #{i+1}</span>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{Math.round(poly.area_pixels)} px²</span>
                                            <ChevronRight size={14} color="var(--primary)" />
                                        </div>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                                    * Les polygones ont été simplifiés pour une intégration fluide sur votre carte.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SatelliteSegmentation;
