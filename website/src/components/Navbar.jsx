import React, { useState, useEffect } from 'react';
import { Leaf, User, Menu, X } from 'lucide-react';

const Navbar = ({ onNavigate, currentPage, user, onLogout }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const links = [
    { id: 'home', label: 'Accueil', emoji: '🏡' },
    { id: 'fields', label: 'Parcelles', emoji: '🌾' },
    { id: 'animals', label: 'Cheptel', emoji: '🐄' },
    { id: 'analytics', label: 'Analytics', emoji: '📊' },
    { id: 'aichat', label: 'Expert Chat', emoji: '✨' },
    { id: 'knowledge', label: 'Ressources', emoji: '📚' },
  ];

  return (
    <nav style={{
      padding: scrolled ? '0.8rem 5%' : '1.2rem 5%',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: scrolled
        ? 'rgba(11, 15, 13, 0.95)'
        : 'rgba(11, 15, 13, 0.7)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      borderBottom: `1px solid ${scrolled ? 'rgba(139, 195, 74, 0.15)' : 'var(--glass-border)'}`,
      boxShadow: scrolled ? '0 4px 30px rgba(0,0,0,0.4)' : 'none',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      {/* Logo */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}
        onClick={() => onNavigate('home')}
      >
        <div style={{
          background: 'var(--gradient-earth)',
          padding: '0.55rem',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(139, 195, 74, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.3s ease',
        }}>
          <Leaf color="#fff" size={22} strokeWidth={2.5} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.5rem',
            fontWeight: '800',
            letterSpacing: '-0.5px',
            color: 'var(--text-bright)',
          }}>
            SANIA
            <span style={{
              color: 'var(--primary)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: '300',
              fontSize: '0.9rem',
              marginLeft: '4px',
            }}>.ai</span>
          </h1>
          <span style={{
            fontSize: '0.6rem',
            color: 'var(--text-dim)',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            fontWeight: '500',
          }}>
            Agriculture Tunisienne
          </span>
        </div>
      </div>

      {/* Nav Links */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        background: 'var(--glass)',
        padding: '0.35rem',
        borderRadius: 'var(--radius-full)',
        border: '1px solid var(--glass-border)',
      }}>
        {links.map(link => (
          <a
            key={link.id}
            href="#"
            onClick={(e) => { e.preventDefault(); onNavigate(link.id); }}
            style={{
              color: currentPage === link.id ? 'var(--text-bright)' : 'var(--text-muted)',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: currentPage === link.id ? '600' : '400',
              transition: 'all 0.3s',
              padding: '0.5rem 1.2rem',
              borderRadius: 'var(--radius-full)',
              background: currentPage === link.id
                ? 'var(--primary-soft)'
                : 'transparent',
              border: currentPage === link.id
                ? '1px solid rgba(139, 195, 74, 0.25)'
                : '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span style={{ fontSize: '0.9rem' }}>{link.emoji}</span>
            {link.label}
          </a>
        ))}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.5rem 1rem',
          borderRadius: 'var(--radius-full)',
          background: 'var(--glass)',
          border: '1px solid var(--glass-border)',
          transition: 'all 0.3s',
        }}>
          <div style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'var(--gradient-warm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <User size={16} color="#fff" />
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-light)' }}>
            {user?.name || 'Utilisateur'}
          </span>
        </div>

        {user && (
          <button
            onClick={onLogout}
            className="btn btn-outline"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              borderColor: 'rgba(199, 91, 57, 0.3)',
              color: 'var(--terracotta)',
              borderRadius: 'var(--radius-full)',
            }}
          >
            Déconnexion
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
