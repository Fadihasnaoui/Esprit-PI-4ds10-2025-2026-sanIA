import React, { useState, useEffect } from 'react';
import { Droplets, Thermometer, Activity, PawPrint, Bug, AlertTriangle, RefreshCw, Leaf, Wind, Volume2 } from 'lucide-react';
import { dashboardService, sensorService } from '../services/api';
import { useTranslation } from '../i18n';
import { createSpeechUtterance, warmSpeechVoices } from '../utils/speech';

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

const speakText = async (text, interrupt = true, language = 'fr') => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
  if (interrupt) window.speechSynthesis.cancel();
  const utterance = await createSpeechUtterance(text, language);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
};

const hasRealValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  const normalized = String(value).trim();
  return normalized !== '' && normalized !== '--' && normalized !== '-' && normalized.toLowerCase() !== 'nan';
};

const playPriorityTone = () => {
  if (typeof window === 'undefined') return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(520, audio.currentTime + 0.28);
    gain.gain.setValueAtTime(0.001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.11, audio.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.32);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.34);
  } catch {
    // Browsers may block audio until the farmer clicks once. The spoken alert remains the fallback.
  }
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

/* Alert Row */
const AlertRow = ({ alert, onOpen }) => {
  const { t } = useTranslation();
  const sevColor = {
    critical: 'var(--terracotta)',
    high: '#e67e22',
    medium: 'var(--sand-gold)',
    low: 'var(--primary)',
  };
  const color = sevColor[alert.severity] || 'var(--sand-gold)';

  return (
    <div className="glass-card" style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{
        padding: '0.5rem', borderRadius: '10px',
        background: `linear-gradient(135deg, ${color}18, transparent)`,
        color,
        border: `1px solid ${color}30`,
        display: 'flex',
      }}>
        <AlertTriangle size={18} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-bright)' }}>{alert.type}</span>
          <span className="badge" style={{
            padding: '0.1rem 0.5rem', fontSize: '0.6rem',
            background: `${color}15`,
            color,
            border: `1px solid ${color}25`,
          }}>
            {alert.severity}
          </span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          {alert.note || t('dashboard.noDetails')} - {new Date(alert.created_at).toLocaleDateString('fr-TN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <button
        onClick={() => onOpen(alert)}
        className="btn btn-outline"
        type="button"
        style={{ padding: '0.35rem 0.8rem', fontSize: '0.7rem', borderRadius: 'var(--radius-full)' }}
      >
        {t('dashboard.view')}
      </button>
    </div>
  );
};
/* ── Disease Scan Row ── */
const ScanRow = ({ scan }) => {
  const { t } = useTranslation();
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
            {(scan.confidence * 100).toFixed(0)}% {t('dashboard.confidence')}
          </span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          {t('dashboard.crop')}: {scan.crop_type} • {new Date(scan.created_at).toLocaleDateString('fr-TN', { day: 'numeric', month: 'short' })}
        </p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════
   MAIN DASHBOARD COMPONENT 
   ═══════════════════════════════════════ */
const Dashboard = ({ onNavigate }) => {
  const { t, language } = useTranslation();
  const [alerts, setAlerts] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [fields, setFields] = useState([]);
  const [latestSensor, setLatestSensor] = useState(null);
  const [latestWeather, setLatestWeather] = useState(null);
  const [scans, setScans] = useState([]);
  const [farmSummary, setFarmSummary] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(() => localStorage.getItem('sania-selected-field-id'));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    warmSpeechVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = warmSpeechVoices;
    }
  }, []);

  const fetchAll = async () => {
    try {
      const fieldId = selectedFieldId || localStorage.getItem('sania-selected-field-id');
      const summaryRes = await dashboardService.getFarmSummary(fieldId);
      const summary = summaryRes.data;
      const activeFieldId = summary.selected_field_id || fieldId;
      setFarmSummary(summary);
      if (summary.selected_field_id) {
        localStorage.setItem('sania-selected-field-id', summary.selected_field_id);
        setSelectedFieldId(summary.selected_field_id);
      }
      setFields(summary.selected_field ? [summary.selected_field] : []);
      setLatestSensor(summary.sensor);
      setLatestWeather(summary.weather || null);
      if (activeFieldId) {
        try {
          const sensorRes = await sensorService.getHistory(activeFieldId, 7);
          const sortedReadings = [...(sensorRes.data || [])].sort(
            (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
          );
          setLatestSensor(sortedReadings[0] || summary.sensor || null);
        } catch {
          setLatestSensor(summary.sensor || null);
        }
      }
      if (activeFieldId) {
        try {
          const weatherRes = await sensorService.getFieldWeather(activeFieldId);
          setLatestWeather(weatherRes.data || summary.weather || null);
        } catch {
          if (summary.selected_field?.farm_id) {
            try {
              const weatherRes = await sensorService.getWeather(summary.selected_field.farm_id);
              setLatestWeather(weatherRes.data || summary.weather || null);
            } catch {
              setLatestWeather(summary.weather || null);
            }
          } else {
            setLatestWeather(summary.weather || null);
          }
        }
      }
      setAnimals(Array.from({ length: summary.livestock?.total || 0 }, (_, index) => ({ id: index })));
      setScans(summary.latest_scan ? [summary.latest_scan] : []);
      setAlerts((summary.notifications || []).map((item) => ({
        ...item,
        id: item.source === 'alert' ? item.source_id : item.id,
        type: item.title || item.type,
        note: item.message,
        status: 'open',
        resolvable: item.source === 'alert',
      })));
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, [selectedFieldId]);

  useEffect(() => {
    const handleSelectedFieldChanged = (event) => {
      setSelectedFieldId(event.detail || localStorage.getItem('sania-selected-field-id'));
    };
    window.addEventListener('sania-selected-field-changed', handleSelectedFieldChanged);
    return () => window.removeEventListener('sania-selected-field-changed', handleSelectedFieldChanged);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const handleOpenAlert = (alert) => {
    const source = alert.source || alert.type || '';
    if (source === 'livestock' || source.startsWith('animal')) {
      onNavigate?.('animals');
    } else if (source === 'ndvi' || source === 'field_ndvi') {
      onNavigate?.('satellite');
    } else if (source === 'soil_health' || source === 'sensor' || source === 'weather' || source.includes('temperature') || source.includes('moisture')) {
      onNavigate?.('analytics');
    } else if (source === 'disease_scan') {
      onNavigate?.('knowledge');
    } else {
      onNavigate?.(alert.field_id ? 'fields' : 'knowledge');
    }
  };
  const openAlerts = alerts.filter(a => a.status === 'open');
  const selectedField = farmSummary?.selected_field;
  const weather = latestWeather || farmSummary?.weather || {};
  const windSpeed = weather.windspeed ?? weather.wind_speed_10m ?? weather.wind_speed ?? null;
  const weatherSoilMoisture = weather.soil_moisture_surface_pct ?? weather.soil_moisture_rootzone_pct ?? null;
  const ndvi = farmSummary?.ndvi;
  const soilIndicators = farmSummary?.soil_health?.indicators || {};
  const soilMoisture = soilIndicators.soil_moisture_pct;
  const soilMoistureSource = soilIndicators.soil_moisture_source;
  const sensorSoilMoisture = latestSensor?.soil_moisture;
  const sensorTemperature = latestSensor?.temperature_c;
  const soilMoistureText =
    weatherSoilMoisture != null
      ? t('common.openMeteoParcel')
      : sensorSoilMoisture != null
      ? t('common.latestSensor')
      : soilMoistureSource === 'satellite_ndvi_evi'
      ? t('dashboard.soilSatellite')
      : soilMoistureSource === 'sensor'
        ? t('dashboard.soilSensor')
        : t('dashboard.soilUnavailable');
  const livestock = farmSummary?.livestock || {};
  const totalArea = selectedField?.area_ha || fields.reduce((sum, f) => sum + (f.area_ha || 0), 0);
  const healthyScans = scans.filter(s => s.predicted_disease?.toLowerCase().includes('healthy'));
  const diseaseRate = scans.length > 0 ? Math.round((healthyScans.length / scans.length) * 100) : 100;

  const animatedAlerts = useCounter(openAlerts.length);
  const animatedAnimals = useCounter(livestock.total ?? animals.length);

  const spokenAlertCount = (count) => {
    if (language === 'en') {
      if (count === 0) return 'No active alerts';
      if (count === 1) return 'One active alert';
      return `${count} active alerts`;
    }
    if (language === 'tn') {
      if (count === 0) return 'ما فماش تنبيهات محلولة';
      if (count === 1) return 'فما تنبيه واحد';
      if (count === 2) return 'فما زوز تنبيهات';
      return `فما ${count} تنبيهات`;
    }
    if (count === 0) return 'Aucune alerte active';
    if (count === 1) return 'Une alerte active';
    if (count === 2) return 'Deux alertes actives';
    return `${count} alertes actives`;
  };

  const buildDashboardSummary = () => {
    const parts = [];
    if (hasRealValue(selectedField?.name)) {
      if (language === 'en') parts.push(`Field ${selectedField.name}`);
      else if (language === 'tn') parts.push(`البقعة ${selectedField.name}`);
      else parts.push(`Champ ${selectedField.name}`);
    }

    if (hasRealValue(ndvi?.ndvi_value)) {
      parts.push(`NDVI ${Number(ndvi.ndvi_value).toFixed(2)}`);
    }

    const moistureValue = weatherSoilMoisture ?? sensorSoilMoisture ?? soilMoisture;
    if (hasRealValue(moistureValue)) {
      if (language === 'en') parts.push(`Soil moisture ${Math.round(moistureValue)} percent`);
      else if (language === 'tn') parts.push(`رطوبة التربة ${Math.round(moistureValue)} بالمية`);
      else parts.push(`Humidite sol ${Math.round(moistureValue)} pour cent`);
    }

    const temperatureValue = weather.temperature ?? sensorTemperature;
    if (hasRealValue(temperatureValue)) {
      const value = Math.round(Number(temperatureValue) * 10) / 10;
      if (language === 'en') parts.push(`Weather temperature ${value} degrees`);
      else if (language === 'tn') parts.push(`درجة الحرارة ${value} درجة`);
      else parts.push(`Temperature meteo ${value} degres`);
    }

    if (hasRealValue(windSpeed)) {
      const value = Math.round(Number(windSpeed) * 10) / 10;
      if (language === 'en') parts.push(`Wind ${value} kilometers per hour`);
      else if (language === 'tn') parts.push(`الريح ${value} كيلومتر في الساعة`);
      else parts.push(`Vent ${value} kilometres par heure`);
    }

    if (openAlerts.length > 0 || parts.length > 0) {
      parts.push(spokenAlertCount(openAlerts.length));
    }

    if (parts.length === 0) {
      if (language === 'en') return 'No live farm values are available yet.';
      if (language === 'tn') return 'ما فماش داتا حية متوفرة توة.';
      return 'Aucune donnee terrain disponible pour le moment.';
    }

    return `${parts.join('. ')}.`;
  };

  const readDashboardSummary = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      return;
    }
    speakText(buildDashboardSummary(), true, language);
  };

  useEffect(() => {
    const handleReadDashboard = () => readDashboardSummary();
    window.addEventListener('sania-read-dashboard', handleReadDashboard);
    return () => window.removeEventListener('sania-read-dashboard', handleReadDashboard);
  }, [
    selectedField?.name,
    ndvi?.ndvi_value,
    weatherSoilMoisture,
    sensorSoilMoisture,
    soilMoisture,
    weather.temperature,
    sensorTemperature,
    windSpeed,
    openAlerts.length,
    language,
  ]);

  useEffect(() => {
    const priorityAlert = openAlerts.find((alert) => {
      const severity = String(alert.severity || '').toLowerCase();
      const source = String(alert.source || alert.type || '').toLowerCase();
      const text = `${alert.type || ''} ${alert.note || ''}`.toLowerCase();
      return severity === 'critical'
        || (severity === 'high' && source.includes('livestock'))
        || (severity === 'high' && text.includes('temperature animale'));
    });

    if (!priorityAlert || typeof window === 'undefined') return;

    const alertId = priorityAlert.id || priorityAlert.source_id || `${priorityAlert.type}-${priorityAlert.created_at}`;
    const storageKey = `sania-spoken-alert-${alertId}`;
    if (window.sessionStorage.getItem(storageKey)) return;

    window.sessionStorage.setItem(storageKey, 'true');
    playPriorityTone();
    window.setTimeout(() => {
      const text = `${priorityAlert.type || ''} ${priorityAlert.note || ''}`.toLowerCase();
      const message = text.includes('temperature animale')
        ? (language === 'en'
          ? 'Warning: high animal temperature'
          : language === 'tn'
          ? 'رد بالك: حرارة الحيوان طالعة'
          : 'Attention: temperature animale elevee')
        : (language === 'en'
          ? `Warning: ${priorityAlert.type || 'critical alert'}. ${priorityAlert.note || ''}`
          : language === 'tn'
          ? `رد بالك: ${priorityAlert.type || 'تنبيه مهم'}. ${priorityAlert.note || ''}`
          : `Attention: ${priorityAlert.type || 'alerte critique'}. ${priorityAlert.note || ''}`);
      speakText(message, false, language);
    }, 380);
  }, [alerts, language]);

  if (loading) {
    return (
      <section style={{ padding: '5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        <div className="floating"><Leaf size={40} color="var(--primary)" /></div>
        <p style={{ color: 'var(--text-muted)' }}>{t('dashboard.loading')}</p>
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
            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '600' }}>{t('dashboard.kicker')}</span>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', fontWeight: '700', letterSpacing: '-0.5px', color: 'var(--text-bright)' }}>
            {t('dashboard.titleA')} <span className="gradient-text-warm">{t('dashboard.titleB')}</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.4rem' }}>
            {selectedField
              ? `${selectedField.name} • ${selectedField.crop_type || t('common.fieldFallback')} • ${Number(totalArea || 0).toFixed(1)} ha`
              : t('common.noField')} • {livestock.total ?? animals.length} {t('dashboard.animals', { plural: (livestock.total ?? animals.length) !== 1 ? 's' : '' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={readDashboardSummary}
            type="button"
            aria-label="Lire le resume vocal du domaine"
            title="Lire le resume vocal du domaine"
            style={{
              padding: '0.5rem', borderRadius: '10px', border: '1px solid var(--glass-border)',
              background: 'var(--glass)', color: 'var(--primary)', cursor: 'pointer', display: 'flex',
              transition: 'all 0.3s',
            }}
          >
            <Volume2 size={16} />
          </button>
          <button
            onClick={handleRefresh}
            type="button"
            aria-label="Actualiser les donnees du dashboard"
            style={{
              padding: '0.5rem', borderRadius: '10px', border: '1px solid var(--glass-border)',
              background: 'var(--glass)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex',
              transition: 'all 0.3s', animation: refreshing ? 'rotate-slow 1s linear infinite' : 'none',
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ───── Stats Grid ───── */}
      <div className="grid-cols-3">
        <StatCard
          icon={Leaf}
          label={t('dashboard.followedField')}
          value={ndvi?.ndvi_value != null ? ndvi.ndvi_value.toFixed(3) : '--'}
          unit="NDVI"
          color="#8BC34A"
          delay={1}
          subtext={selectedField ? `${selectedField.name} • ${selectedField.crop_type || t('common.fieldFallback')}` : t('dashboard.selectedFieldEmpty')}
        />
        <StatCard 
          icon={Droplets} label={t('dashboard.soilHumidity')}
          value={weatherSoilMoisture != null ? Math.round(weatherSoilMoisture) : (sensorSoilMoisture != null ? Math.round(sensorSoilMoisture) : (soilMoisture != null ? Math.round(soilMoisture) : '--'))} unit="%"
          color="#4EADD5" delay={2}
          subtext={soilMoistureText}
        />
        <StatCard 
          icon={Thermometer} label={t('dashboard.tempWeather')}
          value={weather.temperature != null ? Math.round(weather.temperature * 10) / 10 : (sensorTemperature != null ? Math.round(sensorTemperature * 10) / 10 : '--')} unit="C"
          color="#C75B39" delay={3}
          subtext={weather.temperature != null ? t('common.openMeteoParcel') : (sensorTemperature != null ? t('common.latestSensor') : t('common.unavailableWeather'))}
        />
        <StatCard
          icon={Wind}
          label={t('dashboard.windWeather')}
          value={windSpeed != null ? Math.round(windSpeed * 10) / 10 : '--'}
          unit={windSpeed != null ? 'km/h' : ''}
          color="#6B8E23"
          delay={4}
          subtext={windSpeed != null ? t('common.openMeteoReal') : t('common.unavailableWeather')}
        />
        <StatCard icon={Activity} label={t('dashboard.activeAlerts')} value={animatedAlerts} unit={`/ ${alerts.length} total`} color="#e74c3c" delay={5} trend={openAlerts.length > 3 ? 12 : -5} />
        <StatCard icon={PawPrint} label={t('dashboard.livestock')} value={animatedAnimals} unit={t('dashboard.heads')} color="#D4A843" delay={6} subtext={`${livestock.warnings || 0} ${t('dashboard.attention')} • ${livestock.species_count || 0} ${t('dashboard.species')}`} />
        <StatCard icon={Bug} label={t('dashboard.latestScan')} value={diseaseRate} unit="%" color="#8BC34A" delay={6} trend={diseaseRate >= 80 ? 3 : -8} subtext={farmSummary?.latest_scan ? farmSummary.latest_scan.predicted_disease : t('dashboard.noRecentScan')} />
        
      </div>

      {/* ───── Alerts Section ───── */}
      {alerts.length > 0 && (
        <div data-alert-center style={{ marginTop: '3rem', scrollMarginTop: '110px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} color="var(--terracotta)" />
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-bright)' }}>
                {t('dashboard.alertsCenter')}
              </h3>
              {openAlerts.length > 0 && (
                <span className="badge badge-warm" style={{ marginLeft: '0.3rem' }}>{openAlerts.length} {t('dashboard.active', { plural: openAlerts.length > 1 ? 's' : '' })}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {alerts.slice(0, 5).map((alert, i) => (
              <AlertRow key={alert.id || i} alert={alert} onOpen={handleOpenAlert} />
            ))}
            {alerts.length > 5 && (
              <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', padding: '0.5rem' }}>
                {t('dashboard.moreAlerts', { count: alerts.length - 5 })}
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
                {t('dashboard.diseaseDiagnosis')}
              </h3>
              <span className="badge badge-gold">{scans.length} {t('dashboard.scan', { plural: scans.length > 1 ? 's' : '' })}</span>
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
