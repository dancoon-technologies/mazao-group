import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, setOnSessionInvalidated } from '@/lib/api';
import { STORAGE_KEYS } from '@/constants/config';
import { decodeJwtPayload, getMustChangePasswordFromToken, isTokenExpired } from '@/lib/jwt';

type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  role: string | null;
  roleDisplay: string | null;
  department: string | null;
  region: string | null;
  mustChangePassword: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout: () => Promise<void>;
  setUnlocked: (unlocked: boolean) => void;
  isUnlocked: boolean;
  checkUnlocked: () => Promise<boolean>;
  clearMustChangePassword: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    userId: null,
    email: null,
    displayName: null,
    role: null,
    roleDisplay: null,
    department: null,
    region: null,
    mustChangePassword: false,
  });
  const [isUnlocked, setIsUnlocked] = useState(false);
  const mounted = useRef(true);

  const checkToken = useCallback(async () => {
    let access = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    if (!mounted.current) return;
    if (!access) {
      setState({ isAuthenticated: false, isLoading: false, userId: null, email: null, displayName: null, role: null, roleDisplay: null, department: null, region: null, mustChangePassword: false });
      return;
    }
    if (isTokenExpired(access)) {
      const refreshed = await api.refreshTokenIfNeeded();
      if (!mounted.current) return;
      if (!refreshed) {
        setState({ isAuthenticated: false, isLoading: false, userId: null, email: null, displayName: null, role: null, roleDisplay: null, department: null, region: null, mustChangePassword: false });
        return;
      }
      access = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      if (!access) {
        setState({ isAuthenticated: false, isLoading: false, userId: null, email: null, displayName: null, role: null, roleDisplay: null, department: null, region: null, mustChangePassword: false });
        return;
      }
    }
    const payload = decodeJwtPayload(access);
    const userId = (payload?.user_id as string) ?? null;
    const email = (payload?.email as string) ?? null;
    const displayName = (payload?.display_name as string) ?? null;
    const role = (payload?.role as string) ?? null;
    const roleDisplay = (payload?.role_display as string) ?? null;
    const department = (payload?.department_display as string) ?? (payload?.department as string) ?? null;
    const region = (payload?.region_display as string) ?? null;
    const mustChangePassword = getMustChangePasswordFromToken(access);
    setState({ isAuthenticated: true, isLoading: false, userId, email, displayName, role, roleDisplay, department: department || null, region: region || null, mustChangePassword });
  }, []);

  useEffect(() => {
    mounted.current = true;
    checkToken();
    return () => {
      mounted.current = false;
    };
  }, [checkToken]);

  useEffect(() => {
    setOnSessionInvalidated(() => {
      if (mounted.current) {
        setState({
          isAuthenticated: false,
          isLoading: false,
          userId: null,
          email: null,
          displayName: null,
          role: null,
          roleDisplay: null,
          department: null,
          region: null,
          mustChangePassword: false,
        });
        setIsUnlocked(false);
      }
    });
    return () => setOnSessionInvalidated(null);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        setIsUnlocked(false);
      } else if (next === 'active' && state.isAuthenticated) {
        const valid = await api.validateSession();
        if (!valid && mounted.current) {
          setState({
            isAuthenticated: false,
            isLoading: false,
            userId: null,
            email: null,
            displayName: null,
            role: null,
            roleDisplay: null,
            department: null,
            region: null,
            mustChangePassword: false,
          });
          setIsUnlocked(false);
        }
      }
    });
    return () => sub.remove();
  }, [state.isAuthenticated]);

  const login = useCallback(async (email: string, password: string) => {
    await api.login(email, password);
    if (!mounted.current) return { mustChangePassword: false };
    const access = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    const payload = decodeJwtPayload(access);
    const userId = (payload?.user_id as string) ?? null;
    const displayName = (payload?.display_name as string) ?? null;
    const role = (payload?.role as string) ?? null;
    const roleDisplay = (payload?.role_display as string) ?? null;
    const department = (payload?.department_display as string) ?? (payload?.department as string) ?? null;
    const region = (payload?.region_display as string) ?? null;
    const mustChangePassword = getMustChangePasswordFromToken(access);
    setState({ isAuthenticated: true, isLoading: false, userId, email, displayName, role, roleDisplay, department: department || null, region: region || null, mustChangePassword });
    return { mustChangePassword };
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    if (!mounted.current) return;
    setState({ isAuthenticated: false, isLoading: false, userId: null, email: null, displayName: null, role: null, roleDisplay: null, department: null, region: null, mustChangePassword: false });
    setIsUnlocked(false);
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setState((s) => (s.mustChangePassword ? { ...s, mustChangePassword: false } : s));
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
    clearMustChangePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
