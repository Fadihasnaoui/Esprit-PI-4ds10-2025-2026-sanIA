import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, ChevronRight, ChevronDown, Activity, Syringe, Pill, HeartPulse, Milk } from 'lucide-react';
import { livestockService } from '../services/api';

const AnimalCard = ({ animal, delay }) => {
  const [expanded, setExpanded] = useState(false);

  // Determine icon based on species
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

  return (
    <div 
      className={`glass-card animate-slide-up delay-${delay}`}
      style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: `3px solid var(--sand-gold)` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <div style={{ 
            fontSize: '1.8rem', background: 'rgba(255,255,255,0.05)', 
            padding: '0.8rem', borderRadius: '12px', height: 'fit-content' 
          }}>
            {getSpeciesIcon(animal.species)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: "'Playfair Display', serif", color: 'var(--text-bright)' }}>
                {animal.tag_id}
              </h3>
              <span className="badge" style={{ background: 'rgba(212, 168, 67, 0.1)', color: 'var(--sand-gold)', border: '1px solid rgba(212, 168, 67, 0.2)' }}>
                {animal.species}
              </span>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              {animal.breed} • {calculateAge(animal.birth_date)}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vaccinations</div>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--primary)' }}>
            {animal.vaccinations?.length || 0}
          </div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Traitements</div>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--terracotta)' }}>
            {animal.treatments?.length || 0}
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="btn btn-outline"
        style={{ width: '100%', fontSize: '0.75rem', justifyContent: 'center', borderRadius: 'var(--radius-full)', padding: '0.5rem' }}
      >
        {expanded ? <><ChevronDown size={14} /> Masquer le carnet</> : <><ChevronRight size={14} /> Voir le carnet vétérinaire</>}
      </button>

      {expanded && (
        <div className="animate-fade-in" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          
          {/* Vaccinations */}
          <div>
            <h4 style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-light)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Syringe size={14} color="var(--primary)" /> Historique Vaccinal
            </h4>
            {animal.vaccinations && animal.vaccinations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {animal.vaccinations.map((vac, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', padding: '0.5rem', background: 'rgba(139, 195, 74, 0.05)', borderRadius: '6px', border: '1px solid rgba(139, 195, 74, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', color: 'var(--text-bright)' }}>
                      <span>{vac.vaccine_name}</span>
                      <span>{new Date(vac.date).toLocaleDateString()}</span>
                    </div>
                    <div style={{ color: 'var(--text-dim)', marginTop: '2px' }}>
                      {vac.dose} • {vac.vet_name}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune vaccination enregistrée.</p>
            )}
          </div>

          {/* Treatments */}
          <div>
            <h4 style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-light)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Pill size={14} color="var(--terracotta)" /> Traitements Médicaux
            </h4>
            {animal.treatments && animal.treatments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {animal.treatments.map((treat, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', padding: '0.5rem', background: 'rgba(199, 91, 57, 0.05)', borderRadius: '6px', border: '1px solid rgba(199, 91, 57, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', color: 'var(--text-bright)' }}>
                      <span>{treat.diagnosis}</span>
                      <span>{new Date(treat.date).toLocaleDateString()}</span>
                    </div>
                    <div style={{ color: 'var(--text-dim)', marginTop: '2px' }}>
                      {treat.medicine} ({treat.dosage})
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucun traitement enregistré.</p>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

const AnimalsDashboard = () => {
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecies, setFilterSpecies] = useState('all');

  useEffect(() => {
    livestockService.getAnimals()
      .then(res => {
        setAnimals(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching animals:", err);
        setLoading(false);
      });
  }, []);

  const speciesList = [...new Set(animals.map(a => a.species))];
  
  const filteredAnimals = animals.filter(a => {
    const matchesSearch = a.tag_id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.breed.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterSpecies === 'all' || a.species === filterSpecies;
    return matchesSearch && matchesFilter;
  });

  return (
    <div style={{ padding: '2rem 0' }}>
       {/* Header */}
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🐄</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--sand-gold)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '600' }}>Gestion du Cheptel</span>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: '700', color: 'var(--text-bright)' }}>
            Animaux & <span className="gradient-text-warm">Suivi Vétérinaire</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            {animals.length} têtes • {speciesList.length} espèces • Suivi sanitaire complet
          </p>
        </div>
        <button className="btn btn-warm">
          <Plus size={16} /> Ajouter un animal
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="🔍 Rechercher (ID, race)..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          style={{ 
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)',
            padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', color: 'var(--text-light)',
            fontSize: '0.9rem', width: '100%', maxWidth: '300px',
            fontFamily: "'Inter', sans-serif",
          }}
        />
        <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--glass)', padding: '0.25rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--glass-border)' }}>
          <button
            onClick={() => setFilterSpecies('all')}
            className={filterSpecies === 'all' ? 'btn btn-primary' : 'btn'}
            style={{ padding: '0.35rem 0.8rem', fontSize: '0.72rem', borderRadius: 'var(--radius-full)', background: filterSpecies === 'all' ? undefined : 'transparent', color: filterSpecies === 'all' ? undefined : 'var(--text-muted)' }}
          >
            Tous
          </button>
          {speciesList.map(sp => (
            <button key={sp}
              onClick={() => setFilterSpecies(sp)}
              className={filterSpecies === sp ? 'btn btn-primary' : 'btn'}
              style={{ padding: '0.35rem 0.8rem', fontSize: '0.72rem', borderRadius: 'var(--radius-full)', background: filterSpecies === sp ? undefined : 'transparent', color: filterSpecies === sp ? undefined : 'var(--text-muted)' }}
            >
              {sp}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
          <div className="floating"><Activity size={40} color="var(--primary)" /></div>
        </div>
      ) : (
        <div className="grid-cols-3">
          {filteredAnimals.map((animal, i) => (
            <AnimalCard key={animal.id} animal={animal} delay={i % 6} />
          ))}
        </div>
      )}

      {filteredAnimals.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <p>Aucun animal trouvé.</p>
        </div>
      )}
    </div>
  );
};

export default AnimalsDashboard;
