import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Download, TrendingUp, Droplets, Thermometer, Activity, ChevronDown, RefreshCw, Leaf } from 'lucide-react';
import { fieldService, sensorService, ndviService, alertService, diseaseService } from '../services/api';

const cropEmojis = { Tomato: '🍅', Grape: '🍇', Apple: '🍎', Corn: '🌽', Olive: '🫒', default: '🌱' };

/* ── Custom Tooltip ── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '0.7rem 1rem', boxShadow: 'var(--shadow-md)' }}>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: '0.8rem', fontWeight: '600' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

/* ── Summary Card ── */
const SummaryCard = ({ icon: Icon, label, value, unit, color, subtext }) => (
  <div style={{
    background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', padding: '1rem 1.2rem',
    border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '160px',
  }}>
    <div style={{
      padding: '0.6rem', borderRadius: '12px',
      background: `linear-gradient(135deg, ${color}18, ${color}08)`, color,
      border: `1px solid ${color}25`, display: 'flex',
    }}>
      <Icon size={20} />
    </div>
    <div>
      <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bright)', fontFamily: "'Playfair Display', serif" }}>
        {value}<span style={{ fontSize: '0.7rem', marginLeft: '3px', color: 'var(--text-dim)', fontFamily: "'Inter'", fontWeight: '400' }}>{unit}</span>
      </div>
      {subtext && <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>{subtext}</div>}
    </div>
  </div>
);

const COLORS = ['#8BC34A', '#4EADD5', '#C75B39', '#D4A843', '#6B8E23', '#a855f7'];

/* ═══════════════════════════════════════
   ANALYTICS PAGE
   ═══════════════════════════════════════ */
