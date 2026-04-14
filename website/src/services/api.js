import axios from 'axios';

// Keep in sync with mobile (`mobile/src/services/api.js`) — default FastAPI port 8000.
const API_PORT = import.meta.env.VITE_API_PORT ?? '8000';
const API_URL = `http://${window.location.hostname}:${API_PORT}/api/v1`;

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Anti-cache : Ajoute un timestamp à chaque requête GET
  if (config.method === 'get') {
    config.params = {
      ...config.params,
      _t: Date.now()
    };
  }
  
  console.log(`[API REQUEST] => ${config.method.toUpperCase()} ${config.url}`);
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
  updateField: (fieldId, data) => api.put(`/fields/${fieldId}`, data),
  deleteField: (fieldId) => api.delete(`/fields/${fieldId}`),
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
  getSpatialDiagnostic: (fieldId) => api.get(`/ndvi/${fieldId}/spatial-diagnostic`),
};

export const vraService = {
  getFullAnalysis: (fieldId) => api.get(`/vra/${fieldId}/full-analysis`),
  getVraMap:       (fieldId) => api.get(`/vra/${fieldId}/map`),
  getSoilHealth:   (fieldId) => api.get(`/vra/${fieldId}/soil-health`),
  getCropCalendar: (fieldId) => api.get(`/vra/${fieldId}/crop-calendar`),
};

export default api;
