import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (username: string, email: string, password: string) =>
    api.post('/auth/register', { username, email, password }),
  
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password })
};

export const playerAPI = {
  getProfile: () => api.get('/player/profile'),
  
  getStats: () => api.get('/player/stats'),
  
  getMatches: (limit?: number) =>
    api.get('/player/matches', { params: { limit } }),
  
  getCosmetics: () => api.get('/player/cosmetics'),
  
  updateCosmetics: (cardTheme: string, bladeSkin: string, backgroundTheme: string) =>
    api.post('/player/cosmetics', { cardTheme, bladeSkin, backgroundTheme })
};

export default api;
