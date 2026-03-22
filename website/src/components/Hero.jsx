import React, { useEffect, useState } from 'react';
import { ArrowRight, Play, Sprout, Sun, Droplets, Wheat, Leaf, Shield, Zap } from 'lucide-react';
import { fieldService, livestockService, alertService, diseaseService } from '../services/api';

const FloatingIcon = ({ icon: Icon, delay, x, y, size, color }) => (
  <div className="floating" style={{
    position: 'absolute', left: x, top: y,
    animationDelay: `${delay}s`, animationDuration: `${4 + delay}s`,
    opacity: 0.12, color, filter: `drop-shadow(0 0 8px ${color})`,
  }}>
    <Icon size={size} />
  </div>
);

const Hero = ({ onStart }) => {
  const [loaded, setLoaded] = useState(false);
  const [stats, setStats] = useState({ fields: 0, animals: 0, alerts: 0, scans: 0, area: 0 });

  useEffect(() => { 
    setLoaded(true);
    // Fetch live stats for hero
    const fetchStats = async () => {
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
    };
    fetchStats();
  }, []);

  return (
    <section style={{
      padding: '6rem 0 4rem', display: 'flex', flexDirection: 'column',
      alignItems: 'center', textAlign: 'center', position: 'relative', minHeight: '80vh', justifyContent: 'center', overflow: 'hidden',
    }}>
      {/* Background decorations */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(199,91,57,0.08) 0%, transparent 70%)', top: '-200px', right: '-100px' }} />
        <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,195,74,0.06) 0%, transparent 70%)', bottom: '-200px', left: '-100px' }} />
        <FloatingIcon icon={Sprout} delay={0} x="8%" y="20%" size={40} color="var(--primary)" />
        <FloatingIcon icon={Sun} delay={1.5} x="85%" y="15%" size={36} color="var(--sand-gold)" />
        <FloatingIcon icon={Droplets} delay={0.8} x="90%" y="60%" size={32} color="var(--sky-blue)" />
        <FloatingIcon icon={Wheat} delay={2} x="5%" y="65%" size={38} color="var(--terracotta)" />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '900px' }}>
        {/* Badge */}
        <div className={loaded ? 'animate-slide-up' : ''} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 1.4rem', borderRadius: 'var(--radius-full)',
          background: 'var(--primary-soft)', border: '1px solid rgba(139,195,74,0.25)',
          color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '600',
          marginBottom: '2.5rem', letterSpacing: '1.5px', textTransform: 'uppercase',
        }}>
          <span style={{ fontSize: '1rem' }}>🇹🇳</span>
          Agriculture de Précision — Made in Tunisia
        </div>

        {/* Main heading */}
        <h2 className={loaded ? 'animate-slide-up delay-1' : ''} style={{
          fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          fontWeight: '800', lineHeight: '1.1', marginBottom: '1.8rem', letterSpacing: '-1.5px', color: 'var(--text-bright)',
        }}>
          Cultivons l'avenir avec <br />
          <span className="gradient-text" style={{ fontSize: '1.15em', display: 'inline-block', marginTop: '0.2rem' }}>
            l'intelligence artificielle
          </span>
        </h2>

        <p className={loaded ? 'animate-slide-up delay-2' : ''} style={{
          color: 'var(--text-muted)', fontSize: '1.15rem', maxWidth: '650px',
          margin: '0 auto 3rem', fontWeight: '300', lineHeight: '1.8',
        }}>
          De l'olivier de Sfax aux vignobles du Cap Bon — SANIA surveille vos cultures, 
          optimise l'irrigation et prédit les maladies grâce aux capteurs IoT et à l'IA.
        </p>

        {/* Dynamic Stats */}
        <div className={loaded ? 'animate-slide-up delay-3' : ''} style={{
          display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '3rem', flexWrap: 'wrap',
        }}>
          {[
            { value: stats.fields, label: 'Parcelles actives', icon: Leaf, color: 'var(--primary)' },
            { value: stats.animals, label: 'Animaux suivis', icon: Shield, color: 'var(--sand-gold)' },
            { value: `${stats.healthRate || 100}%`, label: 'Cultures saines', icon: Zap, color: 'var(--sky-blue)' },
            { value: `${stats.area.toFixed(1)}ha`, label: 'Surface totale', icon: Sun, color: 'var(--terracotta)' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center', minWidth: '100px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.3rem' }}>
                <stat.icon size={18} color={stat.color} style={{ opacity: 0.6 }} />
              </div>
              <div style={{ 
                fontSize: '2rem', fontWeight: '800', color: stat.color,
                fontFamily: "'Playfair Display', serif", textShadow: `0 0 20px ${stat.color}30`,
              }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '500' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className={loaded ? 'animate-slide-up delay-4' : ''} style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onStart} style={{ padding: '1.1rem 2.5rem', fontSize: '0.9rem' }}>
            Accéder au Dashboard <ArrowRight size={18} />
          </button>
          <button className="btn btn-outline" style={{ padding: '1.1rem 2.5rem', fontSize: '0.9rem' }}>
            Découvrir SANIA <Play size={18} />
          </button>
        </div>
      </div>

      {/* Decorative bottom line */}
      <div style={{
        position: 'absolute', bottom: 0, left: '10%', right: '10%', height: '2px',
        background: 'linear-gradient(90deg, transparent, var(--terracotta) 25%, var(--sand-gold) 50%, var(--primary) 75%, transparent)', opacity: 0.25,
      }} />
    </section>
  );
};

export default Hero;
