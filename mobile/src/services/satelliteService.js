import api from './api';

export const satelliteService = {
  /** Full Pillar 2 analysis (NDVI + VRA + soil health + crop calendar) — single call */
  async getFullAnalysis(fieldId) {
    const res = await api.get(`/vra/${fieldId}/full-analysis`);
    return res.data;
  },

  /** VRA prescription map only */
  async getVraMap(fieldId) {
    const res = await api.get(`/vra/${fieldId}/map`);
    return res.data;
  },

  /** Soil health indicators only */
  async getSoilHealth(fieldId) {
    const res = await api.get(`/vra/${fieldId}/soil-health`);
    return res.data;
  },

  /** Crop calendar only */
  async getCropCalendar(fieldId) {
    const res = await api.get(`/vra/${fieldId}/crop-calendar`);
    return res.data;
  },

  /** NDVI history (existing endpoint) */
  async getNdviHistory(fieldId, weeks = 8) {
    const res = await api.get(`/ndvi/${fieldId}?weeks=${weeks}`);
    return res.data;
  },

  /** Raw NDVI spatial diagnostic (existing endpoint) */
  async getNdviDiagnostic(fieldId) {
    const res = await api.get(`/ndvi/${fieldId}/spatial-diagnostic`);
    return res.data;
  },

  /** All user fields */
  async getFields() {
    const res = await api.get('/fields/');
    return res.data;
  },
};
