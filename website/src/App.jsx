import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import FieldsDashboard from './pages/FieldsDashboard';
import AnimalsDashboard from './pages/AnimalsDashboard';
import Analytics from './pages/Analytics';
import KnowledgeBase from './components/KnowledgeBase';
import AIAssistant from './components/AIAssistant';
import { authService } from './services/api';
import { Leaf } from 'lucide-react';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);

  React.useEffect(() => {
    console.log("App initialization starting...");
    const authPromise = authService.login('farmer@agrismart.tn', 'Farmer123!')
      .then(() => {
        console.log("Login success");
        setIsAuthenticated(true);
      })
      .catch(err => {
        console.warn("Login failed (backend might be offline):", err);
        setIsAuthenticated(true);
      });

    // Safety fallback: if after 15s nothing happened, force entry
    const timer = setTimeout(() => {
      console.log("Safety fallback triggered");
      setIsAuthenticated(true);
    }, 15000);

    return () => clearTimeout(timer);
  }, []);

  if (!isAuthenticated) {
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
        <div className="floating" style={{
          padding: '1rem',
          borderRadius: '16px',
          background: 'var(--gradient-earth)',
          boxShadow: '0 8px 32px rgba(139, 195, 74, 0.3)',
        }}>
          <Leaf size={32} color="#fff" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.4rem',
            fontWeight: '700',
            marginBottom: '0.5rem',
            color: 'var(--text-bright)',
          }}>
            SANIA
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', letterSpacing: '1px' }}>
            Initialisation du système...
          </p>
        </div>
        {/* Loading bar */}
        <div style={{
          width: '200px',
          height: '3px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: '60%',
            height: '100%',
            background: 'var(--gradient-earth)',
            borderRadius: '10px',
            animation: 'shimmer 1.5s ease-in-out infinite',
          }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Navbar onNavigate={setCurrentPage} currentPage={currentPage} />

      <main style={{ minHeight: '80vh', padding: '0 5%' }}>
        {currentPage === 'home' && (
          <>
            <Hero onStart={() => setCurrentPage('fields')} />
            <Dashboard onOpenAssistant={() => setShowAssistant(true)} />
          </>
        )}

        {currentPage === 'fields' && (
          <FieldsDashboard />
        )}

        {currentPage === 'animals' && (
          <AnimalsDashboard />
        )}

        {currentPage === 'analytics' && (
          <Analytics />
        )}

        {currentPage === 'knowledge' && (
          <KnowledgeBase />
        )}
      </main>

      <AIAssistant isOpen={showAssistant} setIsOpen={setShowAssistant} />

      {/* Premium Footer */}
      <footer style={{
        padding: '3rem 5%',
        borderTop: '1px solid var(--glass-border)',
        marginTop: '3rem',
        position: 'relative',
      }}>
        {/* Tunisian decorative top line */}
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
            <div style={{
              padding: '0.35rem',
              borderRadius: '8px',
              background: 'var(--gradient-earth)',
              display: 'flex',
            }}>
              <Leaf size={14} color="#fff" />
            </div>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: '700',
              fontSize: '0.95rem',
              color: 'var(--text-light)',
            }}>
              SANIA
            </span>
          </div>
          <p style={{
            color: 'var(--text-dim)',
            fontSize: '0.8rem',
            textAlign: 'center',
          }}>
            © 2026 Projet SANIA — Agriculture Intelligente de Tunisie 🇹🇳
            <span style={{ margin: '0 0.5rem', opacity: 0.3 }}>|</span>
            L'IA au service de la terre
          </p>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {['Équipe', 'Contact', 'API'].map((link, i) => (
              <a key={i} href="#" style={{
                color: 'var(--text-dim)',
                textDecoration: 'none',
                fontSize: '0.8rem',
                transition: 'color 0.3s',
              }}
                onMouseEnter={e => e.target.style.color = 'var(--primary)'}
                onMouseLeave={e => e.target.style.color = 'var(--text-dim)'}
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
