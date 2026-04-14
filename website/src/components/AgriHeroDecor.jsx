import { Tractor, Beef, Wheat } from 'lucide-react';

/**
 * Decorative agriculture strip (tractor + livestock + crop) — no layout logic.
 */
export default function AgriHeroDecor() {
  const items = [
    { Icon: Tractor, label: 'Machines', color: 'var(--sand-gold)' },
    { Icon: Beef, label: 'Élevage', color: 'var(--terracotta)' },
    { Icon: Wheat, label: 'Cultures', color: 'var(--primary)' },
  ];

  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 'clamp(1rem, 4vw, 2rem)',
        marginBottom: '1.25rem',
        opacity: 0.85,
      }}
    >
      {items.map(({ Icon, label, color }) => (
        <div
          key={label}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            minWidth: '72px',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'rgba(255,252,247,0.05)',
              border: `1px solid rgba(255,248,240,0.1)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
              boxShadow: `0 8px 24px rgba(0,0,0,0.25), 0 0 0 1px ${color}22 inset`,
            }}
          >
            <Icon size={26} strokeWidth={1.5} />
          </div>
          <span
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              fontWeight: 600,
            }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
