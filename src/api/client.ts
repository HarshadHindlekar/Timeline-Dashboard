import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { MesResponse } from '../types/api';

export const TOKEN_STORAGE_KEY = 'mes_auth_token';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://fractaldmsdev.centralindia.cloudapp.azure.com';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor: Inject Bearer token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Unwrap MES envelope and handle HTTP errors
apiClient.interceptors.response.use(
  (response) => {
    const data = response.data as MesResponse<unknown>;

    // MES envelope convention
    if (data && typeof data === 'object' && 'status_code' in data) {
      if (data.status_code >= 400) {
        return Promise.reject(new Error(data.message || 'API request failed'));
      }
      return data.data; // Unwrap data directly
    }

    return response.data;
  },
  (error: AxiosError<MesResponse<unknown>>) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    // If 401 on an authenticated endpoint (not /auth/login), clear token & redirect
    if (status === 401) {
      if (!url.includes('/auth/login')) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        // Only redirect if not already on /login
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login?expired=1';
        }
      }
    }

    // Extract error message from MES envelope or default
    const envelope = error.response?.data;
    const message =
      envelope?.message ||
      (error.response?.data as any)?.detail ||
      error.message ||
      'An unexpected error occurred';

    return Promise.reject(new Error(message));
  }
);
