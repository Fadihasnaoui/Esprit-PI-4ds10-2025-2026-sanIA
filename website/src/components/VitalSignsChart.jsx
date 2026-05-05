import React, { useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const ACTIVITY_COLOR = {
  EATING:     '#fbbf24',
  WALKING:    '#34d399',
  RUNNING:    '#f87171',
  RUMINATING: '#60a5fa',
  RESTING:    '#818cf8',
};

const ACTIVITY_LABEL = {
  EATING: 'Repas', WALKING: 'Marche', RUNNING: 'Course',
  RUMINATING: 'Rumination', RESTING: 'Repos',
};

/* Normal vital ranges per species (backend already filters, this is for chart annotation) */
const SPECIES_RANGES = {
  Bovin:  { tempLo: 37.5, tempHi: 40.5, bpmLo: 40,  bpmHi: 110 },
  Ovin:   { tempLo: 38.0, tempHi: 41.0, bpmLo: 60,  bpmHi: 125 },
  Caprin: { tempLo: 38.0, tempHi: 41.5, bpmLo: 60,  bpmHi: 130 },
  Cheval: { tempLo: 37.0, tempHi: 39.5, bpmLo: 24,  bpmHi: 64  },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const act = payload[0]?.payload?.activity;
  return (
    <div style={{
      background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', padding: '8px 12px', fontSize: '0.68rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{ color: '#94a3b8', marginBottom: '4px', fontSize: '0.6rem' }}>{label}</div>
      {act && (
        <div style={{
          color: ACTIVITY_COLOR[act] || '#fff', fontSize: '0.6rem',
          fontWeight: 700, marginBottom: '5px', letterSpacing: '1px',
        }}>
          ◉ {ACTIVITY_LABEL[act] || act}
        </div>
      )}
      {payload.map((p, i) => p.value != null && (
        <div key={i} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ opacity: 0.7 }}>{p.name}</span>
          <strong>
            {typeof p.value === 'number'
              ? (p.name.includes('°') ? p.value.toFixed(2) : Math.round(p.value))
              : p.value}
          </strong>
        </div>
      ))}
    </div>
  );
};

const ForecastTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0a1628', border: '1px solid rgba(134,239,172,0.2)',
      borderRadius: '8px', padding: '8px 12px', fontSize: '0.68rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#86efac80', marginBottom: '4px', fontSize: '0.6rem' }}>{label}</div>
      {payload.map((p, i) => p.value != null && (
        <div key={i} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ opacity: 0.7 }}>{p.name}</span>
          <strong>
            {typeof p.value === 'number'
              ? (p.name.includes('°') ? p.value.toFixed(2) : Math.round(p.value))
              : p.value}
          </strong>
        </div>
      ))}
    </div>
  );
};

const ActivityDot = (props) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy || payload?.isForecast) return null;
  const color = ACTIVITY_COLOR[payload?.activity] || 'rgba(255,255,255,0.2)';
  const isLive = payload?.isLive;
  return (
    <circle
      cx={cx} cy={cy}
      r={isLive ? 5 : 2.5}
      fill={color}
      stroke={isLive ? '#fff' : 'none'}
      strokeWidth={isLive ? 1.5 : 0}
    />
  );
};

