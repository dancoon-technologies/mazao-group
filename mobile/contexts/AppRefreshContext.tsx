import React, { createContext, useCallback, useContext, useState } from 'react';

type AppRefreshContextValue = {
  refreshTrigger: number;
  triggerRefresh: () => void;
};

const AppRefreshContext = createContext<AppRefreshContextValue | null>(null);

export function AppRefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshTrigger((n) => n + 1), []);
  const value: AppRefreshContextValue = { refreshTrigger, triggerRefresh };
  return (
    <AppRefreshContext.Provider value={value}>
      {children}
    </AppRefreshContext.Provider>
  );
}

export function useAppRefresh() {
  const ctx = useContext(AppRefreshContext);
  if (!ctx) throw new Error('useAppRefresh must be used within AppRefreshProvider');
  return ctx;
}
