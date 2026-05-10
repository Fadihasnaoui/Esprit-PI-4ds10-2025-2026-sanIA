import React, { useState, useEffect } from 'react';
import { FileText, Search, ExternalLink, Bug, Activity, AlertTriangle, CheckCircle, Leaf, BookOpen, BarChart3 } from 'lucide-react';
import { diseaseService, alertService, fieldService } from '../services/api';

const staticDocs = [
  { title: "Guide de traitement du Mildiou", type: "PDF", size: "2.4 MB", date: "15 Jan 2026", icon: "🍅", color: "var(--terracotta)" },
  { title: "Optimisation de l'irrigation des Oliviers", type: "PDF", size: "1.8 MB", date: "02 Fév 2026", icon: "🫒", color: "var(--olive)" },
  { title: "Calendrier de fertilisation — Vignoble du Cap Bon", type: "PDF", size: "3.1 MB", date: "10 Fév 2026", icon: "🍇", color: "var(--sand-gold)" },
  { title: "Gestion du stress hydrique en zone aride", type: "PDF", size: "2.0 MB", date: "28 Jan 2026", icon: "💧", color: "var(--sky-blue)" },
];

const docSummaries = {
  "Guide de traitement du Mildiou": [
    "Surveiller les feuilles apres humidite forte ou pluie.",
    "Isoler les plantes touchees et retirer les feuilles fortement atteintes.",
    "Traiter tot, puis verifier l'evolution avec un nouveau scan IA.",
  ],
  "Optimisation de l'irrigation des Oliviers": [
    "Arroser selon l'humidite du sol, pas seulement selon le calendrier.",
    "Prioriser les jeunes arbres et les zones avec NDVI faible.",
    "Eviter l'exces d'eau pour limiter les maladies racinaires.",
  ],
  "Calendrier de fertilisation — Vignoble du Cap Bon": [
    "Adapter la fertilisation au stade de croissance.",
    "Utiliser la carte VRA pour reduire les intrants dans les zones deja vigoureuses.",
    "Controler l'effet avec NDVI et observations terrain.",
  ],
  "Gestion du stress hydrique en zone aride": [
    "Suivre temperature, vent et humidite avant les pics de chaleur.",
    "Declencher l'irrigation quand le stress monte avant le fletrissement visible.",
    "Comparer les parcelles pour detecter les zones qui consomment plus d'eau.",
  ],
};

