import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polygon, Polyline, Tooltip, LayersControl, LayerGroup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Professional Marker Setup
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

// A safe component to handle map centering only when a new animal is selected
const FlightController = ({ position, selectedId }) => {
    const map = useMap();
    const [lastFlownId, setLastFlownId] = useState(null);

    useEffect(() => {
        if (position && position[0] && position[1] && selectedId !== lastFlownId) {
            try {
                map.flyTo(position, 18, { duration: 2.0 }); 
                setLastFlownId(selectedId);
            } catch (e) { console.warn("Map flyTo failed", e); }
        }
    }, [position, map, selectedId, lastFlownId]);
    return null;
};

// Safe component for map searching
const MapSearchController = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords && coords.length >= 2) {
            try {
                map.flyTo([coords[0], coords[1]], 18, { duration: 2.0 });
            } catch (e) { console.warn("Search map flyTo failed", e); }
        }
    }, [coords, map]);
    return null;
};

// --- SVI Scan Animation ---
const SVIScan = () => {
    const [scanPos, setScanPos] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setScanPos(prev => (prev > 100 ? 0 : prev + 1.5));
        }, 80);
        return () => clearInterval(interval);
    }, []);
    return (
        <div style={{
            position: 'absolute', top: `${scanPos}%`, left: 0, width: '100%', height: '3px',
            background: 'rgba(74, 222, 128, 0.4)', boxShadow: '0 0 25px rgba(74, 222, 128, 0.9)',
            zIndex: 1000, pointerEvents: 'none', transition: 'top 0.1s linear'
        }}></div>
    );
};

