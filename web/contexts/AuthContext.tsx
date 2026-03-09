"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, setOnSessionExpired } from "@/lib/api";
import type { UserRole } from "@/lib/types";
import { ROLES_CAN_ACCESS_DASHBOARD } from "@/lib/constants";

type AuthState = {
  email: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
};

type AuthContextValue = AuthState & {
  login: (
    email: string,
    password: string
  ) => Promise<{ email: string; role: string; must_change_password: boolean }>;
  logout: () => void;
  setMustChangePassword: (value: boolean) => void;
  canAccessDashboard: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const loggedOutState: AuthState = {
  email: null,
  role: null,
  isAuthenticated: false,
  isLoading: false,
  mustChangePassword: false,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ...loggedOutState,
    isLoading: true,
  });
  const setStateRef = useRef(setState);
  setStateRef.current = setState;

  useEffect(() => {
    setOnSessionExpired(() => {
      setStateRef.current(loggedOutState);
    });
    return () => setOnSessionExpired(null);
  }, []);

  useEffect(() => {
    api
      .getMe()
      .then((data) => {
        if (data?.user) {
          setState({
            email: data.user.email,
            role: data.user.role as UserRole,
            isAuthenticated: true,
            isLoading: false,
            mustChangePassword: data.user.must_change_password ?? false,
          });
        } else {
          setState({
            email: null,
            role: null,
            isAuthenticated: false,
            isLoading: false,
            mustChangePassword: false,
          });
        }
      })
      .catch(() => {
        setState({
          email: null,
          role: null,
          isAuthenticated: false,
          isLoading: false,
          mustChangePassword: false,
        });
      });
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<{ email: string; role: string; must_change_password: boolean }> => {
      const { user } = await api.login(email, password);
      const mustChange = user.must_change_password ?? false;
      setState({
        email: user.email,
        role: user.role,
        isAuthenticated: true,
        isLoading: false,
        mustChangePassword: mustChange,
      });
      return { email: user.email, role: user.role, must_change_password: mustChange };
    },
    []
  );

  const setMustChangePassword = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, mustChangePassword: value }));
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setState({
      email: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      mustChangePassword: false,
    });
  }, []);

  const canAccessDashboard = useMemo(
    () => state.role !== null && ROLES_CAN_ACCESS_DASHBOARD.includes(state.role),
    [state.role]
  );

  const value: AuthContextValue = useMemo(
    () => ({
      ...state,
      login,
      logout,
      setMustChangePassword,
      canAccessDashboard,
    }),
    [state, login, logout, setMustChangePassword, canAccessDashboard]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
