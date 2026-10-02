import { Button } from '@usefood/ui';
import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from './app-context';

type DbStatus =
  | { kind: 'sem-config' }
  | { kind: 'verificando' }
  | { kind: 'ok'; brandName: string | null }
  | { kind: 'erro'; message: string };

/**
 * Tela provisória de cada app na E01: mostra marca, ambiente e se o banco responde.
 * Some quando a primeira tela real do app existir.
 */
export function StatusScreen({ title, description }: { title: string; description: string }) {
  const { app, brand, environment, supabase } = useAppContext();
  const [status, setStatus] = useState<DbStatus>(
    supabase ? { kind: 'verificando' } : { kind: 'sem-config' },
  );

  const check = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('brands')
      .select('name')
      .eq('slug', brand)
      .maybeSingle();
    setStatus(
      error
        ? { kind: 'erro', message: error.message }
        : { kind: 'ok', brandName: data?.name ?? null },
    );
  }, [supabase, brand]);

  useEffect(() => {
    // A primeira verificação roda ao abrir a tela; o botão repete depois.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
  }, [check]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="text-caption text-ink-muted">{brand}</p>
        <h1 className="font-display text-display">{title}</h1>
        <p className="text-body text-ink-muted">{description}</p>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-lg border border-line bg-surface p-6 text-body">
        <dt className="text-ink-muted">App</dt>
        <dd>{app}</dd>
        <dt className="text-ink-muted">Ambiente</dt>
        <dd>{environment}</dd>
        <dt className="text-ink-muted">Banco</dt>
        <dd>
          {status.kind === 'sem-config' &&
            'Sem conexão: preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env.'}
          {status.kind === 'verificando' && 'Verificando…'}
          {status.kind === 'ok' &&
            (status.brandName
              ? `Conectado. Marca encontrada: ${status.brandName}.`
              : `Conectado, mas a marca "${brand}" não está cadastrada ou ativa.`)}
          {status.kind === 'erro' && `Não conectou: ${status.message}`}
        </dd>
      </dl>

      {supabase && (
        <Button variant="secondary" className="self-start" onClick={() => void check()}>
          Verificar de novo
        </Button>
      )}
    </main>
  );
}
