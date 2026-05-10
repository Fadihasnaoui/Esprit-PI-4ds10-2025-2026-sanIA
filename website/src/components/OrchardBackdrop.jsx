const cropsByPage = {
  fields: ['🍅', '🌿', '🍇', '🫒', '🌾', '🌱', '🍎', '🥔'],
  animals: ['🌾', '🌿', '🫒', '🍎', '🌱', '🍇', '🍅', '🥔'],
  analytics: ['🍇', '🍅', '🫒', '🌾', '🌱', '🍎', '🥔', '🌿'],
  satellite: ['🌱', '🫒', '🌾', '🍇', '🍅', '🌿', '🍎', '🥔'],
  chat: ['🌿', '🍅', '🍇', '🫒', '🌱', '🌾', '🍎', '🥔'],
  knowledge: ['🌾', '🫒', '🍇', '🍅', '🌱', '🌿', '🍎', '🥔'],
  'digital-twin': ['🌾', '🌱', '🍅', '🍇', '🫒', '🥔', '🍎', '🌿'],
};

const layout = [
  { left: '5%', top: '16%', size: '1.9rem', delay: '0s', duration: '13s' },
  { left: '15%', top: '62%', size: '1.35rem', delay: '-4s', duration: '16s' },
  { left: '31%', top: '24%', size: '2.3rem', delay: '-9s', duration: '18s' },
  { left: '47%', top: '73%', size: '1.5rem', delay: '-2s', duration: '14s' },
  { left: '63%', top: '18%', size: '1.25rem', delay: '-7s', duration: '17s' },
  { left: '78%', top: '58%', size: '2rem', delay: '-5s', duration: '15s' },
  { left: '91%', top: '28%', size: '1.45rem', delay: '-11s', duration: '19s' },
  { left: '86%', top: '82%', size: '1.8rem', delay: '-1s', duration: '12s' },
];

const OrchardBackdrop = ({ page }) => {
  const crops = cropsByPage[page] || cropsByPage.fields;

  return (
    <div className="orchard-backdrop" aria-hidden="true">
      <div className="orchard-glow orchard-glow--green" />
      <div className="orchard-glow orchard-glow--warm" />
      {layout.map((item, index) => (
        <span
          key={`${page}-${index}`}
          className="orchard-fruit"
          style={{
            left: item.left,
            top: item.top,
            fontSize: item.size,
            animationDelay: item.delay,
            animationDuration: item.duration,
          }}
        >
          {crops[index % crops.length]}
        </span>
      ))}
    </div>
  );
};

export default OrchardBackdrop;
