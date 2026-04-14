import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function HeroSection({ onLaunchDashboard }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-word', {
        y: 90,
        opacity: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'power3.out',
        delay: 0.5,
      });
      gsap.from(['.hero-sub', '.hero-ctas'], {
        y: 30,
        opacity: 0,
        duration: 0.7,
        stagger: 0.15,
        ease: 'power2.out',
        delay: 1.2,
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="sania-hero-copy"
      style={{
        position: 'relative',
        zIndex: 2,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        alignSelf: 'stretch',
      }}
    >
      <div
        style={{
          padding: '0 1rem 0 0',
          maxWidth: 'min(92vw, 520px)',
        }}
      >
        <h1
          className="sania-hero-english-headline"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            lineHeight: 0.92,
            color: '#fff',
            margin: 0,
            textShadow: '0 2px 40px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <span className="hero-word" style={{ display: 'inline-block' }}>
            GROW
          </span>{' '}
          <span className="hero-word" style={{ display: 'inline-block' }}>
            SMARTER.
          </span>
          <br />
          <span className="hero-word" style={{ display: 'inline-block' }}>
            FARM
          </span>{' '}
          <span className="hero-word" style={{ display: 'inline-block' }}>
            SMARTER.
          </span>
        </h1>

        <p
          className="hero-sub"
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: '17px',
            color: 'rgba(240, 235, 227, 0.72)',
            maxWidth: '480px',
            marginTop: '20px',
            lineHeight: 1.65,
            fontWeight: 400,
            textShadow: '0 1px 24px rgba(0,0,0,0.45)',
          }}
        >
          AI-powered precision agriculture for the fields of tomorrow.
          <br />
          Built for Tunisia. Ready for the world.
        </p>

        <div
          className="hero-ctas"
          style={{
            marginTop: '36px',
            display: 'flex',
            flexDirection: 'row',
            gap: '16px',
            flexWrap: 'wrap',
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            className="sania-hero-btn-primary"
            onClick={onLaunchDashboard}
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '13px',
              padding: '14px 28px',
              borderRadius: '6px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Launch Dashboard
          </button>
          <button
            type="button"
            className="sania-hero-btn-ghost"
            onClick={() => {
              document.getElementById('sania-dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '13px',
              padding: '14px 28px',
              borderRadius: '6px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Watch Demo
          </button>
        </div>
      </div>
    </div>
  );
}
