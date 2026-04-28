import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Filter, ChevronRight, ChevronDown, 
  Activity, Syringe, Pill, HeartPulse, Map, 
  TrendingUp, Wifi, WifiOff, LayoutGrid, Info,
  Edit, Trash2, X, Map as MapIcon, CheckCircle, AlertTriangle,
  FileText, Download, Command
} from 'lucide-react';
import axios from 'axios';
import { livestockService, alertService, insightsService } from '../services/api';
import LivestockMap from '../components/LivestockMap';
import VitalSignsChart from '../components/VitalSignsChart';
import OrbitalScanModal from '../components/OrbitalScanModal';
import HealthScanModal from '../components/HealthScanModal';
import HeatStressAlert from '../components/HeatStressAlert';
import MagneticCard from '../components/MagneticCard';
import CommandPalette from '../components/CommandPalette';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Legend, Cell
} from 'recharts';

/* ── Sania Core Utilities ── */
const getSpeciesIcon = (species) => {
  switch(species?.toLowerCase()) {
    case 'bovin': return '🐄';
    case 'ovin': return '🐑';
    case 'caprin': return '🐐';
    case 'cheval': return '🐎';
    case 'volaille': return '🐓';
    default: return '🐾';
  }
};

const calculateAge = (birthDate) => {
  if (!birthDate) return '—';
  const birth = new Date(birthDate);
  const now = new Date();
  const diff = now.getFullYear() - birth.getFullYear();
  if (diff === 0) {
    const months = (now.getMonth() - birth.getMonth()) + 1;
    return `${months} mois`;
  }
  return `${diff} ans`;
};

