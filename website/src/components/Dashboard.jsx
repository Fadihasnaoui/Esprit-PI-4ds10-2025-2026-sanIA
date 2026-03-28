import React, { useState, useEffect } from 'react';
import { Droplets, Thermometer, Activity, TreePine, Bug, Zap, AlertTriangle, CheckCircle, Clock, RefreshCw, ChevronRight, Leaf, Wind } from 'lucide-react';
import { alertService, livestockService, fieldService, sensorService, diseaseService } from '../services/api';

/* ── Animated Counter Hook ── */
const useCounter = (target, duration = 1200) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.round(start * 10) / 10);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return typeof target === 'number' && !Number.isInteger(target) ? count.toFixed(1) : Math.round(count);
};

/* ── StatCard ── */
const StatCard = ({ icon: Icon, label, value, unit, color, delay, trend, subtext }) => (
  <div 
    className={`glass-card animate-slide-up delay-${delay}`}
    style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ 
        padding: '0.8rem', borderRadius: '14px', 
        background: `linear-gradient(135deg, ${color}18, ${color}08)`, 
        color, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={22} strokeWidth={2} />
      </div>
      {trend !== undefined && (
        <span style={{
          fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.5px',
          padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)',
          background: trend >= 0 ? 'rgba(139,195,74,0.1)' : 'rgba(199,91,57,0.1)',
          color: trend >= 0 ? 'var(--primary)' : 'var(--terracotta)',
          border: `1px solid ${trend >= 0 ? 'rgba(139,195,74,0.2)' : 'rgba(199,91,57,0.2)'}`,
        }}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </span>
      )}
      {trend === undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div className="status-dot online" style={{ width: '5px', height: '5px' }}></div>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>Live</span>
        </div>
      )}
    </div>
    <div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '500' }}>{label}</p>
      <h3 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-1px', fontFamily: "'Playfair Display', serif", color: 'var(--text-bright)' }}>
        {value}<span style={{ fontSize: '0.85rem', marginLeft: '5px', color: 'var(--text-dim)', fontFamily: "'Inter', sans-serif", fontWeight: '400' }}>{unit}</span>
      </h3>
    </div>
    {subtext && <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '-0.3rem' }}>{subtext}</p>}
    <div className="progress-bar">
      <div className="fill" style={{ width: `${Math.min(100, typeof value === 'number' ? value : 70)}%`, background: `linear-gradient(90deg, ${color}, ${color}50)`, boxShadow: `0 0 8px ${color}30` }}></div>
    </div>
  </div>
);

/* ── Alert Row ── */
const AlertRow = ({ alert, onResolve }) => {
  const sevColor = {
    critical: 'var(--terracotta)',
    high: '#e67e22',
    medium: 'var(--sand-gold)',
    low: 'var(--primary)',
  };
  return (
    <div className="glass-card" style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{
        padding: '0.5rem', borderRadius: '10px',
        background: `linear-gradient(135deg, ${sevColor[alert.severity] || 'var(--sand-gold)'}18, transparent)`,
        color: sevColor[alert.severity] || 'var(--sand-gold)',
        border: `1px solid ${sevColor[alert.severity] || 'var(--sand-gold)'}30`,
        display: 'flex',
      }}>
        <AlertTriangle size={18} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-bright)' }}>{alert.type}</span>
          <span className="badge" style={{
            padding: '0.1rem 0.5rem', fontSize: '0.6rem',
            background: `${sevColor[alert.severity] || 'var(--sand-gold)'}15`,
            color: sevColor[alert.severity] || 'var(--sand-gold)',
            border: `1px solid ${sevColor[alert.severity] || 'var(--sand-gold)'}25`,
          }}>
            {alert.severity}
          </span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          {alert.note || 'Pas de détails'} • {new Date(alert.created_at).toLocaleDateString('fr-TN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      {alert.status === 'open' ? (
        <button
          onClick={() => onResolve(alert.id)}
          className="btn btn-outline"
          style={{ padding: '0.35rem 0.8rem', fontSize: '0.7rem', borderRadius: 'var(--radius-full)' }}
        >
          <CheckCircle size={13} /> Résoudre
        </button>
      ) : (
        <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
          <CheckCircle size={11} /> Résolu
        </span>
      )}
    </div>
  );
};

