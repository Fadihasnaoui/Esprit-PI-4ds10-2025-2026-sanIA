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
  addVaccination: (animalId, data) => api.post(`/animals/${animalId}/vaccinations`, data),
  deleteVaccination: (logId) => api.delete(`/animals/vaccinations/${logId}`),
  addTreatment: (animalId, data) => api.post(`/animals/${animalId}/treatments`, data),
  deleteTreatment: (logId) => api.delete(`/animals/treatments/${logId}`),
  getZones: () => api.get('/animals/zones'),
  createZone: (data) => api.post('/animals/zones', data),
  deleteZone: (id) => api.delete(`/animals/zones/${id}`),
};

export const diseaseService = {
  getScans: () => api.get('/scans/'),
  createScan: (data) => api.post('/scans/', data),
};

export const ndviService = {
  getHistory: (fieldId, weeks = 8) => api.get(`/ndvi/${fieldId}?weeks=${weeks}`),
};

export default api;
