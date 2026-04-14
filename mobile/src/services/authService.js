import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { API_BASE_URL } from './api';

export const authService = {
  async login(email, password) {
    // FastAPI OAuth2 requires form-encoded body
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);

    const response = await api.post('/auth/login', form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token } = response.data;
    await AsyncStorage.setItem('access_token', access_token);

    // Fetch full user profile
    const meResponse = await api.get('/auth/me');
    await AsyncStorage.setItem('user', JSON.stringify(meResponse.data));

    return meResponse.data;
  },

  async register(name, email, password) {
    const response = await api.post('/auth/register', {
      name,
      email,
      password,
      role: 'FARMER',
    });
    return response.data;
  },

  async logout() {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('user');
  },

  async getStoredUser() {
    const userStr = await AsyncStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  async getToken() {
    return AsyncStorage.getItem('access_token');
  },
};