/* ── Disease Scan Row ── */
const ScanRow = ({ scan }) => {
  const confColor = scan.confidence >= 0.9 ? 'var(--primary)' : scan.confidence >= 0.7 ? 'var(--sand-gold)' : 'var(--terracotta)';
  return (
    <div className="glass-card" style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{
        padding: '0.5rem', borderRadius: '10px',
        background: 'rgba(199, 91, 57, 0.08)', color: 'var(--terracotta)', border: '1px solid rgba(199, 91, 57, 0.15)', display: 'flex',
      }}>
        <Bug size={18} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-bright)' }}>{scan.predicted_disease}</span>
          <span className="badge" style={{
            padding: '0.1rem 0.5rem', fontSize: '0.6rem',
            background: `${confColor}15`, color: confColor, border: `1px solid ${confColor}25`,
          }}>
            {(scan.confidence * 100).toFixed(0)}% confiance
          </span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          Culture: {scan.crop_type} • {new Date(scan.created_at).toLocaleDateString('fr-TN', { day: 'numeric', month: 'short' })}
        </p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════
   MAIN DASHBOARD COMPONENT 
   ═══════════════════════════════════════ */
const Dashboard = ({ onOpenAssistant }) => {
  const [alerts, setAlerts] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [fields, setFields] = useState([]);
  const [latestSensor, setLatestSensor] = useState(null);
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('today');

  const fetchAll = async () => {
    try {
      const [alertRes, animalRes, fieldRes, scanRes] = await Promise.allSettled([
        alertService.getAlerts(),
        livestockService.getAnimals(),
        fieldService.getFields(),
        diseaseService.getScans(),
      ]);
      
      if (alertRes.status === 'fulfilled') setAlerts(alertRes.value.data);
      if (animalRes.status === 'fulfilled') setAnimals(animalRes.value.data);
      if (scanRes.status === 'fulfilled') setScans(scanRes.value.data);
      
      if (fieldRes.status === 'fulfilled' && fieldRes.value.data.length > 0) {
        setFields(fieldRes.value.data);
        // Fetch sensor data for the first field
        try {
          const sensorRes = await sensorService.getHistory(fieldRes.value.data[0].id, 1);
          if (sensorRes.data.length > 0) {
            setLatestSensor(sensorRes.data[0]);
          }
        } catch (e) {}
      }
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const handleResolveAlert = async (id) => {
    try {
      await alertService.updateAlert(id, { status: 'resolved', note: 'Résolu depuis le dashboard' });
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' } : a));
    } catch (e) { alert('Erreur: ' + e.message); }
  };

  const openAlerts = alerts.filter(a => a.status === 'open');
  const resolvedAlerts = alerts.filter(a => a.status !== 'open');
  const totalArea = fields.reduce((sum, f) => sum + (f.area_ha || 0), 0);
  const healthyScans = scans.filter(s => s.predicted_disease?.toLowerCase().includes('healthy'));
  const diseaseRate = scans.length > 0 ? Math.round((healthyScans.length / scans.length) * 100) : 100;

  const animatedAlerts = useCounter(openAlerts.length);
  const animatedAnimals = useCounter(animals.length);
  const animatedFields = useCounter(fields.length);
  const animatedArea = useCounter(totalArea);

  if (loading) {
    return (
      <section style={{ padding: '5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        <div className="floating"><Leaf size={40} color="var(--primary)" /></div>
        <p style={{ color: 'var(--text-muted)' }}>Chargement du tableau de bord...</p>
      </section>
    );
  }

  return (
    <section className="mosaic-bg" style={{ padding: '5rem 0', position: 'relative' }}>
      {/* Section header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🌿</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '600' }}>Monitoring en temps réel</span>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', fontWeight: '700', letterSpacing: '-0.5px', color: 'var(--text-bright)' }}>
            État Général <span className="gradient-text-warm">du Domaine</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.4rem' }}>
            {fields.length} parcelle{fields.length !== 1 ? 's' : ''} • {totalArea.toFixed(1)} ha • {animals.length} animal{animals.length !== 1 ? 'aux' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={handleRefresh}
            style={{
              padding: '0.5rem', borderRadius: '10px', border: '1px solid var(--glass-border)',
              background: 'var(--glass)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex',
              transition: 'all 0.3s', animation: refreshing ? 'rotate-slow 1s linear infinite' : 'none',
            }}
          >
            <RefreshCw size={16} />
          </button>
          <div style={{ display: 'flex', gap: '0.2rem', background: 'var(--glass)', padding: '0.25rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--glass-border)' }}>
            {['today', 'week'].map(t => (
              <button key={t}
                onClick={() => setTimeRange(t)}
                className={t === timeRange ? 'btn btn-primary' : 'btn'}
                style={{ padding: '0.4rem 1rem', fontSize: '0.72rem', borderRadius: 'var(--radius-full)', background: t === timeRange ? undefined : 'transparent', color: t === timeRange ? undefined : 'var(--text-muted)' }}
              >
                {t === 'today' ? "Aujourd'hui" : 'Semaine'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ───── Stats Grid ───── */}
      <div className="grid-cols-3">
        <StatCard 
          icon={Droplets} label="Humidité du Sol" 
          value={latestSensor ? Math.round(latestSensor.soil_moisture) : '--'} unit="%" 
          color="#4EADD5" delay={1} 
          subtext={latestSensor ? `Capteur lu à ${new Date(latestSensor.created_at).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}` : 'Aucune donnée'}
        />
        <StatCard 
          icon={Thermometer} label="Température" 
          value={latestSensor ? Math.round(latestSensor.temperature_c * 10) / 10 : '--'} unit="°C" 
          color="#C75B39" delay={2} 
          subtext={latestSensor ? `Humidité air: ${Math.round(latestSensor.humidity_pct)}%` : 'Aucune donnée'}
        />
        <StatCard icon={Activity} label="Alertes Actives" value={animatedAlerts} unit={`/ ${alerts.length} total`} color="#e74c3c" delay={3} trend={openAlerts.length > 3 ? 12 : -5} />
        <StatCard icon={TreePine} label="Cheptel" value={animatedAnimals} unit="têtes" color="#D4A843" delay={4} subtext={`${new Set(animals.map(a => a.species)).size} espèce(s)`} />
        <StatCard icon={Bug} label="Santé Cultures" value={diseaseRate} unit="%" color="#8BC34A" delay={5} trend={diseaseRate >= 80 ? 3 : -8} subtext={`${scans.length} scan(s) analysé(s)`} />
        
        {/* AI Insight Card */}
        <div className="glass-card animate-slide-up delay-6" style={{ background: 'linear-gradient(145deg, rgba(139,195,74,0.08), rgba(107,142,35,0.05))', border: '1px solid rgba(139,195,74,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.4rem', borderRadius: '10px', background: 'var(--primary-soft)', display: 'flex' }}>
                <Zap size={18} color="var(--primary)" />
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', fontFamily: "'Playfair Display', serif", color: 'var(--text-bright)' }}>SANIA AI Insight</h3>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase' }}>Analyse automatisée</span>
              </div>
            </div>
            <p style={{ fontSize: '0.9rem', marginBottom: '1.2rem', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', fontWeight: '300', fontStyle: 'italic', borderLeft: '3px solid var(--primary)', paddingLeft: '1rem' }}>
              "{openAlerts.length > 0 ? openAlerts[0].note || `${openAlerts.length} alerte(s) requièrent votre attention urgente.` : `Tout va bien ! ${fields.length} parcelle(s) sous surveillance, ${diseaseRate}% de cultures saines.`}"
            </p>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', fontSize: '0.78rem', justifyContent: 'center' }} onClick={onOpenAssistant}>
            <Zap size={15} /> Consulter l'IA
          </button>
        </div>
      </div>

      {/* ───── Alerts Section ───── */}
      {alerts.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} color="var(--terracotta)" />
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-bright)' }}>
                Centre d'Alertes
              </h3>
              {openAlerts.length > 0 && (
                <span className="badge badge-warm" style={{ marginLeft: '0.3rem' }}>{openAlerts.length} active{openAlerts.length > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {alerts.slice(0, 5).map((alert, i) => (
              <AlertRow key={alert.id || i} alert={alert} onResolve={handleResolveAlert} />
            ))}
            {alerts.length > 5 && (
              <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', padding: '0.5rem' }}>
                + {alerts.length - 5} autre(s) alerte(s)
              </p>
            )}
          </div>
        </div>
      )}

      {/* ───── Disease Scans Section ───── */}
      {scans.length > 0 && (
        <div style={{ marginTop: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bug size={18} color="var(--sand-gold)" />
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-bright)' }}>
                Diagnostic Maladies
              </h3>
              <span className="badge badge-gold">{scans.length} scan{scans.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {scans.slice(0, 4).map((scan, i) => (
              <ScanRow key={scan.id || i} scan={scan} />
            ))}
          </div>
        </div>
      )}

      <div className="section-divider" style={{ marginTop: '3rem' }}></div>
    </section>
  );
};

export default Dashboard;
