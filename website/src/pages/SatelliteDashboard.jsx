import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Satellite, Leaf, RefreshCw, ChevronRight, AlertTriangle, CheckCircle, Clock, Map, Activity,
} from 'lucide-react';
import { fieldService, ndviService, vraService } from '../services/api';
import FieldMap from '../components/FieldMap';
import ScrollReveal from '../components/ScrollReveal';
import AgriHeroDecor from '../components/AgriHeroDecor';

/* ── helpers ── */
const ndviColor = (v) => {
  if (v == null) return '#888';
  if (v >= 0.6) return '#4CAF50';
  if (v >= 0.4) return '#8BC34A';
  if (v >= 0.2) return '#FFC107';
  return '#F44336';
};

const ndviLabel = (v) => {
  if (v == null) return 'N/A';
  if (v >= 0.6) return 'Excellent';
  if (v >= 0.4) return 'Bon';
  if (v >= 0.2) return 'Modéré';
  return 'Faible';
};

/* Zone color keyed by zone.id ("A","B","C") */
const zoneColor = { A: '#F44336', B: '#FF9800', C: '#4CAF50' };

const stageStatusColor = { completed: '#6B8E23', current: '#8BC34A', upcoming: '#555' };

/* ── shared components ── */
const Card = ({ title, icon: Icon, color = '#8BC34A', children, extra }) => (
  <div style={{
    background: 'var(--surface-variant)',
    border: '1px solid var(--outline-variant)',
    borderRadius: 'var(--radius-md)',
    padding: '1.4rem',
    marginBottom: '1.4rem',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
        <div style={{
          padding: '0.5rem', borderRadius: '10px',
          background: `linear-gradient(135deg, ${color}22, ${color}0a)`,
          border: `1px solid ${color}30`, color, display: 'flex',
        }}>
          <Icon size={18} />
        </div>
        <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-bright)' }}>{title}</span>
      </div>
      {extra}
    </div>
    {children}
  </div>
);

const Badge = ({ label, color }) => (
  <span style={{
    padding: '0.2rem 0.7rem', borderRadius: '99px', fontSize: '0.7rem',
    fontWeight: '700', background: `${color}22`, color, border: `1px solid ${color}40`,
  }}>
    {label}
  </span>
);

/* ════════════════════════════════════════
   NDVI CARD — live value from full-analysis + history chart
   ════════════════════════════════════════ */
const NdviCard = ({ fieldId, liveVal, liveDate, liveClouds, liveSource }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fieldId) return;
    setLoading(true);
    ndviService.getHistory(fieldId, 12)
      .then(r => {
        const raw = r.data;
        const history = Array.isArray(raw) ? raw : (raw?.history || raw?.ndvi_history || []);
        // Normalise field names
        const mapped = history.map(h => ({
          ...h,
          ndvi:       h.ndvi       ?? h.ndvi_value ?? null,
          week_label: h.week_label ??
            new Date(h.captured_at || h.date).toLocaleDateString('fr', { day:'2-digit', month:'short' }),
        }));
        setData(mapped);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [fieldId, liveVal, liveDate]); // Re-fetch history if live data changes (from refresh)

  // High-confidence source logic
  const latestDB  = data[data.length - 1];
  const isStale   = liveVal == null;
  const val       = isStale ? (latestDB?.ndvi ?? null) : liveVal;
  
  const StatusBadge = () => {
    if (!isStale) return (
      <div style={{ fontSize: '0.62rem', color: '#4CAF50', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.3rem', fontWeight: 'bold' }}>
        <RefreshCw size={10} className="spin" /> 🛰 Synchronisé Satellite {liveDate}
      </div>
    );
    if (latestDB) return (
      <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.3rem' }}>
        <Clock size={10} /> Dernière lecture : {latestDB.week_label} (Cache local)
      </div>
    );
    return null;
  };

  return (
    <Card title="Indice NDVI — Santé Végétale" icon={Leaf} color="#4CAF50"
      extra={<Badge label={ndviLabel(val)} color={ndviColor(val)} />}>
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>Chargement…</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.2rem', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>NDVI Actuel</div>
              <div style={{ fontSize: '2.8rem', fontWeight: '800', color: '#FFFFFF', fontFamily: "'Newsreader', serif", lineHeight: 1 }}>
                {val != null ? val.toFixed(3) : '—'}
              </div>
              <StatusBadge />
            </div>
            {val != null && (
              <div style={{ flex: 1 }}>
                <div style={{ height: '8px', borderRadius: '99px', background: 'linear-gradient(90deg, #F44336, #FFC107, #4CAF50)', marginBottom: '4px', position: 'relative' }}>
                  <div style={{
                    position: 'absolute', top: '-3px',
                    left: `${Math.max(0, Math.min(100, (val + 0.1) / 1.1 * 100))}%`,
                    width: '14px', height: '14px', borderRadius: '50%',
                    background: ndviColor(val), border: '2px solid #fff',
                    transform: 'translateX(-50%)',
                    transition: 'left 0.8s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)' }}>
                  <span>-0.1 (Sol nu)</span><span>0.5 (Dense)</span><span>1.0 (Max)</span>
                </div>
              </div>
            )}
          </div>

          {/* History chart */}
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="ndviGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4CAF50" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="week_label" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 1]} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: '#FFFFFF'
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                />
                <Area type="monotone" dataKey="ndvi" stroke="#4CAF50" strokeWidth={2} fill="url(#ndviGrad)" name="NDVI" dot={{ r: 3, fill: '#4CAF50' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--glass-border)', borderRadius: '8px', color: 'var(--text-dim)', fontSize: '0.75rem', textAlign: 'center', padding: '1rem' }}>
              <div>
                <Activity size={24} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                <p>Historique réel en cours de constitution...<br/>Actualisez pour synchroniser le satellite.</p>
              </div>
            </div>
          )}
          {data.length === 0 && val == null && (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '1rem' }}>
              Aucune donnée NDVI disponible pour cette parcelle.
            </div>
          )}
        </>
      )}
    </Card>
  );
};


