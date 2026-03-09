import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import { api, setOnSessionInvalidated } from '@/lib/api';
import { STORAGE_KEYS } from '@/constants/config';
import { decodeJwtPayload, getMustChangePasswordFromToken, isTokenExpired } from '@/lib/jwt';
import {
  clearOfflineCredentials,
  getOfflineCredentials,
  saveOfflineCredentials,
  verifyOfflineLogin,
  type CachedAuthPayload,
} from '@/lib/offlineAuth';

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

const clearAuthState: AuthState = {
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
};

function setStateFromCachedPayload(payload: CachedAuthPayload): AuthState {
  return {
    isAuthenticated: true,
    isLoading: false,
    userId: payload.userId,
    email: payload.email,
    displayName: payload.displayName,
    role: payload.role,
    roleDisplay: payload.roleDisplay,
    department: payload.department,
    region: payload.region,
    mustChangePassword: payload.mustChangePassword,
  };
}

/** True if the error is due to network (offline / request failed). */
function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError && (e.message === 'Network request failed' || e.message === 'Failed to fetch')) return true;
  if (e instanceof Error) {
    const msg = e.message.toLowerCase();
    return msg.includes('network') || msg.includes('failed to fetch') || msg.includes('network request failed');
  }
  return false;
}

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
      const { payload } = await getOfflineCredentials();
      if (payload && mounted.current) {
        setState(setStateFromCachedPayload(payload));
      } else {
        setState(clearAuthState);
      }
      return;
    }
    if (isTokenExpired(access)) {
      const refreshed = await api.refreshTokenIfNeeded();
      if (!mounted.current) return;
      if (!refreshed) {
        const netState = await NetInfo.fetch();
        const offline = !(netState.isConnected ?? false);
        const { payload } = await getOfflineCredentials();
        if (offline && payload && mounted.current) {
          setState(setStateFromCachedPayload(payload));
        } else {
          setState(clearAuthState);
        }
        return;
      }
      access = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      if (!access) {
        setState(clearAuthState);
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
        setState(clearAuthState);
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
        const netState = await NetInfo.fetch();
        if (!(netState.isConnected ?? false)) {
          return;
        }
        const valid = await api.validateSession();
        if (!valid && mounted.current) {
          setState(clearAuthState);
          setIsUnlocked(false);
        }
      }
    });
    return () => sub.remove();
  }, [state.isAuthenticated]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      await api.login(email, password);
    } catch (e) {
      if (isNetworkError(e)) {
        const payload = await verifyOfflineLogin(email, password);
        if (payload && mounted.current) {
          setState(setStateFromCachedPayload(payload));
          return { mustChangePassword: payload.mustChangePassword };
        }
      }
      throw e;
    }
    if (!mounted.current) return { mustChangePassword: false };
    const access = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    if (!access) {
      setState(clearAuthState);
      return { mustChangePassword: false };
    }
    const payload = decodeJwtPayload(access);
    const userId = (payload?.user_id as string) ?? null;
    const displayName = (payload?.display_name as string) ?? null;
    const role = (payload?.role as string) ?? null;
    const roleDisplay = (payload?.role_display as string) ?? null;
    const department = (payload?.department_display as string) ?? (payload?.department as string) ?? null;
    const region = (payload?.region_display as string) ?? null;
    const mustChangePassword = getMustChangePasswordFromToken(access);
    const authState: AuthState = { isAuthenticated: true, isLoading: false, userId, email, displayName, role, roleDisplay, department: department || null, region: region || null, mustChangePassword };
    setState(authState);
    const cached: CachedAuthPayload = {
      userId,
      email,
      displayName,
      role,
      roleDisplay,
      department: department || null,
      region: region || null,
      mustChangePassword,
    };
    await saveOfflineCredentials(email, password, cached);
    return { mustChangePassword };
  }, []);

  const logout = useCallback(async () => {
    await clearOfflineCredentials();
    await api.logout();
    if (!mounted.current) return;
    setState(clearAuthState);
    setIsUnlocked(false);
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setState((s) => (s.mustChangePassword ? { ...s, mustChangePassword: false } : s));
  }, []);

  const setUnlocked = useCallback((unlocked: boolean) => {
    setIsUnlocked(unlocked);
  }, []);

  /** Current snapshot of isUnlocked only; does not re-check biometrics. */
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
