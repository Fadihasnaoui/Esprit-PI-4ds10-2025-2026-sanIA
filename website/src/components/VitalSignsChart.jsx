import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const VitalSignsChart = ({ telemetryData, selectedId, historicalData = [] }) => {
    const liveChartRef = useRef();
    const forecastChartRef = useRef();
    
    // Chart instances
    const c1 = useRef(null);
    const c2 = useRef(null);
    
    // Series
    const hrSeriesRef = useRef(null);
    const tSeriesRef = useRef(null);
    const hrForecastRef = useRef(null);
    const tForecastRef = useRef(null);
    
    // Data Accumulators
    const hrDataRef = useRef([]);
    const tDataRef = useRef([]);
    const lastTimeRef = useRef(0);

    // AI Prediction Generator (Forces REAL Device Time)
    const updateForecasts = () => {
        if (!hrForecastRef.current || !tForecastRef.current) return;
        if (hrDataRef.current.length < 3 || tDataRef.current.length < 3) return;
        
        const computeLinReg = (dataArray) => {
            const n = Math.min(dataArray.length, 20);
            const recent = dataArray.slice(-n);
            let sumX = 0, sumX2 = 0, sumY = 0, sumXY = 0;
            
            for (let i = 0; i < n; i++) {
                sumX += i;
                sumX2 += i * i;
                sumY += recent[i].value;
                sumXY += i * recent[i].value;
            }
            
            const denom = (n * sumX2 - sumX * sumX) || 1;
            const m = (n * sumXY - sumX * sumY) / denom;
            const b = (sumY - m * sumX) / n;
            
            // Forçage de l'heure locale (Tunisie = UTC+1 = 3600 sec)
            const nowSecs = Math.floor(Date.now() / 1000) + 3600;
            const predictions = [{ time: nowSecs, value: recent[recent.length - 1].value }];
            
            for (let i = 1; i <= 10; i++) {
                let val = (m * (n - 1 + i)) + b;
                val += (Math.random() - 0.5) * 1.5;
                predictions.push({ time: nowSecs + (i * 60), value: parseFloat(val.toFixed(2)) });
            }
            return predictions;
        };

        const fHr = computeLinReg(hrDataRef.current);
        const fTemp = computeLinReg(tDataRef.current);

        hrForecastRef.current.setData(fHr);
        tForecastRef.current.setData(fTemp);
        c2.current?.timeScale().fitContent();
    };

    useEffect(() => {
        if (!liveChartRef.current || !forecastChartRef.current) return;

        // --- CHART 1 : LIVE DATA ---
        c1.current = createChart(liveChartRef.current, {
            width: liveChartRef.current.clientWidth,
            height: 180,
            layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#c9d1d9' },
            grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
            timeScale: { timeVisible: true, secondsVisible: true },
            leftPriceScale: {
                visible: true,
                borderColor: 'rgba(255, 255, 255, 0.1)',
            },
            rightPriceScale: {
                visible: true,
                borderColor: 'rgba(255, 255, 255, 0.1)',
            },
        });
        hrSeriesRef.current = c1.current.addLineSeries({ color: '#f85149', lineWidth: 2, priceScaleId: 'right', title: 'BPM Réel' });
        tSeriesRef.current = c1.current.addLineSeries({ color: '#388bfd', lineWidth: 2, priceScaleId: 'left', title: 'Temp (°C) Réel' });

        // --- CHART 2 : AI FORECAST ---
        c2.current = createChart(forecastChartRef.current, {
            width: forecastChartRef.current.clientWidth,
            height: 160,
            layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#86efac' }, // Greenish text for IA
            grid: { vertLines: { color: 'rgba(134, 239, 172, 0.05)' }, horzLines: { color: 'rgba(134, 239, 172, 0.05)' } },
            timeScale: { timeVisible: true, secondsVisible: true },
            leftPriceScale: {
                visible: true,
                borderColor: 'rgba(134, 239, 172, 0.1)',
            },
            rightPriceScale: {
                visible: true,
                borderColor: 'rgba(134, 239, 172, 0.1)',
            },
        });
        // Both lines dashed in the forecast chart
        hrForecastRef.current = c2.current.addLineSeries({ color: '#f85149', lineWidth: 2, lineStyle: 2, priceScaleId: 'right', title: 'BPM (Prédictif)' });
        tForecastRef.current = c2.current.addLineSeries({ color: '#388bfd', lineWidth: 2, lineStyle: 2, priceScaleId: 'left', title: 'Temp (Prédictif)' });

        const handleResize = () => {
            if (c1.current && liveChartRef.current) c1.current.applyOptions({ width: liveChartRef.current.clientWidth });
            if (c2.current && forecastChartRef.current) c2.current.applyOptions({ width: forecastChartRef.current.clientWidth });
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            c1.current?.remove();
            c2.current?.remove();
        };
    }, []);

    // Handle Historical Data Input
    useEffect(() => {
        if (!hrSeriesRef.current || !tSeriesRef.current) return;
        if (historicalData.length > 0) {
            
            // 1. Calculate time drift between backend Simulator DB and Real Now
            let maxDbTime = 0;
            historicalData.forEach(d => {
                const t = Math.floor(new Date(d.time).getTime() / 1000);
                if (t > maxDbTime) maxDbTime = t;
            });
            const realNowSecs = Math.floor(Date.now() / 1000) + 3600; // Local Time (Tunisia)
            const timeShift = maxDbTime > 0 ? (realNowSecs - maxDbTime) : 0; 
            // This pulls all the 12:00 static database data to be plotted RIGHT NOW on the live axis!

            const seenTimes = new Set();
            const processPoints = (key) => historicalData
                .map(d => ({ 
                    time: Math.floor(new Date(d.time).getTime() / 1000) + timeShift, 
                    value: d[key] 
                }))
                .filter(p => {
                    if (isNaN(p.time) || p.value == null || p.time === 0 || seenTimes.has(p.time)) return false;
                    seenTimes.add(p.time);
                    return true;
                }).sort((a,b) => a.time - b.time);
            
            const hrPoints = processPoints('heart_rate');
            seenTimes.clear();
            const tPoints = historicalData
                .map(d => ({ 
                    time: Math.floor(new Date(d.time).getTime() / 1000) + timeShift, 
                    value: d.temperature_c != null ? d.temperature_c : null  // ONLY temperature_c, never weight_kg
                })) 
                .filter(p => p.value !== null && !isNaN(p.time) && p.value > 20 && p.value < 50) // Bovine range 20-50°C
                .sort((a,b) => a.time - b.time);
                
            const unqT = [];
            const tSet = new Set();
            for(let p of tPoints) { if(!tSet.has(p.time)) { tSet.add(p.time); unqT.push(p); } }

            hrSeriesRef.current.setData(hrPoints);
            tSeriesRef.current.setData(unqT);

            if (hrPoints.length > 0) lastTimeRef.current = hrPoints[hrPoints.length - 1].time;
            
            hrDataRef.current = hrPoints;
            tDataRef.current = unqT;
            c1.current?.timeScale().fitContent();
            updateForecasts();
        } else {
            hrSeriesRef.current.setData([]);
            tSeriesRef.current.setData([]);
            hrDataRef.current = [];
            tDataRef.current = [];
            lastTimeRef.current = 0;
            updateForecasts();
        }
    }, [historicalData, selectedId]);

    // Handle Live Websocket Injection
    useEffect(() => {
        if (selectedId && telemetryData[selectedId] && hrSeriesRef.current) {
            const latest = telemetryData[selectedId];
            if (!latest.time || !latest.heart_rate) return;

            try {
                // Ignore the backend's "simulated" date completely to prevent "temps passé" bugs
                // Force pure real system time plot (+1 hour for Tunisia)
                const timeSecs = Math.floor(Date.now() / 1000) + 3600;
                
                if (timeSecs <= lastTimeRef.current) return;
                lastTimeRef.current = timeSecs;

                const hrPoint = { time: timeSecs, value: latest.heart_rate };
                hrSeriesRef.current.update(hrPoint);
                hrDataRef.current.push(hrPoint);
                if (hrDataRef.current.length > 100) hrDataRef.current.shift();
                
                const tVal = (latest.temperature_c != null && latest.temperature_c > 20 && latest.temperature_c < 50)
                    ? latest.temperature_c
                    : null; // ONLY real temperature, reject weight values
                if (tVal !== null && tSeriesRef.current) {
                    const tempPoint = { time: timeSecs, value: tVal };
                    tSeriesRef.current.update(tempPoint);
                    tDataRef.current.push(tempPoint);
                    if (tDataRef.current.length > 100) tDataRef.current.shift();
                }

                updateForecasts();
            } catch (e) {
                console.warn("Chart update failed:", e);
            }
        }
    }, [telemetryData, selectedId]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            
            {/* ENCART 1 : TEMPS RÉEL */}
            <div style={{ position: 'relative', width: '100%', height: '180px', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 5, left: 10, zIndex: 10, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                    <span style={{ color: '#388bfd' }}>Temp (°C)</span> & <span style={{ color: '#f85149' }}>BPM</span> (HISTORIQUE ET DIRECT)
                </div>
                <div ref={liveChartRef} style={{ width: '100%', height: '100%' }} />
            </div>

            {/* ENCART 2 : PRÉVISION IA (INDÉPENDANT) */}
            <div style={{ position: 'relative', width: '100%', height: '160px', background: 'linear-gradient(180deg, rgba(134, 239, 172, 0.05) 0%, rgba(0,0,0,0.1) 100%)', borderRadius: '12px', border: '1px solid rgba(134, 239, 172, 0.2)', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 5, left: 10, zIndex: 10, fontSize: '0.7rem', color: '#86efac', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '6px', height: '6px', background: '#86efac', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                    MODULE IA - PROJECTION COURT TERME (FUTUR)
                </div>
                <div ref={forecastChartRef} style={{ width: '100%', height: '100%', marginTop: '5px' }} />
            </div>
            
            <style>{`
                @keyframes pulse { 0% { opacity: 0.3; } 50% { opacity: 1; box-shadow: 0 0 5px #86efac; } 100% { opacity: 0.3; } }
            `}</style>
        </div>
    );
};

export default VitalSignsChart;