/* ════════════════════════════════════════
   VRA CARD
   Backend zones: { id:"A"|"B"|"C", label, area_pct, application_rate_pct,
                    prescription: { N_kg, P_kg, K_kg, water_m3 } }
   ════════════════════════════════════════ */
const VraCard = ({ data }) => {
  if (!data) return null;
  const zones = data.zones || [];
  const savings = data.savings_vs_uniform_pct;

  return (
    <Card title="Carte de Prescription VRA" icon={Map} color="#FF9800">
      {savings != null && (
        <div style={{
          background: 'linear-gradient(135deg, #FF980015, #FFC10710)',
          border: '1px solid #FF980030', borderRadius: '10px',
          padding: '0.7rem 1rem', marginBottom: '1rem',
          display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Économies intrants</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#FF9800', fontFamily: "'Newsreader', serif" }}>
              ~{savings?.toFixed(0)}%
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', flex: 1 }}>
            {data.savings_message || 'vs application uniforme'}
          </div>
          {data.avg_ndvi != null && (
            <Badge label={`NDVI moy. ${data.avg_ndvi?.toFixed(3)}`} color="#FF9800" />
          )}
        </div>
      )}

      {/* Mini VRA Map Visualization */}
      {data.spatial_overlay && data.spatial_overlay.length > 0 && (
        <div style={{ height: '220px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #FF980030', marginBottom: '1.2rem' }}>
          <FieldMap 
            showNdvi={true}
            vraData={data}
            /* Calculate rough center from the first cell's first point so it centers nicely */
            center={data.spatial_overlay[0].polygon[0]}
            zoom={15}
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {zones.map(z => {
          const color = zoneColor[z.id] || '#888';
          const presc = z.prescription || {};
          return (
            <div key={z.id} style={{
              background: `${color}10`,
              border: `1px solid ${color}30`,
              borderRadius: '10px', padding: '0.9rem 1rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
                  <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-bright)' }}>
                    Zone {z.label || z.label_fr || z.id}
                  </span>
                </div>
                <Badge label={`${z.area_pct?.toFixed(0) ?? '?'}% du champ`} color={color} />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '0.4rem', fontStyle: 'italic' }}>
                {z.interpretation}
              </div>
              <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {presc.N_kg != null && <span>N: <b style={{ color: 'var(--text-light)' }}>{presc.N_kg} kg</b></span>}
                {presc.P_kg != null && <span>P: <b style={{ color: 'var(--text-light)' }}>{presc.P_kg} kg</b></span>}
                {presc.K_kg != null && <span>K: <b style={{ color: 'var(--text-light)' }}>{presc.K_kg} kg</b></span>}
                {presc.water_m3 != null && <span>💧 <b style={{ color: 'var(--text-light)' }}>{presc.water_m3} m³</b></span>}
                <span>Taux: <b style={{ color: 'var(--text-light)' }}>{z.application_rate_pct}%</b></span>
              </div>
            </div>
          );
        })}
      </div>

      {data.total_prescription && (
        <div style={{
          marginTop: '1rem', padding: '0.7rem 1rem',
          background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.75rem',
        }}>
          <span style={{ color: 'var(--text-dim)' }}>Total champ:</span>
          <span>N: <b style={{ color: '#FF9800' }}>{data.total_prescription.N_kg} kg</b></span>
          <span>P: <b style={{ color: '#FF9800' }}>{data.total_prescription.P_kg} kg</b></span>
          <span>K: <b style={{ color: '#FF9800' }}>{data.total_prescription.K_kg} kg</b></span>
          <span>💧 <b style={{ color: '#FF9800' }}>{data.total_prescription.water_m3} m³</b></span>
        </div>
      )}
    </Card>
  );
};

/* ════════════════════════════════════════
   SOIL HEALTH CARD
   Backend: { indicators:{ndvi,savi,msavi,...}, health_score, health_label,
              moisture_stress, recommendations:[] }
   ════════════════════════════════════════ */
const SoilHealthCard = ({ data }) => {
  if (!data) return null;

  const score      = data.health_score ?? 0;
  const scoreColor = score >= 70 ? '#4CAF50' : score >= 45 ? '#FF9800' : '#F44336';
  const indicators = data.indicators || {};

  const stressColor = { Low: '#4CAF50', Moderate: '#FF9800', High: '#F44336' };
  const mstress = data.moisture_stress;

  return (
    <Card title="Santé du Sol" icon={Leaf} color="#8BC34A"
      extra={<Badge label={data.health_label || 'N/A'} color={scoreColor} />}>

      {/* Score circle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '1.2rem' }}>
        <div style={{
          width: '90px', height: '90px', borderRadius: '50%', flexShrink: 0,
          background: `conic-gradient(${scoreColor} ${score * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: '70px', height: '70px', borderRadius: '50%',
            background: 'var(--bg-surface)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '1.4rem', fontWeight: '800', color: scoreColor, lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: '0.55rem', color: 'var(--text-dim)', letterSpacing: '1px' }}>/100</span>
          </div>
        </div>

        {/* Indices pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {Object.entries(indicators).map(([k, v]) => {
            if (v == null) return null;
            return (
              <div key={k} style={{
                padding: '0.3rem 0.75rem', borderRadius: '99px',
                background: 'rgba(139,195,74,0.1)', border: '1px solid rgba(139,195,74,0.2)',
                fontSize: '0.72rem',
              }}>
                <span style={{ color: 'var(--text-dim)' }}>{k.toUpperCase().replace('_', ' ')}: </span>
                <span style={{ color: 'var(--text-bright)', fontWeight: '700' }}>
                  {typeof v === 'number' ? v.toFixed(3) : v}
                </span>
              </div>
            );
          })}
          {mstress && (
            <div style={{
              padding: '0.3rem 0.75rem', borderRadius: '99px',
              background: `${stressColor[mstress] || '#888'}18`,
              border: `1px solid ${stressColor[mstress] || '#888'}30`,
              fontSize: '0.72rem',
            }}>
              <span style={{ color: 'var(--text-dim)' }}>Stress hydrique: </span>
              <span style={{ color: stressColor[mstress] || '#888', fontWeight: '700' }}>{mstress}</span>
            </div>
          )}
          {data.soil_type_classification && (
            <div style={{
              padding: '0.3rem 0.75rem', borderRadius: '99px',
              background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.2)',
              fontSize: '0.72rem',
            }}>
              <span style={{ color: 'var(--text-dim)' }}>Type de Sol: </span>
              <span style={{ color: '#FF9800', fontWeight: '700' }}>{data.soil_type_classification}</span>
            </div>
          )}
        </div>
      </div>

      {data.fertility_desc && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.8rem', fontStyle: 'italic' }}>
          {data.fertility_desc}
        </p>
      )}

      {/* Recommendations */}
      {data.recommendations?.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem' }}>
            Recommandations
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {data.recommendations.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-light)' }}>
                <ChevronRight size={14} color="#8BC34A" style={{ marginTop: '1px', flexShrink: 0 }} />
                {r}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

/* ════════════════════════════════════════
   CROP CALENDAR CARD
   Backend: { current_stage:{name,name_fr,action,...}, timeline:[{name,period,status,...}],
              upcoming_actions:[{stage,action,...}], season_progress_pct,
              ndvi_vs_expected:{assessment,...} }
   ════════════════════════════════════════ */
const CropCalendarCard = ({ data, liveNdvi }) => {
  if (!data) return null;

  const timeline        = data.timeline || [];
  const upcoming        = data.upcoming_actions || [];
  const currentStage    = data.current_stage || {};
  const ndviAssessment  = data.ndvi_vs_expected?.assessment || '';
  const progress        = data.season_progress_pct ?? 0;

  // ── Real-time stress alert from live satellite NDVI ──
  const expectedNdvi = currentStage.ndvi_expected;
  const ndviDeviation = (liveNdvi != null && expectedNdvi != null)
    ? liveNdvi - expectedNdvi : null;
  const stressAlert = ndviDeviation != null && ndviDeviation < -0.15;

  return (
    <Card title="Calendrier Cultural" icon={Clock} color="#9C27B0">
      {/* ── Real-time satellite stress alert ── */}
      {stressAlert && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
          padding: '0.7rem 1rem', borderRadius: '10px', marginBottom: '1.2rem',
          background: 'rgba(244,67,54,0.08)',
          border: '1px solid rgba(244,67,54,0.3)',
        }}>
          <AlertTriangle size={18} color="#F44336" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#F44336', marginBottom: '0.2rem' }}>
              ⚠️ Alerte Stress Végétal Détecté
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
              NDVI satellitaire ({liveNdvi?.toFixed(3)}) est {Math.abs(ndviDeviation).toFixed(2)} en dessous
              du seuil attendu ({expectedNdvi?.toFixed(2)}) pour l'étape «{currentStage.name_fr || currentStage.name}».
              Inspectez stress hydrique, carences ou maladies.
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-bright)' }}>
            {currentStage.name_fr || currentStage.name || '—'}
            <span style={{ fontWeight: '400', color: 'var(--text-dim)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
              (Étape {currentStage.index}/{currentStage.total})
            </span>
          </span>
          <span style={{ fontSize: '0.75rem', color: '#9C27B0', fontWeight: '700' }}>
            {progress?.toFixed(0)}%
          </span>
        </div>
        <div style={{ height: '8px', borderRadius: '99px', background: 'var(--bg-dark)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '99px',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #7B1FA2, #9C27B0)',
            transition: 'width 0.6s ease',
          }} />
        </div>
        {ndviAssessment && (
          <p style={{ fontSize: '0.73rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
            {ndviAssessment}
          </p>
        )}
      </div>

      {currentStage.action && (
        <div style={{
          padding: '0.6rem 0.9rem', borderRadius: '8px',
          background: 'rgba(156,39,176,0.08)', border: '1px solid rgba(156,39,176,0.2)',
          fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '1rem',
        }}>
          <b style={{ color: '#CE93D8' }}>Action maintenant:</b> {currentStage.action}
        </div>
      )}

      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.2rem' }}>
        {timeline.map((s, i) => {
          const color = stageStatusColor[s.status] || '#555';
          const isCurrent = s.status === 'current';
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.8rem',
              padding: isCurrent ? '0.6rem 0.9rem' : '0.4rem 0.9rem',
              borderRadius: '8px',
              background: isCurrent ? 'rgba(139,195,74,0.1)' : 'transparent',
              border: isCurrent ? '1px solid rgba(139,195,74,0.25)' : '1px solid transparent',
            }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: isCurrent ? '700' : '400', color: isCurrent ? 'var(--text-bright)' : 'var(--text-muted)' }}>
                  {s.name_fr || s.name}
                </span>
                {s.period && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginLeft: '0.5rem' }}>({s.period})</span>
                )}
              </div>
              {s.status === 'completed' && <CheckCircle size={12} color="#6B8E23" />}
              {s.status === 'current' && <Badge label="En cours" color="#8BC34A" />}
            </div>
          );
        })}
      </div>

      {/* Upcoming actions */}
      {upcoming.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem' }}>
            Actions à venir
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {upcoming.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-light)' }}>
                <AlertTriangle size={13} color={i === 0 ? '#F44336' : '#FF9800'} style={{ marginTop: '2px', flexShrink: 0 }} />
                <span>
                  <b style={{ color: i === 0 ? '#F44336' : '#FF9800' }}>
                    {a.label === 'NOW' ? 'MAINTENANT' : a.label} — {a.stage}:
                  </b>{' '}
                  {a.action}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

/* ════════════════════════════════════════
   SATELLITE DASHBOARD PAGE
   ════════════════════════════════════════ */
const SatelliteDashboard = () => {
  const [fields, setFields]         = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [analysis, setAnalysis]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(false);

  /* Load fields on mount */
  useEffect(() => {
    fieldService.getFields()
      .then(r => {
        const f = r.data || [];
        setFields(f);
        if (f.length > 0) setSelectedId(f[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* Load full analysis when field changes */
  useEffect(() => {
    if (!selectedId) return;
    setRefreshing(true);
    setAnalysis(null);
    setError(false);
    vraService.getFullAnalysis(selectedId)
      .then(r => {
        setAnalysis(r.data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setRefreshing(false));
  }, [selectedId]);

  const selectedField = fields.find(f => f.id === selectedId);

  const handleRefresh = () => {
    if (!selectedId) return;
    setRefreshing(true);
    setError(false);
    vraService.getFullAnalysis(selectedId)
      .then(r => {
        setAnalysis(r.data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setRefreshing(false));
  };

  return (
    <div style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      {/* ── Header ── */}
      <ScrollReveal>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            padding: '0.75rem', borderRadius: '14px',
            background: 'linear-gradient(135deg, #1a3a5c, #0d2137)',
            border: '1px solid rgba(33,150,243,0.25)',
            display: 'flex',
          }}>
            <Satellite size={28} color="#4EADD5" />
          </div>
          <div>
            <h2 style={{ fontFamily: "'Newsreader', serif", fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-bright)', margin: 0 }}>
              Analyse Satellite
            </h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', margin: 0 }}>
              NDVI · VRA · Santé du Sol · Calendrier Cultural
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.6rem 1.2rem', borderRadius: '99px',
            background: 'var(--primary-soft)', border: '1px solid var(--outline-variant)',
            color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '800',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} />
          Actualiser
        </button>
      </div>
      </ScrollReveal>

      {/* ── Field chips ── */}
      {loading ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '4rem' }}>Chargement des parcelles…</div>
      ) : fields.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '4rem',
          background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)',
          color: 'var(--text-dim)',
        }}>
          <Satellite size={48} color="var(--text-dim)" style={{ marginBottom: '1rem' }} />
          <p>Aucune parcelle enregistrée. Créez d'abord une parcelle dans l'onglet Parcelles.</p>
        </div>
      ) : (
        <ScrollReveal delay={0.06}>
        <>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.6rem' }}>
            {fields.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedId(f.id)}
                style={{
                  padding: '0.5rem 1.1rem', borderRadius: '99px', cursor: 'pointer',
                  fontSize: '0.82rem', fontWeight: selectedId === f.id ? '700' : '400',
                  background: selectedId === f.id ? 'rgba(139,195,74,0.15)' : 'var(--glass)',
                  border: selectedId === f.id ? '1px solid rgba(139,195,74,0.4)' : '1px solid var(--glass-border)',
                  color: selectedId === f.id ? '#8BC34A' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                🌾 {f.name}
              </button>
            ))}
          </div>

          {/* ── Field info banner ── */}
          {selectedField && (
            <div style={{
              display: 'flex', gap: '2rem', flexWrap: 'wrap',
              padding: '0.9rem 1.2rem', marginBottom: '1.6rem',
              background: 'rgba(139,195,74,0.06)', border: '1px solid rgba(139,195,74,0.15)', borderRadius: '12px',
              fontSize: '0.8rem', color: 'var(--text-muted)',
            }}>
              <span>📍 <b style={{ color: 'var(--text-light)' }}>{selectedField.name}</b></span>
              {selectedField.crop_type && <span>🌱 Culture: <b style={{ color: 'var(--text-light)' }}>{selectedField.crop_type}</b></span>}
              {selectedField.area_ha  && <span>📐 Surface: <b style={{ color: 'var(--text-light)' }}>{selectedField.area_ha} ha</b></span>}
              {selectedField.location && <span>🗺 {selectedField.location}</span>}
            </div>
          )}

          {/* ── Loading ── */}
          {refreshing && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem', opacity: 0.9 }}>
                <AgriHeroDecor />
              </div>
              <Satellite size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
              <p>Analyse satellite en cours…</p>
            </div>
          )}

          {/* ── Error ── */}
          {!refreshing && error && (
            <div style={{
              textAlign: 'center', padding: '3rem',
              background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)',
              color: 'var(--text-dim)',
            }}>
              <AlertTriangle size={36} color="#FF9800" style={{ marginBottom: '0.8rem' }} />
              <p>Impossible de charger l'analyse pour cette parcelle.<br />
                Vérifiez que le backend tourne sur le port 8000.</p>
            </div>
          )}

          {/* ── Cards grid ── */}
          {!refreshing && !error && analysis && (() => {
            // Extract the one real NDVI value from full-analysis for NdviCard
            // Prefer the new flat ndvi_summary (single source of truth)
            const ndviSum  = analysis.ndvi_summary || {};
            const diagSum  = analysis.ndvi_diagnostic?.summary || {};
            const vraAvg   = analysis.vra_map?.avg_ndvi;
            // Priority: ndvi_summary.avg_ndvi → diagnostic.avg_ndvi → vra_map.avg_ndvi
            const liveVal  = typeof ndviSum.avg_ndvi  === 'number' ? ndviSum.avg_ndvi
                           : typeof diagSum.avg_ndvi   === 'number' ? diagSum.avg_ndvi
                           : typeof vraAvg             === 'number' ? vraAvg
                           : null;
            // Use ndvi_summary fields first for meta info
            const liveDate   = ndviSum.date   || diagSum.date;
            const liveClouds = ndviSum.clouds  ?? diagSum.clouds;
            const liveSource = ndviSum.source  || diagSum.source;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '0' }}>
                <div style={{ paddingRight: '0.7rem' }}>
                  <NdviCard
                    fieldId={selectedId}
                    liveVal={liveVal}
                    liveDate={liveDate}
                    liveClouds={liveClouds}
                    liveSource={liveSource}
                  />
                  <SoilHealthCard data={analysis.soil_health} />
                </div>
                <div style={{ paddingLeft: '0.7rem' }}>
                  <VraCard data={analysis.vra_map} />
                  <CropCalendarCard data={analysis.crop_calendar} liveNdvi={liveVal} />
                </div>
              </div>
            );
          })()}
        </>
        </ScrollReveal>
      )}
    </div>
  );
};

export default SatelliteDashboard;