const Analytics = () => {
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [telemetryData, setTelemetryData] = useState([]);
  const [ndviData, setNdviData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingField, setLoadingField] = useState(false);
  const [days, setDays] = useState(7);

  // Initial fetch all fields + global data
  useEffect(() => {
    const init = async () => {
      try {
        const [fieldRes, alertRes, scanRes] = await Promise.allSettled([
          fieldService.getFields(),
          alertService.getAlerts(),
          diseaseService.getScans(),
        ]);
        if (fieldRes.status === 'fulfilled') {
          setFields(fieldRes.value.data);
          if (fieldRes.value.data.length > 0) {
            setSelectedFieldId(fieldRes.value.data[0].id);
          }
        }
        if (alertRes.status === 'fulfilled') setAlerts(alertRes.value.data);
        if (scanRes.status === 'fulfilled') setScans(scanRes.value.data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    init();
  }, []);

  // Fetch sensor + NDVI for selected field
  useEffect(() => {
    if (!selectedFieldId || selectedFieldId.startsWith('aaa') || selectedFieldId.startsWith('ddd')) {
      setLoadingField(false);
      setTelemetryData([]);
      setNdviData([]);
      return;
    }
    const fetchFieldData = async () => {
      setLoadingField(true);
      const [sensorRes, ndviRes] = await Promise.allSettled([
        sensorService.getHistory(selectedFieldId, days),
        ndviService.getHistory(selectedFieldId, 12),
      ]);
      if (sensorRes.status === 'fulfilled') {
        const fmt = sensorRes.value.data.map(d => ({
          time: new Date(d.created_at).toLocaleDateString('fr', { day: '2-digit', month: 'short' }) + ' ' +
                new Date(d.created_at).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }),
          humidity: Math.round(d.soil_moisture),
          temp: Math.round(d.temperature_c * 10) / 10,
          airHumidity: Math.round(d.humidity_pct),
        })).reverse();
        setTelemetryData(fmt);
      } else {
        setTelemetryData([]);
      }
      if (ndviRes.status === 'fulfilled') {
        const fmt = ndviRes.value.data.map(d => ({
          date: new Date(d.captured_at).toLocaleDateString('fr', { day: '2-digit', month: 'short' }),
          ndvi: d.ndvi_value, status: d.status,
        })).reverse();
        setNdviData(fmt);
      } else {
        setNdviData([]);
      }
      setLoadingField(false);
    };
    fetchFieldData();
  }, [selectedFieldId, days]);

  const handleExportCSV = () => {
    if (telemetryData.length === 0) return;
    const selectedField = fields.find(f => f.id === selectedFieldId);
    const headers = "Time,SoilMoisture(%),Temperature(°C),AirHumidity(%)\n";
    const rows = telemetryData.map(d => `${d.time},${d.humidity},${d.temp},${d.airHumidity}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', ''); a.setAttribute('href', url);
    a.setAttribute('download', `telemetry_${selectedField?.name || 'data'}.csv`);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // Computed stats
  const selectedField = fields.find(f => f.id === selectedFieldId);
  const avgHum = telemetryData.length > 0 ? Math.round(telemetryData.reduce((s, d) => s + d.humidity, 0) / telemetryData.length) : '--';
  const avgTemp = telemetryData.length > 0 ? (telemetryData.reduce((s, d) => s + d.temp, 0) / telemetryData.length).toFixed(1) : '--';
  const maxTemp = telemetryData.length > 0 ? Math.max(...telemetryData.map(d => d.temp)) : '--';
  const minTemp = telemetryData.length > 0 ? Math.min(...telemetryData.map(d => d.temp)) : '--';
  const openAlerts = alerts.filter(a => a.status === 'open').length;

  // Disease pie chart data
  const diseaseGroups = scans.reduce((acc, s) => {
    const key = s.predicted_disease || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(diseaseGroups).map(([name, value]) => ({ name, value }));

  // Alerts by severity
  const severityData = ['critical', 'high', 'medium', 'low'].map(sev => ({
    severity: sev.charAt(0).toUpperCase() + sev.slice(1),
    count: alerts.filter(a => a.severity === sev).length,
  })).filter(d => d.count > 0);

  if (loading) {
    return (
      <div style={{ padding: '4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div className="floating"><TrendingUp size={40} color="var(--primary)" /></div>
        <p style={{ color: 'var(--text-muted)' }}>Chargement des analytics...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📊</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--sky-blue)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '600' }}>Télémétrie capteurs</span>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: '700', color: 'var(--text-bright)' }}>
            Analytics & <span className="gradient-text">Données en Direct</span>
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Field selector */}
          <select
            value={selectedFieldId || ''}
            onChange={e => setSelectedFieldId(e.target.value)}
            style={{
              background: 'var(--glass)', border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-full)', padding: '0.5rem 1rem',
              color: 'var(--text-light)', fontSize: '0.8rem', cursor: 'pointer', outline: 'none', fontFamily: "'Inter'",
            }}
          >
            {fields.map(f => (
              <option key={f.id} value={f.id}>{cropEmojis[f.crop_type] || '🌱'} {f.name}</option>
            ))}
          </select>
          {/* Time range */}
          <div style={{ display: 'flex', gap: '0.2rem', background: 'var(--glass)', padding: '0.2rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--glass-border)' }}>
            {[{ d: 1, label: '24h' }, { d: 7, label: '7j' }, { d: 14, label: '14j' }, { d: 30, label: '30j' }].map(opt => (
              <button key={opt.d}
                onClick={() => setDays(opt.d)}
                className={days === opt.d ? 'btn btn-primary' : 'btn'}
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.7rem', borderRadius: 'var(--radius-full)', background: days === opt.d ? undefined : 'transparent', color: days === opt.d ? undefined : 'var(--text-muted)' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button className="btn btn-outline" style={{ fontSize: '0.75rem', borderRadius: 'var(--radius-full)', padding: '0.45rem 1rem' }} onClick={handleExportCSV}>
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <SummaryCard icon={Droplets} label="Humidité Moy." value={avgHum} unit="%" color="#4EADD5" subtext={`${telemetryData.length} mesures`} />
        <SummaryCard icon={Thermometer} label="Temp. Moy." value={avgTemp} unit="°C" color="#C75B39" subtext={`Min ${minTemp}° / Max ${maxTemp}°`} />
        <SummaryCard icon={Activity} label="Alertes ouvertes" value={openAlerts} unit={`/ ${alerts.length}`} color="#e74c3c" />
        <SummaryCard icon={Leaf} label="Parcelle" value={selectedField?.name || '--'} unit="" color="#8BC34A" subtext={`${selectedField?.crop_type || ''} · ${selectedField?.area_ha || ''} ha`} />
      </div>

      {loadingField && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="floating"><Activity size={24} color="var(--primary)" /></div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Chargement des données pour {selectedField?.name}...</p>
        </div>
      )}

      {!loadingField && (
        <>
          {/* Main Charts */}
          <div className="grid-cols-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
            {/* Humidity Chart */}
            <div className="glass-card animate-slide-up delay-1" style={{ height: '380px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontFamily: "'Playfair Display', serif", fontWeight: '700', color: 'var(--text-bright)' }}>💧 Humidité du Sol</h3>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Pourcentage volumique — {days} derniers jours</span>
                </div>
                <div className="badge badge-primary"><div className="status-dot online" style={{ width: '5px', height: '5px' }}></div> {avgHum}% moy</div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {telemetryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={telemetryData}>
                      <defs>
                        <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4EADD5" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#4EADD5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="time" stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="humidity" name="Humidité" stroke="#4EADD5" fillOpacity={1} fill="url(#colorHum)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#4EADD5', stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>Aucune donnée capteur</div>}
              </div>
            </div>

            {/* Temperature Chart */}
            <div className="glass-card animate-slide-up delay-2" style={{ height: '380px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontFamily: "'Playfair Display', serif", fontWeight: '700', color: 'var(--text-bright)' }}>🌡️ Température</h3>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>°C — {days} derniers jours</span>
                </div>
                <div className="badge badge-warm"><div className="status-dot warning" style={{ width: '5px', height: '5px' }}></div> {avgTemp}°C moy</div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {telemetryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={telemetryData}>
                      <defs>
                        <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#C75B39" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#C75B39" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="time" stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="temp" name="Temp" stroke="#C75B39" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#C75B39', stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>Aucune donnée capteur</div>}
              </div>
            </div>
          </div>

          {/* Second row: NDVI + Disease Pie + Alerts Bar */}
          <div className="grid-cols-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginTop: '1.5rem' }}>
            {/* NDVI Chart */}
            <div className="glass-card animate-slide-up delay-3" style={{ height: '320px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontFamily: "'Playfair Display', serif", fontWeight: '700', color: 'var(--text-bright)' }}>🛰️ Indice NDVI</h3>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Santé végétale par satellite — 12 semaines</span>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {ndviData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ndviData}>
                      <defs>
                        <linearGradient id="colorNdvi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6B8E23" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6B8E23" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} domain={[0, 1]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="ndvi" name="NDVI" stroke="#6B8E23" fillOpacity={1} fill="url(#colorNdvi)" strokeWidth={2} dot={{ r: 3, fill: '#6B8E23' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: '0.85rem' }}>Aucune donnée NDVI disponible</div>}
              </div>
            </div>

            {/* Disease distribution pie */}
            {pieData.length > 0 && (
              <div className="glass-card animate-slide-up delay-4" style={{ height: '320px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontFamily: "'Playfair Display', serif", fontWeight: '700', color: 'var(--text-bright)' }}>🔬 Distribution Maladies</h3>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{scans.length} scan(s) analysé(s)</span>
                </div>
                <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
                  <ResponsiveContainer width="60%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '0.8rem' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                    {pieData.map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[i % COLORS.length] }}></div>
                        <span style={{ color: 'var(--text-muted)', flex: 1 }}>{d.name}</span>
                        <span style={{ color: 'var(--text-light)', fontWeight: '700' }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Alerts by severity */}
            {severityData.length > 0 && (
              <div className="glass-card animate-slide-up delay-5" style={{ height: '320px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontFamily: "'Playfair Display', serif", fontWeight: '700', color: 'var(--text-bright)' }}>⚠️ Alertes par Sévérité</h3>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{alerts.length} alerte(s) total</span>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={severityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="severity" stroke="var(--text-dim)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-dim)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '0.8rem' }} />
                      <Bar dataKey="count" name="Alertes" fill="var(--terracotta)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Air humidity if data exists */}
          {telemetryData.length > 0 && (
            <div className="glass-card animate-slide-up" style={{ height: '300px', display: 'flex', flexDirection: 'column', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontFamily: "'Playfair Display', serif", fontWeight: '700', color: 'var(--text-bright)' }}>🌬️ Humidité de l'Air & Température</h3>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Comparaison multi-capteurs</span>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={telemetryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="time" stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="airHumidity" name="Humidité Air %" stroke="#8BC34A" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="temp" name="Temp °C" stroke="#C75B39" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    <Line type="monotone" dataKey="humidity" name="Sol %" stroke="#4EADD5" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Analytics;
