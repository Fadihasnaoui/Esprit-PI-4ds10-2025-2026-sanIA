import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Search, Filter, ChevronRight, ChevronDown, 
  Activity, Syringe, Pill, HeartPulse, Map, 
  TrendingUp, Wifi, WifiOff, LayoutGrid, Info,
  Edit, Trash2, X, Map as MapIcon, CheckCircle, AlertTriangle
} from 'lucide-react';
import { livestockService } from '../services/api';
import LivestockMap from '../components/LivestockMap';
import VitalSignsChart from '../components/VitalSignsChart';

/* ── Animal Card Component ── */
const AnimalCard = ({ animal, telemetry, delay, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const getSpeciesIcon = (species) => {
    const s = species.toLowerCase();
    if (s.includes('bovin') || s.includes('cow')) return '🐄';
    if (s.includes('ovin') || s.includes('sheep')) return '🐑';
    if (s.includes('caprin') || s.includes('goat')) return '🐐';
    if (s.includes('volaille') || s.includes('chicken')) return '🐔';
    return '🐾';
  };

  const calculateAge = (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);
    const months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
    if (months < 12) return `${months} mois`;
    return `${Math.floor(months / 12)} ans`;
  };

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

  /* Pro Health Score Calculation */
  /* Dynamic Health Status: Sain or Critique only */
  const getHealthInfo = (t, manualStatus) => {
    const isActuallyCritique = t ? (t.heart_rate > 100 || t.temperature_c > 39.5 || t.heart_rate < 40 || t.temperature_c < 37.5) : (manualStatus === 'Critique' || manualStatus === 'URGENCE' || manualStatus === 'Malade');
    return isActuallyCritique ? { label: 'Critique', color: '#ef4444', isBlinking: true } : { label: 'Sain', color: '#22c55e', isBlinking: false };
  };

  const health = getHealthInfo(telemetry, animal.status);
  const statusColor = health.color;

  return (
    <div
      className={`glass-card animate-slide-up`}
      style={{ 
        padding: '1.5rem', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem', 
        borderTop: `4px solid ${statusColor}`,
        transition: 'transform 0.3s ease',
        animationDelay: `${delay * 0.1}s`
      }}
    >
      <style>{blinkStyle}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{
            fontSize: '1.5rem', 
            background: 'var(--bg-elevated)',
            padding: '0.8rem', 
            borderRadius: '16px', 
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)'
          }}>
            {getSpeciesIcon(animal.species)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-bright)' }}>
                {animal.tag_id}
              </h3>
              {telemetry && (
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, boxShadow: `0 0 8px ${statusColor}` }}></div>
              )}
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
              {animal.breed} • {calculateAge(animal.birth_date)}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => onEdit(animal)} className="btn-icon" style={{ padding: '0.4rem', color: 'var(--text-dim)' }}>
            <Edit size={14} />
          </button>
          <button onClick={() => onDelete(animal)} className="btn-icon" style={{ padding: '0.4rem', color: 'var(--terracotta)' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {telemetry ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '12px' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>💓 BPM</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-bright)' }}>{Math.round(telemetry.heart_rate)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>🌡️ Temp</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-bright)' }}>{telemetry.temperature_c}°C</div>
            </div>
          </div>
          
          {/* Pro Health Bar */}
          <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.6rem', borderRadius: '10px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', marginBottom: '0.3rem' }}>
               <span style={{ color: 'var(--text-muted)' }}>SCORE SANTÉ IA</span>
               <span style={{ color: health.color, fontWeight: '700' }}>{health.status} ({health.label})</span>
             </div>
             <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
               <div style={{ width: `${health.score}%`, height: '100%', background: health.color, transition: 'width 1s ease' }}></div>
             </div>
          </div>
        </div>
      ) : (
        <div style={{ height: '90px', border: '1px dashed var(--glass-border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', gap: '0.5rem' }}>
          <WifiOff size={20} opacity={0.5} />
          Hors-ligne (Sensor Disconnected)
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Poids</div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600' }}>
            {telemetry?.weight_kg ? telemetry.weight_kg.toFixed(1) : (animal.weight_kg ? animal.weight_kg.toFixed(1) : '—')} kg
          </div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Vaccins</div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--primary)' }}>{animal.vaccinations?.length || 0}</div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', border: health.isBlinking ? '1px solid #ef4444' : 'none' }} className={health.isBlinking ? 'card-status-blink' : ''}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Santé</div>
          <div style={{ fontSize: '0.8rem', fontWeight: '800', color: health.color }}>{health.label}</div>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="btn btn-outline"
        style={{ width: '100%', fontSize: '0.75rem', justifyContent: 'center', borderRadius: '10px' }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Caract. & Historique
      </button>

      {expanded && (
        <div className="animate-fade-in" style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.1)', padding: '0.8rem', borderRadius: '12px' }}>
            
            {/* Vaccinations Section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase' }}>Vaccinations</span>
                <button 
                  onClick={() => {
                    const name = prompt("Nom du vaccin:");
                    const date = prompt("Date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
                    if (name && date) {
                      livestockService.addVaccination(animal.id, { 
                        vaccine_name: name, dose: '1 dose', vet_name: 'Dr. Vétérinaire', 
                        date: new Date(date).toISOString(), next_due_date: new Date(new Date(date).setMonth(new Date(date).getMonth() + 6)).toISOString() 
                      }).then(() => window.location.reload());
                    }
                  }} 
                  style={{ background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', padding: '0 6px', fontSize: '12px' }}
                >
                  +
                </button>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {animal.vaccinations?.length > 0 ? animal.vaccinations.map(v => (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{v.vaccine_name} ({new Date(v.date).toLocaleDateString()})</span>
                    <button 
                      onClick={() => { if(window.confirm("Supprimer?")) livestockService.deleteVaccination(v.id).then(() => window.location.reload()); }} 
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )) : <span>N/A</span>}
              </div>
            </div>

            {/* Traitements Section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--sand-gold)', fontWeight: '700', textTransform: 'uppercase' }}>Traitements</span>
                <button 
                  onClick={() => {
                    const diagnosis = prompt("Diagnostic:");
                    const medicine = prompt("Médicament:");
                    if (diagnosis && medicine) {
                      livestockService.addTreatment(animal.id, { 
                        diagnosis, medicine, dosage: '1 dose/jour', vet_note: 'Suivi standard', 
                        date: new Date().toISOString()
                      }).then(() => window.location.reload());
                    }
                  }} 
                  style={{ background: 'var(--sand-gold)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', padding: '0 6px', fontSize: '12px' }}
                >
                  +
                </button>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {animal.treatments?.length > 0 ? animal.treatments.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t.medicine}: {t.diagnosis}</span>
                    <button 
                      onClick={() => { if(window.confirm("Supprimer?")) livestockService.deleteTreatment(t.id).then(() => window.location.reload()); }} 
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )) : <span>N/A</span>}
              </div>
            </div>

        </div>
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

  const fetchAnimals = () => {
    setLoading(true);
    livestockService.getAnimals()
      .then(res => {
        setAnimals(res.data);
        if (res.data.length > 0 && !selectedAnimalId) {
          setSelectedAnimalId(res.data[0].id);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching animals:", err);
        setLoading(false);
      });
  };

  const fetchHistory = (id) => {
    if (!id) return;
    setHistoricalTelemetry([]); // Clear while loading
    livestockService.getTelemetryHistory(id, 50)
      .then(res => {
        if (res.data.length > 0) {
          setHistoricalTelemetry(res.data);
          // Also update current view with latest from history
          const last = res.data[0]; // res.data is sorted desc
          setTelemetryData(prev => ({ ...prev, [id]: last }));
        }
      })
      .catch(err => console.error("History fetch failed", err));
  };

  useEffect(() => {
    if (selectedAnimalId) fetchHistory(selectedAnimalId);
  }, [selectedAnimalId]);

  useEffect(() => {
    fetchAnimals();

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

  const speciesList = [...new Set(animals.map(a => a.species))];

  const filteredAnimals = useMemo(() => {
    return animals.filter(a => {
      const matchesSearch = a.tag_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            a.breed.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterSpecies === 'all' || a.species === filterSpecies;
      return matchesSearch && matchesFilter;
    });
  }, [animals, searchTerm, filterSpecies]);

  // Global Health stats
  const activeCount = Object.keys(telemetryData).length;
  
  const critiqueAnimals = animals.filter(a => {
    const t = telemetryData[a.id];
    return t ? (t.heart_rate > 100 || t.temperature_c > 39.5) : (a.status === 'Critique');
  });
  
  const critiqueCount = critiqueAnimals.length;
  const sainCount = animals.length - critiqueCount;

  return (
    <div style={{ padding: '1.5rem 0' }}>
      {/* Top Banner Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total Cheptel', value: animals.length, icon: LayoutGrid, color: 'var(--primary)' },
          { label: 'Connectés (IoT)', value: activeCount, icon: isConnected ? Wifi : WifiOff, color: isConnected ? 'var(--primary)' : 'var(--terracotta)' },
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
        
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: '12px', padding: '0.3rem', border: '1px solid var(--glass-border)' }}>
            <button 
              className={`btn ${viewMode === 'grid' ? 'btn-primary' : ''}`} 
              style={{ borderRadius: '10px', padding: '0.4rem 1.2rem', fontSize: '0.85rem' }}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={16} /> Grille
            </button>
            <button 
              className={`btn ${viewMode === 'live' ? 'btn-primary' : ''}`}
              style={{ borderRadius: '10px', padding: '0.4rem 1.2rem', fontSize: '0.85rem' }}
              onClick={() => setViewMode('live')}
            >
              <MapIcon size={16} /> Live Tracking
            </button>
          </div>
          <button 
            className="btn btn-warm" 
            style={{ borderRadius: '12px' }}
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
            <Plus size={18} /> Nouvel Animal
          </button>
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
      ) : viewMode === 'grid' ? (
        <div className="grid-cols-3">
          {filteredAnimals.map((animal, i) => (
            <AnimalCard 
              key={animal.id} 
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
              onDelete={(a) => {
                setAnimalToDelete(a);
              }}
            />
          ))}
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
              <LivestockMap animals={filteredAnimals} telemetryData={telemetryData} selectedId={selectedAnimalId} onSelectAnimal={setSelectedAnimalId} />
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
                    <VitalSignsChart telemetryData={telemetryData} selectedId={selectedAnimalId} historicalData={historicalTelemetry} />
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
                  {Object.values(telemetryData).sort((a,b) => new Date(b.time) - new Date(a.time)).slice(0, 10).map((t, idx) => {
                    const animal = animals.find(an => an.id === t.animal_id);
                    return (
                      <div key={idx} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{animal?.tag_id || 'ID...'}</span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontFamily: "'Playfair Display', serif" }}>
                {editingAnimal ? "Modifier l'animal" : "Ajouter un animal"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ color: 'var(--text-dim)' }}><X size={20} /></button>
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
              
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Tag ID / Numéro</label>
                <input 
                  type="text" required value={formData.tag_id}
                  onChange={e => setFormData({...formData, tag_id: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Espèce</label>
                  <select 
                    value={formData.species}
                    onChange={e => setFormData({...formData, species: e.target.value})}
                    style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: '#fff' }}
                  >
                    <option value="Bovin">Bovin</option>
                    <option value="Ovin">Ovin</option>
                    <option value="Caprin">Caprin</option>
                    <option value="Volaille">Volaille</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Race</label>
                  <input 
                    type="text" required value={formData.breed}
                    onChange={e => setFormData({...formData, breed: e.target.value})}
                    style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Genre</label>
                  <select 
                    value={formData.gender}
                    onChange={e => setFormData({...formData, gender: e.target.value})}
                    style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: '#fff' }}
                  >
                    <option value="Male">Mâle</option>
                    <option value="Female">Femelle</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Date d'entrée</label>
                  <input 
                    type="date" value={formData.entry_date}
                    onChange={e => setFormData({...formData, entry_date: e.target.value})}
                    style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: '#fff' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Date de naissance</label>
                <input 
                  type="date" required value={formData.birth_date}
                  onChange={e => setFormData({...formData, birth_date: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>État de santé</label>
                <select 
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: '#fff' }}
                >
                  <option value="Sain">Sain</option>
                  <option value="Critique">Critique</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Poids (kg)</label>
                <input 
                  type="number" step="0.1" value={formData.weight_kg}
                  onChange={e => setFormData({...formData, weight_kg: e.target.value})}
                  placeholder="Ex: 450.5"
                  style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Latitude</label>
                  <input 
                    type="number" step="0.0001" value={formData.latitude}
                    onChange={e => setFormData({...formData, latitude: e.target.value})}
                    placeholder="ex: 36.60"
                    style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>Longitude</label>
                  <input 
                    type="number" step="0.0001" value={formData.longitude}
                    onChange={e => setFormData({...formData, longitude: e.target.value})}
                    placeholder="ex: 10.49"
                    style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: '#fff' }}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', padding: '1rem', borderRadius: '14px' }}>
                {editingAnimal ? "Enregistrer les modifications" : "Ajouter au cheptel"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnimalsDashboard;
