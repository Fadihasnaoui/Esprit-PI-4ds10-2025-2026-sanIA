import React, { Suspense, lazy, useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import SaniaExplainer from './components/SaniaExplainer';
import OrchardBackdrop from './components/OrchardBackdrop';
import Login from './pages/Login';
import { authService, systemService } from './services/api';
import { BACKEND_ORIGIN } from './services/backendConfig';
import {
  AlertTriangle,
  BookOpenCheck,
  ChartSpline,
  CheckCircle2,
  Cuboid,
  Droplets,
  Home,
  Loader2,
  MapPinned,
  MessageCircle,
  PawPrint,
  SatelliteDish,
  WifiOff,
} from 'lucide-react';
import { useTranslation } from './i18n';

const FieldsDashboard = lazy(() => import('./pages/FieldsDashboard'));
const AnimalsDashboard = lazy(() => import('./pages/AnimalsDashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const SatelliteDashboard = lazy(() => import('./pages/SatelliteDashboard'));
const Chat = lazy(() => import('./pages/Chat'));
const DigitalTwin = lazy(() => import('./pages/DigitalTwin'));
const KnowledgeBase = lazy(() => import('./components/KnowledgeBase'));
const IrrigationShowcase = lazy(() => import('./pages/IrrigationShowcase'));

const PageLoader = () => {
  const { t } = useTranslation();
  return (
    <section style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
        <Loader2 className="animate-spin" size={18} color="var(--primary)" />
        {t('common.loading')}
      </div>
    </section>
  );
};

const ApiStatusBanner = ({ health }) => {
  const { t } = useTranslation();
  if (!health) return null;

  const offline = health.offline;
  const degraded = !offline && (!health.database || !health.pgvector || !health.safa_rag?.ready);
  if (!offline && !degraded) return null;

  const color = offline ? 'var(--terracotta)' : 'var(--sand-gold)';
  const Icon = offline ? WifiOff : AlertTriangle;
  const message = offline
    ? t('app.backendOffline')
    : [
        !health.database ? t('app.dbOffline') : null,
        !health.pgvector ? t('app.pgvectorOff') : null,
        !health.safa_rag?.ready ? t('app.safaOff') : null,
      ].filter(Boolean).join(' | ');

  return (
    <div style={{
      position: 'fixed',
      right: '1.2rem',
      bottom: '1.2rem',
      zIndex: 250,
      maxWidth: '360px',
      padding: '0.65rem 0.85rem',
      borderRadius: 999,
      border: `1px solid ${color}55`,
      background: 'rgba(11, 15, 13, 0.92)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.7rem',
      fontSize: '0.78rem',
      fontWeight: 700,
      boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
        <Icon size={17} /> {message}
      </span>
      {!offline && health.database && (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary)' }}>
          <CheckCircle2 size={15} /> {t('app.authDbOk')}
        </span>
      )}
    </div>
  );
};

const KeyboardAccessDock = ({ enabled, onNavigate }) => {
  const { t } = useTranslation();
  if (!enabled) return null;

  const actions = [
    { key: 'Alt+1', label: t('nav.home'), page: 'home', icon: Home },
    { key: 'Alt+2', label: t('nav.chat'), page: 'chat', icon: MessageCircle },
    { key: 'Alt+3', label: t('nav.fields'), page: 'fields', icon: MapPinned },
    { key: 'Alt+4', label: t('nav.animals'), page: 'animals', icon: PawPrint },
    { key: 'Alt+5', label: t('nav.analytics'), page: 'analytics', icon: ChartSpline },
    { key: 'Alt+6', label: t('nav.satellite'), page: 'satellite', icon: SatelliteDish },
    { key: 'Alt+7', label: t('nav.irrigation'), page: 'irrigation', icon: Droplets },
    { key: 'Alt+8', label: t('nav.knowledge'), page: 'knowledge', icon: BookOpenCheck },
    { key: 'Alt+9', label: t('nav.twin'), page: 'digital-twin', icon: Cuboid },
  ];

  return (
    <div className="keyboard-access-dock" aria-label={t('accessibility.quickNav')}>
      {actions.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            className="keyboard-access-button"
            onClick={() => onNavigate(item.page)}
            aria-keyshortcuts={item.key}
          >
            <Icon size={16} />
            <span>{item.label}</span>
            <kbd>{item.key}</kbd>
          </button>
        );
      })}
    </div>
  );
};

function App() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [backendHealth, setBackendHealth] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('sania-theme') || 'dark');
  const [colorVisionMode, setColorVisionMode] = useState(() => {
    const savedMode = localStorage.getItem('sania-color-vision-mode');
    if (savedMode) return savedMode;
    return localStorage.getItem('sania-colorblind') === 'true' ? 'deuteranopia' : 'none';
  });
  const [keyboardMode, setKeyboardMode] = useState(() => localStorage.getItem('sania-keyboard-nav') === 'true');
  const showOrchardBackdrop = isAuthenticated && currentPage !== 'home';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sania-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (colorVisionMode && colorVisionMode !== 'none') {
      document.documentElement.setAttribute('data-colorblind', 'true');
      document.documentElement.setAttribute('data-colorblind-mode', colorVisionMode);
    } else {
      document.documentElement.removeAttribute('data-colorblind');
      document.documentElement.removeAttribute('data-colorblind-mode');
    }
    localStorage.setItem('sania-color-vision-mode', colorVisionMode);
    localStorage.setItem('sania-colorblind', String(colorVisionMode !== 'none'));
  }, [colorVisionMode]);

  useEffect(() => {
    document.documentElement.dataset.keyboardNav = keyboardMode ? 'true' : 'false';
    localStorage.setItem('sania-keyboard-nav', String(keyboardMode));
  }, [keyboardMode]);

  useEffect(() => {
    document.body.dataset.saniaPage = isAuthenticated && currentPage !== 'home' ? 'subpage' : 'home';
    return () => {
      delete document.body.dataset.saniaPage;
    };
  }, [currentPage, isAuthenticated]);

  useEffect(() => {
    const handleExpired = () => {
      setIsAuthenticated(false);
      setUser(null);
      setCurrentPage('home');
    };
    window.addEventListener('sania-auth-expired', handleExpired);
    return () => window.removeEventListener('sania-auth-expired', handleExpired);
  }, []);

  useEffect(() => {
    let active = true;
    const checkBackend = async () => {
      try {
        const res = await systemService.getHealth();
        if (active) setBackendHealth(res.data);
      } catch {
        if (active) setBackendHealth({ offline: true });
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await authService.getMe();
          setUser(res.data);
          setIsAuthenticated(true);
        } catch (err) {
          console.error("Auto-auth failed:", err);
          localStorage.removeItem('token');
        }
      }
      setInitializing(false);
    };
    checkAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
    setCurrentPage('home');
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleNavigate = (page) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setCurrentPage(page);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleDiscoverSania = () => {
    const section = document.getElementById('discover-sania');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleReadDashboard = () => {
    window.dispatchEvent(new CustomEvent('sania-read-dashboard'));
  };

  useEffect(() => {
    if (!keyboardMode) return undefined;

    const shortcutTarget = (event) => {
      if (event.code === 'Digit1' || event.code === 'Numpad1' || event.key === '1' || event.key === '&') return 'home';
      if (event.code === 'Digit2' || event.code === 'Numpad2' || event.key === '2' || event.key === 'é') return 'chat';
      if (event.code === 'Digit3' || event.code === 'Numpad3' || event.key === '3' || event.key === '"') return 'fields';
      if (event.code === 'Digit4' || event.code === 'Numpad4' || event.key === '4' || event.key === "'") return 'animals';
      if (event.code === 'Digit5' || event.code === 'Numpad5' || event.key === '5' || event.key === '(') return 'analytics';
      if (event.code === 'Digit6' || event.code === 'Numpad6' || event.key === '6' || event.key === '-') return 'satellite';
      if (event.code === 'Digit7' || event.code === 'Numpad7' || event.key === '7') return 'irrigation';
      if (event.code === 'Digit8' || event.code === 'Numpad8' || event.key === '8' || event.key === '_') return 'knowledge';
      if (event.code === 'Digit9' || event.code === 'Numpad9' || event.key === '9' || event.key === 'ç') return 'digital-twin';
      return null;
    };

    const onKeyDown = (event) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const target = shortcutTarget(event);
      if (!target || event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      handleNavigate(target);
    };

    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [keyboardMode]);

  const footerLinks = [
    { label: t('app.team'), action: () => handleDiscoverSania() },
    { label: t('app.contact'), action: () => { window.location.href = 'mailto:support@sania.ai?subject=Support%20SANIA'; } },
    { label: t('app.api'), action: () => { window.open(`${BACKEND_ORIGIN}/docs`, '_blank', 'noopener,noreferrer'); } },
  ];

  if (initializing) {
    return (
      <div style={{
        background: 'var(--bg-deepest)',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-light)',
        gap: '1.5rem',
      }}>
        <img
          className="floating"
          src="/sania-logo.png"
          alt="SanIA"
          style={{ width: 120, height: 'auto', display: 'block' }}
        />
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', letterSpacing: '1px' }}>
            {t('app.init')}
          </p>
        </div>
        <Loader2 className="animate-spin" size={20} color="var(--primary)" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App">
      <Navbar
        onNavigate={handleNavigate}
        currentPage={currentPage}
        user={user}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
        colorVisionMode={colorVisionMode}
        onChangeColorVisionMode={setColorVisionMode}
        keyboardMode={keyboardMode}
        onToggleKeyboardMode={() => setKeyboardMode((value) => !value)}
        onReadDashboard={handleReadDashboard}
      />
      <ApiStatusBanner health={backendHealth} />
      <KeyboardAccessDock enabled={keyboardMode} onNavigate={handleNavigate} />

      <main
        key={currentPage}
        className={`page-transition ${showOrchardBackdrop ? 'page-with-orchard' : ''}`}
        style={{ minHeight: '80vh', padding: '0 5%' }}
      >
        {showOrchardBackdrop && <OrchardBackdrop page={currentPage} />}
        <Suspense fallback={<PageLoader />}>
          {currentPage === 'home' && (
            <>
              <Hero onStart={() => handleNavigate('fields')} onDiscover={handleDiscoverSania} theme={theme} />
              <Dashboard onNavigate={handleNavigate} />
              <SaniaExplainer />
            </>
          )}

        {currentPage === 'fields' && (
          <FieldsDashboard />
        )}

        {currentPage === 'animals' && (
          <AnimalsDashboard user={user} />
        )}

        {currentPage === 'analytics' && (
          <Analytics />
        )}

        {currentPage === 'satellite' && (
          <SatelliteDashboard />
        )}

        {currentPage === 'irrigation' && (
          <IrrigationShowcase />
        )}

        {currentPage === 'chat' && (
          <Chat />
        )}

        {currentPage === 'knowledge' && (
          <KnowledgeBase />
        )}

        {currentPage === 'digital-twin' && (
          <DigitalTwin user={user} />
        )}
        </Suspense>
      </main>


      {/* Premium Footer */}
      <footer style={{
        padding: '3rem 5%',
        borderTop: '1px solid var(--glass-border)',
        marginTop: '3rem',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: '20%',
          right: '20%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--terracotta) 25%, var(--sand-gold) 50%, var(--primary) 75%, transparent)',
          opacity: 0.3,
        }} />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <img
              src="/sania-logo.png"
              alt="SanIA"
              style={{ height: 40, width: 'auto', display: 'block' }}
            />
          </div>
          <p style={{
            color: 'var(--text-dim)',
            fontSize: '0.8rem',
            textAlign: 'center',
          }}>
            {t('app.footer')}
            <span style={{ margin: '0 0.5rem', opacity: 0.3 }}>|</span>
            {t('app.slogan')}
          </p>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {footerLinks.map((link, i) => (
              <button key={i} type="button" onClick={link.action} style={{
                color: 'var(--text-dim)',
                fontSize: '0.8rem',
                transition: 'color 0.3s',
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
              }}
                onMouseEnter={e => e.target.style.color = 'var(--primary)'}
                onMouseLeave={e => e.target.style.color = 'var(--text-dim)'}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
