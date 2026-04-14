import { Html } from '@react-three/drei';

const accent = '#b8d4c8';
const accentMuted = '#8aa899';
const label = 'rgba(232, 228, 220, 0.55)';
const panelStyle = {
  background: 'linear-gradient(165deg, rgba(28,32,30,0.82) 0%, rgba(18,22,20,0.88) 100%)',
  border: '1px solid rgba(255, 248, 240, 0.12)',
  borderRadius: '10px',
  padding: '14px 18px',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  fontFamily: "'DM Mono', ui-monospace, monospace",
  color: 'rgba(247, 244, 239, 0.92)',
  width: '188px',
  boxShadow: '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset',
  pointerEvents: 'none',
};

export default function HoloPanels() {
  return (
    <>
      <Html transform position={[-18, 8, -5]} style={{ pointerEvents: 'none' }}>
        <div style={panelStyle}>
          <div style={{ fontSize: '9px', letterSpacing: '0.22em', color: label, marginBottom: '8px', fontWeight: 600 }}>
            CROP HEALTH
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: accent, lineHeight: 1, letterSpacing: '-0.02em' }}>94.2%</div>
          <div style={{ fontSize: '11px', color: accentMuted, marginTop: '10px', lineHeight: 1.35 }}>NDVI 0.67 · Aïn Draham</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '10px' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#7aab6a',
                boxShadow: '0 0 10px rgba(122, 171, 106, 0.5)',
                animation: 'saniaBlink 1.8s ease-in-out infinite',
              }}
            />
            <span style={{ color: accentMuted, letterSpacing: '0.12em' }}>LIVE</span>
          </div>
          <style>{`@keyframes saniaBlink { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
      </Html>

      <Html transform position={[12, 10, -8]} style={{ pointerEvents: 'none' }}>
        <div style={panelStyle}>
          <div style={{ fontSize: '9px', letterSpacing: '0.22em', color: label, marginBottom: '8px', fontWeight: 600 }}>
            WATER SAVED
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: accent, lineHeight: 1 }}>50%</div>
          <div style={{ fontSize: '11px', color: accentMuted, marginTop: '10px', lineHeight: 1.35 }}>vs. traditional irrigation</div>
          <div style={{ fontSize: '16px', marginTop: '10px', opacity: 0.45 }}>〰</div>
        </div>
      </Html>

      <Html transform position={[5, 7, 10]} style={{ pointerEvents: 'none' }}>
        <div style={panelStyle}>
          <div style={{ fontSize: '9px', letterSpacing: '0.22em', color: label, marginBottom: '8px', fontWeight: 600 }}>
            DISEASE ALERTS
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: accent, lineHeight: 1 }}>0 Active</div>
          <div style={{ fontSize: '11px', color: accentMuted, marginTop: '10px' }}>Last scan: 2 min ago</div>
          <div style={{ display: 'flex', gap: '5px', marginTop: '12px' }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: 'linear-gradient(90deg, #7a9d8c, #5a7d6c)',
                  opacity: 0.35 + i * 0.12,
                }}
              />
            ))}
          </div>
        </div>
      </Html>
    </>
  );
}
