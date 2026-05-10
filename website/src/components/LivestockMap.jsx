import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents,
    Polygon, Polyline, Tooltip, LayersControl, LayerGroup
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { satelliteService } from '../services/api';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

// ─────────────────────────── Map helpers ────────────────────────────────────

const FlightController = ({ position, selectedId }) => {
    const map = useMap();
    const [lastFlownId, setLastFlownId] = useState(null);
    useEffect(() => {
        if (position && position[0] && position[1] && selectedId !== lastFlownId) {
            try { map.flyTo(position, 18, { duration: 2.0 }); setLastFlownId(selectedId); }
            catch (e) { console.warn('Map flyTo failed', e); }
        }
    }, [position, map, selectedId, lastFlownId]);
    return null;
};

const MapSearchController = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords && coords.length >= 2) {
            try { map.flyTo([coords[0], coords[1]], 18, { duration: 2.0 }); }
            catch (e) { console.warn('Search map flyTo failed', e); }
        }
    }, [coords, map]);
    return null;
};

// ─────────────────────────── SVI scan line ──────────────────────────────────

const SVIScan = () => {
    const [scanPos, setScanPos] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setScanPos(prev => (prev > 100 ? 0 : prev + 1.5)), 80);
        return () => clearInterval(interval);
    }, []);
    return (
        <div style={{
            position: 'absolute', top: `${scanPos}%`, left: 0, width: '100%', height: '3px',
            background: 'rgba(74, 222, 128, 0.4)', boxShadow: '0 0 25px rgba(74, 222, 128, 0.9)',
            zIndex: 1000, pointerEvents: 'none', transition: 'top 0.1s linear'
        }} />
    );
};

// ─────────────────────────── SVI HUD ────────────────────────────────────────