// --- SVI HUD Metadata Overlay ---
const SVIHUD = ({ isConnected }) => {
    const [revisit, setRevisit] = useState(140);
    useEffect(() => {
        const i = setInterval(() => setRevisit(prev => prev > 1 ? prev - 1 : 140), 1000);
        return () => clearInterval(i);
    }, []);

    return (
        <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="glass-card" style={{ 
                background: 'rgba(0,12,5,0.85)', padding: '12px 18px', 
                border: '1.5px solid #4ade80', borderRadius: '14px', 
                color: '#4ade80', minWidth: '240px', boxShadow: '0 8px 32px rgba(0,255,100,0.15)',
                backdropFilter: 'blur(8px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ width: '8px', height: '8px', background: isConnected ? '#4ade80' : '#ef4444', borderRadius: '50%', animation: 'pulse 1s infinite', boxShadow: `0 0 10px ${isConnected ? '#4ade80' : '#ef4444'}` }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: '900', letterSpacing: '1.5px', textShadow: '0 0 5px rgba(74,222,128,0.5)' }}>SVI ORBITAL ENGINE v3.5</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.65rem', borderTop: '1px solid rgba(74, 222, 128, 0.2)', paddingTop: '8px' }}>
                    <div><div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>NODE</div><div style={{ color: '#fff', fontWeight: '700' }}>SMART-SAT 1A (COPERNICUS)</div></div>
                    <div style={{ textAlign: 'right' }}><div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>ETA RE-SCAN</div><div style={{ color: '#4ade80', fontWeight: '700' }}>{Math.floor(revisit / 60)}m {revisit % 60}s</div></div>
                </div>
            </div>

            {/* Satellite Source Authentication HUD */}
            <div className="glass-card" style={{ 
                background: 'rgba(0,0,0,0.6)', padding: '8px 15px', 
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', 
                color: 'rgba(255,255,255,0.8)', fontSize: '0.6rem', display: 'flex', alignItems: 'center', gap: '8px',
                backdropFilter: 'blur(4px)'
            }}>
                <div style={{ fontSize: '10px' }}>🛰️</div>
                <div>
                   <span style={{ fontWeight: '800', color: '#fff' }}>IMAGERY AUTHENTICATED</span>
                   <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.5rem' }}>Source: Esri, Maxar, Earthstar Geographics, CNES/Airbus</div>
                </div>
            </div>
        </div>
    );
};

const LivestockMap = ({ 
    animals = [], telemetryData = {}, selectedId, onSelectAnimal, 
    zones = [], onSaveZone, onDeleteZone, escapedAnimalIds = new Set(), 
    initialPaths = {}, onMapCapture 
}) => {
    const defaultCenter = [36.60, 10.49];
    const [isDrawing, setIsDrawing] = useState(false);
    const [isCaptureMode, setIsCaptureMode] = useState(false);
    const [currentPolygon, setCurrentPolygon] = useState([]);
    const [selectedZoneId, setSelectedZoneId] = useState(null);
    const [paths, setPaths] = useState(initialPaths);
    
    // Search state
    const [searchInput, setSearchInput] = useState('');
    const [searchedMarker, setSearchedMarker] = useState(null);

    const handleSearch = () => {
        const parts = searchInput.split(/[\s,]+/).filter(Boolean).map(s => parseFloat(s));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            // Need a new array ref to trigger effect even if values are similar but we want to re-fly
            setSearchedMarker([parts[0], parts[1], Math.random()]); 
        } else {
            alert("Format invalide. Utilisez: latitude, longitude (ex: 36.6042, 10.4921)");
        }
    };

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

    // --- Moteur de Suivi (Centrage de la carte) ---
    const targetCenter = useMemo(() => {
        if (selectedId) {
            const t = telemetryData[selectedId];
            if (t?.latitude && t?.longitude) return [t.latitude, t.longitude];
            const animal = animals.find(a => a.id === selectedId);
            if (animal?.latitude && animal?.longitude) return [animal.latitude, animal.longitude];
        }
        return null;
    }, [selectedId, telemetryData, animals]);

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
                    const isCritique = t ? (t.heart_rate > 100 || t.temperature_c > 39.5 || t.heart_rate < 40 || isEscaped) : (animal.status === 'Critique' || isEscaped);
                    
                    let color = isCritique ? '#ef4444' : (isSVI ? '#4ade80' : '#22c55e'); 
                    const displaySpecies = (animal.species || 'Animal').charAt(0);
                    const sviConf = t?.svi_confidence !== undefined ? (t.svi_confidence * 100).toFixed(1) : "95.0";

                    const customIcon = L.divIcon({
                        className: 'svi-animal-marker',
                        html: `
                            <div style="position: relative; width: 30px; height: 30px;">
                                <!-- Aura d'onde de choc pour l'évasion (Ping) -->
                                ${isCritique ? `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 50%; border: 4px solid #ef4444; animation: ping 1.2s infinite ease-out;"></div>` : ''}
                                
                                <!-- Indicateur d'urgence ⚠️ -->
                                ${isCritique ? `<div style="position: absolute; top: -25px; left: 50%; transform: translateX(-50%); font-size: 16px; animation: bounce 0.5s infinite alternate;">⚠️</div>` : ''}

                                ${isSVI ? `<div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); font-size: 6px; background: rgba(0,0,0,0.9); padding: 1px 4px; border-radius: 3px; color: #4ade80; border: 1px solid #4ade80; white-space: nowrap; z-index: 100;">SVI SYNC</div>` : ''}

                                <div style="
                                    width: 100%; height: 100%; 
                                    background-color: ${color}; 
                                    border: 3px solid #fff; border-radius: 6px; 
                                    box-shadow: 0 0 25px ${isCritique ? '#ef4444' : color};
                                    display: flex; align-items: center; justify-content: center;
                                    color: white; font-size: 12px; font-weight: 900;
                                    transform: rotate(45deg) scale(${isCritique ? '1.4' : (selectedId === animal.id ? '1.2' : '1')});
                                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                                    animation: ${isCritique ? 'emergency-blink 0.8s infinite linear' : 'none'};
                                ">
                                    <div style="transform: rotate(-45deg)">${displaySpecies}</div>
                                </div>
                            </div>
                        `,
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
                            <Marker position={[lat, lng]} icon={customIcon} eventHandlers={{ click: () => onSelectAnimal && onSelectAnimal(animal.id) }}>
                                <Tooltip sticky direction="top">
                                    <div style={{ background: '#000', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                        <strong>{animal.tag_id}</strong><br/>{isSVI ? 'SVI Satellite Mode' : 'IoT Sensor Mode'}
                                    </div>
                                </Tooltip>
                                <Popup>
                                    <div style={{ padding: '4px', fontSize: '0.8rem' }}><strong>ID: {animal.tag_id}</strong><br/>💓 {t ? Math.round(t.heart_rate) : '—'} BPM | 🌡️ {t ? t.temperature_c : '—'}°C</div>
                                </Popup>
                            </Marker>
                        </React.Fragment>
                    );
                })}
            </LayerGroup>
        );
    };

    return (
        <div style={{ position: 'relative', height: '550px', width: '100%', borderRadius: '20px', overflow: 'hidden', background: '#000', border: '2px solid #4ade8055' }}>
            <SVIScan />
            <SVIHUD isConnected={Object.keys(telemetryData).length > 0} />

            {/* Search Input for Coordinates */}
            <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000, display: 'flex', gap: '8px', background: 'rgba(0,12,5,0.85)', padding: '6px', borderRadius: '12px', border: '1.5px solid #4ade80', backdropFilter: 'blur(8px)', boxShadow: '0 8px 32px rgba(0,255,100,0.15)' }}>
                <input 
                    type="text" 
                    placeholder="Lat, Lng..." 
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    style={{ background: 'transparent', border: 'none', color: '#4ade80', outline: 'none', fontSize: '0.8rem', width: '160px', paddingLeft: '8px', fontFamily: "'JetBrains Mono', monospace" }}
                />
                <button onClick={handleSearch} style={{ background: '#4ade80', border: 'transparent', borderRadius: '8px', padding: '6px 12px', color: '#000', cursor: 'pointer', fontWeight: '900', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>🔍</span>
                </button>
            </div>

            <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, display: 'flex', gap: '10px' }}>
                {!isDrawing && !isCaptureMode ? (
                    <>
                        <button onClick={() => { setIsDrawing(true); setSelectedZoneId(null); }} className="btn" style={{ background: '#4ade80', color: '#000', padding: '12px 20px', borderRadius: '12px', fontWeight: '900', boxShadow: '0 4px 15px rgba(74,222,128,0.3)' }}>📡 DÉFINIR ZONE SVI</button>
                        <button onClick={() => setIsCaptureMode(true)} className="btn" style={{ background: '#000', color: '#4ade80', border: '2px solid #4ade80', padding: '12px 20px', borderRadius: '12px', fontWeight: '900', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>🛰️ CAPTURE SAT</button>
                    </>
                ) : isDrawing ? (
                    <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.8)', padding: '8px', borderRadius: '14px', border: '1px solid #4ade80' }}>
                        <button onClick={() => { if (currentPolygon.length < 3) return alert("Min 3 points"); const name = prompt("Nom zone :"); if (name) onSaveZone({ name, polygon_geojson: JSON.stringify({ type: "Polygon", coordinates: [currentPolygon.map(p => [p[1], p[0]])] }) }); setIsDrawing(false); setCurrentPolygon([]); }} className="btn" style={{ background: '#4ade80', color: '#000' }}>SAUVEGARDER</button>
                        <button onClick={() => { setIsDrawing(false); setCurrentPolygon([]); }} className="btn btn-outline" style={{ color: '#fff' }}>ANNULER</button>
                    </div>
                ) : (
                    <div style={{ background: 'rgba(74,222,128,0.9)', color: '#000', padding: '12px 25px', borderRadius: '12px', fontWeight: '900', animation: 'pulse 1s infinite' }}>
                        CIBLEZ UNE ZONE SUR LA CARTE...
                        <button onClick={() => setIsCaptureMode(false)} style={{ marginLeft: '15px', background: 'none', border: 'none', color: '#000', fontWeight: '900', cursor: 'pointer' }}>✖</button>
                    </div>
                )}
            </div>

            <MapContainer center={defaultCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
                <LayersControl position="bottomright">
                    <LayersControl.BaseLayer checked name="Satellite SVI (Global)">
                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    </LayersControl.BaseLayer>
                    
                    <LayersControl.Overlay checked name="🐄 Groupe Bovins">
                        {renderGroup("Bovin")}
                    </LayersControl.Overlay>
                    <LayersControl.Overlay checked name="🐑 Groupe Ovins">
                        {renderGroup("Ovin")}
                    </LayersControl.Overlay>
                    <LayersControl.Overlay checked name="🐐 Groupe Caprins">
                        {renderGroup("Caprin")}
                    </LayersControl.Overlay>
                    <LayersControl.Overlay checked name="🐎 Groupe Chevaux">
                        {renderGroup("Cheval")}
                    </LayersControl.Overlay>
                </LayersControl>

                <MapInteraction />
                {targetCenter && selectedId && <FlightController position={targetCenter} selectedId={selectedId} />}
                {searchedMarker && <MapSearchController coords={searchedMarker} />}
                {searchedMarker && (
                    <Marker position={[searchedMarker[0], searchedMarker[1]]} icon={DefaultIcon}>
                        <Popup>
                            <div style={{ fontSize: '0.8rem' }}><strong>🎯 Position ciblée</strong><br/>Lat: {searchedMarker[0]}<br/>Lng: {searchedMarker[1]}</div>
                        </Popup>
                    </Marker>
                )}
                
                {zones.map(z => {
                    let positions = [];
                    try {
                        const geo = JSON.parse(z.polygon_geojson);
                        if (geo?.coordinates?.[0]) positions = geo.coordinates[0].map(c => [c[1], c[0]]);
                    } catch(e) {}
                    if (positions.length > 0) return <Polygon key={z.id} positions={positions} pathOptions={{ color: selectedZoneId === z.id ? '#ef4444' : '#4ade80', weight: 2, fillOpacity: 0.1 }} eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); setSelectedZoneId(z.id); } }} />;
                    return null;
                })}
                {currentPolygon.length > 0 && <Polygon positions={currentPolygon} pathOptions={{ color: '#4ade80', dashArray: '5, 5' }} />}
            </MapContainer>

            <style>{`
                @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
                @keyframes ping { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
                @keyframes bounce { from { transform: translate(-50%, 0); } to { transform: translate(-50%, -10px); } }
                @keyframes emergency-blink { 
                    0% { background-color: #ef4444; box-shadow: 0 0 10px #ef4444; } 
                    50% { background-color: #fff; box-shadow: 0 0 30px #fff; color: #ef4444; }
                    100% { background-color: #ef4444; box-shadow: 0 0 10px #ef4444; }
                }
                .svi-animal-marker { transition: all 0.5s ease; }
                .leaflet-container { cursor: ${isCaptureMode ? 'crosshair !important' : 'grab'} }
            `}</style>
        </div>
    );
};

export default LivestockMap;
