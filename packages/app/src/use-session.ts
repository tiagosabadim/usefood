import type { AppSupabaseClient, Session } from '@usefood/db';
import { useEffect, useState } from 'react';

/** Sessão do usuário: undefined enquanto carrega, null quando ninguém entrou. */
export function useSession(supabase: AppSupabaseClient): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let ativo = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (ativo) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, nova) => setSession(nova));
    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  return session;
}
