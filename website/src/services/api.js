import axios from 'axios';
import { API_BASE_URL } from './backendConfig';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      window.dispatchEvent(new CustomEvent('sania-auth-expired'));
    }
    return Promise.reject(error);
  },
);

export const authService = {
  login: async (username, password) => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    const res = await api.post('/auth/login', params);
    localStorage.setItem('token', res.data.access_token);
    return res.data;
  },
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

export const systemService = {
  getHealth: () => api.get('/health'),
};

export const dashboardService = {
  getFarmSummary: (fieldId) => api.get(`/dashboard/farm-summary${fieldId ? `?field_id=${fieldId}` : ''}`),
};

export const fieldService = {
  getFields: () => api.get('/fields/'),
  createField: (data) => api.post('/fields/', data),
  updateField: (fieldId, data) => api.put(`/fields/${fieldId}`, data),
  deleteField: (fieldId) => api.delete(`/fields/${fieldId}`),
  getIrrigationLogs: (fieldId) => api.get(`/fields/${fieldId}/irrigation-logs`),
};

export const irrigationService = {
  getHealth: () => api.get('/irrigation/health'),
  getStatus: () => api.get('/irrigation/status'),
  decide: (payload) => api.post('/irrigation/agent/decision', payload, { timeout: 90000 }),
};

export const sensorService = {
  getHistory: (fieldId, days = 7) => api.get(`/sensors/${fieldId}?days=${days}`),
  getFieldWeather: (fieldId) => api.get(`/sensors/weather/field/${fieldId}`),
  getWeather: (farmId) => api.get(`/sensors/weather/${farmId}`),
  ingest: (data) => api.post('/sensors/', data),
};

export const alertService = {
  getAlerts: () => api.get('/alerts/'),
  updateAlert: (id, data) => api.patch(`/alerts/${id}`, data),
};

export const twinService = {
  getMapping: () => api.get('/twin/mapping'),
  saveMapping: (mapping) => api.post('/twin/mapping', { mapping }),
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
  getAnimalEnvironment: (id) => api.get(`/animals/${id}/environment`),
  performAutoScan: (lat, lon) => api.post(`/livestock_scans/orbital-scan?lat=${lat}&lon=${lon}`),
  performHealthScan: (file, species = 'Bovin', animalId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    let url = `/health-scan/analyze?species=${encodeURIComponent(species)}`;
    if (animalId) url += `&animal_id=${animalId}`;
    return api.post(url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
};

export const satelliteService = {
  getZonesHealth: () => api.get('/satellite/zones-health'),
  getSceneInfo: () => api.get('/satellite/scene-info'),
};

export const insightsService = {
  getHeatStress: (species = 'Bovin', hours = 72) =>
    api.get(`/insights/heat-stress?species=${encodeURIComponent(species)}&hours=${hours}`),
  getMarketContext: () => api.get('/insights/market-prices'),
  getAnimalPrice: (animalId) => api.get(`/insights/market-prices/${animalId}`),
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
  getVraMap: (fieldId) => api.get(`/vra/${fieldId}/map`),
  getSoilHealth: (fieldId) => api.get(`/vra/${fieldId}/soil-health`),
  getCropCalendar: (fieldId) => api.get(`/vra/${fieldId}/crop-calendar`),
  /** RAG: send full-analysis JSON to avoid duplicate upstream satellite calls (long-running LLM). */
  getRecommendations: (fieldId, analysisPayload) =>
    api.post(
      `/vra/${fieldId}/recommendations`,
      { analysis: analysisPayload ?? null },
      { timeout: 320000 },
    ),
};

export const ragService = {
  getStatus: () => api.get('/rag/status'),
  ask: (question, conversationId) =>
    api.post(
      '/rag/ask',
      { question, conversation_id: conversationId },
      { timeout: 180000 },
    ),
  listConversations: () => api.get('/rag/conversations'),
  getConversation: (conversationId) => api.get(`/rag/conversations/${conversationId}`),
  clearConversation: (conversationId) => api.delete(`/rag/conversations/${conversationId}`),
};

export default api;
