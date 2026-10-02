import { resolveSite, type DomainRecord } from '@usefood/core';
import { createSupabaseClient, type AppSupabaseClient } from '@usefood/db';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppContextProvider, type AppName } from './app-context';

export interface BootstrapOptions {
  app: AppName;
  element: ReactNode;
  rootId?: string;
}

/** Pergunta ao banco o que é este domínio. Sem banco ou sem resposta, segue sem cadastro. */
async function lookupDomain(
  supabase: AppSupabaseClient | null,
  host: string,
): Promise<DomainRecord | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('resolver_dominio', { p_hostname: host });
  if (error) {
    console.warn('Não foi possível resolver o domínio no banco:', error.message);
    return null;
  }
  return data[0] ?? null;
}

/** Ponto de entrada comum a todos os apps: monitoramento, domínio, banco e render. */
export async function bootstrap({
  app,
  element,
  rootId = 'root',
}: BootstrapOptions): Promise<void> {
  const env = import.meta.env;
  const environment = env.VITE_APP_ENV ?? 'development';

  // O Sentry só entra no pacote baixado quando há DSN configurado.
  const dsn = env.VITE_SENTRY_DSN;
  if (dsn) {
    void import('@sentry/react').then((Sentry) =>
      Sentry.init({ dsn, environment, initialScope: { tags: { app } } }),
    );
  }

  const supabase =
    env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY
      ? createSupabaseClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)
      : null;

  const host = window.location.hostname;
  const site = resolveSite(host, await lookupDomain(supabase, host));
  document.documentElement.dataset.brand = site.brand;

  const container = document.getElementById(rootId);
  if (!container) throw new Error(`Elemento #${rootId} não encontrado no index.html`);

  createRoot(container).render(
    <StrictMode>
      <AppContextProvider value={{ app, site, brand: site.brand, environment, supabase }}>
        {element}
      </AppContextProvider>
    </StrictMode>,
  );
}
