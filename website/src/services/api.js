import axios from 'axios';

const API_URL = `http://127.0.0.1:8000/api/v1`;

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: async (username, password) => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    const res = await api.post('/auth/login', params);
    localStorage.setItem('token', res.data.access_token);
    return res.data;
  },
  getMe: () => api.get('/auth/me'),
};

export const fieldService = {
  getFields: () => api.get('/fields/'),
  createField: (data) => api.post('/fields/', data),
  getIrrigationLogs: (fieldId) => api.get(`/fields/${fieldId}/irrigation-logs`),
};

export const sensorService = {
  getHistory: (fieldId, days = 7) => api.get(`/sensors/${fieldId}?days=${days}`),
  ingest: (data) => api.post('/sensors/', data),
};

export const alertService = {
  getAlerts: () => api.get('/alerts/'),
  updateAlert: (id, data) => api.patch(`/alerts/${id}`, data),
};

export const livestockService = {
  getAnimals: () => api.get('/animals/'),
  getAnimal: (id) => api.get(`/animals/${id}`),
  addAnimal: (data) => api.post('/animals/', data),
  updateAnimal: (id, data) => api.put(`/animals/${id}`, data),
  deleteAnimal: (id) => api.delete(`/animals/${id}`),
  getTelemetryHistory: (id, limit = 50) => api.get(`/animals/${id}/telemetry?limit=${limit}`),
  getTelemetryForecast: (id) => api.get(`/animals/${id}/telemetry/forecast`),
  addVaccination: (animalId, data) => api.post(`/animals/${animalId}/vaccinations`, data),
  getVaccinations: (animalId) => api.get(`/animals/${animalId}/vaccinations`),
  deleteVaccination: (logId) => api.delete(`/animals/vaccinations/${logId}`),
  addTreatment: (animalId, data) => api.post(`/animals/${animalId}/treatments`, data),
  getTreatments: (animalId) => api.get(`/animals/${animalId}/treatments`),
  deleteTreatment: (logId) => api.delete(`/animals/treatments/${logId}`),
  getConsumption: (animalId, limit = 30) => api.get(`/animals/${animalId}/consumption?limit=${limit}`),
  getZones: () => api.get('/animals/zones'),
  createZone: (data) => api.post('/animals/zones', data),
  deleteZone: (id) => api.delete(`/animals/zones/${id}`),
  getMyFarm: () => api.get('/animals/farm/me'),
  performAutoScan: (lat, lon) => api.post(`/livestock_scans/orbital-scan?lat=${lat}&lon=${lon}`),
  performHealthScan: (file, species = 'Bovin', animalId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    let url = `/health-scan/analyze?species=${encodeURIComponent(species)}`;
    if (animalId) url += `&animal_id=${animalId}`;
    return api.post(url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
};

export const diseaseService = {
  getScans: () => api.get('/scans/'),
  createScan: (data) => api.post('/scans/', data),
};

export const ndviService = {
  getHistory: (fieldId, weeks = 8) => api.get(`/ndvi/${fieldId}?weeks=${weeks}`),
};

export default api;
