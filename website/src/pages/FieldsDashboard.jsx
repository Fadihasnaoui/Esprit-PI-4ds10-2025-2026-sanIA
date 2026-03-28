import React, { useState, useEffect } from 'react';
import { Map, Plus, ChevronRight, ChevronDown, Thermometer, Droplets, X, Leaf, Activity, Clock, Waves, BarChart3, RefreshCw, Satellite } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { fieldService, sensorService, ndviService } from '../services/api';
import FieldMap from '../components/FieldMap';

const cropEmojis = { Tomato: '🍅', Grape: '🍇', Potato: '🥔', Apple: '🍎', default: '🌱' };

/* ── Custom chart tooltip ── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.8rem', boxShadow: 'var(--shadow-md)', fontSize: '0.75rem' }}>
      <p style={{ color: 'var(--text-dim)', marginBottom: '0.2rem' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: '600' }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

/* ── Expanded Field Detail Panel ── */
const FieldDetail = ({ field }) => {
  const [sensorData, setSensorData] = useState([]);
  const [ndviData, setNdviData] = useState([]);
  const [irrigationLogs, setIrrigationLogs] = useState([]);
  const [loadingSensors, setLoadingSensors] = useState(true);
  const [viewMode, setViewMode] = useState('charts'); // 'charts' or 'map'
  const [showNdviOverlay, setShowNdviOverlay] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState(null);

  useEffect(() => {
    if (showNdviOverlay && !diagnosticData) {
      ndviService.getSpatialDiagnostic(field.id)
        .then(res => setDiagnosticData(res.data))
        .catch(err => console.error("Error fetching NDVI diagnostic:", err));
    }
  }, [showNdviOverlay, field.id, diagnosticData]);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingSensors(true);
      const results = await Promise.allSettled([
        sensorService.getHistory(field.id, 7),
        ndviService.getHistory(field.id, 8),
        fieldService.getIrrigationLogs(field.id),
      ]);

      if (results[0].status === 'fulfilled') {
        const formatted = results[0].value.data.map(d => ({
          time: new Date(d.created_at).toLocaleDateString('fr', { day: '2-digit', month: 'short' }) + ' ' +
                new Date(d.created_at).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }),
          humidity: Math.round(d.soil_moisture),
          temp: Math.round(d.temperature_c * 10) / 10,
          airHumidity: Math.round(d.humidity_pct),
        })).reverse();
        setSensorData(formatted);
      }

      if (results[1].status === 'fulfilled') {
        const formatted = results[1].value.data.map(d => ({
          date: new Date(d.captured_at).toLocaleDateString('fr', { day: '2-digit', month: 'short' }),
          ndvi: d.ndvi_value,
          status: d.status,
        })).reverse();
        setNdviData(formatted);
      }

      if (results[2].status === 'fulfilled') {
        setIrrigationLogs(results[2].value.data);
      }

      setLoadingSensors(false);
    };
    fetchData();
  }, [field.id]);

  if (loadingSensors) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="floating"><Activity size={24} color="var(--primary)" /></div>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Chargement des données capteurs...</p>
      </div>
    );
  }
  const polygon = field.polygon_geojson ? JSON.parse(field.polygon_geojson) : [];

  return (
    <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* View Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--glass)', padding: '0.2rem', borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
        <button 
          onClick={() => setViewMode('charts')} 
          className={`btn ${viewMode === 'charts' ? 'btn-primary' : ''}`}
          style={{ padding: '0.4rem 1rem', fontSize: '0.7rem', textTransform: 'none', background: viewMode === 'charts' ? undefined : 'transparent', color: viewMode === 'charts' ? undefined : 'var(--text-muted)' }}
        >
          <BarChart3 size={14} /> Graphiques
        </button>
        <button 
          onClick={() => setViewMode('map')} 
          className={`btn ${viewMode === 'map' ? 'btn-warm' : ''}`}
          style={{ padding: '0.4rem 1rem', fontSize: '0.7rem', textTransform: 'none', background: viewMode === 'map' ? undefined : 'transparent', color: viewMode === 'map' ? undefined : 'var(--text-muted)' }}
        >
          <Map size={14} /> Carte NDVI
        </button>
      </div>

      {viewMode === 'map' ? (
        <div style={{ height: '400px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--glass-border)', position: 'relative' }}>
          <FieldMap 
            initialPolygon={polygon} 
            showNdvi={showNdviOverlay} 
            diagnosticData={diagnosticData}
          />
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 1000 }}>
             <button 
                onClick={() => setShowNdviOverlay(!showNdviOverlay)}
                className={`btn ${showNdviOverlay ? 'btn-primary' : 'glass-card'}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', background: showNdviOverlay ? undefined : 'rgba(0,0,0,0.5)' }}
             >
                <Satellite size={14} /> {showNdviOverlay ? 'Désactiver Overlay NDVI' : 'Activer Diagnostic NDVI'}
             </button>
          </div>
        </div>
      ) : (
        <>
          {/* Mini Stats */}
      {sensorData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.8rem' }}>
          {[
            { icon: Droplets, label: 'Humidité Sol', value: `${sensorData[sensorData.length - 1]?.humidity ?? '--'}%`, color: '#4EADD5' },
            { icon: Thermometer, label: 'Température', value: `${sensorData[sensorData.length - 1]?.temp ?? '--'}°C`, color: '#C75B39' },
            { icon: Waves, label: 'Hum. Air', value: `${sensorData[sensorData.length - 1]?.airHumidity ?? '--'}%`, color: '#8BC34A' },
            { icon: BarChart3, label: 'NDVI', value: ndviData.length > 0 ? ndviData[ndviData.length - 1].ndvi.toFixed(2) : '--', color: '#6B8E23' },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', padding: '0.8rem 1rem',
              border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '0.6rem',
            }}>
              <s.icon size={16} color={s.color} />
              <div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-bright)', fontFamily: "'Playfair Display', serif" }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row */}
      {sensorData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {/* Soil Moisture Chart */}
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.8rem', color: 'var(--text-light)', fontFamily: "'Inter', sans-serif" }}>
              💧 Humidité du Sol (7 jours)
            </h4>
            <div style={{ height: '180px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sensorData}>
                  <defs>
                    <linearGradient id={`hum-${field.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4EADD5" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#4EADD5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="humidity" name="Humidité" stroke="#4EADD5" fillOpacity={1} fill={`url(#hum-${field.id})`} strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Temperature Chart */}
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.8rem', color: 'var(--text-light)', fontFamily: "'Inter', sans-serif" }}>
              🌡️ Température (7 jours)
            </h4>
            <div style={{ height: '180px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sensorData}>
                  <defs>
                    <linearGradient id={`temp-${field.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C75B39" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#C75B39" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="temp" name="Temp" stroke="#C75B39" fillOpacity={1} fill={`url(#temp-${field.id})`} strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* NDVI Chart */}
      {ndviData.length > 0 && (
        <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid var(--glass-border)' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.8rem', color: 'var(--text-light)', fontFamily: "'Inter', sans-serif" }}>
            🛰️ Indice NDVI — Santé végétale (8 semaines)
          </h4>
          <div style={{ height: '160px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ndviData}>
                <defs>
                  <linearGradient id={`ndvi-${field.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6B8E23" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6B8E23" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} domain={[0, 1]} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="ndvi" name="NDVI" stroke="#6B8E23" fillOpacity={1} fill={`url(#ndvi-${field.id})`} strokeWidth={2} dot={{ r: 3, fill: '#6B8E23' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Irrigation Logs */}
      {irrigationLogs.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.6rem', color: 'var(--text-light)', fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            💦 Logs d'Irrigation ({irrigationLogs.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {irrigationLogs.slice(0, 5).map((log, i) => (
              <div key={log.id || i} style={{
                display: 'flex', alignItems: 'center', gap: '0.8rem',
                background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 1rem', border: '1px solid var(--glass-border)', fontSize: '0.8rem',
              }}>
                <Clock size={14} color="var(--sky-blue)" />
                <span style={{ color: 'var(--text-muted)' }}>
                  {new Date(log.created_at).toLocaleDateString('fr-TN', { day: '2-digit', month: 'short' })}
                </span>
                <span style={{ color: 'var(--text-light)', fontWeight: '600' }}>
                  {log.recommended_minutes} min recommandé
                </span>
                {log.executed_minutes != null && (
                  <span style={{ color: 'var(--primary)' }}>→ {log.executed_minutes} min exécuté</span>
                )}
                <span style={{ marginLeft: 'auto', color: 'var(--sky-blue)', fontWeight: '600' }}>
                  {log.water_estimate_m3} m³
                </span>
                <span className="badge" style={{
                  padding: '0.1rem 0.4rem', fontSize: '0.6rem',
                  background: log.status === 'done' ? 'rgba(139,195,74,0.1)' : 'rgba(212,168,67,0.1)',
                  color: log.status === 'done' ? 'var(--primary)' : 'var(--sand-gold)',
                  border: `1px solid ${log.status === 'done' ? 'rgba(139,195,74,0.2)' : 'rgba(212,168,67,0.2)'}`,
                }}>
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {sensorData.length === 0 && ndviData.length === 0 && irrigationLogs.length === 0 && (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
          Aucune donnée disponible pour cette parcelle. Connectez des capteurs IoT pour commencer.
        </p>
      )}
        </>
      )}
    </div>
  );
};

/* ── Zone Card with expand ── */
const ZoneCard = ({ zone, delay }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div 
      className={`glass-card animate-slide-up delay-${delay}`}
      style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: '1.2rem' }}>{cropEmojis[zone.crop_type] || cropEmojis.default}</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: "'Playfair Display', serif", color: 'var(--text-bright)' }}>
              {zone.name}
            </h3>
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
            {zone.crop_type} • {zone.area_ha} ha • Créé {new Date(zone.created_at).toLocaleDateString('fr-TN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ padding: '0.4rem', borderRadius: '10px', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', border: '1px solid rgba(139,195,74,0.15)' }}>
          <Map size={16} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span className="badge badge-primary">{cropEmojis[zone.crop_type] || '🌱'} {zone.crop_type}</span>
        <span className="badge badge-gold">{zone.area_ha} ha</span>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="btn btn-outline"
        style={{ width: '100%', fontSize: '0.75rem', justifyContent: 'center', borderRadius: 'var(--radius-full)', padding: '0.5rem' }}
      >
        {expanded ? <><ChevronDown size={14} /> Masquer les détails</> : <><ChevronRight size={14} /> Voir les données en détail</>}
      </button>

      {expanded && <FieldDetail field={zone} />}
    </div>
  );
};

/* ═══════════════════════════════════════
   MAIN FIELDS DASHBOARD 
   ═══════════════════════════════════════ */
const FieldsDashboard = () => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newField, setNewField] = useState({ name: '', crop_type: 'Tomato', area_ha: '', polygon: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCrop, setFilterCrop] = useState('all');

  const fetchFields = () => {
    setLoading(true);
    fieldService.getFields()
      .then(res => { setZones(res.data); setLoading(false); })
      .catch(err => { console.error("Error fetching fields:", err); setLoading(false); });
  };

  useEffect(() => { fetchFields(); }, []);

  const handleCreateField = (e) => {
    e.preventDefault();
    fieldService.createField({
      ...newField, area_ha: parseFloat(newField.area_ha),
      farm_id: '88888888-4444-4444-4444-121212121212', 
      polygon_geojson: JSON.stringify(newField.polygon)
    }).then(() => {
      setIsModalOpen(false);
      setNewField({ name: '', crop_type: 'Tomato', area_ha: '', polygon: [] });
      fetchFields();
    }).catch(err => alert("Erreur: " + err.message));
  };

  // Filtering
  const cropTypes = [...new Set(zones.map(z => z.crop_type))];
  const filtered = zones.filter(z => {
    const matchSearch = z.name.toLowerCase().includes(searchTerm.toLowerCase()) || z.crop_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCrop = filterCrop === 'all' || z.crop_type === filterCrop;
    return matchSearch && matchCrop;
  });
  const totalArea = zones.reduce((s, z) => s + (z.area_ha || 0), 0);

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)',
    padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', color: 'var(--text-light)',
    fontSize: '0.9rem', width: '100%', outline: 'none', transition: 'border-color 0.3s, box-shadow 0.3s', fontFamily: "'Inter', sans-serif",
  };

  if (loading && zones.length === 0) {
    return (
      <div style={{ padding: '4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div className="floating"><Leaf size={40} color="var(--primary)" /></div>
        <p style={{ color: 'var(--text-muted)' }}>Chargement des parcelles...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🌾</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--olive)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '600' }}>Gestion foncière</span>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: '700', color: 'var(--text-bright)' }}>
            Parcelles & <span className="gradient-text-warm">Exploitations</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            {zones.length} parcelle{zones.length !== 1 ? 's' : ''} • {totalArea.toFixed(1)} ha total • {cropTypes.length} culture{cropTypes.length !== 1 ? 's' : ''} différente{cropTypes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-warm" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Nouvelle Parcelle
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="🔍 Rechercher une parcelle..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          style={{ ...inputStyle, maxWidth: '300px', padding: '0.6rem 1rem', fontSize: '0.85rem' }}
        />
        <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--glass)', padding: '0.25rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--glass-border)' }}>
          <button
            onClick={() => setFilterCrop('all')}
            className={filterCrop === 'all' ? 'btn btn-primary' : 'btn'}
            style={{ padding: '0.35rem 0.8rem', fontSize: '0.72rem', borderRadius: 'var(--radius-full)', background: filterCrop === 'all' ? undefined : 'transparent', color: filterCrop === 'all' ? undefined : 'var(--text-muted)' }}
          >
            Tous
          </button>
          {cropTypes.map(ct => (
            <button key={ct}
              onClick={() => setFilterCrop(ct)}
              className={filterCrop === ct ? 'btn btn-primary' : 'btn'}
              style={{ padding: '0.35rem 0.8rem', fontSize: '0.72rem', borderRadius: 'var(--radius-full)', background: filterCrop === ct ? undefined : 'transparent', color: filterCrop === ct ? undefined : 'var(--text-muted)' }}
            >
              {cropEmojis[ct] || '🌱'} {ct}
            </button>
          ))}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-scale-in" style={{ width: '900px', maxWidth: '95vw', background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--glass-border)', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(199,91,57,0.08), rgba(212,168,67,0.05))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🌿</span>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-bright)' }}>Nouvelle Parcelle</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateField} style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem', display: 'block', fontWeight: '600' }}>Nom de la parcelle</label>
                  <input type="text" placeholder="ex: Oliveraie de Sfax" required value={newField.name} onChange={e => setNewField({...newField, name: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem', display: 'block', fontWeight: '600' }}>Type de culture</label>
                  <select value={newField.crop_type} onChange={e => setNewField({...newField, crop_type: e.target.value})} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="Tomato">🍅 Tomate</option>
                    <option value="Grape">🍇 Vigne</option>
                    <option value="Potato">🥔 Pomme de terre</option>
                    <option value="Apple">🍎 Pommier</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem', display: 'block', fontWeight: '600' }}>Surface (hectares)</label>
                  <input type="number" step="0.1" placeholder="ex: 5.2" required value={newField.area_ha} onChange={e => setNewField({...newField, area_ha: e.target.value})} style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline" style={{ flex: 1, borderRadius: 'var(--radius-full)' }}>Annuler</button>
                  <button type="submit" className="btn btn-warm" style={{ flex: 1, borderRadius: 'var(--radius-full)' }} disabled={newField.polygon.length < 3}><Plus size={16} /> Créer</button>
                </div>
                {newField.polygon.length < 3 && (
                  <p style={{ fontSize: '0.65rem', color: 'var(--terracotta)', textAlign: 'center' }}>Veuillez délimiter la parcelle sur la carte (min. 3 points)</p>
                )}
              </div>
              <div style={{ height: '400px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                <FieldMap 
                  isEditable={true} 
                  initialPolygon={newField.polygon} 
                  onPolygonChange={(poly) => setNewField({...newField, polygon: poly})} 
                />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Zone Cards */}
      <div className="grid-cols-3">
        {filtered.map((z, i) => <ZoneCard key={z.id} zone={z} delay={Math.min(i + 1, 6)} />)}
      </div>

      {filtered.length === 0 && zones.length > 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <p>Aucune parcelle ne correspond à "{searchTerm || filterCrop}"</p>
        </div>
      )}

      {zones.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌾</div>
          <h3 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '0.5rem', color: 'var(--text-light)' }}>Aucune parcelle</h3>
          <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>Commencez par ajouter votre première zone d'exploitation</p>
          <button className="btn btn-warm" onClick={() => setIsModalOpen(true)}><Plus size={16} /> Créer ma première parcelle</button>
        </div>
      )}
    </div>
  );
};

export default FieldsDashboard;