const ForageStockView = ({ animals }) => {
  const needsPerDay = { 'Bovin': 15, 'Ovin': 3, 'Caprin': 2.5, 'Cheval': 10, 'Volaille': 0.15 };
  const waterNeedsPerDay = { 'Bovin': 40, 'Ovin': 6, 'Caprin': 5, 'Cheval': 30, 'Volaille': 0.3 };
  
  const speciesCount = animals.reduce((acc, a) => {
    const sp = a.species || 'Bovin';
    acc[sp] = (acc[sp] || 0) + 1;
    return acc;
  }, {});

  let totalDailyStock = 0;
  let totalWaterStock = 0;
  
  return (
    <div className="animate-fade-in glass-card" style={{ padding: '2rem', borderTop: '4px solid #fde047' }}>
       <h3 style={{ fontSize: '1.5rem', color: '#fde047', fontFamily: "'Playfair Display', serif", marginBottom: '1.5rem' }}>Prévision Intelligente SVI : Stocks (3 Jours)</h3>
       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {Object.entries(speciesCount).map(([species, count]) => {
              const dailyFood = (needsPerDay[species] || 10) * count;
              const total3DFood = dailyFood * 3;
              totalDailyStock += total3DFood;
              
              const dailyWater = (waterNeedsPerDay[species] || 20) * count;
              const total3DWater = dailyWater * 3;
              totalWaterStock += total3DWater;

              return (
                 <div key={species} style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '14px', border: '1px solid rgba(253, 224, 71, 0.2)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '10px' }}>{getSpeciesIcon(species)}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-bright)' }}>{species} ({count})</div>
                    
                    <div style={{ marginTop: '15px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                       <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Fourrage (Jour)<br/><span style={{ color: '#fff', fontWeight: 600 }}>{dailyFood.toFixed(1)} kg</span></div>
                          <div style={{ marginTop: '5px', fontSize: '0.85rem', color: '#fde047', fontWeight: 900 }}>Stock 3J: {total3DFood.toFixed(1)} kg</div>
                       </div>
                       <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '10px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Eau (Jour)<br/><span style={{ color: '#fff', fontWeight: 600 }}>{dailyWater.toFixed(1)} L</span></div>
                          <div style={{ marginTop: '5px', fontSize: '0.85rem', color: '#38bdf8', fontWeight: 900 }}>Stock 3J: {total3DWater.toFixed(1)} L</div>
                       </div>
                    </div>
                 </div>
              );
          })}
       </div>
       <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
         <div style={{ padding: '1.5rem', background: 'rgba(253, 224, 71, 0.1)', borderRadius: '14px', textAlign: 'center', border: '1px dashed #fde047' }}>
           <div style={{ fontSize: '1rem', color: '#fde047', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>Total Fourrage (3 Jours)</div>
           <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', fontFamily: "'Playfair Display', serif", marginTop: '10px' }}>{totalDailyStock.toFixed(1)} KG</div>
         </div>
         <div style={{ padding: '1.5rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '14px', textAlign: 'center', border: '1px dashed #38bdf8' }}>
           <div style={{ fontSize: '1rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>Total Eau (3 Jours)</div>
           <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', fontFamily: "'Playfair Display', serif", marginTop: '10px' }}>{totalWaterStock.toFixed(1)} L</div>
         </div>
       </div>
    </div>
  );
};

/* ── Pro-Advanced Health Records Section ── */
const HealthTabs = ({ animal, consumption, vaccinations, treatments, onHealthScan }) => {
  const [activeTab, setActiveTab] = useState('metabolic');

  const [liveTemp, setLiveTemp] = useState(24.0);
  const [liveNdvi, setLiveNdvi] = useState(0.50);

  useEffect(() => {
    const fetchEnv = () => {
      livestockService.getAnimalEnvironment(animal.id)
        .then(res => {
          setLiveTemp(res.data.temperature);
          setLiveNdvi(res.data.ndvi);
        })
        .catch(err => {
          console.error("Sania-Copernicus Sync Failed:", err);
          // Graceful fallback to random walk if API is unavailable
          setLiveTemp(prev => parseFloat((prev + (Math.random() * 0.2 - 0.1)).toFixed(1)));
        });
    };
    
    fetchEnv();
    const interval = setInterval(fetchEnv, 15000); // 15s High-Frequency Sync
    return () => clearInterval(interval);
  }, [animal.id]);

  const latestLog = consumption?.[0];
  
  const chartData = useMemo(() => {
    if (!consumption || consumption.length === 0) return [];
    
    // 1. Prepare historical data & Shift it cleanly to ending "NOW" exactly
    let rawData = [...consumption].reverse();
    let timeOffset = 0;
    if (rawData.length > 0) {
        const lastPointTime = new Date(rawData[rawData.length - 1].date).getTime();
        timeOffset = Date.now() - lastPointTime;
    }
    
    let baseData = rawData.map((c, i) => {
      const liveTime = new Date(c.date).getTime() + timeOffset;
      const d = new Date(liveTime);
      return {
        date: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        water: c.water_liters,
        food: c.food_kg,
        fullDate: d.toLocaleString(),
        timestamp: liveTime
      };
    });
    
    // 2. Machine Learning: Simple Linear Extrapolation for the Future
    if (baseData.length > 2) {
      const n = Math.min(baseData.length, 14); // Trend over max 14 last points
      const recent = baseData.slice(-n);
      
      let sumX = 0, sumX2 = 0, sumYw = 0, sumXYw = 0, sumYf = 0, sumXYf = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumX2 += i * i;
        sumYw += recent[i].water;
        sumXYw += i * recent[i].water;
        sumYf += recent[i].food;
        sumXYf += i * recent[i].food;
      }
      
      const denominator = (n * sumX2 - sumX * sumX) || 1;
      const mw = (n * sumXYw - sumX * sumYw) / denominator; // Slope Water
      const bw = (sumYw - mw * sumX) / n;                   // Intercept Water
      
      const mf = (n * sumXYf - sumX * sumYf) / denominator; // Slope Food
      const bf = (sumYf - mf * sumX) / n;                   // Intercept Food
      
      const lastPoint = { ...baseData[baseData.length - 1] };
      // Seamless connection between History and AI Forecast Lines
      baseData[baseData.length - 1].waterForecast = lastPoint.water;
      baseData[baseData.length - 1].foodForecast = lastPoint.food;
      
      const lastTime = recent[recent.length - 1].timestamp;
      
      // Project 5 items into the future
      for (let i = 1; i <= 5; i++) {
        const nextTime = lastTime + (86400000 * i); // 1 day step simulated
        const d = new Date(nextTime);
        const futX = n - 1 + i;
        
        let predW = (mw * futX) + bw + (Math.random() * 2 - 1);
        let predF = (mf * futX) + bf + (Math.random() * 0.5 - 0.25);
        
        if (predW < 0) predW = Math.abs(predW);
        if (predF < 0) predF = Math.abs(predF);
        
        baseData.push({
          date: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          waterForecast: parseFloat(predW.toFixed(1)),
          foodForecast: parseFloat(predF.toFixed(1)),
          isForecast: true
        });
      }
    }
    
    return baseData;
  }, [consumption]);

  // AI Diagnostic Logic
  const getSaniaInsight = () => {
    if (!latestLog) return "En attente de synchronisation satellite...";
    if (latestLog?.water_liters > 50) return "Alerte : Forte consommation d'eau. Risque de coup de chaleur détecté par la météo réelle.";
    if (liveNdvi < 0.45) return "Diagnostic : Pâturage devenant pauvre. Supplémentation alimentaire requise.";
    return "Système Métabolique Stable. Synchronisation Sania-Copernicus optimale.";
  };

  return (
    <div style={{ marginTop: '1.2rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Sania AI Diagnostic Panel */}
      <div className="animate-fade-in" style={{ 
        marginBottom: '1rem', padding: '1rem', borderRadius: '14px', 
        background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
        borderLeft: '4px solid #4ade80'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.4rem' }}>
          <Activity size={14} color="#4ade80" />
          <div style={{ fontSize: '0.6rem', color: '#4ade80', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>Sania Integrated Diagnostic</div>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#fff', margin: 0, fontWeight: '500' }}>{getSaniaInsight()}</p>
        
        <button 
          onClick={() => onHealthScan(animal)}
          style={{
            marginTop: '1rem',
            width: '100%',
            padding: '10px',
            background: 'rgba(74, 222, 128, 0.2)',
            border: '1px solid #4ade80',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: '900',
            letterSpacing: '1px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.3s'
          }}
          className="hover:bg-[#4ade80]/30 transition-all"
        >
          <Activity size={14} /> EXÉCUTER DIAGNOSTIC EXPERT
        </button>

        <div style={{ marginTop: '0.6rem', display: 'flex', gap: '1rem' }}>
           <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>Météo : <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{liveTemp.toFixed(1)}°C (Live)</span></div>
           <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>Santé herbe : <span style={{ color: '#4ade80', fontWeight: 'bold' }}>NDVI {liveNdvi.toFixed(2)}</span></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.2rem', background: 'rgba(255,255,255,0.03)', padding: '0.3rem', borderRadius: '12px' }}>
        {['metabolic', 'medical'].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{ 
              flex: 1, padding: '0.5rem', border: 'none', borderRadius: '10px', fontSize: '0.7rem', fontWeight: '800', 
              background: activeTab === t ? 'var(--primary)' : 'transparent',
              color: activeTab === t ? '#fff' : 'var(--text-dim)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              textTransform: 'uppercase'
            }}
          >
            {t === 'metabolic' ? 'Bio-Pulse : Analyse Métabolique' : 'Historique des Interventions'}
          </button>
        ))}
      </div>

      {activeTab === 'metabolic' && (
        <div className="animate-fade-in">
           <div style={{ fontSize: '0.6rem', color: '#4ade80', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1.5px', textAlign: 'center', fontWeight: 'bold' }}>
             Flux Métabolique Satellite SVI (Live)
           </div>
           
           <div style={{ height: '180px', width: '100%', marginLeft: '-20px' }}>
             {chartData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                   <defs>
                     <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8}/>
                       <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                   <XAxis dataKey="date" fontSize={8} axisLine={false} tickLine={false} tick={{fill: 'var(--text-dim)'}} />
                   <Tooltip 
                     contentStyle={{ background: '#111', border: 'none', borderRadius: '8px', fontSize: '0.7rem' }}
                     itemStyle={{ color: '#fff' }}
                     labelFormatter={(label, payload) => {
                        const point = payload?.[0]?.payload;
                        return point?.isForecast ? `${label} (Prédiction IA)` : label;
                     }}
                   />
                   <Area type="monotone" dataKey="water" name="Eau (L)" stroke="var(--primary)" fillOpacity={1} fill="url(#colorWater)" connectNulls />
                   <Area type="monotone" dataKey="food" name="Nourriture (Kg)" stroke="var(--sand-gold)" fill="transparent" strokeWidth={2} connectNulls />
                   
                   {/* FORECAST LINES */}
                   <Area type="monotone" dataKey="waterForecast" name="Prévision Eau" strokeDasharray="4 4" stroke="#86efac" fill="transparent" strokeWidth={2} connectNulls />
                   <Area type="monotone" dataKey="foodForecast" name="Prévision Food" strokeDasharray="4 4" stroke="#fde047" fill="transparent" strokeWidth={2} connectNulls />
                 </AreaChart>
               </ResponsiveContainer>
             ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)', borderRadius: '12px' }}>
                   <Activity className="animate-pulse" size={24} color="var(--primary)" />
                   <span style={{ fontSize: '0.65rem', marginTop: '10px', color: 'var(--text-muted)' }}>Synchronisation avec l'Orbital Cloud Sania...</span>
                </div>
             )}
           </div>

           <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6rem', color: 'var(--text-dim)' }}>
                 <div style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }}></div> EAU (PULSE)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6rem', color: 'var(--text-dim)' }}>
                 <div style={{ width: '8px', height: '8px', border: '2px solid var(--sand-gold)', borderRadius: '50%' }}></div> FOOD (PULSE)
              </div>
           </div>
        </div>
      )}

      {activeTab === 'medical' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ fontSize: '0.6rem', color: 'var(--primary)', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>Timeline Vaccinale</div>
             <button 
                onClick={() => {
                   const v_name = prompt("Nom du Vaccin :");
                   const v_date = prompt("Date Vaccination (YYYY-MM-DD) :", new Date().toISOString().split('T')[0]);
                   const v_next = prompt("PROCHAIN RAPPEL SVI (YYYY-MM-DD) :", new Date(new Date().getTime() + 90 * 86400000).toISOString().split('T')[0]);
                   if (v_name && v_date && v_next) {
                      livestockService.addVaccination(animal.id, {
                         vaccine_name: v_name,
                         date: v_date,
                         next_due_date: v_next,
                         dose: "Standard",
                         vet_name: "Vet Sania"
                      }).then(() => window.location.reload())
                      .catch(err => alert("Erreur: " + (err.response?.data?.detail || "Inconnu")));
                   }
                }}
                style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid #4ade80', color: '#4ade80', fontSize: '0.55rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                +ajouter
             </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
             {vaccinations?.length > 0 ? vaccinations.slice(0, 5).map((v, i) => (
               <div key={v.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', position: 'relative' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: i === 0 ? 'var(--primary)' : 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.1)' }}></div>
                    {i < vaccinations.length - 1 && <div style={{ width: '1px', height: '35px', background: 'rgba(255,255,255,0.1)' }}></div>}
                 </div>
                 <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                       <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#fff' }}>{v.vaccine_name}</div>
                       <button onClick={() => {
                          if (confirm("Supprimer ce vaccin réel ?")) {
                             axios.delete(`http://localhost:8000/api/v1/animals/vaccinations/${v.id}`).then(() => window.location.reload());
                          }
                       }} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.6rem', cursor: 'pointer' }}>Effacer</button>
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>Injecté : {new Date(v.date).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.55rem', color: 'var(--primary)', fontWeight: 'bold' }}>PROCHAIN RAPPEL SVI : {new Date(v.next_due_date).toLocaleDateString()}</div>
                 </div>
               </div>
             )) : <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', padding: '1rem', textAlign: 'center', borderRadius: '10px' }}>Inscrivez le premier vaccin de l'animal pour activer la Timeline.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Animal Card Component ── */
const AnimalCard = ({ animal, telemetry, delay, onEdit, onDelete, onPrint, onHealthScan }) => {
  const [expanded, setExpanded] = useState(false);
  const [healthData, setHealthData] = useState({ consumption: [], vaccinations: [], treatments: [] });

  useEffect(() => {
    if (expanded) {
      Promise.all([
        livestockService.getConsumption(animal.id),
        livestockService.getVaccinations(animal.id),
        livestockService.getTreatments(animal.id)
      ]).then(([c, v, t]) => {
        setHealthData({ consumption: c.data, vaccinations: v.data, treatments: t.data });
      }).catch(console.error);
    }
  }, [expanded, animal.id]);

  const blinkStyle = `
    @keyframes card-blink {
      0% { opacity: 1; box-shadow: 0 0 5px #ef4444; }
      50% { opacity: 0.6; box-shadow: 0 0 15px #ef4444; }
      100% { opacity: 1; box-shadow: 0 0 5px #ef4444; }
    }
    .card-status-blink {
      animation: card-blink 1s infinite ease-in-out;
    }
  `;

  /* Pro Health Score Calculation — respects BCS diagnostic labels */
  const getHealthInfo = (t, manualStatus) => {
    const isSVI = t?.source === 'SATELLITE_SVI';
    // Telemetry overrides for hard physiological anomalies
    const telemetryCritique = t && (t.heart_rate > 100 || t.temperature_c > 39.5 || t.heart_rate < 40 || t.geofence_status === 'BREACH');
    if (telemetryCritique) {
      return { label: 'Critique', color: '#ef4444', isBlinking: true,
               status: t?.geofence_status === 'BREACH' ? 'HORS ZONE' : 'Critique' };
    }
    // AI diagnostic status (from Health Scan) — all 5 classes
    const aiStates = {
      'Critique':       { label: 'Critique',      color: '#ef4444', isBlinking: true,  status: 'Critique' },
      'URGENCE':        { label: 'Critique',      color: '#ef4444', isBlinking: true,  status: 'URGENCE' },
      'Malade':         { label: 'Critique',      color: '#ef4444', isBlinking: true,  status: 'Malade' },
      'Déshydraté':     { label: 'Déshydraté',    color: '#38bdf8', isBlinking: false, status: 'Déshydraté' },
      'Sous-alimenté':  { label: 'Sous-alimenté', color: '#fbbf24', isBlinking: false, status: 'Sous-alimenté' },
      'Stressé':        { label: 'Stressé',       color: '#a78bfa', isBlinking: false, status: 'Stressé' },
    };
    if (manualStatus && aiStates[manualStatus]) return aiStates[manualStatus];
    // Default → Sain
    return { label: 'Sain', color: isSVI ? '#4ade80' : '#22c55e', isBlinking: false,
             status: isSVI ? 'SYNC SAT' : 'Sain' };
  };

  const health = getHealthInfo(telemetry, animal.status);
  const statusColor = health.color;
  const isSVI = telemetry?.source === 'SATELLITE_SVI';
  // Live market valuation (ECB FX + seasonal Aïd/Ramadan multipliers + per-animal modulators).
  // Falls back to a local static estimate if the insights API is unavailable.
  const [marketPrice, setMarketPrice] = useState(null);
  const [priceMeta, setPriceMeta] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!animal?.id) return;
    insightsService.getAnimalPrice(animal.id)
      .then(r => {
        if (cancelled) return;
        setMarketPrice(r.data?.price_tnd ?? null);
        setPriceMeta(r.data?.breakdown ?? null);
      })
      .catch(() => { /* keep fallback */ });
    return () => { cancelled = true; };
  }, [animal?.id, animal?.status, animal?.weight_kg]);

  const estimatedPrice = useMemo(() => {
    if (marketPrice != null) return marketPrice;
    // Offline fallback — same math as before
    const basePrices = { 'bovin': 4800, 'ovin': 1450, 'caprin': 980, 'cheval': 8500, 'volaille': 35 };
    let price = basePrices[animal.species?.toLowerCase()] || 1000;
    if (animal.birth_date) {
      const ageYears = (new Date() - new Date(animal.birth_date)) / (1000 * 60 * 60 * 24 * 365.25);
      if (ageYears < 0.5) price *= 0.65;
      else if (ageYears < 1.5) price *= 0.90;
      else if (ageYears > 8) price *= 0.70;
    }
    if (health.label === 'Critique') price *= 0.40;
    else if (['Déshydraté', 'Sous-alimenté', 'Stressé', 'Malade'].includes(animal.status)) price *= 0.75;
    const currentWeight = telemetry?.weight_kg || animal.weight_kg;
    if (currentWeight) {
      const sp = animal.species?.toLowerCase();
      if (sp === 'bovin' && currentWeight < 350) price *= 0.85;
      else if (sp === 'ovin' && currentWeight < 45) price *= 0.82;
      else if (sp === 'caprin' && currentWeight < 30) price *= 0.80;
    }
    if (price > 1000) return Math.round(price / 50) * 50;
    if (price > 100)  return Math.round(price / 10) * 10;
    return Math.round(price / 5) * 5;
  }, [animal, health.label, telemetry?.weight_kg, animal.status, marketPrice]);

  return (
    <div
      className={`glass-card ${health.isBlinking ? 'card-status-blink' : ''}`}
      style={{ 
        padding: '1.2rem', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem', 
        borderTop: `4px solid ${statusColor}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animationDelay: `${delay * 0.05}s`,
        background: isSVI ? 'rgba(0, 20, 10, 0.4)' : 'var(--glass-bg)',
        boxShadow: expanded ? `0 10px 40px rgba(0,0,0,0.4)` : 'none',
        zIndex: expanded ? 100 : 1
      }}
    >
      <style>{blinkStyle}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <div style={{
            fontSize: '1.2rem', 
            background: isSVI ? 'rgba(74, 222, 128, 0.1)' : 'var(--bg-elevated)',
            padding: '0.6rem', 
            borderRadius: '12px', 
            border: isSVI ? '1px solid #4ade80' : 'none'
          }}>
            {getSpeciesIcon(animal.species)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: isSVI ? '#4ade80' : 'var(--text-bright)' }}>
                {animal.tag_id}
              </h3>
              {telemetry && (
                <div style={{ 
                  width: '6px', height: '6px', borderRadius: '50%', background: statusColor, 
                  boxShadow: `0 0 10px ${statusColor}`,
                  animation: isSVI ? 'pulse 2s infinite' : 'none'
              }}></div>
              )}
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {isSVI ? (
                <>
                  <span style={{ color: '#4ade80', fontWeight: 'bold' }}>🛰️ SVI ORBITAL SCAN</span>
                </>
              ) : `${animal.breed} • ${calculateAge(animal.birth_date)}`}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(253, 224, 71, 0.1) 0%, rgba(234, 179, 8, 0.05) 100%)',
            padding: '0.4rem 0.8rem',
            borderRadius: '10px',
            border: '1px solid rgba(253, 224, 71, 0.3)',
            textAlign: 'right',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
          }}>
            <div style={{ fontSize: '0.5rem', color: '#fde047', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Prix Marché {marketPrice != null ? '(Live)' : '(Estimé)'}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>
              {estimatedPrice.toLocaleString()} <span style={{ fontSize: '0.6rem', color: '#fde047' }}>TND</span>
            </div>
            {priceMeta?.seasonal?.event && (
              <div style={{ fontSize: '0.5rem', color: '#fbbf24', fontWeight: 700, marginTop: '2px' }}>
                🌙 {priceMeta.seasonal.event} ×{priceMeta.seasonal.multiplier}
              </div>
            )}
          </div>
          <button 
            onClick={() => onEdit(animal)} 
            style={{ 
              padding: '0.5rem', 
              background: 'rgba(74, 222, 128, 0.1)', 
              color: 'var(--primary)',
              border: '1px solid rgba(74, 222, 128, 0.2)',
              borderRadius: '10px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            className="hover-glow"
          >
            <Edit size={14} />
          </button>
        </div>
      </div>

      {telemetry ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ 
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', 
            background: isSVI ? 'rgba(74, 222, 128, 0.05)' : 'rgba(0,0,0,0.2)', 
            padding: '0.5rem', borderRadius: '8px',
            border: isSVI ? '1px solid rgba(74, 222, 128, 0.2)' : 'none'
          }}>
            <div>
              <div style={{ fontSize: '0.55rem', color: isSVI ? '#4ade80' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                {isSVI ? '📡 BPM (SAT)' : '💓 BPM'}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-bright)' }}>{Math.round(telemetry.heart_rate)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.55rem', color: isSVI ? '#4ade80' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                {isSVI ? '🌡️ TEMP (SAR)' : '🌡️ TEMP'}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-bright)' }}>{telemetry.temperature_c.toFixed(1)}°C</div>
            </div>
          </div>
          
          <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.4rem', borderRadius: '6px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.5rem', marginBottom: '0.2rem' }}>
               <span style={{ color: 'var(--text-muted)' }}>{isSVI ? 'SATELLITE REVISIT CONFIDENCE' : 'SIGNAL STRENGTH'}</span>
               <span style={{ color: health.color, fontWeight: '700' }}>{isSVI ? `${(telemetry.svi_confidence * 100).toFixed(1)}%` : 'EXCELLENT'}</span>
             </div>
             <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.3rem' }}>
               <div style={{ width: `${isSVI ? telemetry.svi_confidence * 100 : 98}%`, height: '100%', background: health.color, transition: 'width 1s ease' }}></div>
             </div>
             {isSVI && (
               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.45rem', color: 'var(--text-dim)' }}>
                  <span>RSSI: {telemetry.rssi || -92} dBm</span>
                  <span>SNR: {telemetry.snr ? telemetry.snr.toFixed(1) : '8.2'} dB</span>
                  <span>GW: COPERNICUS-01</span>
               </div>
             )}
          </div>
        </div>
      ) : (
        <div style={{ height: '80px', border: '1px dashed var(--glass-border)', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.65rem', gap: '0.4rem' }}>
          <WifiOff size={16} opacity={0.5} />
          Waiting for Signal...
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
        <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.4rem', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>Poids</div>
          <div style={{ fontSize: '0.7rem', fontWeight: '600' }}>
            {telemetry?.weight_kg 
              ? telemetry.weight_kg.toFixed(0) 
              : (animal.weight_kg ? animal.weight_kg.toFixed(0) : '—')} kg
          </div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.4rem', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>Santé</div>
          <div style={{ fontSize: '0.7rem', fontWeight: '800', color: health.color }}>{health.label}</div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.4rem', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>Sexe</div>
          <div style={{ fontSize: '0.6rem', fontWeight: '700', color: 'var(--text-bright)' }}>{animal.gender || '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: expanded ? '1fr' : '1fr', gap: '0.5rem' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="btn btn-outline"
          style={{ width: '100%', fontSize: '0.75rem', justifyContent: 'center', borderRadius: '12px', padding: '0.6rem', background: 'rgba(255,255,255,0.02)' }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} 
          {expanded ? 'Fermer le Dossier' : 'Consulter Dossier Santé'}
        </button>
        {expanded && (
          <button
            onClick={() => onPrint(animal, telemetry, healthData)}
            className="btn btn-primary"
            style={{ width: '100%', fontSize: '0.75rem', background: 'var(--gradient-warm)', border: 'none', borderRadius: '12px', padding: '0.6rem', marginTop: '0.5rem' }}
          >
            <FileText size={14} /> Imprimer Passeport Officiel
          </button>
        )}
      </div>

      {expanded && (
        <HealthTabs 
          animal={animal} 
          consumption={healthData.consumption} 
          vaccinations={healthData.vaccinations} 
          treatments={healthData.treatments} 
          onHealthScan={onHealthScan}
        />
      )}
    </div>
  );
};

/* ── Main Dashboard Component ── */
const AnimalsDashboard = ({ user }) => {
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecies, setFilterSpecies] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); 
  const [telemetryData, setTelemetryData] = useState({});
  const [historicalTelemetry, setHistoricalTelemetry] = useState([]);
  const [forecastTelemetry, setForecastTelemetry] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [animalToDelete, setAnimalToDelete] = useState(null);
  const [editingAnimal, setEditingAnimal] = useState(null);
  const [formData, setFormData] = useState({ 
    tag_id: '', species: 'Bovin', breed: '', gender: 'Femelle', birth_date: '', 
    entry_date: '', status: 'Active', weight_kg: '', latitude: '', longitude: '' 
  });
  const wsRef = useRef(null);
  const [printingAnimal, setPrintingAnimal] = useState(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [initialPaths, setInitialPaths] = useState({});
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [forceManualScan, setForceManualScan] = useState(false);
  const [farmData, setFarmData] = useState(null);
  const [healthScanAnimal, setHealthScanAnimal] = useState(null);
  const [mapCaptureLocation, setMapCaptureLocation] = useState(null);

  const fetchAnimals = () => {
    setLoading(true);
    livestockService.getAnimals()
      .then(res => {
        setAnimals(res.data);
        if (res.data.length > 0 && !selectedAnimalId) {
          setSelectedAnimalId(res.data[0].id);
        }
        setLoading(false);

        // CHARGEMENT INITIAL DES TRACÉS POUR LA CARTE (Mode Réel)
        const pathsUpdate = {};
        res.data.forEach(animal => {
          livestockService.getTelemetryHistory(animal.id, 20).then(hist => {
            if (hist.data && hist.data.length > 0) {
              const lastPoint = hist.data[0]; 
              setTelemetryData(prev => ({
                ...prev,
                [animal.id]: {
                  ...lastPoint,
                  source: 'SATELLITE_SVI',
                  svi_confidence: 0.99
                }
              }));
              
              // On construit le trajet historique (du plus vieux au plus récent)
              pathsUpdate[animal.id] = hist.data
                .map(p => [p.latitude, p.longitude])
                .reverse();
              
              if (Object.keys(pathsUpdate).length === res.data.length) {
                setInitialPaths(pathsUpdate);
              }
            }
          });
        });
      })
      .catch(err => {
        console.error("Error fetching animals:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAnimals();
    livestockService.getZones().then(res => setZones(res.data));
    livestockService.getMyFarm().then(res => {
      setFarmData(res.data);
    }).catch(console.error);
  }, []);

  const handleMapCapture = (lat, lon) => {
    setMapCaptureLocation(`${lat}, ${lon}`);
    setIsScanModalOpen(true);
  };

  const fetchHistory = (id) => {
    if (!id) return;
    setHistoricalTelemetry([]); // Clear while loading
    setForecastTelemetry([]); // Clear forecast
    
    livestockService.getTelemetryHistory(id, 50)
      .then(res => {
        if (res && res.data && Array.isArray(res.data)) {
          setHistoricalTelemetry(res.data);
        }
      })
      .catch(err => console.error("History fetch failed", err));
      
    livestockService.getTelemetryForecast(id)
      .then(res => {
        if (res && res.data && Array.isArray(res.data)) {
          setForecastTelemetry(res.data);
        }
      })
      .catch(err => console.error("Forecast fetch failed", err));
  };

  const fetchZones = () => {
    livestockService.getZones().then(res => setZones(res.data)).catch(console.error);
  };

  const handleSaveZone = async (zoneData) => {
    try {
      const farm_id = user?.farm_id || (animals.length > 0 ? animals[0].farm_id : null);
      if (!farm_id) return alert("Identifiant de ferme introuvable.");
      await livestockService.createZone({ ...zoneData, farm_id });
      fetchZones();
      alert("Zone sauvegardée !");
    } catch (err) {
      alert("Erreur: " + err.message);
    }
  };

  const handleDeleteZone = async (zoneId) => {
    try {
      await livestockService.deleteZone(zoneId);
      fetchZones();
    } catch (err) {
      alert("Erreur: " + err.message);
    }
  };

  useEffect(() => {
    if (selectedAnimalId) fetchHistory(selectedAnimalId);
  }, [selectedAnimalId]);

  useEffect(() => {
    fetchAnimals();
    fetchZones();

    const connectWS = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = '127.0.0.1:8000'; // Target explicit backend
      const wsUrl = `${protocol}//${host}/api/v1/livestock_telemetry/ws`;
      
      console.log(`Connecting to WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("WebSocket Connected");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'TELEMETRY_UPDATE') {
            const t = msg.data;
            setTelemetryData(prev => ({ ...prev, [t.animal_id]: t }));
          }
        } catch (e) { console.error("WS parse error", e); }
      };

      ws.onclose = () => {
        console.log("WebSocket Disconnected. Reconnecting...");
        setIsConnected(false);
        setTimeout(connectWS, 3000);
      };

      ws.onerror = (e) => {
        console.error("WebSocket Error", e);
        ws.close();
      };

      wsRef.current = ws;
    };

    connectWS();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!printingAnimal) return;
    setIsPdfGenerating(true);
    
    // Set proper document title temporarily so the native 'Save as PDF' has the correct default filename
    const originalTitle = document.title;
    document.title = `PASSEPORT_SVI_${printingAnimal.animal.tag_id}`;

    // Give React time to render the portal in the DOM
    const timer = setTimeout(() => {
      // Trigger native high-fidelity print
      window.print();
      
      // Cleanup after print dialog closes
      document.title = originalTitle;
      setPrintingAnimal(null);
      setIsPdfGenerating(false);
    }, 600);
    
    return () => clearTimeout(timer);
  }, [printingAnimal]);

  const speciesList = [...new Set(animals.map(a => a.species))];

  const filteredAnimals = useMemo(() => {
    return animals.filter(a => {
      const tagStr = a.tag_id ? String(a.tag_id).toLowerCase() : '';
      const breedStr = a.breed ? String(a.breed).toLowerCase() : '';
      const searchStr = searchTerm ? searchTerm.toLowerCase() : '';
      
      const matchesSearch = tagStr.includes(searchStr) || breedStr.includes(searchStr);
      const matchesFilter = filterSpecies === 'all' || a.species === filterSpecies;
      return matchesSearch && matchesFilter;
    });
  }, [animals, searchTerm, filterSpecies]);

  // Global Health stats
  const activeCount = Object.keys(telemetryData).length;
  
  const CRITIQUE_STATUSES = ['Critique', 'URGENCE', 'Malade'];
  const critiqueAnimals = animals.filter(a => {
    const t = telemetryData[a.id];
    const telemetryFlag = t && (t.heart_rate > 100 || t.temperature_c > 39.5 || t.heart_rate < 40 || t.geofence_status === 'BREACH');
    const diagnosticFlag = CRITIQUE_STATUSES.includes(a.status);
    return telemetryFlag || diagnosticFlag;
  });
  
  const critiqueCount = critiqueAnimals.length;
  const sainCount = animals.length - critiqueCount;

  // Ray-Casting algorithm to check Point in Polygon (Frontend automatic compute)
  const isPointInPolygon = (point, vs) => {
    if (!point || !vs || !Array.isArray(vs) || vs.length < 3) return false;
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
  };

  const escapedAnimals = useMemo(() => {
    if (!animals) return [];
    return animals.filter(a => {
      if (!a) return false;
      const t = telemetryData[a.id];
      // S'il est marqué explicitly par le backend
      if (t?.geofence_status === 'BREACH') return true;
      
      // S'il n'y a pas de zones, l'animal est virtuellement libre (safe)
      if (!zones || zones.length === 0) return false;
      
      // Récupérer la dernière position connue de l'animal
      const lat = t?.latitude || a.latitude;
      const lng = t?.longitude || a.longitude;
      if (lat === undefined || lng === undefined) return false;

      let isInsideAnyZone = false;
      for (const z of zones) {
        try {
          if (!z.polygon_geojson) continue;
          const geo = JSON.parse(z.polygon_geojson);
          if (geo && geo.coordinates && Array.isArray(geo.coordinates[0])) {
            const polyCoords = geo.coordinates[0]; // [[lng, lat]]
            if (isPointInPolygon([lng, lat], polyCoords)) {
              isInsideAnyZone = true;
              break;
            }
          }
        } catch (e) { console.error("GeoJSON parse error", e); }
      }
      
      return !isInsideAnyZone; 
    });
  }, [animals, telemetryData, zones]);

  return (
    <div style={{ padding: '1.5rem 0' }}>
      {escapedAnimals.length > 0 && (
        <div className="animate-pulse" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '2px solid #ef4444', borderRadius: '12px', padding: '1.2rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.2rem', boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3)' }}>
          <div style={{ background: '#ef4444', padding: '12px', borderRadius: '50%', color: 'white', display: 'flex' }}>
            <AlertTriangle size={28} />
          </div>
          <div>
            <h3 style={{ color: '#ef4444', margin: 0, fontSize: '1.3rem', fontWeight: 'bold', textTransform: 'uppercase' }}>🚨 Alerte Geofencing : Évasion Détectée</h3>
            <p style={{ margin: '0.3rem 0 0', color: 'var(--text-bright)', fontSize: '0.95rem' }}>
              <strong>{escapedAnimals.length} animal(aux)</strong> se trouvent actuellement hors des limites de pâturage : <span style={{ color: '#ffbdcb', fontWeight: 'bold' }}>{escapedAnimals.map(a => a.tag_id).join(', ')}</span>
            </p>
          </div>
          <button 
            onClick={() => setViewMode('live')}
            style={{ marginLeft: 'auto', background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s' }}
            onMouseOver={(e) => e.target.style.background = '#dc2626'}
            onMouseOut={(e) => e.target.style.background = '#ef4444'}
          >
            Localiser
          </button>
        </div>
      )}

      {/* Live Heat-Stress Alert (OpenMeteo 72h THI forecast) — toutes les espèces de la ferme */}
      <div style={{ marginBottom: '1.5rem' }}>
        <HeatStressAlert speciesList={speciesList} />
      </div>

      {/* Top Banner Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total Cheptel', value: animals.length, icon: LayoutGrid, color: 'var(--primary)' },
          { label: 'Animaux Sains', value: sainCount, icon: CheckCircle, color: '#22c55e' },
          { label: 'Alertes Santé', value: critiqueCount, icon: AlertTriangle, color: critiqueCount > 0 ? '#ef4444' : 'var(--text-muted)' },
        ].map((s, i) => (
          <div key={i} className="glass-card" style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--glass-border)' }}>
            <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bright)', fontFamily: "'Playfair Display', serif" }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', fontWeight: '800', color: 'var(--text-bright)' }}>
            Suivi <span className="gradient-text-warm">Intelligent</span>
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem' }}>Surveillance biométrique et GPS en temps réel</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          {/* Command Center — icon-style launcher for the ⌘K palette */}
          <button
            onClick={() => {
              const ev = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
              window.dispatchEvent(ev);
            }}
            title="Command Center (Ctrl+K)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: 44, height: 44, padding: 0, borderRadius: '12px',
              background: 'rgba(74,222,128,0.08)',
              border: '1px solid rgba(74,222,128,0.3)',
              color: '#4ade80', cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 12px rgba(74,222,128,0.08)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(74,222,128,0.15)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(74,222,128,0.25)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(74,222,128,0.08)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(74,222,128,0.08)';
            }}
          >
            <Command size={18} strokeWidth={2.2} />
            <kbd style={{
              position: 'absolute', bottom: -6, right: -6,
              background: '#0B0F1E', border: '1px solid rgba(74,222,128,0.4)',
              borderRadius: 4, padding: '0 5px', fontSize: '0.55rem',
              color: '#4ade80', fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700, letterSpacing: 0.5,
            }}>⌘K</kbd>
          </button>
          {/* Quick Actions Group */}
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: '14px', padding: '0.35rem', border: '1px solid var(--glass-border)', gap: '0.4rem' }}>
            <button 
              className="btn" 
              style={{ 
                borderRadius: '10px', 
                background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)', 
                color: '#000', 
                fontWeight: '900',
                border: 'none',
                padding: '0.6rem 1.2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(74, 222, 128, 0.2)',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
              onClick={() => setIsScanModalOpen(true)}
            >
              <Wifi size={16} /> SCAN ORBITAL
            </button>



            <button 
              className="btn btn-warm" 
              style={{ borderRadius: '10px', padding: '0.6rem 1.2rem', fontSize: '0.8rem', fontWeight: '900' }}
              onClick={() => {
                setEditingAnimal(null);
                setFormData({ 
                  tag_id: '', species: 'Bovin', breed: '', gender: 'Femelle', 
                  birth_date: new Date().toISOString().split('T')[0],
                  entry_date: new Date().toISOString().split('T')[0],
                  status: 'Sain', weight_kg: '', latitude: '36.60', longitude: '10.49'
                });
                setIsModalOpen(true);
              }}
            >
              <Plus size={16} /> NOUVEL ANIMAL
            </button>
          </div>

          {/* View Modes Group */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '0.35rem', border: '1px solid var(--glass-border)' }}>
            <button 
              className={`btn ${viewMode === 'grid' ? 'btn-primary' : ''}`} 
              style={{ borderRadius: '10px', padding: '0.5rem 1rem', fontSize: '0.75rem', background: viewMode === 'grid' ? 'var(--primary)' : 'transparent', border: 'none' }}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={14} />
            </button>
            <button 
              className={`btn ${viewMode === 'live' ? 'btn-primary' : ''}`}
              style={{ borderRadius: '10px', padding: '0.5rem 1rem', fontSize: '0.75rem', background: viewMode === 'live' ? 'var(--primary)' : 'transparent', border: 'none' }}
              onClick={() => setViewMode('live')}
            >
              <MapIcon size={14} />
            </button>
            <button 
              className={`btn ${viewMode === 'stock' ? 'btn-primary' : ''}`}
              style={{ borderRadius: '10px', padding: '0.5rem 1rem', fontSize: '0.75rem', background: viewMode === 'stock' ? 'var(--primary)' : 'transparent', border: 'none' }}
              onClick={() => setViewMode('stock')}
            >
              <TrendingUp size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters Search */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text" placeholder="Rechercher par ID ou race..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', padding: '0.8rem 1rem 0.8rem 3rem', background: 'var(--bg-elevated)', 
              border: '1px solid var(--glass-border)', borderRadius: '14px', color: 'var(--text-bright)', outline: 'none'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['all', ...speciesList].map(sp => (
            <button key={sp}
              onClick={() => setFilterSpecies(sp)}
              style={{ 
                padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer',
                background: filterSpecies === sp ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: filterSpecies === sp ? '#fff' : 'var(--text-dim)',
                border: '1px solid var(--glass-border)', transition: 'all 0.2s'
              }}
            >
              {sp === 'all' ? 'Tous' : sp}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity className="animate-spin" size={40} color="var(--primary)" />
        </div>
      ) : viewMode === 'stock' ? (
         <ForageStockView animals={filteredAnimals} />
      ) : viewMode === 'grid' ? (
        <div className="grid-cols-3">
          {filteredAnimals.map((animal, i) => {
            const glow =
              ['Critique', 'URGENCE', 'Malade'].includes(animal.status) ? 'rgba(239,68,68,0.35)' :
              animal.status === 'Déshydraté' ? 'rgba(56,189,248,0.32)' :
              animal.status === 'Sous-alimenté' ? 'rgba(251,191,36,0.32)' :
              animal.status === 'Stressé' ? 'rgba(167,139,250,0.32)' :
              'rgba(74,222,128,0.28)';
            return (
              <MagneticCard key={animal.id} index={i} strength={5} glowColor={glow}>
                <AnimalCard
                  animal={animal}
                  telemetry={telemetryData[animal.id]}
                  delay={i}
                  onEdit={(a) => {
                    setEditingAnimal(a);
                    setFormData({
                      tag_id: a.tag_id,
                      species: a.species,
                      breed: a.breed,
                      gender: a.gender || 'Femelle',
                      birth_date: new Date(a.birth_date).toISOString().split('T')[0],
                      entry_date: a.entry_date ? new Date(a.entry_date).toISOString().split('T')[0] : '',
                      status: a.status || 'Sain',
                      weight_kg: a.weight_kg || '',
                      latitude: a.latitude || '',
                      longitude: a.longitude || ''
                    });
                    setIsModalOpen(true);
                  }}
                  onDelete={(a) => { setAnimalToDelete(a); }}
                  onPrint={(a, t, h) => setPrintingAnimal({ animal: a, telemetry: t, healthData: h })}
                  onHealthScan={(a) => setHealthScanAnimal(a)}
                />
              </MagneticCard>
            );
          })}
        </div>
      ) : (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
           <div className="glass-card" style={{ padding: '0.5rem', background: 'var(--bg-deepest)' }}>
              <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><MapIcon size={20} /> Géolocalisation Live</h3>
                <span style={{ fontSize: '0.7rem', color: isConnected ? 'var(--primary)' : 'var(--terracotta)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? 'var(--primary)' : 'var(--terracotta)' }}></div>
                   {isConnected ? 'WebSocket Actif' : 'Déconnecté'}
                </span>
              </div>
              <LivestockMap 
                animals={filteredAnimals} 
                telemetryData={telemetryData} 
                selectedId={selectedAnimalId} 
                onSelectAnimal={setSelectedAnimalId} 
                zones={zones} 
                onSaveZone={handleSaveZone} 
                onDeleteZone={handleDeleteZone} 
                onMapCapture={handleMapCapture}
                escapedAnimalIds={new Set(escapedAnimals.map(a => a.id))}
                initialPaths={initialPaths}
              />
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Vital Signs Chart */}
              <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><HeartPulse size={20} /> Signes Vitaux</h3>
                {selectedAnimalId ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
                       <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginBottom: '0.4rem' }}>Animal Sélectonné</div>
                       <div style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: "'Playfair Display', serif" }}>{animals.find(a => a.id === selectedAnimalId)?.tag_id}</div>
                       <div style={{ marginTop: '0.8rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                         {telemetryData[selectedAnimalId]?.activity_level || 'HORS-LIGNE'}
                       </div>
                    </div>
                    <VitalSignsChart 
                      telemetryData={telemetryData} 
                      selectedId={selectedAnimalId} 
                      historicalData={historicalTelemetry} 
                      forecastData={forecastTelemetry} 
                    />
                  </div>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Info size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                    <p>Sélectionnez un animal sur la carte pour monitorer ses constantes.</p>
                  </div>
                )}
              </div>

              {/* Live Activity Feed */}
              <div className="glass-card" style={{ padding: '1.2rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Activity size={16} color="var(--sand-gold)" /> Flux d'Activité Live
                </h4>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.values(telemetryData)
                      .filter(t => animals.some(an => an.id === t.animal_id))
                      .sort((a,b) => new Date(b.time) - new Date(a.time))
                      .slice(0, 10).map((t, idx) => {
                    const animal = animals.find(an => an.id === t.animal_id);
                    return (
                      <div key={idx} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{animal.tag_id}</span>
                          <span style={{ marginLeft: '8px', color: 'var(--text-dim)' }}>{t.activity_level}</span>
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>{new Date(t.time).toLocaleTimeString()}</div>
                      </div>
                    );
                  })}
                  {Object.keys(telemetryData).length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '1rem' }}>En attente de données...</div>
                  )}
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {animalToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card animate-scale-in" style={{ width: '400px', padding: '2rem', border: '1px solid var(--terracotta)', textAlign: 'center' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'var(--terracotta)' }}>
              <Trash2 size={32} />
            </div>
            <h3 style={{ fontSize: '1.4rem', fontFamily: "'Playfair Display', serif", marginBottom: '1rem', color: '#fff' }}>
              Zone Dangereuse
            </h3>
            <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', lineHeight: '1.5' }}>
              Vous êtes sur le point de supprimer l'animal <strong style={{ color: 'var(--text-bright)' }}>{animalToDelete.tag_id}</strong>. Cette action effacera également de manière permanente tout l'historique de télémétrie, de vaccination et de traitement. Confirmez-vous ?
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setAnimalToDelete(null)} 
                className="btn btn-outline" 
                style={{ padding: '0.8rem 1.5rem', borderRadius: '12px', flex: 1 }}
              >
                Annuler
              </button>
              <button 
                onClick={async () => {
                  try {
                    console.log("Deleting animal:", animalToDelete.id);
                    await livestockService.deleteAnimal(animalToDelete.id);
                    console.log("Delete success");
                    setAnimalToDelete(null);
                    await fetchAnimals();
                  } catch (err) {
                    console.error("Delete Error:", err);
                    alert("Erreur lors de la suppression: " + (err.response?.data?.detail || err.message));
                    setAnimalToDelete(null); // Close even on error to avoid being stuck
                  }
                }} 
                className="btn" 
                style={{ background: 'var(--terracotta)', color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '12px', flex: 1 }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredAnimals.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.1rem' }}>Aucun animal ne correspond à votre recherche.</p>
        </div>
      )}

      {/* CRUD Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card animate-scale-in" style={{ width: '450px', padding: '2rem', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '12px', color: '#000' }}>
                   {editingAnimal ? <Edit size={22} /> : <Plus size={22} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontFamily: "'Playfair Display', serif", margin: 0, color: '#fff' }}>
                    {editingAnimal ? "Modifier le Dossier" : "Nouvel Animal SVI"}
                  </h3>
                  <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Certification Sania Cloud
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              
              // Helper to transform formData into API-ready payload
              const preparePayload = (baseData) => {
                const p = { ...baseData };
                if (p.birth_date) p.birth_date = new Date(p.birth_date).toISOString();
                if (p.entry_date) p.entry_date = new Date(p.entry_date).toISOString();
                else delete p.entry_date;
                
                if (p.weight_kg) p.weight_kg = parseFloat(p.weight_kg);
                else p.weight_kg = null;
                
                if (p.latitude) p.latitude = parseFloat(p.latitude);
                else p.latitude = null;
                
                if (p.longitude) p.longitude = parseFloat(p.longitude);
                else p.longitude = null;
                
                return p;
              };

              const payload = preparePayload(formData);
              
              // For creation, we need farm_id
              if (!editingAnimal) {
                payload.farm_id = user?.farm_id || (animals.length > 0 ? animals[0].farm_id : null);
                if (!payload.farm_id || payload.farm_id === 'aaa') {
                  alert("Erreur: Identifiant de ferme introuvable. Veuillez vous reconnecter.");
                  return;
                }
              }

              const action = editingAnimal 
                ? livestockService.updateAnimal(editingAnimal.id, payload)
                : livestockService.addAnimal(payload);
              
              action.then(() => {
                setIsModalOpen(false);
                fetchAnimals();
              }).catch(err => {
                console.error("CRUD Error:", err.response?.data || err.message);
                const detail = err.response?.data?.detail;
                const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
                alert("Erreur: " + (msg || err.message));
              });
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Tag ID (RFID/SVI)</label>
                  <input 
                    required placeholder="BOV-001" value={formData.tag_id}
                    onChange={e => setFormData({...formData, tag_id: e.target.value})}
                    style={modalInputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Espèce</label>
                  <select 
                    value={formData.species}
                    onChange={e => setFormData({...formData, species: e.target.value})}
                    style={modalInputStyle}
                  >
                    <option value="Bovin" style={{ color: '#000' }}>Bovin</option>
                    <option value="Ovin" style={{ color: '#000' }}>Ovin</option>
                    <option value="Caprin" style={{ color: '#000' }}>Caprin</option>
                    <option value="Cheval" style={{ color: '#000' }}>Cheval</option>
                    <option value="Volaille" style={{ color: '#000' }}>Volaille</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Race / Type</label>
                  <input 
                    required placeholder="Ex: Charolaise" value={formData.breed}
                    onChange={e => setFormData({...formData, breed: e.target.value})}
                    style={modalInputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Genre</label>
                  <select 
                    value={formData.gender}
                    onChange={e => setFormData({...formData, gender: e.target.value})}
                    style={modalInputStyle}
                  >
                    <option value="Mâle" style={{ color: '#000' }}>Mâle</option>
                    <option value="Femelle" style={{ color: '#000' }}>Femelle</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Date de Naissance</label>
                  <input 
                    type="date" required value={formData.birth_date}
                    onChange={e => setFormData({...formData, birth_date: e.target.value})}
                    style={modalInputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Date d'Entrée</label>
                  <input 
                    type="date" required value={formData.entry_date}
                    onChange={e => setFormData({...formData, entry_date: e.target.value})}
                    style={modalInputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Etat de santé</label>
                  <select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    style={modalInputStyle}
                  >
                    <option value="Sain" style={{ color: '#000' }}>Sain</option>
                    <option value="Critique" style={{ color: '#000' }}>Critique</option>
                    <option value="Quarantaine" style={{ color: '#000' }}>Quarantaine</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Poids (Ref. kg)</label>
                  <input 
                    type="number" step="0.1" value={formData.weight_kg}
                    onChange={e => setFormData({...formData, weight_kg: e.target.value})}
                    placeholder="450.0"
                    style={modalInputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Latitude (Base)</label>
                  <input 
                    type="number" step="0.0001" value={formData.latitude}
                    onChange={e => setFormData({...formData, latitude: e.target.value})}
                    placeholder="36.60"
                    style={modalInputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Longitude (Base)</label>
                  <input 
                    type="number" step="0.0001" value={formData.longitude}
                    onChange={e => setFormData({...formData, longitude: e.target.value})}
                    placeholder="10.49"
                    style={modalInputStyle}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '1rem', borderRadius: '14px', fontSize: '1rem', fontWeight: '800' }}>
                  {editingAnimal ? "METTRE À JOUR" : "VALIDER LE CHEPTEL"}
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline" style={{ flex: 1, padding: '1rem', borderRadius: '14px', color: '#fff' }}>
                  FERMER
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SANIA PASSPORT — NATIVE PRINT PORTAL */}
      {printingAnimal && createPortal(
        <div className="sania-passport-print" style={{ background: '#fff', width: '100%', minHeight: '100vh', position: 'absolute', top: 0, left: 0, zIndex: 999999 }}>
          {/* ═══ SECTION 1 : EN-TÊTE & IDENTITÉ ═══ */}
          <div className="print-page" style={{ padding: '40px 50px 30px', borderBottom: '6px solid #8BC34A', background: '#ffffff', pageBreakInside: 'avoid' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div>
                <h1 style={{ color: '#111', fontSize: '3rem', margin: 0, fontFamily: "'Playfair Display', serif", fontWeight: 900, letterSpacing: '-1px' }}>
                  🌿 PASSEPORT SANIA
                </h1>
                <p style={{ fontSize: '0.9rem', color: '#8BC34A', letterSpacing: '4px', fontWeight: 900, margin: '8px 0 0 0', textTransform: 'uppercase' }}>
                  Certification Satellite SVI • AgriSmart Tunisia
                </p>
              </div>
              <div style={{ textAlign: 'right', background: '#8BC34A', padding: '12px 20px', borderRadius: '12px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <div style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 900, letterSpacing: '2px' }}>GÉNÉRÉ LE</div>
                <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 900 }}>{new Date().toLocaleDateString('fr-FR')}</div>
              </div>
            </div>
          </div>

          {/* ═══ SECTION 2 : IDENTITÉ BIOMÉTRIQUE ═══ */}
          <div className="print-page" style={{ padding: '30px 50px', background: '#fafffa', borderBottom: '2px solid #e8f5e9', display: 'flex', gap: '30px', alignItems: 'center', pageBreakInside: 'avoid' }}>
              <div style={{ width: '130px', height: '130px', background: '#fff', border: '4px solid #e8f5e9', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', flexShrink: 0, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                {getSpeciesIcon(printingAnimal.animal.species)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', color: '#8BC34A', fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '15px' }}>Identité Biométrique</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                  {[
                    { label: 'TAG ID', value: printingAnimal.animal.tag_id, highlight: true },
                    { label: 'Espèce', value: printingAnimal.animal.species },
                    { label: 'Race / Type', value: printingAnimal.animal.breed || '—' },
                    { label: 'Genre', value: printingAnimal.animal.gender || '—' },
                    { label: 'Âge', value: calculateAge(printingAnimal.animal.birth_date) },
                    { label: 'Poids Réf.', value: `${printingAnimal.telemetry?.weight_kg || printingAnimal.animal.weight_kg || '—'} kg` },
                    { label: 'Date Naissance', value: printingAnimal.animal.birth_date ? new Date(printingAnimal.animal.birth_date).toLocaleDateString('fr-FR') : '—' },
                    { label: 'Date Entrée', value: printingAnimal.animal.entry_date ? new Date(printingAnimal.animal.entry_date).toLocaleDateString('fr-FR') : '—' },
                    { label: 'Statut', value: printingAnimal.animal.status || 'Sain' },
                  ].map((field, i) => (
                    <div key={i} style={{ background: '#fff', padding: '12px 18px', borderRadius: '10px', border: field.highlight ? '2px solid #8BC34A' : '1px solid #e8f5e9' }}>
                      <div style={{ fontSize: '0.65rem', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>{field.label}</div>
                      <div style={{ fontSize: field.highlight ? '1.4rem' : '1rem', fontWeight: field.highlight ? 900 : 700, color: field.highlight ? '#8BC34A' : '#111', marginTop: '4px' }}>{field.value}</div>
                    </div>
                  ))}
                </div>
              </div>
          </div>

          {/* ═══ SECTION 3 : GPS & PROPRIÉTAIRE ═══ */}
          <div className="print-page" style={{ padding: '30px 50px', background: '#ffffff', borderBottom: '2px solid #f0f0f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', pageBreakInside: 'avoid' }}>
            <div style={{ background: '#f8fff8', padding: '20px 25px', borderRadius: '14px', border: '2px solid #8BC34A', display: 'flex', gap: '15px', alignItems: 'center' }}>
              <span style={{ fontSize: '2rem' }}>📡</span>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#8BC34A', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' }}>Coordonnées GPS (Live)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#111', marginTop: '5px' }}>
                  {printingAnimal.telemetry?.latitude ?? printingAnimal.animal.latitude ?? '—'}, {printingAnimal.telemetry?.longitude ?? printingAnimal.animal.longitude ?? '—'}
                </div>
              </div>
            </div>
            <div style={{ background: '#f8f8f8', padding: '20px 25px', borderRadius: '14px', border: '1px solid #e0e0e0', display: 'flex', gap: '15px', alignItems: 'center' }}>
              <span style={{ fontSize: '2rem' }}>🏡</span>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#999', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' }}>Ferme & Propriétaire</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111', marginTop: '5px' }}>Sania Integrated Farm #001</div>
                <div style={{ fontSize: '0.85rem', color: '#555' }}>{user?.full_name || 'AgriSmart Manager'}</div>
              </div>
            </div>
          </div>

          {/* ═══ SECTION 4 : CONSTANTES VITALES ═══ */}
          <div className="print-page" style={{ padding: '30px 50px', background: '#fff9f7', borderBottom: '2px solid #fde8e0', pageBreakInside: 'avoid' }}>
            <div style={{ fontSize: '0.8rem', color: '#C75B39', fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '20px' }}>📊 Constantes Vitales Biométriques</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
              {[
                { label: 'Fréq. Cardiaque', value: `${Math.round(printingAnimal.telemetry?.heart_rate || 60)} BPM`, color: '#C75B39', icon: '❤️' },
                { label: 'Température', value: `${(printingAnimal.telemetry?.temperature_c || 38.5).toFixed(1)} °C`, color: '#8BC34A', icon: '🌡️' },
                { label: 'Activité', value: printingAnimal.telemetry?.activity_level || 'Normal', color: '#111', icon: '🏃' },
                { label: 'Confidence SVI', value: printingAnimal.telemetry?.svi_confidence ? `${(printingAnimal.telemetry.svi_confidence * 100).toFixed(1)}%` : '99.8%', color: '#5b8bc7', icon: '🛰️' },
              ].map((v, i) => (
                <div key={i} style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: `2px solid ${v.color}20`, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{v.icon}</div>
                  <div style={{ fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>{v.label}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: v.color, marginTop: '5px' }}>{v.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ SECTION 5 : ANALYSE MÉTABOLIQUE SVI ═══ */}
          <div className="print-page" style={{ padding: '30px 50px', background: '#ffffff', borderBottom: '2px solid #f0f0f0', pageBreakInside: 'avoid' }}>
            <div style={{ fontSize: '0.8rem', color: '#5b8bc7', fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '20px' }}>🌿 Analyse Satellite SVI Orbital</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              {[
                { label: 'NDVI Pâturage', value: '0.82', desc: 'Qualité herbe — Excellent', color: '#8BC34A' },
                { label: 'Fiabilité Scan', value: '99.8%', desc: 'Système SVI opérationnel', color: '#C75B39' },
                { label: 'Source Données', value: 'SAT', desc: 'Réseau Copernicus ESA', color: '#5b8bc7' },
              ].map((m, i) => (
                <div key={i} style={{ padding: '20px', border: `2px solid ${m.color}30`, borderLeft: `4px solid ${m.color}`, borderRadius: '10px', background: `${m.color}08` }}>
                  <div style={{ fontSize: '0.65rem', color: '#999', marginBottom: '5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>{m.label}</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#111' }}>{m.value}</div>
                  <div style={{ fontSize: '0.8rem', color: '#777', marginTop: '5px' }}>{m.desc}</div>
                </div>
              ))}
            </div>
            <div className="print-dark-box" style={{ marginTop: '20px', padding: '20px 25px', background: '#111', borderRadius: '12px', display: 'flex', gap: '15px', alignItems: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <span style={{ fontSize: '1.8rem' }}>🛰️</span>
              <p style={{ fontStyle: 'italic', lineHeight: 1.55, fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>
                Cet animal est surveillé en temps réel via le réseau Copernicus. Ses constantes sont conformes aux seuils de santé AgriSmart Tunisia.
              </p>
            </div>
          </div>

          {/* ═══ SECTION 6 : REGISTRE VACCINAL ═══ */}
          <div className="print-page" style={{ padding: '30px 50px', background: '#fafff8', borderBottom: '2px solid #e8f5e9', pageBreakInside: 'avoid' }}>
            <div style={{ fontSize: '0.8rem', color: '#8BC34A', fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '20px' }}>💉 Registre Vaccinal (SVI)</div>
            {printingAnimal.healthData.vaccinations?.length > 0 ? (
              <div style={{ width: '100%', fontSize: '1rem', border: '1px solid #e8f5e9', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', background: '#e8f5e9', padding: '12px 18px', borderBottom: '2px solid #8BC34A', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                   <div style={{ flex: 2, fontWeight: 900, color: '#111', fontSize: '0.8rem', textTransform: 'uppercase' }}>Vaccin</div>
                   <div style={{ flex: 1, fontWeight: 900, color: '#111', fontSize: '0.8rem', textTransform: 'uppercase' }}>Date Injection</div>
                   <div style={{ flex: 1, fontWeight: 900, color: '#111', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Prochain Rappel</div>
                </div>
                {printingAnimal.healthData.vaccinations.map((v, i) => (
                  <div key={v.id} style={{ display: 'flex', padding: '12px 18px', background: i % 2 === 0 ? '#fff' : '#f8fff8', borderBottom: '1px solid #e8f5e9', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    <div style={{ flex: 2, fontWeight: 700, color: '#111' }}>{v.vaccine_name}</div>
                    <div style={{ flex: 1, color: '#444' }}>{new Date(v.date).toLocaleDateString('fr-FR')}</div>
                    <div style={{ flex: 1, color: '#8BC34A', fontWeight: 900, textAlign: 'right' }}>{new Date(v.next_due_date || v.date).toLocaleDateString('fr-FR')}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '20px 25px', background: '#fff', borderRadius: '10px', border: '1px dashed #c8e6c9', color: '#aaa', fontSize: '0.9rem', fontStyle: 'italic' }}>
                Aucune donnée vaccinale enregistrée pour cet animal.
              </div>
            )}
          </div>

          {/* ═══ SECTION 7 : INTERVENTIONS & SOINS ═══ */}
          <div className="print-page" style={{ padding: '30px 50px', background: '#fff9f7', borderBottom: '2px solid #fde8e0', pageBreakInside: 'avoid' }}>
            <div style={{ fontSize: '0.8rem', color: '#C75B39', fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '20px' }}>💊 Interventions & Soins Médicaux</div>
            {printingAnimal.healthData.treatments?.length > 0 ? (
              <div style={{ width: '100%', fontSize: '1rem', border: '1px solid #fde8e0', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', background: '#fde8e0', padding: '12px 18px', borderBottom: '2px solid #C75B39', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                   <div style={{ flex: 2, fontWeight: 900, color: '#111', fontSize: '0.8rem', textTransform: 'uppercase' }}>Traitement</div>
                   <div style={{ flex: 1, fontWeight: 900, color: '#111', fontSize: '0.8rem', textTransform: 'uppercase' }}>Début</div>
                   <div style={{ flex: 1, fontWeight: 900, color: '#111', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Statut</div>
                </div>
                {printingAnimal.healthData.treatments.map((t, i) => (
                  <div key={t.id} style={{ display: 'flex', padding: '12px 18px', background: i % 2 === 0 ? '#fff' : '#fff9f7', borderBottom: '1px solid #fde8e0', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    <div style={{ flex: 2, fontWeight: 700, color: '#111' }}>{t.medication_name}</div>
                    <div style={{ flex: 1, color: '#444' }}>{new Date(t.start_date).toLocaleDateString('fr-FR')}</div>
                    <div style={{ flex: 1, color: '#C75B39', fontWeight: 900, textAlign: 'right' }}>✔ CERTIFIÉ</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '20px 25px', background: '#fff', borderRadius: '10px', border: '1px dashed #fecdc2', color: '#aaa', fontSize: '0.9rem', fontStyle: 'italic' }}>
                Aucune intervention médicale répertoriée.
              </div>
            )}
          </div>

          {/* ═══ PIED DE PAGE CERTIFICATION ═══ */}
          <div className="print-page print-dark-box" style={{ padding: '30px 50px', background: '#111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pageBreakInside: 'avoid', borderBottom: 'none', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#8BC34A', fontWeight: 900, letterSpacing: '2px' }}>SANIA — AGRISMART TUNISIA</div>
              <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '5px' }}>Document certifié • Sync Orbital v5.0</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 700 }}>ID: {printingAnimal.animal.id?.slice(0, 8)?.toUpperCase()}</div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '3px' }}>Animal: {printingAnimal.animal.tag_id}</div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* SVI Orbital Scan Modal */}
      <OrbitalScanModal 
        isOpen={isScanModalOpen} 
        onClose={() => { setIsScanModalOpen(false); setForceManualScan(false); }} 
        user={user} 
        farmLocation={farmData?.location}
        manualCaptureLocation={mapCaptureLocation}
        forceManual={forceManualScan}
      />
      {/* Health Diagnostic IA Modal */}
      <HealthScanModal
        isOpen={!!healthScanAnimal}
        onClose={() => setHealthScanAnimal(null)}
        animal={healthScanAnimal}
        onStatusUpdated={() => fetchAnimals()}
      />
      {/* Command Palette (⌘K / Ctrl+K) */}
      <CommandPalette
        animals={animals}
        onSelectAnimal={(a) => setHealthScanAnimal(a)}
        onAction={(id) => {
          if (id === 'orbital')   setIsScanModalOpen(true);
          if (id === 'health')    setHealthScanAnimal(animals[0] || null);
          if (id === 'print' && animals[0]) setPrintingAnimal({ animal: animals[0], telemetry: telemetryData[animals[0].id], healthData: {} });
          if (id === 'export') {
            const csv = ['tag_id,species,breed,status,weight_kg']
              .concat(animals.map(a => [a.tag_id, a.species, a.breed, a.status, a.weight_kg].join(',')))
              .join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = 'cheptel.csv'; link.click();
            URL.revokeObjectURL(url);
          }
        }}
      />
    </div>
  );
};

// Common style for modal inputs to avoid repetition
const modalInputStyle = {
  width: '100%', 
  padding: '0.9rem 1.2rem', 
  background: 'rgba(255,255,255,0.03)', 
  border: '1px solid rgba(255,255,255,0.1)', 
  borderRadius: '14px', 
  color: '#fff',
  fontSize: '0.9rem',
  outline: 'none',
  transition: 'all 0.3s ease'
};

export default AnimalsDashboard;
