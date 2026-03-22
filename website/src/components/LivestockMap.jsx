import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayerGroup, Tooltip } from 'react-leaflet';
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

const LivestockMap = ({ animals = [], telemetryData = {}, selectedId, onSelectAnimal }) => {
    const defaultCenter = [36.60, 10.49];
    
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
            
            // If we have telemetry, use real pos, else use manual pos from DB, else random scatter
            const lat = t?.latitude || animal.latitude || (36.60 + (Math.random() * 0.01 - 0.005));
            const lng = t?.longitude || animal.longitude || (10.49 + (Math.random() * 0.01 - 0.005));
            const isOnline = !!t;
            
            const isActuallyCritique = t ? 
                (t.heart_rate > 100 || t.temperature_c > 39.5 || t.heart_rate < 40 || t.temperature_c < 37.5) 
                : (animal.status === 'Critique' || animal.status === 'URGENCE' || animal.status === 'Malade');
            
            const healthStatus = isActuallyCritique ? 'Critique' : 'Sain';
            const activity = t?.activity_level || (healthStatus === 'Critique' ? 'STRESS' : 'CALME');
            
            let color = isActuallyCritique ? '#ef4444' : '#22c55e'; // Red (Critique) or Green (Sain)
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
                        click: () => onSelectAnimal && onSelectAnimal(animal.id)
                    }}
                >
                    <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                        <div style={{ padding: '2px 5px', fontWeight: 'bold' }}>
                            {animal.tag_id} : {activity}
                        </div>
                    </Tooltip>
                    <Popup minWidth={180}>
                        <div style={{ color: '#000', padding: '5px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: '1.1rem' }}>{animal.tag_id}</strong>
                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '10px', background: isOnline ? color : '#eee', color: isOnline ? '#fff' : '#666' }}>
                                    {activity}
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
        <div style={{ height: '450px', width: '100%', borderRadius: '16px', overflow: 'hidden', background: '#111', border: '1px solid var(--glass-border)' }}>
            <MapContainer center={defaultCenter} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={true}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                {targetCenter && selectedId && <FlightController position={targetCenter} selectedId={selectedId} />}
                {markerElements}
            </MapContainer>

            <style>{`
                @keyframes critical-blink {
                    0% { opacity: 1; transform: scale(1); box-shadow: 0 0 15px #ef4444; }
                    50% { opacity: 0.4; transform: scale(1.2); box-shadow: 0 0 30px #ef4444; }
                    100% { opacity: 1; transform: scale(1); box-shadow: 0 0 15px #ef4444; }
                }
                .critical-beacon {
                    animation: critical-blink 0.8s infinite ease-in-out;
                    z-index: 1000 !important;
                }
                .leaflet-tooltip {
                    background: rgba(0, 0, 0, 0.85);
                    border: 1px solid var(--glass-border);
                    color: white;
                    border-radius: 8px;
                    padding: 4px 8px;
                    font-family: inherit;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                }
                .leaflet-tooltip-top:before {
                    border-top-color: rgba(0, 0, 0, 0.85);
                }
            `}</style>
        </div>
    );
};

export default LivestockMap;
