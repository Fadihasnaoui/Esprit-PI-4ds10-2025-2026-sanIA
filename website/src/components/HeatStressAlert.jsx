import { useEffect, useState } from 'react';
import { Thermometer, Droplets, AlertTriangle, Flame } from 'lucide-react';
import { insightsService } from '../services/api';

const SEVERITY_STYLES = {
    NORMAL:   { color: '#4ade80', label: 'Normal',         icon: Thermometer,  bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.35)', rank: 0 },
    MILD:     { color: '#fbbf24', label: 'Stress léger',   icon: Thermometer,  bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.4)',  rank: 1 },
    MODERATE: { color: '#f97316', label: 'Stress modéré',  icon: Flame,        bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.45)', rank: 2 },
    SEVERE:   { color: '#ef4444', label: 'Stress SÉVÈRE',  icon: AlertTriangle, bg: 'rgba(239,68,68,0.14)',  border: 'rgba(239,68,68,0.6)',   rank: 3 },
};

const SPECIES_EMOJI = { Bovin: '🐄', Ovin: '🐑', Caprin: '🐐', Cheval: '🐴', Volaille: '🐔' };
const DEFAULT_SPECIES = ['Bovin', 'Ovin', 'Caprin', 'Cheval'];

const HeatStressAlert = ({ speciesList }) => {
    const species = Array.isArray(speciesList) && speciesList.length > 0
        ? [...new Set(speciesList)]
        : DEFAULT_SPECIES;

    const [forecasts, setForecasts] = useState({});   // species → data
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const results = await Promise.all(
                species.map(sp => insightsService.getHeatStress(sp, 72)
                    .then(r => [sp, r.data])
                    .catch(() => [sp, null]))
            );
            if (cancelled) return;
            const map = {};
            results.forEach(([sp, data]) => { if (data?.available) map[sp] = data; });
            setForecasts(map);
            setLoading(false);
        };
        load();
        const iv = setInterval(load, 15 * 60 * 1000);
        return () => { cancelled = true; clearInterval(iv); };
    }, [species.join('|')]);

    if (loading) {
        return (
            <div style={{
                padding: '14px 18px', borderRadius: '14px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)'
            }}>🌡️ Chargement des données météo pour {species.length} espèce(s)…</div>
        );
    }

    const entries = Object.entries(forecasts);
    if (entries.length === 0) return null;

    // Worst-case headline (highest severity across all species)
    const worst = entries.reduce((acc, [sp, d]) => {
        const rank = SEVERITY_STYLES[d.alert_level]?.rank ?? 0;
        return rank > acc.rank ? { sp, d, rank } : acc;
    }, { sp: null, d: null, rank: -1 });

    const headline = SEVERITY_STYLES[worst.d?.alert_level] || SEVERITY_STYLES.NORMAL;
    const HeadIcon = headline.icon;
    const anyMeteo = worst.d;
    const peakDate = anyMeteo?.peak?.when ? new Date(anyMeteo.peak.when) : null;

    return (
        <div style={{
            padding: '16px 20px',
            borderRadius: '16px',
            background: headline.bg,
            border: `1px solid ${headline.border}`,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: worst.d?.alert_level === 'SEVERE' ? `0 0 25px ${headline.color}40` : 'none',
            animation: worst.d?.alert_level === 'SEVERE' ? 'pulse-heat 2s infinite ease-in-out' : 'none'
        }}>
            <style>{`@keyframes pulse-heat {0%,100%{box-shadow:0 0 15px ${headline.color}20;}50%{box-shadow:0 0 35px ${headline.color}60;}}`}</style>

            {/* Headline row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    width: 44, height: 44, borderRadius: '12px',
                    background: `${headline.color}22`, border: `1px solid ${headline.color}60`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <HeadIcon size={22} color={headline.color} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        Stress Thermique — {entries.length} espèce{entries.length > 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: headline.color, letterSpacing: '1px' }}>
                        {headline.label.toUpperCase()}
                        {worst.sp && ` · pire cas ${SPECIES_EMOJI[worst.sp] || ''} ${worst.sp}`}
                    </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'rgba(255,255,255,0.75)' }}>
                    {anyMeteo && (<>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                            <Thermometer size={12} /> {anyMeteo.current.temp_c}°C &nbsp; <Droplets size={12} /> {anyMeteo.current.rh_pct}%
                        </span>
                        {peakDate && (
                            <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>
                                ⏱ pic {peakDate.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit' })}
                            </span>
                        )}
                    </>)}
                </div>
            </div>

            {/* Per-species grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                {entries.map(([sp, d]) => {
                    const st = SEVERITY_STYLES[d.alert_level] || SEVERITY_STYLES.NORMAL;
                    const curSt = SEVERITY_STYLES[d.current.severity] || SEVERITY_STYLES.NORMAL;
                    return (
                        <div key={sp} style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: 'rgba(0,0,0,0.25)',
                            border: `1px solid ${st.color}40`,
                            display: 'flex', flexDirection: 'column', gap: '4px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>
                                    {SPECIES_EMOJI[sp] || '🐾'} {sp}
                                </span>
                                <span style={{ fontSize: '0.55rem', fontWeight: 900, color: st.color, letterSpacing: '1px' }}>
                                    {st.label.toUpperCase()}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'JetBrains Mono, monospace' }}>
                                <span>THI now <b style={{ color: curSt.color }}>{d.current.thi}</b></span>
                                <span>pic <b style={{ color: st.color }}>{d.peak?.thi}</b></span>
                            </div>
                            {d.hours_above_moderate > 0 && (
                                <div style={{ fontSize: '0.55rem', color: '#fbbf24' }}>
                                    {d.hours_above_moderate}h de stress à venir
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Actionable advice (from the worst species) */}
            {worst.d?.alert_level !== 'NORMAL' && worst.d?.advice?.length > 0 && (
                <>
                    <button
                        onClick={() => setExpanded(v => !v)}
                        style={{
                            alignSelf: 'flex-start', background: 'transparent',
                            border: `1px solid ${headline.color}60`, color: headline.color,
                            padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem',
                            fontWeight: 700, cursor: 'pointer', letterSpacing: '1px'
                        }}>
                        {expanded ? 'Masquer les recommandations' : `Voir recommandations (${worst.sp})`}
                    </button>
                    {expanded && (
                        <ul style={{
                            margin: 0, padding: '10px 12px 10px 26px',
                            background: 'rgba(0,0,0,0.25)', borderRadius: '10px',
                            fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6
                        }}>
                            {worst.d.advice.slice(0, 5).map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
};

export default HeatStressAlert;
