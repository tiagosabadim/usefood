import type { Site } from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { createContext, useContext, type ReactNode } from 'react';

export type AppName = 'admin' | 'garcom' | 'web' | 'console';

export interface AppContextValue {
  app: AppName;
  /** O que o domínio acessado representa: vitrine de uma marca ou uma loja direta. */
  site: Site;
  /** Atalho para site.brand (usefood, guapifood…). */
  brand: string;
  environment: string;
  /** null quando o .env ainda não tem as chaves do Supabase. */
  supabase: AppSupabaseClient | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppContextProvider({
  value,
  children,
}: {
  value: AppContextValue;
  children: ReactNode;
}) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppContext precisa estar dentro do bootstrap()');
  return value;
}
