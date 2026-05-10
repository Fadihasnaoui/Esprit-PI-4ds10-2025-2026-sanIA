import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Command, CornerDownLeft, Cpu, Satellite, Activity, Heart, Printer } from 'lucide-react';

/**
 * CommandPalette — Linear/Notion-style ⌘K (or Ctrl+K) interface.
 *
 * Props:
 *  - animals          : full list, used for fuzzy search over tag_id / species / status
 *  - onSelectAnimal   : (animal) => void — invoked when an animal row is picked
 *  - onAction(action) : ('orbital' | 'health' | 'print' | 'export') => void
 */
const CommandPalette = ({ animals = [], onSelectAnimal, onAction }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);
    const inputRef = useRef(null);

    // Global ⌘K / Ctrl+K listener + Esc to close
    useEffect(() => {
        const handler = (e) => {
            const isK = (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey);
            if (isK) {
                e.preventDefault();
                setOpen(v => !v);
            } else if (e.key === 'Escape' && open) {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open]);

    // Autofocus on open, reset state
    useEffect(() => {
        if (open) {
            setQuery('');
            setHighlight(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Fuzzy ranking: split query into tokens, every token must appear somewhere
    const rank = (animal, tokens) => {
        const hay = [
            animal.tag_id, animal.species, animal.breed, animal.status, animal.gender
        ].filter(Boolean).join(' ').toLowerCase();
        let score = 0;
        for (const t of tokens) {
            const idx = hay.indexOf(t);
            if (idx === -1) return -1;
            score += 100 - idx; // earlier match = better
        }
        return score;
    };

    const GLOBAL_ACTIONS = useMemo(() => ([
        { id: 'orbital',  label: 'Lancer Orbital Scan',   icon: Satellite, hint: 'SVI v9' },
        { id: 'health',   label: 'Lancer Health Scan',    icon: Heart,     hint: 'BCS Gemini' },
        { id: 'print',    label: 'Imprimer dossier médical',icon: Printer,hint: 'PDF' },
        { id: 'export',   label: 'Export CSV du cheptel', icon: Activity,  hint: 'Tableur' },
    ]), []);

    const filteredAnimals = useMemo(() => {
        if (!query.trim()) return animals.slice(0, 8);
        const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
        return animals
            .map(a => ({ a, s: rank(a, tokens) }))
            .filter(x => x.s >= 0)
            .sort((x, y) => y.s - x.s)
            .slice(0, 10)
            .map(x => x.a);
    }, [animals, query]);

    const filteredActions = useMemo(() => {
        if (!query.trim()) return GLOBAL_ACTIONS;
        const q = query.toLowerCase();
        return GLOBAL_ACTIONS.filter(a => a.label.toLowerCase().includes(q));
    }, [query, GLOBAL_ACTIONS]);

    const flatList = useMemo(() => ([
        ...filteredAnimals.map(a => ({ kind: 'animal', data: a })),
        ...filteredActions.map(a => ({ kind: 'action', data: a })),
    ]), [filteredAnimals, filteredActions]);

    const totalResults = flatList.length;

    // Keyboard navigation inside the palette
    useEffect(() => {
        if (!open) return;
        const nav = (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, totalResults - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                const item = flatList[highlight];
                if (!item) return;
                setOpen(false);
                if (item.kind === 'animal') onSelectAnimal?.(item.data);
                else onAction?.(item.data.id);
            }
        };
        window.addEventListener('keydown', nav);
        return () => window.removeEventListener('keydown', nav);
    }, [open, highlight, flatList, totalResults, onSelectAnimal, onAction]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="command-palette-backdrop"
                    key="cmdk-backdrop"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => setOpen(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 11000,
                        background: 'rgba(6,8,16,0.75)', backdropFilter: 'blur(10px)',
                        display: 'flex', justifyContent: 'center', paddingTop: '14vh',
                    }}
                >
                    <motion.div
                        className="command-palette-panel"
                        key="cmdk-panel"
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.96, y: -16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -10 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                        style={{
                            width: 'min(640px, 92vw)',
                            maxHeight: '70vh',
                            background: 'var(--panel)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 18,
                            boxShadow: '0 25px 80px rgba(0,0,0,0.7), 0 0 60px rgba(74,222,128,0.15)',
                            overflow: 'hidden',
                            color: 'var(--text-light)',
                            fontFamily: "'Rajdhani', sans-serif",
                            display: 'flex', flexDirection: 'column',
                        }}
                    >
                        {/* Search bar */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '18px 20px', borderBottom: '1px solid var(--glass-border)'
                        }}>
                            <Search size={18} color="#4ade80" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={e => { setQuery(e.target.value); setHighlight(0); }}
                                placeholder="Rechercher un animal, une action..."
                                style={{
                                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                                    color: 'var(--text-bright)', fontSize: '1rem', fontFamily: "'Rajdhani', sans-serif",
                                    letterSpacing: '0.5px',
                                }}
                            />
                            <div style={{
                                display: 'flex', gap: 4, alignItems: 'center',
                                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
                                color: 'rgba(255,255,255,0.45)',
                            }}>
                                <kbd style={kbdStyle}>ESC</kbd>
                            </div>
                        </div>

                        {/* Results */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
                            {filteredAnimals.length > 0 && (
                                <>
                                    <SectionTitle>Animaux</SectionTitle>
                                    {filteredAnimals.map((a, i) => {
                                        const idx = i;
                                        const selected = highlight === idx;
                                        return (
                                            <Row key={`a-${a.id}`}
                                                selected={selected}
                                                onMouseEnter={() => setHighlight(idx)}
                                                onClick={() => { setOpen(false); onSelectAnimal?.(a); }}>
                                                <Cpu size={14} color={statusColor(a.status)} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700 }}>
                                                        {a.tag_id || '—'}
                                                        <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontWeight: 500 }}>
                                                            {a.species} · {a.breed || 'Race inconnue'}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                                        Statut: {a.status || 'Active'}
                                                    </div>
                                                </div>
                                                {selected && <CornerDownLeft size={12} color="#4ade80" />}
                                            </Row>
                                        );
                                    })}
                                </>
                            )}

                            {filteredActions.length > 0 && (
                                <>
                                    <SectionTitle>Actions</SectionTitle>
                                    {filteredActions.map((act, i) => {
                                        const idx = filteredAnimals.length + i;
                                        const selected = highlight === idx;
                                        const Icon = act.icon;
                                        return (
                                            <Row key={act.id} selected={selected}
                                                onMouseEnter={() => setHighlight(idx)}
                                                onClick={() => { setOpen(false); onAction?.(act.id); }}>
                                                <Icon size={14} color="#a78bfa" />
                                                <div style={{ flex: 1, fontWeight: 700 }}>{act.label}</div>
                                                <span style={{
                                                    fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)',
                                                    background: 'rgba(167,139,250,0.12)', padding: '2px 8px',
                                                    borderRadius: 6,
                                                }}>
                                                    {act.hint}
                                                </span>
                                                {selected && <CornerDownLeft size={12} color="#a78bfa" />}
                                            </Row>
                                        );
                                    })}
                                </>
                            )}

                            {totalResults === 0 && (
                                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                                    Aucun résultat pour « {query} »
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{
                            borderTop: '1px solid var(--glass-border)',
                            padding: '10px 16px', display: 'flex', gap: 14,
                            fontSize: '0.65rem', color: 'var(--text-dim)',
                            fontFamily: "'JetBrains Mono', monospace",
                        }}>
                            <span><kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> Naviguer</span>
                            <span><kbd style={kbdStyle}>↵</kbd> Sélectionner</span>
                            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Command size={10} /> + K pour rouvrir
                            </span>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const kbdStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: '0.62rem',
    fontFamily: "'JetBrains Mono', monospace",
    color: 'rgba(255,255,255,0.7)',
};

const SectionTitle = ({ children }) => (
    <div style={{
        fontSize: '0.55rem', letterSpacing: 2, textTransform: 'uppercase',
        color: 'var(--text-dim)', padding: '8px 12px 4px', fontWeight: 800,
    }}>{children}</div>
);

const Row = ({ children, selected, onClick, onMouseEnter }) => (
    <motion.div
        onClick={onClick} onMouseEnter={onMouseEnter}
        whileTap={{ scale: 0.985 }}
        style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
            background: selected ? 'rgba(74,222,128,0.08)' : 'transparent',
            border: selected ? '1px solid rgba(74,222,128,0.35)' : '1px solid transparent',
            transition: 'background 0.15s, border 0.15s',
            fontSize: '0.82rem',
        }}
    >
        {children}
    </motion.div>
);

const statusColor = (status) => {
    if (!status) return '#4ade80';
    if (['Critique', 'URGENCE', 'Malade'].includes(status)) return '#ef4444';
    if (status === 'Déshydraté')    return '#38bdf8';
    if (status === 'Sous-alimenté') return '#fbbf24';
    if (status === 'Stressé')       return '#a78bfa';
    return '#4ade80';
};

export default CommandPalette;
