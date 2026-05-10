import { useState, useCallback } from 'react';
import api from './api';

/**
 * useAnimalDetection - Hook custom pour la gestion du scanner SVI Orbital
 */
export const useAnimalDetection = () => {
    const [status, setStatus] = useState('idle'); // idle, scanning, processing, success, error
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [latency, setLatency] = useState(0);

    const scanImage = useCallback(async (file, coords = null) => {
        if (!file && !coords) return;

        setStatus('scanning');
        setError(null);

        try {
            const startTime = Date.now();
            let response;

            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                response = await api.post('/livestock_scans/orbital-scan', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else if (coords) {
                response = await api.post(`/livestock_scans/orbital-scan?lat=${coords.lat}&lon=${coords.lon}`);
            }
            
            const endTime = Date.now();
            
            // On attend un peu pour l'effet de "processing" si l'API est trop rapide
            if (endTime - startTime < 1500) {
                setStatus('processing');
                await new Promise(resolve => setTimeout(resolve, 1500 - (endTime - startTime)));
            }

            setResults(response.data);
            setLatency(response.data.latency_ms || (endTime - startTime));
            setStatus('success');
            return response.data;
        } catch (err) {
            console.error("SVI Scan Error:", err);
            setError(err.response?.data?.detail || "Échec de la liaison satellite.");
            setStatus('error');
            throw err;
        }
    }, []);

    const reset = useCallback(() => {
        setStatus('idle');
        setResults(null);
        setError(null);
        setLatency(0);
    }, []);

    return { scanImage, status, results, error, latency, reset };
};
