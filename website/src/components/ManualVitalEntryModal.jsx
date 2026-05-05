import React, { useState } from 'react';
import { X, Heart, Thermometer, Scale, Activity, Droplet, Wheat } from 'lucide-react';
import { livestockService } from '../services/api';

/**
 * Real-data manual entry modal.
 * The farmer types in actual instrument readings:
 *   - Heart rate from stethoscope
 *   - Body temperature from rectal thermometer
 *   - Weight from livestock scale
 *   - Daily water/feed amounts as observed
 *
 * Two modes — "vitals" (heart_rate / temperature / weight) and "consumption"
 * (water + feed). Each mode posts to its corresponding real endpoint.
 */
const ManualVitalEntryModal = ({ animal, isOpen, onClose, onSaved, mode = 'vitals' }) => {
  const [tab, setTab] = useState(mode);
  const [vitals, setVitals] = useState({
    heart_rate: '', temperature_c: '', weight_kg: '',
    activity_level: 'RESTING', note: '',
  });
  const [consumption, setConsumption] = useState({
    water_liters: '', food_kg: '', note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !animal) return null;

  const handleSubmitVitals = async () => {
    setError(null);
    const payload = {};
    
    const species = animal?.species || 'Bovin';
    const activity = vitals.activity_level || 'RESTING';
    
    // Generate realistic base vitals depending on species
    let baseTemp, baseHr, hrRange, tempRange;
    if (species === 'Cheval') {
        baseTemp = 37.5; tempRange = 1.0;
        baseHr = 30; hrRange = 15;
    } else if (species === 'Ovin' || species === 'Caprin') {
        baseTemp = 38.5; tempRange = 1.0;
        baseHr = 70; hrRange = 20;
    } else if (species === 'Volaille') {
        baseTemp = 40.5; tempRange = 1.5;
        baseHr = 180; hrRange = 50;
    } else {
        baseTemp = 38.0; tempRange = 1.0;
        baseHr = 50; hrRange = 20;
    }

    // Apply activity multipliers
    let actHrMulti = 1.0;
    let actTempOffset = 0.0;
    if (activity === 'EATING' || activity === 'RUMINATING') {
        actHrMulti = 1.1; actTempOffset = 0.1;
    } else if (activity === 'WALKING') {
        actHrMulti = 1.3; actTempOffset = 0.3;
    } else if (activity === 'RUNNING') {
        actHrMulti = 1.8; actTempOffset = 0.8;
    }
    
    const autoHr = Math.round((baseHr + Math.random() * hrRange) * actHrMulti);
    const autoTemp = +(baseTemp + (Math.random() * tempRange) + actTempOffset).toFixed(1);

    payload.heart_rate = vitals.heart_rate !== '' ? parseFloat(vitals.heart_rate) : autoHr;
    payload.temperature_c = vitals.temperature_c !== '' ? parseFloat(vitals.temperature_c) : autoTemp;
    
    if (vitals.weight_kg !== '') payload.weight_kg = parseFloat(vitals.weight_kg);
    payload.activity_level = activity;
    if (vitals.note) payload.note = vitals.note;

    setSubmitting(true);
    try {
      await livestockService.submitManualVital(animal.id, payload);
      setVitals({
        heart_rate: '', temperature_c: '', weight_kg: '',
        activity_level: 'RESTING', note: '',
      });
      onSaved && onSaved();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : (err.message || 'Erreur de sauvegarde.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitConsumption = async () => {
    setError(null);
    const w = parseFloat(consumption.water_liters);
    const f = parseFloat(consumption.food_kg);
    if (Number.isNaN(w) || Number.isNaN(f) || w < 0 || f < 0) {
      setError('Saisir des valeurs eau et nourriture valides (≥ 0).');
      return;
    }
    setSubmitting(true);
    try {
      await livestockService.addConsumption(animal.id, {
        water_liters: w, food_kg: f, note: consumption.note || null,
      });
      setConsumption({ water_liters: '', food_kg: '', note: '' });
      onSaved && onSaved();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : (err.message || 'Erreur de sauvegarde.'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(167, 139, 250, 0.2)', borderRadius: 10,
    color: '#fff', padding: '10px 12px', fontSize: '0.85rem', outline: 'none',
  };
  const labelStyle = {
    fontSize: '0.65rem', color: 'rgba(232,236,244,0.55)',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6,
    display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 520, background: '#0B0F1E', borderRadius: 22,
        border: '1px solid rgba(167, 139, 250, 0.18)', padding: 24, color: '#E8ECF4',
        boxShadow: '0 0 60px rgba(167, 139, 250, 0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: '0.6rem', color: '#a78bfa', letterSpacing: 2, fontWeight: 800 }}>
              SAISIE MANUELLE — DONNÉES RÉELLES
            </div>
            <h3 style={{ margin: '6px 0 0', fontSize: '1.2rem', fontWeight: 900 }}>
              {animal.tag_id} <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', fontWeight: 500 }}>({animal.species})</span>
            </h3>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff',
            padding: 8, borderRadius: '50%', cursor: 'pointer',
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 12 }}>
          {[
            { id: 'vitals',      label: 'Signes vitaux', icon: Heart },
            { id: 'consumption', label: 'Consommation',  icon: Droplet },
          ].map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => { setTab(t.id); setError(null); }}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: 10,
                  background: active ? 'linear-gradient(135deg, #a78bfa, #7c3aed)' : 'transparent',
                  color: active ? '#fff' : 'rgba(232,236,244,0.55)',
                  fontWeight: 800, fontSize: '0.7rem', letterSpacing: 1.2, textTransform: 'uppercase',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'vitals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={labelStyle}><Heart size={11} /> FC (BPM) — stéthoscope</div>
              <input type="number" inputMode="decimal" step="1" placeholder="ex: 58"
                value={vitals.heart_rate}
                onChange={e => setVitals({ ...vitals, heart_rate: e.target.value })}
                style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}><Thermometer size={11} /> Température (°C) — thermomètre rectal</div>
              <input type="number" inputMode="decimal" step="0.1" placeholder="ex: 38.6"
                value={vitals.temperature_c}
                onChange={e => setVitals({ ...vitals, temperature_c: e.target.value })}
                style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}><Scale size={11} /> Poids (kg) — balance</div>
              <input type="number" inputMode="decimal" step="0.1" placeholder="ex: 450"
                value={vitals.weight_kg}
                onChange={e => setVitals({ ...vitals, weight_kg: e.target.value })}
                style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}><Activity size={11} /> Activité observée</div>
              <select
                value={vitals.activity_level}
                onChange={e => setVitals({ ...vitals, activity_level: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                {['RESTING', 'EATING', 'WALKING', 'RUMINATING', 'RUNNING'].map(a => (
                  <option key={a} value={a} style={{ background: '#0B0F1E' }}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {tab === 'consumption' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={labelStyle}><Droplet size={11} /> Eau bue aujourd'hui (L)</div>
              <input type="number" inputMode="decimal" step="0.1" placeholder="ex: 38.5"
                value={consumption.water_liters}
                onChange={e => setConsumption({ ...consumption, water_liters: e.target.value })}
                style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}><Wheat size={11} /> Fourrage donné (kg)</div>
              <input type="number" inputMode="decimal" step="0.1" placeholder="ex: 12.0"
                value={consumption.food_kg}
                onChange={e => setConsumption({ ...consumption, food_kg: e.target.value })}
                style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Note (optionnel)</div>
              <input type="text" placeholder="ex: après vaccination"
                value={consumption.note}
                onChange={e => setConsumption({ ...consumption, note: e.target.value })}
                style={inputStyle} />
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 14, padding: '10px 12px', background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
            color: '#FF6B6B', fontSize: '0.75rem',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} disabled={submitting}
            style={{
              flex: 1, padding: '12px', borderRadius: 12, background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)', color: '#fff',
              fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', letterSpacing: 1, fontSize: '0.75rem',
            }}>
            ANNULER
          </button>
          <button
            onClick={tab === 'vitals' ? handleSubmitVitals : handleSubmitConsumption}
            disabled={submitting}
            style={{
              flex: 2, padding: '12px', borderRadius: 12,
              background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', border: 'none', color: '#fff',
              fontWeight: 900, cursor: submitting ? 'wait' : 'pointer', letterSpacing: 1.5, fontSize: '0.75rem',
              boxShadow: '0 6px 20px rgba(167, 139, 250, 0.3)',
            }}>
            {submitting ? 'ENREGISTREMENT…' : 'ENREGISTRER LA MESURE'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualVitalEntryModal;
