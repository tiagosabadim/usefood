import { StatusScreen, useAppContext } from '@usefood/app';
import type { AppSupabaseClient } from '@usefood/db';
import { AreaDoRestaurante } from './area-do-restaurante';
import { Login } from './login';
import { Tela } from './tela';
import { useSession } from './use-session';

export function App() {
  const { supabase } = useAppContext();
  if (!supabase) {
    return (
      <StatusScreen
        title="PDV do restaurante"
        description="Configure o banco no .env para entrar."
      />
    );
  }
  return <ComSessao supabase={supabase} />;
}

function ComSessao({ supabase }: { supabase: AppSupabaseClient }) {
  const session = useSession(supabase);

  if (session === undefined) {
    return (
      <Tela>
        <p className="text-body text-ink-muted">Carregando…</p>
      </Tela>
    );
  }
  if (!session) return <Login supabase={supabase} />;
  return <AreaDoRestaurante supabase={supabase} session={session} />;
}
