import React, { useState, useEffect } from 'react';
import { Leaf, User, Menu, X } from 'lucide-react';

const Navbar = ({ onNavigate, currentPage }) => {
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
    { id: 'satellite', label: 'Satellite', emoji: '🛰️' },
    { id: 'knowledge', label: 'Ressources', emoji: '📚' },
  ];

  return (
    <nav
      className="sania-nav"
      style={{
      padding: scrolled ? '0.8rem 5%' : '1.2rem 5%',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 200,
      transition: 'all 0.45s var(--ease-smooth)',
      background: scrolled ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
      boxShadow: scrolled ? '0 10px 40px rgba(74, 124, 89, 0.08)' : 'none',
      borderBottom: scrolled ? '1px solid var(--outline-variant)' : 'none',
    }}
    >
      {/* Logo */}
      <div 
        style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}
        onClick={() => onNavigate('home')}
      >
        <div style={{ 
          background: 'var(--primary)', 
          padding: '0.55rem', 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Leaf color="#fff" size={22} strokeWidth={2.5} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <h1 style={{ 
            fontFamily: "'Newsreader', serif",
            fontSize: '1.5rem', 
            fontWeight: '800', 
            letterSpacing: '-0.5px',
            color: 'var(--text-bright)',
          }}>
            SANIA
            <span style={{ 
              color: 'var(--primary)', 
              fontFamily: "'Manrope', sans-serif",
              fontWeight: '300',
              fontSize: '0.9rem',
              marginLeft: '4px',
            }}>.ai</span>
          </h1>
        </div>
      </div>

      {/* Nav Links */}
      <div className="sania-nav-pill" style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        alignItems: 'center',
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
              fontWeight: currentPage === link.id ? '700' : '500',
              transition: 'all 0.3s',
              padding: '0.5rem 1.2rem',
              borderRadius: 'var(--radius-full)',
              background: currentPage === link.id 
                ? 'var(--primary-soft)' 
                : 'transparent',
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
          background: 'rgba(74, 124, 89, 0.1)',
          border: '1px solid rgba(74, 124, 89, 0.2)',
          cursor: 'pointer',
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)' }}>
            Fellah
          </span>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
