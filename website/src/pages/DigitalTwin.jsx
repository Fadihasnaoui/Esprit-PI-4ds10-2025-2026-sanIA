import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  BadgeCheck,
  Bot,
  CalendarDays,
  CreditCard,
  Droplets,
  Eye,
  LockKeyhole,
  Loader2,
  Mail,
  RadioTower,
  ShieldAlert,
  Sparkles,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { BACKEND_ORIGIN } from '../services/backendConfig';
import { fieldService, twinService } from '../services/api';

// ── Zone → crop type mapping (must match backend ZONES list) ────────────────
const ZONES = [
  { key: 'Potato', label: 'Potato 🥔', cropType: 'potato' },
  { key: 'Tomato', label: 'Tomato 🍅', cropType: 'tomato' },
  { key: 'Grape',  label: 'Grape 🍇',  cropType: 'grape'  },
  { key: 'Apple',  label: 'Apple 🍎',  cropType: 'apple'  },
];

// ── Field selector panel shown above the Unity embed ────────────────────────
function TwinFieldConfigurator({ onSaved }) {
  const [fields,   setFields]   = useState([]);
  const [mapping,  setMapping]  = useState({ Potato: null, Tomato: null, Grape: null, Apple: null });
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.allSettled([fieldService.getFields(), twinService.getMapping()])
      .then(([fResult, mResult]) => {
        // Fields — always try to load, don't let mapping failure block this
        if (fResult.status === 'fulfilled') {
          const data = fResult.value?.data;
          setFields(Array.isArray(data) ? data : []);
        } else {
          console.error('Failed to load fields:', fResult.reason);
        }

        // Mapping — convert zones array to flat dict
        let hasMapping = false;
        if (mResult.status === 'fulfilled') {
          const zonesArr = mResult.value?.data?.zones || [];
          const savedMapping = Object.fromEntries(zonesArr.map(e => [e.zone, e.field_id || null]));
          setMapping(prev => ({ ...prev, ...savedMapping }));
          hasMapping = zonesArr.some(e => e.field_id);
        }
        setOpen(!hasMapping);
      })
      .finally(() => setLoading(false));
  }, []);

  const fieldsForZone = (zone) => {
    const ct = ZONES.find(z => z.key === zone)?.cropType || '';
    // Match zone key exactly (case-insensitive) OR the cropType substring
    return fields.filter(f => {
      const raw = (f.crop_type || '').toLowerCase();
      return raw === zone.toLowerCase() || raw.includes(ct);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await twinService.saveMapping(mapping);
      setSaved(true);
      setOpen(false);
      onSaved?.(mapping);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div style={{
      background: 'rgba(10,26,15,0.85)',
      border: '1px solid rgba(100,200,100,0.2)',
      borderRadius: 12,
      marginBottom: '1rem',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.7rem 1.1rem', background: 'transparent', border: 'none',
          cursor: 'pointer', color: 'var(--text-light)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700 }}>
          <RadioTower size={14} color="var(--primary)" />
          Digital Twin — Field Configuration
        </span>
        <span style={{ fontSize: '0.75rem', color: saved ? '#7ec87e' : 'var(--text-dim)' }}>
          {saved ? '✓ Saved' : open ? 'Hide ▲' : 'Configure ▼'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 1.1rem 1.1rem' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
            Pick one field per zone. The Digital Twin will monitor these fields for irrigation & health.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            {ZONES.map(zone => {
              const options = fieldsForZone(zone.key);
              return (
                <div key={zone.key} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10, padding: '0.75rem',
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>
                    {zone.label}
                  </div>
                  {options.length === 0 ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      {fields.length === 0
                        ? 'No fields found for your farm'
                        : `No ${zone.key} fields (crop_type must contain "${ZONES.find(z=>z.key===zone.key)?.cropType}")`}
                    </div>
                  ) : (
                    <select
                      value={mapping[zone.key] || ''}
                      onChange={e => setMapping(m => ({ ...m, [zone.key]: e.target.value || null }))}
                      style={{
                        width: '100%', background: 'rgba(0,0,0,0.4)', color: 'var(--text-light)',
                        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7,
                        padding: '0.4rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer',
                      }}
                    >
                      <option value="">— Select field —</option>
                      {options.map(f => (
                        <option key={f.id} value={f.id}>{f.name} ({f.area_ha} ha)</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '0.55rem 1.6rem', borderRadius: 99,
              background: saving ? 'rgba(100,180,100,0.3)' : 'var(--gradient-earth)',
              border: 'none', color: '#fff', fontWeight: 700,
              fontSize: '0.82rem', cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save & Launch Twin'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Unity build paths (files live in website/public/twin/) ──────────────────
const BUILD_NAME   = 'SanIA_Twin';
const BUILD_ROOT   = '/twin/Build';
const LOADER_URL   = `${BUILD_ROOT}/${BUILD_NAME}.loader.js`;
const UNITY_CONFIG = {
  dataUrl:             `${BUILD_ROOT}/${BUILD_NAME}.data.unityweb`,
  frameworkUrl:        `${BUILD_ROOT}/${BUILD_NAME}.framework.js.unityweb`,
  codeUrl:             `${BUILD_ROOT}/${BUILD_NAME}.wasm.unityweb`,
  streamingAssetsUrl:  '/twin/StreamingAssets',
  companyName:         'SanIA',
  productName:         'SanIA Digital Twin',
  productVersion:      '1.0',
};

// ── Unity WebGL embed ────────────────────────────────────────────────────────
function UnityTwinEmbed() {
  const canvasRef        = useRef(null);
  const instanceRef      = useRef(null);
  const scriptRef        = useRef(null);
  const [phase, setPhase]     = useState('idle');   // idle | loading | ready | error
  const [progress, setProgress] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef(null);

  const jwt = localStorage.getItem('token') || '';

  const load = useCallback(() => {
    if (phase === 'loading' || phase === 'ready') return;
    setPhase('loading');
    setProgress(0);

    // Inject config so Unity jslib can read them before any C# runs
    window.SANIA_BACKEND_URL = BACKEND_ORIGIN;
    window.SANIA_JWT         = jwt;

    const script = document.createElement('script');
    script.src = LOADER_URL;
    scriptRef.current = script;

    script.onload = () => {
      if (!canvasRef.current) { setPhase('error'); return; }
      window.createUnityInstance(canvasRef.current, UNITY_CONFIG, (p) => {
        setProgress(Math.round(p * 100));
      })
        .then((instance) => {
          instanceRef.current = instance;
          setPhase('ready');
          // Also send JWT via SendMessage for late-arriving WebGLAuthBridge
          if (jwt) instance.SendMessage('WebGLAuthBridge', 'ReceiveJwt', jwt);
        })
        .catch((err) => {
          console.error('[UnityTwin] createUnityInstance failed:', err);
          setPhase('error');
        });
    };

    script.onerror = () => setPhase('error');
    document.body.appendChild(script);
  }, [phase, jwt]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (instanceRef.current) { instanceRef.current.Quit(); instanceRef.current = null; }
      if (scriptRef.current && document.body.contains(scriptRef.current)) {
        document.body.removeChild(scriptRef.current);
      }
    };
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  const retry = () => {
    if (instanceRef.current) { instanceRef.current.Quit(); instanceRef.current = null; }
    if (scriptRef.current && document.body.contains(scriptRef.current)) {
      document.body.removeChild(scriptRef.current);
    }
    setPhase('idle');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          background: '#06100c',
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}
      >
        <canvas
          ref={canvasRef}
          id="unity-canvas"
          style={{ width: '100%', height: '100%', display: phase === 'ready' ? 'block' : 'none' }}
          tabIndex={-1}
        />

        {/* Idle state — start button */}
        {phase === 'idle' && (
          <div style={overlayStyle}>
            <button
              type="button"
              onClick={load}
              style={{
                padding: '0.9rem 2.2rem',
                borderRadius: 99,
                background: 'var(--gradient-earth)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(139,195,74,0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <Sparkles size={18} /> Lancer le Digital Twin
            </button>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: '0.6rem' }}>
              ~50 MB — WebGL 2.0 requis
            </p>
          </div>
        )}

        {/* Loading progress */}
        {phase === 'loading' && (
          <div style={overlayStyle}>
            <Loader2 className="animate-spin" size={32} color="var(--primary)" />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
              Chargement de la simulation… {progress}%
            </p>
            <div style={{
              width: 220,
              height: 4,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 99,
              marginTop: '0.6rem',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                background: 'var(--gradient-earth)',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <div style={overlayStyle}>
            <p style={{ color: 'var(--terracotta)', fontWeight: 700 }}>
              Impossible de charger le twin.
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: '0.4rem', maxWidth: 340, textAlign: 'center' }}>
              Le build WebGL n&apos;est pas encore déployé ou votre navigateur ne supporte pas WebGL 2.0.
            </p>
            <button type="button" onClick={retry} style={iconBtnStyle}>
              <RefreshCw size={15} /> Réessayer
            </button>
          </div>
        )}

        {/* Controls overlay (visible once ready) */}
        {phase === 'ready' && (
          <div style={{
            position: 'absolute',
            top: 10,
            right: 10,
            display: 'flex',
            gap: '0.5rem',
            zIndex: 10,
          }}>
            <button type="button" onClick={toggleFullscreen} style={iconBtnStyle} title="Plein écran">
              <Maximize2 size={14} />
            </button>
          </div>
        )}
      </div>

      {phase === 'ready' && (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', textAlign: 'center' }}>
          Cliquez dans la scene pour capturer la souris · <kbd>T</kbd> vitesse · <kbd>W</kbd> pluie · <kbd>I</kbd> maladie · <kbd>R</kbd> reset
        </p>
      )}
    </div>
  );
}

const overlayStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

const iconBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.4rem 0.9rem',
  borderRadius: 99,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'var(--text-light)',
  fontSize: '0.8rem',
  cursor: 'pointer',
  marginTop: '1rem',
};

// ── Marketing content ────────────────────────────────────────────────────────
const twinShots = [
  { src: '/digital-twin/twin-1.png', title: 'Vue drone du domaine',        text: 'Surveillez les zones cultivees, les animaux et les alertes depuis une scene 3D lisible.' },
  { src: '/digital-twin/twin-2.png', title: 'Simulation en temps reel',    text: 'Visualisez les decisions d irrigation, l evolution du climat et les foyers de maladie.' },
  { src: '/digital-twin/twin-3.png', title: 'Scenario 7 jours',            text: 'Testez la pluie, la chaleur et les risques avant de passer a l action sur terrain.' },
  { src: '/digital-twin/twin-4.png', title: 'Pilotage premium',            text: 'Donnez au farmer une vue claire des simulations avancees reservees aux abonnes SANIA.' },
];

const benefits = [
  { icon: Eye,        title: 'Voir toute la ferme',       text: 'Une copie 3D simple de votre exploitation, avec cultures, animaux et zones a risque.' },
  { icon: Droplets,   title: 'Comprendre l irrigation',   text: 'SANIA affiche ou arroser, ou attendre, et pourquoi la decision a ete prise.' },
  { icon: ShieldAlert,title: 'Anticiper les pertes',      text: 'Les foyers de maladie et les situations de stress sont visibles avant qu elles deviennent graves.' },
  { icon: Bot,        title: 'IA agricole connectee',     text: 'Le digital twin utilise les memes donnees que le site: parcelles, meteo, scans, cheptel et alertes.' },
];

const plans = [
  'Installation et configuration du domaine',
  'Acces au simulateur 3D SANIA',
  'Suivi irrigation et maladies',
  'Preview 7 jours pour les decisions critiques',
  'Support equipe SANIA pour demarrage',
];

const DEMO_PAID_TWIN_EMAILS = new Set(['fellah@sania.ai']);

const getTwinPassKey = (email) => `sania-twin-pass-paid:${String(email || 'guest').toLowerCase()}`;

const DigitalTwin = ({ user }) => {
  const userEmail = String(user?.email || '').toLowerCase();
  const isDemoPrepaid = DEMO_PAID_TWIN_EMAILS.has(userEmail);
  const [paidPass, setPaidPass] = useState(() => {
    if (isDemoPrepaid) return true;
    return localStorage.getItem(getTwinPassKey(userEmail)) === 'true';
  });
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (isDemoPrepaid) {
      setPaidPass(true);
      localStorage.setItem(getTwinPassKey(userEmail), 'true');
      return;
    }
    setPaidPass(localStorage.getItem(getTwinPassKey(userEmail)) === 'true');
  }, [isDemoPrepaid, userEmail]);

  const requestAccess = () => {
    window.location.href = 'mailto:support@sania.ai?subject=Acces%20Digital%20Twin%20SANIA&body=Bonjour%20SANIA,%0AJe%20veux%20activer%20le%20Digital%20Twin%203D%20pour%20mon%20exploitation.%0A%0ANom:%0ATelephone:%0ARegion:%0ASurface:%0A';
  };

  const startDemoStripePayment = () => {
    setPaying(true);
    window.setTimeout(() => {
      localStorage.setItem(getTwinPassKey(userEmail), 'true');
      setPaidPass(true);
      setPaying(false);
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }, 900);
  };

  const scrollToOffer = () => {
    document.getElementById('digital-twin-offer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const showLiveTwin = paidPass || isDemoPrepaid;

  return (
    <section className="digital-twin-page">

      {/* ── Live twin embed ── */}
      {showLiveTwin ? (
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <RadioTower size={16} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-light)' }}>
              Simulation 3D en direct
            </span>
            <span style={{
              padding: '0.15rem 0.6rem',
              borderRadius: 99,
              background: 'rgba(139,195,74,0.12)',
              border: '1px solid rgba(139,195,74,0.25)',
              color: 'var(--primary)',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}>
              {isDemoPrepaid ? 'PASS PAYE - DEMO' : 'LIVE'}
            </span>
          </div>
          <TwinFieldConfigurator />
          <UnityTwinEmbed />
        </div>
      ) : (
        <div className="glass-card" style={{
          marginBottom: '3rem',
          padding: '1.4rem',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, 0.75fr)',
          gap: '1.3rem',
          alignItems: 'center',
        }}>
          <div>
            <span className="badge badge-gold">
              <LockKeyhole size={15} /> pass digital twin requis
            </span>
            <h2 style={{ margin: '1rem 0 0.7rem', color: 'var(--text-light)' }}>
              Debloquez la simulation 3D SANIA
            </h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 780 }}>
              Le jumeau numerique est un module premium. Le farmer paie un pass unique de 20 dollars
              pour ouvrir la scene 3D, connecter ses parcelles, et tester les decisions irrigation,
              maladie, meteo et cheptel dans une simulation interactive.
            </p>
          </div>
          <div style={{
            border: '1px solid rgba(139,195,74,0.28)',
            borderRadius: 18,
            background: 'linear-gradient(145deg, rgba(139,195,74,0.16), rgba(0,0,0,0.18))',
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-light)', fontSize: '1.1rem' }}>Pass Twin 3D</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{userEmail || 'farmer account'}</span>
              </div>
              <strong style={{ color: 'var(--primary)', fontSize: '2rem' }}>$20</strong>
            </div>
            <button className="btn btn-primary" type="button" onClick={startDemoStripePayment} disabled={paying} style={{ width: '100%' }}>
              {paying ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
              {paying ? 'validation stripe demo...' : 'payer avec stripe demo'}
            </button>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', margin: '0.8rem 0 0', lineHeight: 1.5 }}>
              Demo jury: aucun vrai paiement n est envoye. Le compte fellah@sania.ai est deja marque comme paye.
            </p>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <div className="digital-twin-hero">
        <div className="digital-twin-copy">
          <span className="badge badge-primary">
            <Sparkles size={15} /> module premium
          </span>
          <h1>
            Votre ferme en <span className="gradient-text">jumeau numerique 3D</span>
          </h1>
          <p>
            SANIA peut transformer votre domaine en scene interactive: vous voyez les parcelles, les cultures,
            le cheptel, l irrigation, la meteo et les alertes comme si vous survoliez votre ferme.
          </p>
          <div className="digital-twin-actions">
            <button className="btn btn-primary" type="button" onClick={requestAccess}>
              <Mail size={18} /> demander l acces
            </button>
            <button className="btn btn-outline" type="button" onClick={scrollToOffer}>
              <CreditCard size={18} /> voir l offre
            </button>
          </div>
        </div>

        <div className="digital-twin-showcase">
          <div className="digital-twin-screen digital-twin-screen-main">
            <img src={twinShots[0].src} alt={twinShots[0].title} />
            <div className="digital-twin-screen-fallback">
              Placez votre image dans website/public/digital-twin/twin-1.png
            </div>
          </div>
          <div className="digital-twin-status-card">
            <RadioTower size={18} />
            <div>
              <strong>Simulation connectee</strong>
              <span>irrigation, maladie, cheptel, meteo</span>
            </div>
          </div>
          <div className="digital-twin-lock">
            <LockKeyhole size={18} /> acces sur abonnement
          </div>
        </div>
      </div>

      {/* ── Gallery ── */}
      <div className="digital-twin-gallery">
        {twinShots.map((shot, index) => (
          <article className="glass-card digital-twin-shot" key={shot.src}>
            <div className="digital-twin-shot-image">
              <img src={shot.src} alt={shot.title} />
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <h3>{shot.title}</h3>
            <p>{shot.text}</p>
          </article>
        ))}
      </div>

      {/* ── Benefits ── */}
      <div className="digital-twin-benefits">
        {benefits.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <article className="glass-card digital-twin-benefit" key={benefit.title}>
              <div className="sania-task-icon">
                <Icon size={20} />
              </div>
              <h3>{benefit.title}</h3>
              <p>{benefit.text}</p>
            </article>
          );
        })}
      </div>

      {/* ── Offer ── */}
      <div id="digital-twin-offer" className="glass-card digital-twin-offer">
        <div>
          <span className="badge badge-gold">
            <CalendarDays size={15} /> abonnement ferme
          </span>
          <h2>Activez le Digital Twin quand votre exploitation est prete</h2>
          <p>
            Le module est reserve aux agriculteurs qui veulent une couche de simulation avancee.
            L equipe SANIA prepare la scene 3D avec vos cultures et vos donnees, puis vous donne l acces.
          </p>
        </div>
        <div className="digital-twin-plan">
          {plans.map((item) => (
            <div key={item}>
              <BadgeCheck size={18} />
              <span>{item}</span>
            </div>
          ))}
          <button className="btn btn-warm" type="button" onClick={requestAccess}>
            reserver une demo payante
          </button>
        </div>
      </div>

    </section>
  );
};

export default DigitalTwin;
