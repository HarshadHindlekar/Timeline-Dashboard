import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, LoginRequest } from '../types/auth';
import * as authApi from '../api/auth';
import { TOKEN_STORAGE_KEY } from '../api/client';

interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await authApi.getMe();
      setUser(profile);
    } catch (err) {
      console.warn('Session restoration failed:', err);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const initSession = async () => {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        setToken(storedToken);
        await refreshProfile();
      }
      setIsLoading(false);
    };

    initSession();
  }, [refreshProfile]);

  const login = async (credentials: LoginRequest) => {
    const res = await authApi.login(credentials);
    if (!res.access_token) {
      throw new Error('No access token received');
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, res.access_token);
    setToken(res.access_token);

    // Fetch user profile immediately
    const profile = await authApi.getMe();
    setUser(profile);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
