import React from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Droplets,
  Map,
  Microscope,
  Satellite,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from '../i18n';

const tasks = [
  { key: 'assistant', icon: Bot },
  { key: 'fields', icon: Map },
  { key: 'irrigation', icon: Droplets },
  { key: 'disease', icon: Microscope },
  { key: 'livestock', icon: ShieldCheck },
  { key: 'satellite', icon: Satellite },
  { key: 'alerts', icon: AlertTriangle },
  { key: 'analytics', icon: BarChart3 },
];

const SaniaExplainer = () => {
  const { t } = useTranslation();

  return (
    <section id="discover-sania" style={{ padding: '5rem 0 2rem', position: 'relative' }}>
      <div
        className="sania-explainer-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.3fr)',
          gap: '2rem',
          alignItems: 'start',
        }}
      >
        <div
          className="glass-card sania-explainer-intro"
          style={{ position: 'sticky', top: '6.5rem', padding: '2rem' }}
        >
          <img
            src="/sania-logo.png"
            alt="SanIA"
            style={{ width: 56, height: 'auto', display: 'block', marginBottom: '1.2rem' }}
          />
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', marginBottom: '1rem', letterSpacing: '0' }}>
            {t('explainer.title')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: 1.8, marginBottom: '1.2rem' }}>
            {t('explainer.intro')}
          </p>
          <p style={{ color: 'var(--text-light)', lineHeight: 1.8, fontWeight: 600 }}>
            {t('explainer.goal')}
          </p>
        </div>

        <div className="sania-task-grid">
          {tasks.map((task) => {
            const Icon = task.icon;
            const [title, text] = t(`explainer.tasks.${task.key}`);
            return (
              <article key={task.key} className="glass-card sania-task-card">
                <div className="sania-task-icon">
                  <Icon size={20} />
                </div>
                <div>
                  <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '1rem', marginBottom: '0.45rem' }}>
                    {title}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.65, fontSize: '0.94rem' }}>
                    {text}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SaniaExplainer;
