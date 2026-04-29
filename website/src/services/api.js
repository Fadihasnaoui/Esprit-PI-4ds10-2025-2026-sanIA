import axios from 'axios';

const API_URL = `http://127.0.0.1:8000/api/v1`;

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
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

export const ragService = {
  ask: (question, conversationId) =>
    api.post('/rag/ask', { question, conversation_id: conversationId }, { timeout: 180000 }),
  listConversations: () => api.get('/rag/conversations'),
  getConversation: (conversationId) => api.get(`/rag/conversations/${conversationId}`),
  clearConversation: (conversationId) => api.delete(`/rag/conversations/${conversationId}`),
  rebuildIndex: () => api.post('/rag/index'),
};

export default api;