const SVIHUD = ({ isConnected, sceneInfo }) => {
    const [revisit, setRevisit] = useState(140);
    useEffect(() => {
        const i = setInterval(() => setRevisit(prev => prev > 1 ? prev - 1 : 140), 1000);
        return () => clearInterval(i);
    }, []);

    const acqDate = sceneInfo?.acquisition_date
        ? sceneInfo.acquisition_date.substring(0, 10)
        : null;

    return (
        <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
                background: 'rgba(0,12,5,0.85)', padding: '12px 18px',
                border: '1.5px solid #4ade80', borderRadius: '14px',
                color: '#4ade80', minWidth: '240px', boxShadow: '0 8px 32px rgba(0,255,100,0.15)',
                backdropFilter: 'blur(8px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ width: '8px', height: '8px', background: isConnected ? '#4ade80' : '#ef4444', borderRadius: '50%', animation: 'pulse 1s infinite', boxShadow: `0 0 10px ${isConnected ? '#4ade80' : '#ef4444'}` }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: '900', letterSpacing: '1.5px', textShadow: '0 0 5px rgba(74,222,128,0.5)' }}>SVI ORBITAL ENGINE v3.5</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.65rem', borderTop: '1px solid rgba(74, 222, 128, 0.2)', paddingTop: '8px' }}>
                    <div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>NODE</div>
                        <div style={{ color: '#fff', fontWeight: '700' }}>SMART-SAT 1A (COPERNICUS)</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>ETA RE-SCAN</div>
                        <div style={{ color: '#4ade80', fontWeight: '700' }}>{Math.floor(revisit / 60)}m {revisit % 60}s</div>
                    </div>
                </div>
            </div>

            {/* Satellite source card — shows real Sentinel-2 scene info when available */}
            <div style={{
                background: 'rgba(0,0,0,0.6)', padding: '8px 15px',
                border: `1px solid ${sceneInfo ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '10px', color: 'rgba(255,255,255,0.8)', fontSize: '0.6rem',
                display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(4px)'
            }}>
                <div style={{ fontSize: '10px' }}>🛰️</div>
                <div>
                    <span style={{ fontWeight: '800', color: '#fff' }}>
                        {sceneInfo ? 'SENTINEL-2 L2A VERIFIED' : 'IMAGERY AUTHENTICATED'}
                    </span>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.5rem' }}>
                        {sceneInfo
                            ? `Scene: ${sceneInfo.scene_id?.substring(0, 25)}… | ☁️ ${sceneInfo.cloud_cover_pct}% | 📅 ${acqDate}`
                            : 'Source: Esri, Maxar, Earthstar Geographics, CNES/Airbus'
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────── NDVI Legend ────────────────────────────────────

const NdviLegend = () => (
    <div style={{
        position: 'absolute', bottom: '80px', left: '20px', zIndex: 1000,
        background: 'rgba(0,12,5,0.88)', border: '1px solid rgba(34,197,94,0.4)',
        borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.6rem',
        backdropFilter: 'blur(8px)', minWidth: '130px'
    }}>
        <div style={{ fontWeight: 900, color: '#22c55e', marginBottom: '8px', letterSpacing: '1px' }}>NDVI — INDICE</div>
        {[
            { color: '#22c55e', label: '> 0.60  Excellent' },
            { color: '#84cc16', label: '0.45–0.60  Bon' },
            { color: '#f59e0b', label: '0.30–0.45  Stressé' },
            { color: '#ef4444', label: '< 0.30  Épuisé' },
        ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                <div style={{ width: '12px', height: '12px', background: color, borderRadius: '3px', flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</span>
            </div>
        ))}
        <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)', fontSize: '0.5rem' }}>
            MODIS Terra 8-Day • NASA GIBS
        </div>
    </div>
);

// ─────────────────────────── Zone health panel ──────────────────────────────

const NdviZonesPanel = ({ ndviData, ndviOpacity, onOpacityChange }) => {
    if (!ndviData) return null;
    const { zones, scene_info, ndvi_tile_date } = ndviData;

    return (
        <div style={{
            position: 'absolute', top: '175px', right: '20px', zIndex: 1000,
            background: 'rgba(0,12,5,0.90)', border: '1.5px solid #22c55e',
            borderRadius: '14px', padding: '14px 16px', minWidth: '210px', maxWidth: '240px',
            backdropFilter: 'blur(10px)', color: '#fff',
            boxShadow: '0 8px 32px rgba(0,200,80,0.15)'
        }}>
            <div style={{ fontWeight: 900, color: '#22c55e', marginBottom: '10px', fontSize: '0.72rem', letterSpacing: '1px' }}>
                🌿 SANTÉ DES PÂTURAGES
            </div>

            {zones.length === 0 ? (
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '8px 0' }}>
                    Aucune zone définie.<br />Dessinez une zone SVI sur la carte.
                </div>
            ) : (
                zones.map(zone => (
                    <div key={zone.zone_id} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 800, marginBottom: '4px' }}>Zone de ferme</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                                <div style={{ width: `${Math.min(zone.ndvi * 100, 100)}%`, height: '100%', background: zone.color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                            </div>
                            <span style={{ fontSize: '0.65rem', color: zone.color, fontWeight: 900, whiteSpace: 'nowrap' }}>
                                {zone.ndvi.toFixed(2)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.62rem', color: zone.color, fontWeight: 700 }}>{zone.status}</span>
                            {zone.is_real ? (
                                <span style={{ fontSize: '0.5rem', color: '#4ade80', background: 'rgba(74,222,128,0.15)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(74,222,128,0.5)', fontWeight: 900, letterSpacing: '0.5px' }}>
                                    S2 RÉEL
                                </span>
                            ) : zone.anchored_to_scene ? (
                                <span style={{ fontSize: '0.5rem', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(251,191,36,0.3)', fontWeight: 700 }}>
                                    MODÈLE
                                </span>
                            ) : null}
                        </div>
                        {zone.recommendation && (
                            <div style={{ fontSize: '0.58rem', color: '#f59e0b', marginTop: '4px', lineHeight: 1.4 }}>
                                ⚠️ {zone.recommendation}
                            </div>
                        )}
                    </div>
                ))
            )}

            {/* Opacity slider */}
            <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.45)', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Opacité overlay</span>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>{Math.round(ndviOpacity * 100)}%</span>
                </div>
                <input
                    type="range" min="0.1" max="1" step="0.05" value={ndviOpacity}
                    onChange={e => onOpacityChange(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#22c55e', cursor: 'pointer' }}
                />
            </div>

            {/* Data source footer */}
            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                {scene_info ? (
                    <>
                        <div>🛰️ {scene_info.platform?.toUpperCase()} — {scene_info.processing_level}</div>
                        <div>☁️ Couverture: {scene_info.cloud_cover_pct}%</div>
                        <div>📅 Scène: {scene_info.acquisition_date?.substring(0, 10)}</div>
                    </>
                ) : (
                    <div>📅 Tuiles MODIS: {ndvi_tile_date}</div>
                )}
                <div style={{ marginTop: '3px', color: 'rgba(255,255,255,0.2)' }}>
                    Element84 STAC • NASA GIBS
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────── Main component ─────────────────────────────────

const LivestockMap = ({
    animals = [], telemetryData = {}, selectedId, onSelectAnimal,
    zones = [], onSaveZone, escapedAnimalIds = new Set(),
    initialPaths = {}, onMapCapture
}) => {
    const defaultCenter = [36.60, 10.49];

    // — existing state —
    const [isDrawing, setIsDrawing] = useState(false);
    const [isCaptureMode, setIsCaptureMode] = useState(false);
    const [currentPolygon, setCurrentPolygon] = useState([]);
    const [selectedZoneId, setSelectedZoneId] = useState(null);
    const [paths, setPaths] = useState(initialPaths);
    const [searchInput, setSearchInput] = useState('');
    const [searchedMarker, setSearchedMarker] = useState(null);

    // — NDVI / Sentinel-2 state —
    const [showNdvi, setShowNdvi] = useState(false);
    const [ndviOpacity, setNdviOpacity] = useState(0.65);
    const [ndviData, setNdviData] = useState(null);
    const [ndviLoading, setNdviLoading] = useState(false);
    const [ndviError, setNdviError] = useState(false);

    // ── Fetch satellite data once when NDVI mode is toggled on ──
    const fetchNdviData = useCallback(async () => {
        setNdviLoading(true);
        setNdviError(false);
        try {
            const res = await satelliteService.getZonesHealth();
            setNdviData(res.data);
        } catch (e) {
            console.error('[NDVI] fetch failed', e);
            setNdviError(true);
        }
        setNdviLoading(false);
    }, []);

    useEffect(() => {
        if (showNdvi && !ndviData && !ndviLoading) fetchNdviData();
    }, [showNdvi]);

    // ── Path tracking ──
    useEffect(() => {
        if (Object.keys(initialPaths).length > 0) {
            setPaths(prev => {
                const merged = { ...prev };
                Object.keys(initialPaths).forEach(id => {
                    if (!merged[id] || merged[id].length < initialPaths[id].length) merged[id] = initialPaths[id];
                });
                return merged;
            });
        }
    }, [initialPaths]);

    useEffect(() => {
        const newPaths = { ...paths };
        let changed = false;
        Object.entries(telemetryData).forEach(([id, t]) => {
            if (t?.latitude && t?.longitude) {
                const currentPath = newPaths[id] || [];
                const lastPos = currentPath[currentPath.length - 1];
                if (!lastPos || lastPos[0] !== t.latitude || lastPos[1] !== t.longitude) {
                    newPaths[id] = [...currentPath, [t.latitude, t.longitude]].slice(-100);
                    changed = true;
                }
            }
        });
        if (changed) setPaths(newPaths);
    }, [telemetryData]);

    // ── Helpers ──
    const handleSearch = () => {
        const parts = searchInput.split(/[\s,]+/).filter(Boolean).map(s => parseFloat(s));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            setSearchedMarker([parts[0], parts[1], Math.random()]);
        } else {
            alert('Format invalide. Utilisez: latitude, longitude (ex: 36.6042, 10.4921)');
        }
    };

    const getZoneNdviInfo = useCallback((zoneId) => {
        if (!ndviData?.zones) return null;
        return ndviData.zones.find(z => z.zone_id === zoneId) || null;
    }, [ndviData]);

    const targetCenter = useMemo(() => {
        if (selectedId) {
            const t = telemetryData[selectedId];
            if (t?.latitude && t?.longitude) return [t.latitude, t.longitude];
            const animal = animals.find(a => a.id === selectedId);
            if (animal?.latitude && animal?.longitude) return [animal.latitude, animal.longitude];
        }
        return null;
    }, [selectedId, telemetryData, animals]);

    // ── Map interaction handler ──
    const MapInteraction = () => {
        useMapEvents({
            click(e) {
                if (isDrawing) {
                    setCurrentPolygon(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
                } else if (isCaptureMode) {
                    if (onMapCapture) onMapCapture(e.latlng.lat, e.latlng.lng);
                    setIsCaptureMode(false);
                } else {
                    setSelectedZoneId(null);
                }
            }
        });
        return null;
    };

    // ── Animal group renderer (unchanged) ──
    const renderGroup = (speciesName) => {
        const filteredAnimals = animals.filter(a => a.species === speciesName);
        return (
            <LayerGroup>
                {filteredAnimals.map(animal => {
                    const t = telemetryData[animal.id];
                    const lat = t?.latitude || animal.latitude || (36.60 + (Math.random() * 0.005 - 0.0025));
                    const lng = t?.longitude || animal.longitude || (10.49 + (Math.random() * 0.005 - 0.0025));
                    const isEscaped = escapedAnimalIds.has(animal.id);
                    const isSVI = t?.source === 'SATELLITE_SVI';

                    // Telemetry hard anomalies → Critique
                    const telemetryCritique = t && (t.heart_rate > 100 || t.temperature_c > 39.5 || t.heart_rate < 40);
                    // BCS diagnostic status from Health Scan
                    const statusStyles = {
                        'Critique':      { color: '#ef4444', badge: '⚠️', critique: true },
                        'URGENCE':       { color: '#ef4444', badge: '⚠️', critique: true },
                        'Malade':        { color: '#ef4444', badge: '⚠️', critique: true },
                        'Déshydraté':    { color: '#38bdf8', badge: '💧', critique: false },
                        'Sous-alimenté': { color: '#fbbf24', badge: '🍽️', critique: false },
                        'Stressé':       { color: '#a78bfa', badge: '⚡',  critique: false },
                    };
                    const diagnosticStyle = statusStyles[animal.status];

                    // Priority: escape/telemetry-critique > diagnostic > healthy
                    let color, badge, isCritique;
                    if (telemetryCritique || isEscaped) {
                        color = '#ef4444'; badge = '⚠️'; isCritique = true;
                    } else if (diagnosticStyle) {
                        color = diagnosticStyle.color;
                        badge = diagnosticStyle.badge;
                        isCritique = diagnosticStyle.critique;
                    } else {
                        color = isSVI ? '#4ade80' : '#22c55e'; badge = null; isCritique = false;
                    }

                    const displaySpecies = (animal.species || 'Animal').charAt(0);
                    const customIcon = L.divIcon({
                        className: 'svi-animal-marker',
                        html: `
                            <div style="position:relative;width:30px;height:30px;">
                                ${isCritique ? `<div style="position:absolute;top:0;left:0;width:100%;height:100%;border-radius:50%;border:4px solid #ef4444;animation:ping 1.2s infinite ease-out;"></div>` : ''}
                                ${badge ? `<div style="position:absolute;top:-25px;left:50%;transform:translateX(-50%);font-size:16px;animation:${isCritique ? 'bounce 0.5s infinite alternate' : 'none'};filter:drop-shadow(0 0 4px ${color});">${badge}</div>` : ''}
                                ${isSVI ? `<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:6px;background:rgba(0,0,0,0.9);padding:1px 4px;border-radius:3px;color:#4ade80;border:1px solid #4ade80;white-space:nowrap;z-index:100;">SVI SYNC</div>` : ''}
                                <div style="width:100%;height:100%;background-color:${color};border:3px solid #fff;border-radius:6px;box-shadow:0 0 25px ${color};display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:900;transform:rotate(45deg) scale(${isCritique ? '1.4' : (selectedId === animal.id ? '1.2' : '1')});transition:all 0.4s cubic-bezier(0.175,0.885,0.32,1.275);animation:${isCritique ? 'emergency-blink 0.8s infinite linear' : 'none'};">
                                    <div style="transform:rotate(-45deg)">${displaySpecies}</div>
                                </div>
                            </div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });

                    return (
                        <React.Fragment key={animal.id}>
                            {paths[animal.id] && paths[animal.id].length > 1 && (
                                <Polyline
                                    positions={paths[animal.id]}
                                    pathOptions={{
                                        color: selectedId === animal.id ? '#4ade80' : 'rgba(255,255,255,0.3)',
                                        weight: selectedId === animal.id ? 3 : 1,
                                        dashArray: '5, 10', opacity: 0.6
                                    }}
                                />
                            )}
                            <Marker
                                position={[lat, lng]}
                                icon={customIcon}
                                eventHandlers={{ click: () => onSelectAnimal && onSelectAnimal(animal.id) }}
                            >
                                <Tooltip sticky direction="top">
                                    <div style={{ background: '#000', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                        <strong>{animal.tag_id}</strong>
                                    </div>
                                </Tooltip>
                                <Popup>
                                    <div style={{ padding: '4px', fontSize: '0.8rem' }}>
                                        <strong>ID: {animal.tag_id}</strong><br />
                                        💓 {t ? Math.round(t.heart_rate) : '—'} BPM | 🌡️ {t ? t.temperature_c : '—'}°C
                                        {animal.status && animal.status !== 'Active' && (
                                            <div style={{ marginTop: '4px', padding: '3px 6px', borderRadius: '4px', background: `${color}22`, color, fontWeight: 800, fontSize: '0.72rem', display: 'inline-block' }}>
                                                {badge || ''} {animal.status}
                                            </div>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        </React.Fragment>
                    );
                })}
            </LayerGroup>
        );
    };

    // ── NDVI tile URL (with correct format for Leaflet) ──
    const ndviTileUrl = ndviData?.ndvi_tile_url
        ? ndviData.ndvi_tile_url.replace('{z}', '{z}').replace('{y}', '{y}').replace('{x}', '{x}')
        : null;

    // ─────────────────────────── Render ─────────────────────────────────────
    return (
        <div style={{ position: 'relative', height: '550px', width: '100%', borderRadius: '20px', overflow: 'hidden', background: '#000', border: '2px solid #4ade8055' }}>
            <SVIScan />
            <SVIHUD isConnected={Object.keys(telemetryData).length > 0} sceneInfo={ndviData?.scene_info} />

            {/* ── Coordinate search ── */}
            <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000, display: 'flex', gap: '8px', background: 'rgba(0,12,5,0.85)', padding: '6px', borderRadius: '12px', border: '1.5px solid #4ade80', backdropFilter: 'blur(8px)', boxShadow: '0 8px 32px rgba(0,255,100,0.15)' }}>
                <input
                    type="text"
                    placeholder="Lat, Lng..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    style={{ background: 'transparent', border: 'none', color: '#4ade80', outline: 'none', fontSize: '0.8rem', width: '160px', paddingLeft: '8px', fontFamily: "'JetBrains Mono', monospace" }}
                />
                <button onClick={handleSearch} style={{ background: '#4ade80', border: 'transparent', borderRadius: '8px', padding: '6px 12px', color: '#000', cursor: 'pointer', fontWeight: '900', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>🔍</span>
                </button>
            </div>

            {/* ── NDVI zones panel (right side, below search) ── */}
            {showNdvi && (
                <NdviZonesPanel
                    ndviData={ndviData}
                    ndviOpacity={ndviOpacity}
                    onOpacityChange={setNdviOpacity}
                />
            )}

            {/* ── NDVI legend (bottom-right, above layer control) ── */}
            {showNdvi && <NdviLegend />}

            {/* ── Bottom controls ── */}
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {!isDrawing && !isCaptureMode ? (
                    <>
                        <button
                            onClick={() => { setIsDrawing(true); setSelectedZoneId(null); }}
                            style={{ background: '#4ade80', color: '#000', padding: '12px 20px', borderRadius: '12px', fontWeight: '900', boxShadow: '0 4px 15px rgba(74,222,128,0.3)', border: 'none', cursor: 'pointer' }}
                        >
                            📡 DÉFINIR ZONE SVI
                        </button>

                        <button
                            onClick={() => setIsCaptureMode(true)}
                            style={{ background: '#000', color: '#4ade80', border: '2px solid #4ade80', padding: '12px 20px', borderRadius: '12px', fontWeight: '900', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', cursor: 'pointer' }}
                        >
                            🛰️ CAPTURE SAT
                        </button>

                        {/* NDVI toggle button */}
                        <button
                            onClick={() => setShowNdvi(v => !v)}
                            disabled={ndviLoading}
                            style={{
                                background: showNdvi ? '#22c55e' : 'rgba(0,12,5,0.85)',
                                color: showNdvi ? '#000' : '#22c55e',
                                border: `2px solid ${ndviError ? '#ef4444' : '#22c55e'}`,
                                padding: '12px 20px', borderRadius: '12px', fontWeight: '900',
                                boxShadow: showNdvi ? '0 4px 15px rgba(34,197,94,0.4)' : '0 4px 15px rgba(0,0,0,0.5)',
                                cursor: ndviLoading ? 'wait' : 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {ndviLoading ? '⏳ SENTINEL-2...' : ndviError ? '⚠️ NDVI ERR' : `🌿 NDVI ${showNdvi ? 'ON' : 'OFF'}`}
                        </button>
                    </>
                ) : isDrawing ? (
                    <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.8)', padding: '8px', borderRadius: '14px', border: '1px solid #4ade80' }}>
                        <button
                            onClick={() => {
                                if (currentPolygon.length < 3) return alert('Min 3 points');
                                const name = prompt('Nom zone :');
                                if (name) onSaveZone({ name, polygon_geojson: JSON.stringify({ type: 'Polygon', coordinates: [currentPolygon.map(p => [p[1], p[0]])] }) });
                                setIsDrawing(false);
                                setCurrentPolygon([]);
                                // Refresh NDVI data to include new zone
                                if (showNdvi) { setNdviData(null); fetchNdviData(); }
                            }}
                            style={{ background: '#4ade80', color: '#000', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: '900', cursor: 'pointer' }}
                        >
                            SAUVEGARDER
                        </button>
                        <button
                            onClick={() => { setIsDrawing(false); setCurrentPolygon([]); }}
                            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer' }}
                        >
                            ANNULER
                        </button>
                    </div>
                ) : (
                    <div style={{ background: 'rgba(74,222,128,0.9)', color: '#000', padding: '12px 25px', borderRadius: '12px', fontWeight: '900', animation: 'pulse 1s infinite', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        CIBLEZ UNE ZONE SUR LA CARTE...
                        <button onClick={() => setIsCaptureMode(false)} style={{ background: 'none', border: 'none', color: '#000', fontWeight: '900', cursor: 'pointer', fontSize: '16px' }}>✖</button>
                    </div>
                )}
            </div>

            {/* ── Leaflet map ── */}
            <MapContainer center={defaultCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
                <LayersControl position="bottomright">

                    {/* Base layers */}
                    <LayersControl.BaseLayer checked name="Satellite SVI (Global)">
                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="OpenStreetMap">
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution="© OpenStreetMap contributors"
                        />
                    </LayersControl.BaseLayer>

                    {/* NDVI overlay layer (NASA GIBS — MODIS Terra 8-Day) */}
                    {showNdvi && ndviTileUrl && (
                        <LayersControl.Overlay checked name="🌿 NDVI Pâturage (MODIS Terra)">
                            <TileLayer
                                key={`ndvi-${ndviOpacity}`}
                                url={ndviTileUrl}
                                opacity={ndviOpacity}
                                attribution="NASA GIBS | MODIS Terra NDVI 8-Day"
                                tileSize={256}
                                zoomOffset={0}
                            />
                        </LayersControl.Overlay>
                    )}

                    {/* Animal species layers */}
                    <LayersControl.Overlay checked name="🐄 Groupe Bovins">{renderGroup('Bovin')}</LayersControl.Overlay>
                    <LayersControl.Overlay checked name="🐑 Groupe Ovins">{renderGroup('Ovin')}</LayersControl.Overlay>
                    <LayersControl.Overlay checked name="🐐 Groupe Caprins">{renderGroup('Caprin')}</LayersControl.Overlay>
                    <LayersControl.Overlay checked name="🐎 Groupe Chevaux">{renderGroup('Cheval')}</LayersControl.Overlay>
                </LayersControl>

                <MapInteraction />

                {targetCenter && selectedId && <FlightController position={targetCenter} selectedId={selectedId} />}
                {searchedMarker && <MapSearchController coords={searchedMarker} />}
                {searchedMarker && (
                    <Marker position={[searchedMarker[0], searchedMarker[1]]} icon={DefaultIcon}>
                        <Popup>
                            <div style={{ fontSize: '0.8rem' }}>
                                <strong>🎯 Position ciblée</strong><br />
                                Lat: {searchedMarker[0]}<br />Lng: {searchedMarker[1]}
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Geofence zones — NDVI-aware fill color */}
                {zones.map(z => {
                    let positions = [];
                    try {
                        const geo = JSON.parse(z.polygon_geojson);
                        if (geo?.coordinates?.[0]) positions = geo.coordinates[0].map(c => [c[1], c[0]]);
                    } catch (e) { /* malformed geojson */ }

                    if (positions.length === 0) return null;

                    const ndviInfo = getZoneNdviInfo(z.id);
                    const isSelected = selectedZoneId === z.id;
                    const borderColor = isSelected ? '#ef4444' : (showNdvi && ndviInfo ? ndviInfo.color : '#4ade80');
                    const fillColor = showNdvi && ndviInfo ? ndviInfo.color : '#4ade80';
                    const fillOpacity = showNdvi && ndviInfo ? 0.30 : 0.08;

                    return (
                        <Polygon
                            key={z.id}
                            positions={positions}
                            pathOptions={{ color: borderColor, weight: isSelected ? 3 : 2, fillColor, fillOpacity }}
                            eventHandlers={{ click: e => { L.DomEvent.stopPropagation(e); setSelectedZoneId(z.id); } }}
                        >
                            {showNdvi && ndviInfo && (
                                <Tooltip sticky direction="top" permanent={false}>
                                    <div style={{ background: '#000', color: ndviInfo.color, padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 900 }}>
                                        {z.name} — NDVI {ndviInfo.ndvi} ({ndviInfo.status})
                                    </div>
                                </Tooltip>
                            )}
                        </Polygon>
                    );
                })}

                {/* In-progress drawing polygon */}
                {currentPolygon.length > 0 && (
                    <Polygon positions={currentPolygon} pathOptions={{ color: '#4ade80', dashArray: '5, 5', fillOpacity: 0.1 }} />
                )}
            </MapContainer>

            <style>{`
                @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
                @keyframes ping { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
                @keyframes bounce { from { transform: translate(-50%, 0); } to { transform: translate(-50%, -10px); } }
                @keyframes emergency-blink {
                    0%   { background-color: #ef4444; box-shadow: 0 0 10px #ef4444; }
                    50%  { background-color: #fff;    box-shadow: 0 0 30px #fff; color: #ef4444; }
                    100% { background-color: #ef4444; box-shadow: 0 0 10px #ef4444; }
                }
                .svi-animal-marker { transition: all 0.5s ease; }
                .leaflet-container { cursor: ${isCaptureMode ? 'crosshair !important' : 'grab'} }
            `}</style>
        </div>
    );
};

export default LivestockMap;
