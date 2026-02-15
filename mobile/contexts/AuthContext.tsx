import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/lib/api';
import { STORAGE_KEYS } from '@/constants/config';

type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  email: string | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUnlocked: (unlocked: boolean) => void;
  isUnlocked: boolean;
  checkUnlocked: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    email: null,
  });
  const [isUnlocked, setIsUnlocked] = useState(false);
  const mounted = useRef(true);

  const checkToken = useCallback(async () => {
    const access = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    if (!mounted.current) return;
    setState((s) => ({
      ...s,
      isAuthenticated: !!access,
      isLoading: false,
      email: s.email,
    }));
  }, []);

  useEffect(() => {
    mounted.current = true;
    checkToken();
    return () => {
      mounted.current = false;
    };
  }, [checkToken]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') setIsUnlocked(false);
    });
    return () => sub.remove();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await api.login(email, password);
    if (!mounted.current) return;
    setState({ isAuthenticated: true, isLoading: false, email });
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    if (!mounted.current) return;
    setState({ isAuthenticated: false, isLoading: false, email: null });
    setIsUnlocked(false);
  }, []);

  const setUnlocked = useCallback((unlocked: boolean) => {
    setIsUnlocked(unlocked);
  }, []);

  const checkUnlocked = useCallback(() => Promise.resolve(isUnlocked), [isUnlocked]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    setUnlocked,
    isUnlocked,
    checkUnlocked,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
