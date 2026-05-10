import React, { useEffect, useState } from 'react';
import { ArrowRight, Droplets, Leaf, Play, Shield, Sprout, Sun, Wheat, Zap } from 'lucide-react';
import { alertService, diseaseService, fieldService, livestockService } from '../services/api';
import SaniaFarmScene from './SaniaFarmScene';
import { useTranslation } from '../i18n';

const FloatingIcon = ({ icon: Icon, delay, x, y, size, color }) => (
  <div className="floating" style={{
    position: 'absolute',
    left: x,
    top: y,
    animationDelay: `${delay}s`,
    animationDuration: `${4 + delay}s`,
    opacity: 0.12,
    color,
    filter: `drop-shadow(0 0 8px ${color})`,
  }}>
    <Icon size={size} />
  </div>
);

const Hero = ({ onStart, onDiscover, theme = 'dark' }) => {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const [stats, setStats] = useState({ fields: 0, animals: 0, alerts: 0, scans: 0, area: 0, healthRate: 100 });

  useEffect(() => {
    setLoaded(true);
    const fetchStats = async () => {
      const [fieldRes, animalRes, alertRes, scanRes] = await Promise.allSettled([
        fieldService.getFields(),
        livestockService.getAnimals(),
        alertService.getAlerts(),
        diseaseService.getScans(),
      ]);
      const scans = scanRes.status === 'fulfilled' ? scanRes.value.data : [];
      setStats({
        fields: fieldRes.status === 'fulfilled' ? fieldRes.value.data.length : 0,
        animals: animalRes.status === 'fulfilled' ? animalRes.value.data.length : 0,
        alerts: alertRes.status === 'fulfilled' ? alertRes.value.data.filter((a) => a.status === 'open').length : 0,
        scans: scans.length,
        area: fieldRes.status === 'fulfilled' ? fieldRes.value.data.reduce((sum, field) => sum + (field.area_ha || 0), 0) : 0,
        healthRate: scans.length > 0
          ? Math.round((scans.filter((scan) => scan.predicted_disease?.toLowerCase().includes('healthy')).length / scans.length) * 100)
          : 100,
      });
    };
    fetchStats();
  }, []);

  const isLight = theme === 'light';
  const heroTextShadow = isLight
    ? '0 1px 0 rgba(255,255,255,0.35), 0 8px 22px rgba(23,32,24,0.16)'
    : '0 8px 40px rgba(0,0,0,0.55)';
  const mutedText = isLight ? '#263326' : 'var(--text-muted)';
  const aiTextGradient = isLight
    ? 'linear-gradient(135deg, #3F7428 0%, #246F86 100%)'
    : 'var(--gradient-primary)';

  return (
    <section className="home-hero-fullbleed" style={{
      padding: '6rem 0 4rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      position: 'relative',
      minHeight: '82vh',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <SaniaFarmScene stats={stats} theme={theme} />

      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        <FloatingIcon icon={Sprout} delay={0} x="8%" y="20%" size={40} color="var(--primary)" />
        <FloatingIcon icon={Sun} delay={1.5} x="85%" y="15%" size={36} color="var(--sand-gold)" />
        <FloatingIcon icon={Droplets} delay={0.8} x="90%" y="60%" size={32} color="var(--sky-blue)" />
        <FloatingIcon icon={Wheat} delay={2} x="5%" y="65%" size={38} color="var(--terracotta)" />
      </div>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: '980px' }}>
        <div className={loaded ? 'animate-slide-up' : ''} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1.4rem',
          borderRadius: 'var(--radius-full)',
          background: isLight ? 'rgba(28, 53, 31, 0.9)' : 'rgba(20, 36, 22, 0.78)',
          border: isLight ? '1px solid rgba(93,150,55,0.38)' : '1px solid rgba(139,195,74,0.34)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: isLight ? '#9BE15D' : 'var(--primary)',
          fontSize: '0.8rem',
          fontWeight: '600',
          marginBottom: '2.5rem',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 900 }}>TN</span>
          {t('hero.badge')}
        </div>

        <h2 className={loaded ? 'animate-slide-up delay-1' : ''} style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          fontWeight: '800',
          lineHeight: '1.1',
          marginBottom: '1.8rem',
          letterSpacing: '0',
          color: 'var(--text-bright)',
          textShadow: heroTextShadow,
        }}>
          {t('hero.titleTop')} <br />
          <span
            className="gradient-text"
            style={{
              backgroundImage: aiTextGradient,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              fontSize: '1.15em',
              display: 'inline-block',
              marginTop: '0.2rem',
            }}
          >
            {t('hero.titleAi')}
          </span>
        </h2>

        <p className={loaded ? 'animate-slide-up delay-2' : ''} style={{
          color: mutedText,
          fontSize: '1.15rem',
          maxWidth: '650px',
          margin: '0 auto 3rem',
          fontWeight: isLight ? '500' : '300',
          lineHeight: '1.8',
          textShadow: isLight ? '0 1px 8px rgba(255,255,255,0.34)' : '0 2px 18px rgba(0,0,0,0.65)',
        }}>
          {t('hero.subtitle')}
        </p>

        <div className={loaded ? 'animate-slide-up delay-3' : ''} style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '2rem',
          marginBottom: '3rem',
          flexWrap: 'wrap',
        }}>
          {[
            { value: stats.fields, label: t('hero.fields'), icon: Leaf, color: 'var(--primary)' },
            { value: stats.animals, label: t('hero.animals'), icon: Shield, color: 'var(--sand-gold)' },
            { value: `${stats.healthRate || 100}%`, label: t('hero.healthy'), icon: Zap, color: 'var(--sky-blue)' },
            { value: `${stats.area.toFixed(1)}ha`, label: t('hero.area'), icon: Sun, color: 'var(--terracotta)' },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: 'center', minWidth: '100px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.3rem' }}>
                <stat.icon size={18} color={stat.color} style={{ opacity: 0.75 }} />
              </div>
              <div style={{
                fontSize: '2rem',
                fontWeight: '800',
                color: stat.color,
                fontFamily: "'Playfair Display', serif",
                textShadow: `0 0 20px ${stat.color}30`,
              }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: '0.72rem',
                color: isLight ? '#455241' : 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: '700',
                textShadow: isLight ? '0 1px 10px rgba(255,255,255,0.65)' : 'none',
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div className={loaded ? 'animate-slide-up delay-4' : ''} style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onStart} style={{ padding: '1.1rem 2.5rem', fontSize: '0.9rem' }}>
            {t('hero.dashboard')} <ArrowRight size={18} />
          </button>
          <button
            className="btn btn-outline hero-discover-btn"
            onClick={onDiscover}
            style={{ padding: '1.1rem 2.5rem', fontSize: '0.9rem' }}
          >
            {t('hero.discover')} <Play size={18} />
          </button>
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: 0,
        left: '10%',
        right: '10%',
        height: '2px',
        background: 'linear-gradient(90deg, transparent, var(--terracotta) 25%, var(--sand-gold) 50%, var(--primary) 75%, transparent)',
        opacity: 0.25,
        zIndex: 2,
      }} />
    </section>
  );
};

export default Hero;
