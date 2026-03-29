import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import FieldsDashboard from './pages/FieldsDashboard';
import AnimalsDashboard from './pages/AnimalsDashboard';
import Analytics from './pages/Analytics';
import KnowledgeBase from './components/KnowledgeBase';
import Login from './pages/Login';
import { authService } from './services/api';
import { Leaf, Loader2 } from 'lucide-react';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

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
        onNavigate={setCurrentPage}
        currentPage={currentPage}
        user={user}
        onLogout={handleLogout}
      />

      <main style={{ minHeight: '80vh', padding: '0 5%' }}>
          {currentPage === 'home' && (
            <>
              <Hero onStart={() => setCurrentPage('fields')} />
              <Dashboard />
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

        {currentPage === 'knowledge' && (
          <KnowledgeBase />
        )}
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
