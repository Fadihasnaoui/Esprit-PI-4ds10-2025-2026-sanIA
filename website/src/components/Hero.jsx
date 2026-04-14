import React, { useEffect, useState, useRef } from 'react';
import { ArrowRight, Play, Sprout, Sun, Droplets, Wheat, Leaf, Shield, Zap, ChevronRight } from 'lucide-react';
import gsap from 'gsap';
import { fieldService, livestockService, alertService, diseaseService } from '../services/api';
import FarmCanvas from './3d/FarmCanvas';
import HeroRealBackdrop from './HeroRealBackdrop';

const FloatingFeature = ({ icon: Icon, title, text, delay }) => {
  const ref = useRef(null);
  useEffect(() => {
    gsap.from(ref.current, {
      x: 30,
      opacity: 0,
      duration: 1,
      delay: 2 + delay,
      ease: 'power3.out'
    });
  }, []);

  return (
    <div ref={ref} className="glass-card" style={{
      padding: '1.2rem 1.6rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1.2rem',
      background: 'rgba(255, 255, 255, 0.12)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      marginBottom: '1rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '12px',
        background: 'var(--primary-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--primary)'
      }}>
        <Icon size={20} />
      </div>
      <div>
        <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-bright)', fontFamily: "'Newsreader', serif", marginBottom: '0.2rem' }}>{title}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{text}</div>
      </div>
    </div>
  );
};

const Hero = ({ onStart }) => {
  const [loaded, setLoaded] = useState(false);
  const [stats, setStats] = useState({ fields: 0, animals: 0, alerts: 0, scans: 0, area: 0, healthRate: 100 });
  const contentRef = useRef(null);

  useEffect(() => {
    setLoaded(true);
    const fetchStats = async () => {
      try {
        const [fieldRes, animalRes, alertRes, scanRes] = await Promise.allSettled([
          fieldService.getFields(),
          livestockService.getAnimals(),
          alertService.getAlerts(),
          diseaseService.getScans(),
        ]);
        setStats({
          fields: fieldRes.status === 'fulfilled' ? fieldRes.value.data.length : 0,
          animals: animalRes.status === 'fulfilled' ? animalRes.value.data.length : 0,
          alerts: alertRes.status === 'fulfilled' ? alertRes.value.data.filter(a => a.status === 'open').length : 0,
          scans: scanRes.status === 'fulfilled' ? scanRes.value.data.length : 0,
          area: fieldRes.status === 'fulfilled' ? fieldRes.value.data.reduce((s, f) => s + (f.area_ha || 0), 0) : 0,
          healthRate: scanRes.status === 'fulfilled' && scanRes.value.data.length > 0
            ? Math.round((scanRes.value.data.filter(s => s.predicted_disease?.toLowerCase().includes('healthy')).length / scanRes.value.data.length) * 100)
            : 100,
        });
      } catch (err) {
        console.error("Stats fetch error", err);
      }
    };
    fetchStats();

    // GSAP Animations
    const ctx = gsap.context(() => {
      gsap.from('.hero-reveal', {
        y: 40,
        opacity: 0,
        duration: 1,
        stagger: 0.2,
        ease: 'power4.out',
        delay: 0.5
      });
    }, contentRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="sania-hero-shell" style={{ 
      position: 'relative', 
      minHeight: '100vh', 
      width: '100%', 
      overflow: 'hidden',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)',
      padding: '0 8%',
      alignItems: 'center',
      gap: '4rem'
    }}>
      {/* Background Layer */}
      <div style={{ position: 'absolute', inset: 0, zIndex: -1 }}>
        <HeroRealBackdrop />
      </div>

      {/* Content Column */}
      <div ref={contentRef} style={{ position: 'relative', zIndex: 10 }}>
        <div className="hero-reveal" style={{
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.6rem',
          padding: '0.4rem 1.2rem',
          borderRadius: 'var(--radius-full)',
          background: 'var(--primary-soft)',
          border: '1px solid var(--outline-variant)',
          color: 'var(--primary)',
          fontSize: '0.75rem',
          fontWeight: '700',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          marginBottom: '2rem'
        }}>
          <Sprout size={14} /> Intelligence Agricole de Demain
        </div>

        <h1 className="hero-reveal" style={{
          fontFamily: "'Newsreader', serif",
          fontSize: 'clamp(3rem, 6vw, 5rem)',
          fontWeight: '800',
          lineHeight: 1.05,
          color: 'var(--text-bright)',
          marginBottom: '2rem',
          letterSpacing: '-2px'
        }}>
          Réinventer la terre par la <br />
          <span style={{ color: 'var(--primary)' }}>Culture Digitale.</span>
        </h1>

        <p className="hero-reveal" style={{
          fontSize: '1.2rem',
          color: 'var(--text-muted)',
          lineHeight: 1.7,
          maxWidth: '580px',
          fontFamily: "'Manrope', sans-serif",
          marginBottom: '3rem',
          fontWeight: '500'
        }}>
          Des capteurs IoT intelligents à l'analyse par satellite, SANIA fusionne les données biologiques 
          pour maximiser vos rendements tout en respectant l'équilibre de nos sols tunisiens.
        </p>

        <div className="hero-reveal" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onStart} style={{ padding: '1.2rem 2.8rem', borderRadius: 'var(--radius-md)', background: 'var(--primary)', border: 'none' }}>
            Lancer le Dashboard <ArrowRight size={18} />
          </button>
          <button className="btn btn-outline" style={{ padding: '1.2rem 2.8rem', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
            Voir la démo <Play size={16} fill="currentColor" />
          </button>
        </div>

        {/* Stats strip */}
        <div className="hero-reveal" style={{ 
          display: 'flex', 
          gap: '3rem', 
          marginTop: '4rem',
          borderLeft: '2px solid var(--primary)',
          paddingLeft: '2rem'
        }}>
          {[
            { value: stats.fields, label: 'Zones' },
            { value: stats.animals, label: 'Livestock' },
            { value: `${stats.healthRate}%`, label: 'Santé' }
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-bright)', fontFamily: "'Newsreader', serif" }}>{s.value}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column (The Living Laboratory) */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <div className="glass-card animate-scale-in" style={{
          padding: '2.5rem',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          overflow: 'visible'
        }}>
          <h3 style={{ 
            fontFamily: "'Newsreader', serif", 
            fontSize: '1.5rem', 
            color: 'var(--text-bright)', 
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            Le Lab Vivant
          </h3>
          
          <FloatingFeature 
            icon={Zap} 
            title="Scan Neural" 
            text="Détection instantanée des pathologies" 
            delay={0.2}
          />
          <FloatingFeature 
            icon={Droplets} 
            title="Eco-Irrigation" 
            text="Optimisation hydrique par IA" 
            delay={0.4}
          />
          <FloatingFeature 
            icon={Shield} 
            title="Bio-Sécurité" 
            text="Surveillance du cheptel en temps réel" 
            delay={0.6}
          />
        </div>
        
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          pointerEvents: 'none',
          zIndex: -1,
          opacity: 0.8
        }}>
          <FarmCanvas />
        </div>
      </div>

      {/* Full-bleed film grain from design strategy */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.05,
        pointerEvents: 'none',
        backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")',
        zIndex: 100
      }} />
    </div>
  );
};

export default Hero;
