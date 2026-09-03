import { apiClient } from './client';
import { LoginRequest, LoginResponse, UserProfile } from '../types/auth';

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  return (await apiClient.post('/auth/login', credentials)) as unknown as LoginResponse;
}

export async function getMe(): Promise<UserProfile> {
  return (await apiClient.get('/auth/me')) as unknown as UserProfile;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch (err) {
    // Ignore network or logout errors to ensure clean local logout
    console.warn('Logout endpoint error:', err);
  }
}
