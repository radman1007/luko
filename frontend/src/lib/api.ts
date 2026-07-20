import axios from 'axios';

// تنها نقطه‌ی ورود HTTP در کل اپ — هیچ کامپوننتی مستقیم fetch/axios صدا نمی‌زند.
// پیش‌فرض نسبی است تا در dev از پروکسی Vite و در production از nginx عبور کند.
const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

const TOKEN_KEY = 'luko_access_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // TODO: وقتی بک‌اند refresh token داد، اینجا flow تمدید توکن اضافه شود
    if (error.response?.status === 401) {
      tokenStorage.clear();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
