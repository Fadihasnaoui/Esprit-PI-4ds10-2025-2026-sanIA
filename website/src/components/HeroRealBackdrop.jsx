export default function HeroRealBackdrop() {
  return (
    <div className="sania-hero-backdrop" aria-hidden>
      <img
        className="sania-hero-backdrop__img"
        src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=2560&q=90"
        alt="Panoramic agricultural field"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'brightness(0.65) saturate(1.1)',
        }}
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
      <div className="sania-hero-backdrop__grad" style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, transparent 0%, var(--bg-dark) 95%)',
      }} />
      <div className="sania-hero-backdrop__vignette" style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
      }} />
    </div>
  );
}
