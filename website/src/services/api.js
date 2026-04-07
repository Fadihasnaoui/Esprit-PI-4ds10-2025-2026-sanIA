import axios from 'axios';

const API_URL = `http://${window.location.hostname}:8000/api/v1`;

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
  }
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
  addAnimal: (data) => api.post('/animals/', data),
};

export const diseaseService = {
  getScans: () => api.get('/scans/'),
  createScan: (data) => api.post('/scans/', data),
};

export const ndviService = {
  getHistory: (fieldId, weeks = 8) => api.get(`/ndvi/${fieldId}?weeks=${weeks}`),
};

export const segmentationService = {
  autoDetect: (formData) => api.post('/segmentation/auto-detect', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  calculateNdvi: (formData) => api.post('/segmentation/calculate-ndvi', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

export default api;
