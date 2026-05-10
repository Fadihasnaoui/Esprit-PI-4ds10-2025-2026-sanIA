import React, { useState, useEffect } from 'react';
import {
  Accessibility,
  BookOpenCheck,
  ChartSpline,
  Cuboid,
  Droplets,
  Eye,
  Keyboard,
  PawPrint,
  Home,
  MapPinned,
  Menu,
  MessageCircle,
  Moon,
  SatelliteDish,
  SunMedium,
  User,
  Volume2,
  X,
} from 'lucide-react';
import { useTranslation } from '../i18n';

const Navbar = ({
  onNavigate,
  currentPage,
  user,
  onLogout,
  theme = 'dark',
  onToggleTheme,
  colorVisionMode = 'none',
  onChangeColorVisionMode,
  keyboardMode = false,
  onToggleKeyboardMode,
  onReadDashboard,
}) => {
  const { language, setLanguage, languages, t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const links = [
    { id: 'home', label: t('nav.home'), icon: Home },
    { id: 'chat', label: t('nav.chat'), icon: MessageCircle },
    { id: 'fields', label: t('nav.fields'), icon: MapPinned },
    { id: 'animals', label: t('nav.animals'), icon: PawPrint },
    { id: 'analytics', label: t('nav.analytics'), icon: ChartSpline },
    { id: 'satellite', label: t('nav.satellite'), icon: SatelliteDish },
    { id: 'irrigation', label: t('nav.irrigation'), icon: Droplets },
    { id: 'knowledge', label: t('nav.knowledge'), icon: BookOpenCheck },
    { id: 'digital-twin', label: t('nav.twin'), icon: Cuboid },
  ];

  const ThemeIcon = theme === 'dark' ? SunMedium : Moon;
  const colorVisionActive = colorVisionMode !== 'none';

  const colorVisionOptions = [
    {
      id: 'deuteranopia',
      label: t('accessibility.deuteranopia'),
      detail: t('accessibility.deuteranopiaDetail'),
    },
    {
      id: 'protanopia',
      label: t('accessibility.protanopia'),
      detail: t('accessibility.protanopiaDetail'),
    },
    {
      id: 'tritanopia',
      label: t('accessibility.tritanopia'),
      detail: t('accessibility.tritanopiaDetail'),
    },
    {
      id: 'high-contrast',
      label: t('accessibility.highContrast'),
      detail: t('accessibility.highContrastDetail'),
    },
    {
      id: 'none',
      label: t('accessibility.standardPalette'),
      detail: t('accessibility.saniaColors'),
    },
  ];

  const accessibilityActions = [
    ...colorVisionOptions.map((option) => ({
      label: option.label,
      detail: option.detail,
      icon: Eye,
      active: colorVisionMode === option.id,
      action: () => onChangeColorVisionMode?.(option.id),
    })),
    {
      label: keyboardMode ? t('accessibility.keyboardOn') : t('accessibility.keyboardNav'),
      detail: t('accessibility.shortcuts'),
      icon: Keyboard,
      active: keyboardMode,
      action: onToggleKeyboardMode,
    },
    {
      label: t('accessibility.readSummary'),
      detail: t('accessibility.voiceSummary'),
      icon: Volume2,
      active: false,
      action: onReadDashboard,
    },
  ];

  const renderAccessibilityActions = (compact = false) => (
    <div className={compact ? 'accessibility-menu accessibility-menu-mobile' : 'accessibility-menu'}>
      {accessibilityActions.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            className={`accessibility-action ${item.active ? 'is-active' : ''}`}
            onClick={() => {
              item.action?.();
              if (!compact) setAccessOpen(false);
            }}
          >
            <Icon size={16} />
            <span>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderLinks = (compact = false) => links.map((link) => {
    const Icon = link.icon;
    const active = currentPage === link.id;
    return (
      <button
        key={link.id}
        type="button"
        onClick={(e) => {
          onNavigate(link.id);
          setMobileOpen(false);
        }}
        style={{
          color: active ? 'var(--text-bright)' : 'var(--text-muted)',
          fontSize: compact ? '0.95rem' : '0.72rem',
          fontWeight: active ? '700' : '500',
          transition: 'all 0.3s',
          padding: compact ? '0.75rem 1rem' : '0.38rem 0.52rem',
          borderRadius: compact ? '12px' : 'var(--radius-full)',
          background: active ? 'var(--primary-soft)' : 'transparent',
          border: active ? '1px solid rgba(139, 195, 74, 0.25)' : '1px solid transparent',
          display: 'flex',
          alignItems: 'center',
          gap: compact ? '0.45rem' : '0.28rem',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <Icon size={compact ? 15 : 13} color={active ? 'var(--primary)' : 'currentColor'} />
        {link.label}
      </button>
    );
  });

  return (
    <nav style={{
      padding: scrolled ? '0.55rem 3.2%' : '0.72rem 3.2%',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: scrolled ? 'var(--nav-bg-solid)' : 'var(--nav-bg)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      borderBottom: `1px solid ${scrolled ? 'rgba(139, 195, 74, 0.15)' : 'var(--glass-border)'}`,
      boxShadow: scrolled ? '0 4px 30px rgba(0,0,0,0.4)' : 'none',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <button
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          padding: 0,
          margin: 0,
          border: 'none',
          background: 'transparent',
        }}
        onClick={() => onNavigate('home')}
        aria-label={t('nav.home')}
      >
        <img
          src="/sania-logo.png"
          alt="SanIA — Smart Solutions for Agriculture"
          style={{ height: 46, width: 'auto', display: 'block' }}
        />
      </button>

      <div className="desktop-nav-links" style={{
        display: 'flex',
        gap: '0.12rem',
        alignItems: 'center',
        background: 'var(--glass)',
        padding: '0.25rem',
        borderRadius: 'var(--radius-full)',
        border: '1px solid var(--glass-border)',
      }}>
          {renderLinks()}
      </div>

      <div style={{ display: 'flex', gap: '0.48rem', alignItems: 'center' }}>
        <button
          type="button"
          className="theme-toggle tooltip"
          data-tooltip={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
        >
          <ThemeIcon size={18} />
        </button>

        <div className="accessibility-popover">
          <button
            type="button"
            className={`theme-toggle tooltip ${colorVisionActive || keyboardMode ? 'is-active' : ''}`}
            data-tooltip={t('accessibility.title')}
            onClick={() => setAccessOpen((value) => !value)}
            aria-label={t('accessibility.title')}
            aria-expanded={accessOpen}
          >
            <Accessibility size={18} />
          </button>
          {accessOpen && renderAccessibilityActions()}
        </div>

        <select
          className="language-select"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          aria-label={t('common.language')}
          title={t('common.language')}
        >
          {languages.map((item) => (
            <option key={item.code} value={item.code}>
              {item.short}
            </option>
          ))}
        </select>

        <div className="desktop-user-pill" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.42rem',
          padding: '0.42rem 0.72rem',
          borderRadius: 'var(--radius-full)',
          background: 'var(--glass)',
          border: '1px solid var(--glass-border)',
        }}>
          <div style={{
            width: '27px',
            height: '27px',
            borderRadius: '50%',
            background: 'var(--gradient-warm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <User size={16} color="#fff" />
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: '500', color: 'var(--text-light)' }}>
            {user?.name || t('common.user')}
          </span>
        </div>

        {user && (
          <button
            onClick={onLogout}
            className="btn btn-outline desktop-logout"
            style={{
              padding: '0.42rem 0.72rem',
              fontSize: '0.72rem',
              borderColor: 'rgba(199, 91, 57, 0.3)',
              color: 'var(--terracotta)',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {t('common.logout')}
          </button>
        )}

        <button
          className="mobile-nav-toggle"
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          style={{
            display: 'none',
            width: 42,
            height: 42,
            borderRadius: 12,
            border: '1px solid var(--glass-border)',
            background: 'var(--glass)',
            color: 'var(--text-bright)',
            placeItems: 'center',
          }}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="mobile-nav-panel" style={{
          position: 'absolute',
          left: '5%',
          right: '5%',
          top: 'calc(100% + 0.75rem)',
          padding: '0.8rem',
          borderRadius: 18,
          border: '1px solid var(--glass-border)',
          background: 'var(--nav-panel)',
          boxShadow: 'var(--shadow-lg)',
          display: 'grid',
          gap: '0.35rem',
        }}>
          {renderLinks(true)}
          <button
            type="button"
            className="theme-toggle theme-toggle-mobile"
            onClick={onToggleTheme}
          >
            <ThemeIcon size={18} />
            {theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
          </button>
          {renderAccessibilityActions(true)}
          <select
            className="language-select language-select-mobile"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            aria-label={t('common.language')}
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
          {user && (
            <button
              onClick={onLogout}
              className="btn btn-outline"
              style={{ marginTop: '0.5rem', color: 'var(--terracotta)' }}
            >
              {t('common.logout')}
            </button>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