const KnowledgeBase = () => {
  const [scans, setScans] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const [scanRes, alertRes, fieldRes] = await Promise.allSettled([
        diseaseService.getScans(),
        alertService.getAlerts(),
        fieldService.getFields(),
      ]);
      if (scanRes.status === 'fulfilled') setScans(scanRes.value.data);
      if (alertRes.status === 'fulfilled') setAlerts(alertRes.value.data);
      if (fieldRes.status === 'fulfilled') setFields(fieldRes.value.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Compute disease stats
  const diseaseGroups = scans.reduce((acc, s) => {
    const key = s.predicted_disease || 'Unknown';
    if (!acc[key]) acc[key] = { count: 0, totalConf: 0, crop: s.crop_type };
    acc[key].count++;
    acc[key].totalConf += s.confidence;
    return acc;
  }, {});
  const diseaseList = Object.entries(diseaseGroups).map(([name, data]) => ({
    name, count: data.count, avgConf: (data.totalConf / data.count * 100).toFixed(0), crop: data.crop,
  })).sort((a, b) => b.count - a.count);

  const healthyScanCount = scans.filter(s => s.predicted_disease?.toLowerCase().includes('healthy')).length;
  const diseasedCount = scans.length - healthyScanCount;
  const openAlerts = alerts.filter(a => a.status === 'open');

  const tabs = [
    { id: 'overview', label: '📊 Vue d\'ensemble' },
    { id: 'scans', label: `🔬 Scans Maladies (${scans.length})` },
    { id: 'alerts', label: `⚠️ Alertes (${alerts.length})` },
    { id: 'docs', label: `📚 Guides (${staticDocs.length})` },
  ];

  const filteredDocs = staticDocs.filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredScans = scans.filter(s =>
    s.predicted_disease?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.crop_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredAlerts = alerts.filter(a =>
    a.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.note?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <section style={{ padding: '3rem 0' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📚</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--sand-gold)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '600' }}>Centre de documentation</span>
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', fontWeight: '700', color: 'var(--text-bright)' }}>
          Base de <span className="gradient-text">Connaissances</span>
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.3rem' }}>
          Diagnostics IA, historique des alertes et documentation technique.
        </p>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1.5rem', flexWrap: 'wrap', background: 'var(--glass)', padding: '0.3rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--glass-border)', width: 'fit-content' }}>
        {tabs.map(tab => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? 'btn btn-primary' : 'btn'}
            style={{
              padding: '0.4rem 1rem', fontSize: '0.75rem', borderRadius: 'var(--radius-full)',
              background: activeTab === tab.id ? undefined : 'transparent',
              color: activeTab === tab.id ? undefined : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Search style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} size={18} />
        <input
          type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder={activeTab === 'scans' ? 'Rechercher par maladie ou culture...' : activeTab === 'alerts' ? 'Rechercher dans les alertes...' : 'Rechercher dans la documentation...'}
          style={{
            width: '100%', background: 'var(--glass)', border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-md)', padding: '0.9rem 1rem 0.9rem 3rem',
            color: 'var(--text-light)', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.3s',
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="floating"><BookOpen size={30} color="var(--primary)" /></div>
          <p style={{ color: 'var(--text-dim)', marginTop: '0.5rem' }}>Chargement...</p>
        </div>
      ) : (
        <>
          {/* ═══ OVERVIEW TAB ═══ */}
          {activeTab === 'overview' && (
            <div>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="glass-card animate-slide-up delay-1" style={{ padding: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                    <Leaf size={18} color="var(--primary)" />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Parcelles</span>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '800', fontFamily: "'Playfair Display', serif", color: 'var(--text-bright)' }}>{fields.length}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{fields.reduce((s, f) => s + (f.area_ha || 0), 0).toFixed(1)} hectares au total</div>
                </div>
                <div className="glass-card animate-slide-up delay-2" style={{ padding: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                    <Bug size={18} color="var(--terracotta)" />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Scans IA</span>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '800', fontFamily: "'Playfair Display', serif", color: 'var(--text-bright)' }}>{scans.length}</div>
                  <div style={{ fontSize: '0.72rem', color: diseasedCount > 0 ? 'var(--terracotta)' : 'var(--primary)' }}>
                    {diseasedCount > 0 ? `${diseasedCount} maladie(s) détectée(s)` : 'Aucune maladie détectée'}
                  </div>
                </div>
                <div className="glass-card animate-slide-up delay-3" style={{ padding: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                    <AlertTriangle size={18} color="var(--sand-gold)" />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Alertes</span>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '800', fontFamily: "'Playfair Display', serif", color: 'var(--text-bright)' }}>{alerts.length}</div>
                  <div style={{ fontSize: '0.72rem', color: openAlerts.length > 0 ? 'var(--terracotta)' : 'var(--primary)' }}>
                    {openAlerts.length > 0 ? `${openAlerts.length} non résolue(s)` : 'Tout est sous contrôle ✓'}
                  </div>
                </div>
                <div className="glass-card animate-slide-up delay-4" style={{ padding: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                    <BarChart3 size={18} color="var(--sky-blue)" />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Taux Santé</span>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '800', fontFamily: "'Playfair Display', serif", color: 'var(--text-bright)' }}>
                    {scans.length > 0 ? Math.round((healthyScanCount / scans.length) * 100) : 100}%
                  </div>
                  <div className="progress-bar" style={{ marginTop: '0.3rem' }}>
                    <div className="fill" style={{ width: `${scans.length > 0 ? (healthyScanCount / scans.length) * 100 : 100}%`, background: 'var(--gradient-earth)' }}></div>
                  </div>
                </div>
              </div>

              {/* Top diseases */}
              {diseaseList.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.8rem', color: 'var(--text-bright)', fontFamily: "'Playfair Display', serif" }}>🔬 Top Diagnostics IA</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {diseaseList.slice(0, 5).map((d, i) => (
                      <div key={i} className="glass-card" style={{ padding: '0.8rem 1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: d.name.toLowerCase().includes('healthy') ? 'rgba(139,195,74,0.1)' : 'rgba(199,91,57,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {d.name.toLowerCase().includes('healthy') ? <CheckCircle size={18} color="var(--primary)" /> : <Bug size={18} color="var(--terracotta)" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-bright)' }}>{d.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Culture: {d.crop} • IA confiance: {d.avgConf}%</div>
                        </div>
                        <span className="badge" style={{
                          padding: '0.2rem 0.6rem', fontSize: '0.7rem',
                          background: d.name.toLowerCase().includes('healthy') ? 'rgba(139,195,74,0.1)' : 'rgba(199,91,57,0.1)',
                          color: d.name.toLowerCase().includes('healthy') ? 'var(--primary)' : 'var(--terracotta)',
                          border: `1px solid ${d.name.toLowerCase().includes('healthy') ? 'rgba(139,195,74,0.2)' : 'rgba(199,91,57,0.2)'}`,
                        }}>
                          {d.count} scan{d.count > 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ SCANS TAB ═══ */}
          {activeTab === 'scans' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {filteredScans.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>Aucun scan disponible</p>
              ) : filteredScans.map((scan, i) => {
                const confColor = scan.confidence >= 0.9 ? 'var(--primary)' : scan.confidence >= 0.7 ? 'var(--sand-gold)' : 'var(--terracotta)';
                const isHealthy = scan.predicted_disease?.toLowerCase().includes('healthy');
                return (
                  <div key={scan.id || i} className={`glass-card animate-slide-up delay-${Math.min(i + 1, 6)}`} style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: isHealthy ? 'rgba(139,195,74,0.1)' : 'rgba(199,91,57,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${isHealthy ? 'rgba(139,195,74,0.15)' : 'rgba(199,91,57,0.15)'}`,
                    }}>
                      {isHealthy ? <CheckCircle size={20} color="var(--primary)" /> : <Bug size={20} color="var(--terracotta)" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-bright)' }}>{scan.predicted_disease}</span>
                        <span className="badge" style={{
                          padding: '0.1rem 0.5rem', fontSize: '0.6rem',
                          background: `${confColor}15`, color: confColor, border: `1px solid ${confColor}25`,
                        }}>
                          {(scan.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        Culture: {scan.crop_type} • {new Date(scan.created_at).toLocaleDateString('fr-TN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ ALERTS TAB ═══ */}
          {activeTab === 'alerts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {filteredAlerts.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>Aucune alerte</p>
              ) : filteredAlerts.map((alert, i) => {
                const sevColor = { critical: 'var(--terracotta)', high: '#e67e22', medium: 'var(--sand-gold)', low: 'var(--primary)' };
                return (
                  <div key={alert.id || i} className={`glass-card animate-slide-up delay-${Math.min(i + 1, 6)}`} style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: `${sevColor[alert.severity] || 'var(--sand-gold)'}12`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${sevColor[alert.severity] || 'var(--sand-gold)'}20`,
                    }}>
                      <AlertTriangle size={20} color={sevColor[alert.severity] || 'var(--sand-gold)'} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-bright)' }}>{alert.type}</span>
                        <span className="badge" style={{
                          padding: '0.1rem 0.5rem', fontSize: '0.6rem',
                          background: `${sevColor[alert.severity] || 'var(--sand-gold)'}15`,
                          color: sevColor[alert.severity] || 'var(--sand-gold)',
                          border: `1px solid ${sevColor[alert.severity] || 'var(--sand-gold)'}25`,
                        }}>{alert.severity}</span>
                        <span className="badge" style={{
                          padding: '0.1rem 0.5rem', fontSize: '0.6rem',
                          background: alert.status === 'open' ? 'rgba(199,91,57,0.1)' : 'rgba(139,195,74,0.1)',
                          color: alert.status === 'open' ? 'var(--terracotta)' : 'var(--primary)',
                          border: `1px solid ${alert.status === 'open' ? 'rgba(199,91,57,0.2)' : 'rgba(139,195,74,0.2)'}`,
                        }}>{alert.status}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {alert.note || 'Pas de détails'} • {new Date(alert.created_at).toLocaleDateString('fr-TN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ DOCS TAB ═══ */}
          {activeTab === 'docs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {filteredDocs.map((doc, i) => (
                <div key={i} className={`glass-card animate-slide-up delay-${i + 1}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                    <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', background: `linear-gradient(135deg, ${doc.color}15, ${doc.color}08)`, border: `1px solid ${doc.color}20`, fontSize: '1.4rem' }}>
                      {doc.icon}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1rem', marginBottom: '0.2rem', color: 'var(--text-bright)', fontFamily: "'Inter'", fontWeight: '600' }}>{doc.title}</h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        <span style={{ padding: '0.1rem 0.5rem', borderRadius: 'var(--radius-full)', background: 'rgba(139,195,74,0.08)', fontSize: '0.65rem', marginRight: '0.5rem' }}>{doc.type}</span>
                        {doc.size} • Ajouté le {doc.date}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDoc(doc)}
                    className="btn btn-outline"
                    style={{ padding: '0.45rem 1rem', fontSize: '0.75rem', borderRadius: 'var(--radius-full)' }}
                  >
                    Ouvrir <ExternalLink size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {selectedDoc && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedDoc(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(0,0,0,0.68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            className="glass-card"
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(620px, 94vw)', padding: '1.6rem' }}
          >
            <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${selectedDoc.color}18`, border: `1px solid ${selectedDoc.color}25`, color: selectedDoc.color }}>
                <FileText size={21} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--text-bright)' }}>{selectedDoc.title}</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{selectedDoc.type} - {selectedDoc.size} - ajoute le {selectedDoc.date}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem', margin: '1.2rem 0' }}>
              {(docSummaries[selectedDoc.title] || [
                "Ce guide n'a pas encore de fichier PDF connecte dans le projet.",
                "Le contenu resume reste disponible ici pour que le bouton ouvre une vraie action utile.",
                "Ajoutez le PDF final dans les assets pour remplacer cette fiche par un document telechargeable.",
              ]).map((point) => (
                <div key={point} style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start', color: 'var(--text-light)' }}>
                  <CheckCircle size={17} color="var(--primary)" style={{ marginTop: 3, flexShrink: 0 }} />
                  <span>{point}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setSelectedDoc(null)}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default KnowledgeBase;
