import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const STATS = [
  { key: 'w', end: 50, suffix: '%', label: 'Water Savings' },
  { key: 'y', end: 20, suffix: '%', label: 'Yield Increase' },
  { key: 'n', end: 0.67, suffix: '', label: 'Avg NDVI Score', decimals: 2 },
];

export default function HeroStats() {
  const [values, setValues] = useState(() => STATS.map(() => 0));
  const rootRef = useRef(null);

  useEffect(() => {
    const proxy = { w: 0, y: 0, n: 0 };
    const ctx = gsap.context(() => {
      gsap.to(proxy, {
        w: 50,
        y: 20,
        n: 0.67,
        duration: 2.5,
        delay: 2,
        ease: 'power2.out',
        onUpdate: () => setValues([proxy.w, proxy.y, proxy.n]),
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const format = (i) => {
    const s = STATS[i];
    const v = values[i];
    if (s.decimals != null) return v.toFixed(s.decimals);
    return Math.round(v);
  };

  return (
    <div
      ref={rootRef}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 4,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        background: 'linear-gradient(to top, rgba(13,31,15,0.95), transparent)',
        padding: '32px 16px 28px',
        pointerEvents: 'none',
      }}
    >
      {STATS.map((s, i) => (
        <div
          key={s.key}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            borderRight:
              i < STATS.length - 1 ? '1px solid rgba(0,255,209,0.2)' : 'none',
            padding: '0 12px',
          }}
        >
          <span
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(40px, 8vw, 64px)',
              color: 'var(--cyber)',
              lineHeight: 1,
            }}
          >
            {format(i)}
            {s.suffix}
          </span>
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '12px',
              color: 'var(--text-muted)',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              marginTop: '8px',
              textAlign: 'center',
            }}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}
