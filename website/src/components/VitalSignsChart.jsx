import React, { useEffect, useRef } from 'react';
import { createChart, LineType } from 'lightweight-charts';

const VitalSignsChart = ({ telemetryData, selectedId, historicalData = [] }) => {
    const chartContainerRef = useRef();
    const chartRef = useRef(null);
    const hrSeriesRef = useRef(null);
    const weightSeriesRef = useRef(null);
    const lastTimeRef = useRef(0);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        let chart;
        try {
            const container = chartContainerRef.current;
            chart = createChart(container, {
                width: container.clientWidth || 300,
                height: 300,
                layout: {
                    background: { type: 'solid', color: 'transparent' },
                    textColor: '#c9d1d9',
                },
                grid: {
                    vertLines: { color: 'rgba(255,255,255,0.05)' },
                    horzLines: { color: 'rgba(255,255,255,0.05)' },
                },
                timeScale: {
                    timeVisible: true,
                    secondsVisible: true,
                },
            });

            const hrSeries = chart.addLineSeries({
                color: '#f85149',
                lineWidth: 2,
                priceScaleId: 'right',
                title: 'BPM',
            });

            const weightSeries = chart.addLineSeries({
                color: '#388bfd',
                lineWidth: 2,
                priceScaleId: 'left',
                title: 'Poids',
            });

            chart.priceScale('left').applyOptions({ visible: true });
            chart.priceScale('right').applyOptions({ visible: true });

            chartRef.current = chart;
            hrSeriesRef.current = hrSeries;
            weightSeriesRef.current = weightSeries;

            const handleResize = () => {
                if (chart && container) {
                    chart.applyOptions({ width: container.clientWidth });
                }
            };
            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
                chart.remove();
            };
        } catch (err) {
            console.error("Chart init failed:", err);
        }
    }, []);

    // Handle Historical Data
    useEffect(() => {
        if (hrSeriesRef.current && historicalData.length > 0) {
            const hrPoints = historicalData
                .map(d => ({ time: Math.floor(new Date(d.time).getTime() / 1000), value: d.heart_rate }))
                .filter(p => !isNaN(p.time))
                .sort((a,b) => a.time - b.time);
            
            const weightPoints = historicalData
                .map(d => ({ time: Math.floor(new Date(d.time).getTime() / 1000), value: d.weight_kg }))
                .filter(p => !isNaN(p.time) && p.value != null)
                .sort((a,b) => a.time - b.time);

            if (hrPoints.length > 0) {
                hrSeriesRef.current.setData(hrPoints);
                lastTimeRef.current = Math.max(lastTimeRef.current, hrPoints[hrPoints.length - 1].time);
            }
            if (weightPoints.length > 0) {
                weightSeriesRef.current.setData(weightPoints);
                lastTimeRef.current = Math.max(lastTimeRef.current, weightPoints[weightPoints.length - 1].time);
            }
            
            chartRef.current?.timeScale().fitContent();
        }
    }, [historicalData]);

    useEffect(() => {
        if (selectedId && telemetryData[selectedId] && hrSeriesRef.current) {
            const latest = telemetryData[selectedId];
            if (!latest.time || !latest.heart_rate) return;

            try {
                const date = new Date(latest.time);
                if (isNaN(date.getTime())) return;
                
                const timeSecs = Math.floor(date.getTime() / 1000);
                
                // Prevent duplicate time points
                if (timeSecs <= lastTimeRef.current) return;
                lastTimeRef.current = timeSecs;

                hrSeriesRef.current.update({ time: timeSecs, value: latest.heart_rate });
                
                if (latest.weight_kg && weightSeriesRef.current) {
                    weightSeriesRef.current.update({ time: timeSecs, value: latest.weight_kg });
                }
            } catch (e) {
                console.warn("Chart update failed:", e);
            }
        }
    }, [telemetryData, selectedId]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '300px' }}>
            <h4 style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, fontSize: '0.9rem', color: 'var(--text-main)', pointerEvents: 'none' }}>
                <span style={{ color: '#388bfd' }}>Poids (kg) [Gauche]</span> &nbsp;&&nbsp; <span style={{ color: '#f85149' }}>Rythme Cardiaque [Droite]</span>
            </h4>
            <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
};

export default VitalSignsChart;
