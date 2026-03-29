import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polygon, Tooltip } from 'react-leaflet';
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
                map.flyTo(position, 16, { duration: 1.5 });
                setLastFlownId(selectedId);
            } catch (e) {
                console.warn("Map flyTo failed", e);
            }
        }
    }, [position, map, selectedId, lastFlownId]);
    return null;
};

const LivestockMap = ({ animals = [], telemetryData = {}, selectedId, onSelectAnimal, zones = [], onSaveZone, onDeleteZone, escapedAnimalIds = new Set() }) => {
    const defaultCenter = [36.60, 10.49];
    
    // Drawing Geofence State
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPolygon, setCurrentPolygon] = useState([]);
    const [selectedZoneId, setSelectedZoneId] = useState(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.key === "Delete" || e.key === "Backspace") && selectedZoneId) {
                if (window.confirm("Voulez-vous vraiment supprimer cette zone ?")) {
                    if (onDeleteZone) onDeleteZone(selectedZoneId);
                    setSelectedZoneId(null);
                }
            }
            if (e.key === "Escape") {
                setSelectedZoneId(null);
                setIsDrawing(false);
                setCurrentPolygon([]);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedZoneId, onDeleteZone]);

    const MapInteraction = () => {
        useMapEvents({
            click(e) {
                if (isDrawing) {
                    setCurrentPolygon(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
                } else {
                    // Click outside deselects
                    setSelectedZoneId(null);
                }
            }
        });
        return null;
    };

    const handleSaveDrawing = () => {
        if (currentPolygon.length < 3) {
            alert("Veuillez définir au moins 3 points pour créer une zone.");
            return;
        }
        const name = prompt("Nom de la nouvelle zone de pâturage :");
        if (!name) return;

        const geojson = {
            type: "Polygon",
            coordinates: [ currentPolygon.map(p => [p[1], p[0]]) ] // GeoJSON uses [lng, lat]
        };
        
        if (onSaveZone) {
            onSaveZone({ name, polygon_geojson: JSON.stringify(geojson) });
        }
        
        setIsDrawing(false);
        setCurrentPolygon([]);
    };

    // Target center is computed, but map will only fly if selectedId changes
    const targetCenter = useMemo(() => {
        if (selectedId) {
            const t = telemetryData[selectedId];
            if (t && t.latitude && t.longitude) return [t.latitude, t.longitude];
            
            const animal = animals.find(a => a.id === selectedId);
            if (animal && animal.latitude && animal.longitude) return [animal.latitude, animal.longitude];
        }
        return null;
    }, [selectedId, telemetryData, animals]);

    const markerElements = useMemo(() => {
        return animals.map(animal => {
            const t = telemetryData[animal.id];
            
            const lat = t?.latitude || animal.latitude || (36.60 + (Math.random() * 0.01 - 0.005));
            const lng = t?.longitude || animal.longitude || (10.49 + (Math.random() * 0.01 - 0.005));
            const isOnline = !!t;
            
            const isEscaped = escapedAnimalIds.has(animal.id);
            
            const isActuallyCritique = t ? 
                (t.heart_rate > 100 || t.temperature_c > 39.5 || t.heart_rate < 40 || t.temperature_c < 37.5 || isEscaped) 
                : (animal.status === 'Critique' || animal.status === 'URGENCE' || animal.status === 'Malade' || isEscaped);
            
            const healthStatus = isActuallyCritique ? 'Critique' : 'Sain';
            const activity = isEscaped ? 'HORS ZONE' : (t?.activity_level || (healthStatus === 'Critique' ? 'STRESS' : 'CALME'));
            
            let color = isActuallyCritique ? '#ef4444' : '#22c55e'; 
            let pulseClass = isActuallyCritique ? 'animate-pulse critical-beacon' : '';

            const customIcon = L.divIcon({
                className: 'custom-animal-marker',
                html: `
                    <div style="
                        width: 24px; 
                        height: 24px; 
                        background-color: ${color}; 
                        border: 3px solid #fff; 
                        border-radius: 50%; 
                        box-shadow: 0 0 10px ${color};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 10px;
                        font-weight: bold;
                    " class="${pulseClass}">
                        ${animal.species.charAt(0)}
                    </div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            return (
                <Marker 
                    key={animal.id} 
                    position={[lat, lng]} 
                    icon={customIcon}
                    eventHandlers={{
                        click: (e) => {
                            L.DomEvent.stopPropagation(e);
                            onSelectAnimal && onSelectAnimal(animal.id);
                        }
                    }}
                >
                    <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                        <div style={{ padding: '4px 8px', textAlign: 'center', minWidth: '120px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1.2em' }}>{animal.tag_id}</div>
                            <div style={{ fontSize: '0.85em', color: '#ccc', marginBottom: '4px' }}>
                                {animal.species} • {animal.breed}
                            </div>
                            <div style={{ 
                                padding: '3px 8px', 
                                borderRadius: '12px', 
                                background: (isOnline || isEscaped) ? color : '#555', 
                                color: '#fff', 
                                fontSize: '0.85em',
                                fontWeight: 'bold'
                            }}>
                                {isEscaped ? 'HORS ZONE' : (isOnline ? activity : 'Capteur Hors-ligne')}
                            </div>
                            {isOnline && (
                                <div style={{ marginTop: '4px', fontSize: '0.75em', color: '#4ade80', fontWeight: 'bold' }}>
                                    ● Capteur en marche
                                </div>
                            )}
                        </div>
                    </Tooltip>
                    <Popup minWidth={180}>
                        <div style={{ color: '#000', padding: '5px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: '1.1rem' }}>{animal.tag_id}</strong>
                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '10px', background: (isOnline || isEscaped) ? color : '#eee', color: (isOnline || isEscaped) ? '#fff' : '#666' }}>
                                    {isEscaped ? 'HORS ZONE' : (isOnline ? activity : 'HORS-LIGNE')}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '8px', marginTop: '4px' }}>
                                {animal.species} • {animal.breed}
                            </div>
                            
                            {isOnline ? (
                                <div style={{ borderTop: '1px solid #eee', paddingTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                                    <div style={{ background: '#f8f9fa', padding: '5px', borderRadius: '6px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#666' }}>💓 BPM</div>
                                        <div style={{ fontWeight: 'bold' }}>{Math.round(t.heart_rate)}</div>
                                    </div>
                                    <div style={{ background: '#f8f9fa', padding: '5px', borderRadius: '6px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#666' }}>🌡️ Temp</div>
                                        <div style={{ fontWeight: 'bold' }}>{t.temperature_c}°C</div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ borderTop: '1px solid #eee', paddingTop: '8px', fontSize: '0.8rem', color: '#999', textAlign: 'center', fontStyle: 'italic' }}>
                                    Aucune donnée capteur
                                </div>
                            )}
                        </div>
                    </Popup>
                </Marker>
            );
        });
    }, [animals, telemetryData, onSelectAnimal]);

    return (
        <div style={{ position: 'relative', height: '450px', width: '100%', borderRadius: '16px', overflow: 'hidden', background: '#111', border: '1px solid var(--glass-border)' }}>
            
            {/* Geofencing Controls */}
            <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {!isDrawing ? (
                    <button 
                        onClick={() => { setIsDrawing(true); setSelectedZoneId(null); }}
                        style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
                    >
                        + Dessiner une Zone (Geofence)
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <button 
                            onClick={handleSaveDrawing}
                            style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                        >
                            Sauvegarder
                        </button>
                        <button 
                            onClick={() => { setIsDrawing(false); setCurrentPolygon([]); }}
                            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                        >
                            Annuler
                        </button>
                    </div>
                )}
            </div>

            {selectedZoneId && (
                <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1000, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                    Zone sélectionnée. Appuyez sur [Suppr] pour effacer.
                </div>
            )}

            {isDrawing && (
                <div style={{ position: 'absolute', top: '50px', right: '10px', zIndex: 1000, background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '8px', borderRadius: '8px', fontSize: '0.7rem' }}>
                    Cliquez sur la carte pour tracer.<br/>Points: {currentPolygon.length}
                </div>
            )}

            <MapContainer center={defaultCenter} zoom={14} style={{ height: '100%', width: '100%', cursor: isDrawing ? 'crosshair' : 'grab' }} zoomControl={true}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                {targetCenter && selectedId && <FlightController position={targetCenter} selectedId={selectedId} />}
                <MapInteraction />
                
                {/* Render Saved Zones */}
                {zones.map(z => {
                    let positions = [];
                    try {
                        const geo = JSON.parse(z.polygon_geojson);
                        if (geo && geo.coordinates && geo.coordinates[0]) {
                            positions = geo.coordinates[0].map(coord => [coord[1], coord[0]]); // GeoJSON [lng, lat] to Leaflet [lat, lng]
                        }
                    } catch(e) {}
                    
                    if (positions.length > 0) {
                        const isSelected = selectedZoneId === z.id;
                        return (
                            <Polygon 
                                key={z.id} 
                                positions={positions} 
                                pathOptions={{ 
                                    color: isSelected ? '#ef4444' : 'var(--primary)', 
                                    weight: isSelected ? 4 : 2,
                                    fillColor: isSelected ? '#ef4444' : 'var(--primary)', 
                                    fillOpacity: isSelected ? 0.5 : 0.2 
                                }}
                                eventHandlers={{
                                    click: (e) => {
                                        L.DomEvent.stopPropagation(e);
                                        if (!isDrawing) {
                                            setSelectedZoneId(z.id === selectedZoneId ? null : z.id);
                                        }
                                    }
                                }}
                            >
                                <Tooltip sticky>{z.name}</Tooltip>
                            </Polygon>
                        );
                    }
                    return null;
                })}

                {/* Render Currently Drawing Polygon */}
                {currentPolygon.length > 0 && (
                    <Polygon positions={currentPolygon} pathOptions={{ color: '#eab308', dashArray: '5, 5', fillColor: '#eab308', fillOpacity: 0.4 }} />
                )}

                {markerElements}
            </MapContainer>

            <style>{`
                @keyframes critical-blink {
                    0% { opacity: 1; transform: scale(1); box-shadow: 0 0 15px #ef4444; }
                    50% { opacity: 0.4; transform: scale(1.2); box-shadow: 0 0 30px #ef4444; }
                    100% { opacity: 1; transform: scale(1); box-shadow: 0 0 15px #ef4444; }
                }
                .critical-beacon { animation: critical-blink 0.8s infinite ease-in-out; z-index: 1000 !important; }
            `}</style>
        </div>
    );
};

export default LivestockMap;