const VitalSignsChart = ({ telemetryData, selectedId, historicalData = [], forecastData = [], species }) => {

  /* ── Historical data (chronological, last 50 points) ───────────── */
  const histData = useMemo(() => {
    if (!historicalData.length) return [];
    return [...historicalData]
      .reverse()           // DB returns newest-first; reverse to chronological
      .slice(-50)
      .map((d) => {
        const t = new Date(d.time);
        return {
          label: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          bpm:   Number.isFinite(d.heart_rate)   ? Math.round(d.heart_rate)          : null,
          temp:  (d.temperature_c > 20 && d.temperature_c < 50) ? parseFloat(d.temperature_c.toFixed(2)) : null,
          activity: d.activity_level || 'RESTING',
        };
      })
      .filter(d => d.bpm !== null && d.temp !== null);
  }, [historicalData]);

  /* ── Add live WebSocket point ───────────────────────────────────── */
  const chartData = useMemo(() => {
    const live = selectedId ? telemetryData[selectedId] : null;
    if (!live?.heart_rate) return histData;
    return [
      ...histData,
      {
        label:    '● DIRECT',
        bpm:      Math.round(live.heart_rate),
        temp:     (live.temperature_c > 20 && live.temperature_c < 50)
                    ? parseFloat(live.temperature_c.toFixed(2)) : null,
        activity: live.activity_level || 'RESTING',
        isLive:   true,
      },
    ].slice(-50);
  }, [histData, telemetryData, selectedId]);

  /* ── Backend forecast data ──────────────────────────────────────── */
  const fcData = useMemo(() => {
    if (!forecastData.length) return [];
    return forecastData.map((d, idx) => {
      const bpm  = parseFloat((d.heart_rate_pred  || 0).toFixed(1));
      const temp = parseFloat((d.temperature_c_pred || 0).toFixed(2));
      return {
        label:    `+${idx + 1}min`,
        bpm,
        bpmLo:    parseFloat((d.hr_min  || bpm - 2).toFixed(1)),
        bpmHi:    parseFloat((d.hr_max  || bpm + 2).toFixed(1)),
        temp,
        tempLo:   parseFloat((d.t_min   || temp - 0.15).toFixed(2)),
        tempHi:   parseFloat((d.t_max   || temp + 0.15).toFixed(2)),
        isForecast: true,
      };
    });
  }, [forecastData]);

  /* ── Species reference lines ────────────────────────────────────── */
  const ref = SPECIES_RANGES[species] || null;

  /* ── Dynamic Y-axis domains ─────────────────────────────────────── */
  const bpmDomain = useMemo(() => {
    const vals = chartData.map(d => d.bpm).filter(Boolean);
    if (!vals.length) return [ref?.bpmLo ?? 30, ref?.bpmHi ?? 130];
    const lo = Math.max(0, Math.min(...vals) - 15);
    const hi = Math.max(...vals) + 15;
    return [Math.round(lo), Math.round(hi)];
  }, [chartData, ref]);

  const tempDomain = useMemo(() => {
    const vals = chartData.map(d => d.temp).filter(Boolean);
    if (!vals.length) return [ref?.tempLo ?? 37, ref?.tempHi ?? 42];
    const lo = parseFloat((Math.min(...vals) - 0.6).toFixed(1));
    const hi = parseFloat((Math.max(...vals) + 0.6).toFixed(1));
    return [lo, hi];
  }, [chartData, ref]);

  const fcBpmDomain = useMemo(() => {
    const vals = fcData.flatMap(d => [d.bpmLo, d.bpmHi]).filter(Boolean);
    if (!vals.length) return ['auto', 'auto'];
    return [Math.round(Math.min(...vals) - 5), Math.round(Math.max(...vals) + 5)];
  }, [fcData]);

  const fcTempDomain = useMemo(() => {
    const vals = fcData.flatMap(d => [d.tempLo, d.tempHi]).filter(Boolean);
    if (!vals.length) return ['auto', 'auto'];
    return [parseFloat((Math.min(...vals) - 0.3).toFixed(1)), parseFloat((Math.max(...vals) + 0.3).toFixed(1))];
  }, [fcData]);

  const axisStyle = (color) => ({
    fontSize: 8, axisLine: false, tickLine: false,
    tick: { fill: color }, width: 38,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>

      {/* ── Chart 1 : Historical + Live ─────────────────────────────── */}
      <div style={{
        background: 'rgba(0,0,0,0.18)', borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.05)', padding: '12px 4px 10px',
      }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: '6px', paddingLeft: '10px' }}>
          <span style={{ color: '#388bfd' }}>Temp (°C)</span>
          <span style={{ color: '#475569' }}> · </span>
          <span style={{ color: '#f85149' }}>BPM</span>
          <span style={{ color: '#475569', fontWeight: 400 }}> — Historique & Direct</span>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={190}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 45, left: 2, bottom: 0 }}>
              <defs>
                <linearGradient id="bpmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f85149" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f85149" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="label" fontSize={8} axisLine={false} tickLine={false}
                tick={{ fill: '#4b5563' }} interval="preserveStartEnd"
              />
              <YAxis yAxisId="bpm"  orientation="right" domain={bpmDomain}  unit=" bpm" {...axisStyle('#f8514990')} />
              <YAxis yAxisId="temp" orientation="left"  domain={tempDomain} unit="°C"   {...axisStyle('#388bfd90')} tickCount={5} />
              <Tooltip content={<CustomTooltip />} />

              {/* Normal range reference lines for the selected species */}
              {ref && <>
                <ReferenceLine yAxisId="bpm"  y={ref.bpmHi}  stroke="#f8514930" strokeDasharray="4 2" />
                <ReferenceLine yAxisId="bpm"  y={ref.bpmLo}  stroke="#4ade8030" strokeDasharray="4 2" />
                <ReferenceLine yAxisId="temp" y={ref.tempHi} stroke="#f8514930" strokeDasharray="4 2" />
                <ReferenceLine yAxisId="temp" y={ref.tempLo} stroke="#4ade8030" strokeDasharray="4 2" />
              </>}

              <Area
                yAxisId="bpm" type="monotone" dataKey="bpm"
                stroke="none" fill="url(#bpmGrad)" connectNulls
              />
              <Line
                yAxisId="bpm" type="monotone" dataKey="bpm"
                name="BPM" stroke="#f85149" strokeWidth={2}
                dot={<ActivityDot />} activeDot={{ r: 5, fill: '#f85149' }}
                connectNulls
              />
              <Line
                yAxisId="temp" type="monotone" dataKey="temp"
                name="Temp °C" stroke="#388bfd" strokeWidth={2}
                dot={false} activeDot={{ r: 4, fill: '#388bfd' }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '190px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#475569', fontSize: '0.75rem' }}>
            <div style={{ width: '32px', height: '32px', border: '2px solid #f85149', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            En attente de données télémétriques…
          </div>
        )}

        {/* Activity legend */}
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', paddingLeft: '10px', marginTop: '6px' }}>
          {Object.entries(ACTIVITY_COLOR).map(([act, col]) => (
            <div key={act} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.55rem', color: '#4b5563' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: col }} />
              {ACTIVITY_LABEL[act]}
            </div>
          ))}
          {ref && (
            <div style={{ display: 'flex', gap: '0.6rem', marginLeft: 'auto', paddingRight: '4px' }}>
              <div style={{ fontSize: '0.5rem', color: '#4ade8070' }}>— seuil bas</div>
              <div style={{ fontSize: '0.5rem', color: '#f8514970' }}>— seuil haut</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Chart 2 : Backend IA Forecast ───────────────────────────── */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(134,239,172,0.05) 0%, rgba(0,0,0,0.1) 100%)',
        borderRadius: '12px', border: '1px solid rgba(134,239,172,0.2)',
        padding: '12px 4px 10px',
      }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#86efac', marginBottom: '6px', paddingLeft: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '6px', height: '6px', background: '#86efac', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
          MODULE IA — PROJECTION COURT TERME
          <span style={{ fontWeight: 400, color: '#86efac60', fontSize: '0.6rem' }}>bandes = intervalle de confiance</span>
        </div>

        {fcData.length > 0 ? (
          <ResponsiveContainer width="100%" height={170}>
            <ComposedChart data={fcData} margin={{ top: 8, right: 45, left: 2, bottom: 0 }}>
              <defs>
                <linearGradient id="bpmFcGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#f85149" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#f85149" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="tempFcGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#388bfd" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#388bfd" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(134,239,172,0.04)" />
              <XAxis
                dataKey="label" fontSize={8} axisLine={false} tickLine={false}
                tick={{ fill: '#86efac50' }}
              />
              <YAxis yAxisId="bpm"  orientation="right" domain={fcBpmDomain}  unit=" bpm" {...axisStyle('#f8514970')} />
              <YAxis yAxisId="temp" orientation="left"  domain={fcTempDomain} unit="°C"   {...axisStyle('#388bfd70')} tickCount={5} />
              <Tooltip content={<ForecastTooltip />} />

              {/* BPM confidence band */}
              <Area
                yAxisId="bpm" type="monotone" dataKey="bpmHi"
                stroke="rgba(248,81,73,0.2)" strokeWidth={1} strokeDasharray="3 2"
                fill="url(#bpmFcGrad)" connectNulls legendType="none"
              />
              <Area
                yAxisId="bpm" type="monotone" dataKey="bpmLo"
                stroke="rgba(248,81,73,0.2)" strokeWidth={1} strokeDasharray="3 2"
                fill="rgba(0,0,0,0)" connectNulls legendType="none"
              />

              {/* Temp confidence band */}
              <Area
                yAxisId="temp" type="monotone" dataKey="tempHi"
                stroke="rgba(56,139,253,0.2)" strokeWidth={1} strokeDasharray="3 2"
                fill="url(#tempFcGrad)" connectNulls legendType="none"
              />
              <Area
                yAxisId="temp" type="monotone" dataKey="tempLo"
                stroke="rgba(56,139,253,0.2)" strokeWidth={1} strokeDasharray="3 2"
                fill="rgba(0,0,0,0)" connectNulls legendType="none"
              />

              {/* Center prediction lines */}
              <Line
                yAxisId="bpm" type="monotone" dataKey="bpm"
                name="BPM prédit" stroke="#f85149" strokeWidth={2.5} strokeDasharray="6 3"
                dot={{ r: 3, fill: '#f85149', stroke: 'none' }}
                activeDot={{ r: 5, fill: '#f85149' }} connectNulls
              />
              <Line
                yAxisId="temp" type="monotone" dataKey="temp"
                name="Temp °C" stroke="#388bfd" strokeWidth={2.5} strokeDasharray="6 3"
                dot={{ r: 3, fill: '#388bfd', stroke: 'none' }}
                activeDot={{ r: 5, fill: '#388bfd' }} connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '170px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#86efac40', fontSize: '0.75rem' }}>
            <div style={{ width: '28px', height: '28px', border: '2px solid #86efac40', borderTopColor: '#86efac', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            Calcul de projection IA en cours…
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:0.3; } 50% { opacity:1; box-shadow:0 0 6px #86efac; } }
        @keyframes spin  { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default VitalSignsChart;
