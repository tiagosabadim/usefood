import { Login, StatusScreen, Tela, useAppContext, useSession } from '@usefood/app';
import { AppShell, Button } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { Lojas } from './lojas';

/** Console da plataforma: só a equipe usefood (administradores da plataforma) entra. */
export function App() {
  const { supabase } = useAppContext();
  if (!supabase) {
    return (
      <StatusScreen
        title="Console usefood"
        description="Faltam as chaves do banco nesta publicação."
      />
    );
  }
  return <ComSessao supabase={supabase} />;
}

function ComSessao({
  supabase,
}: {
  supabase: NonNullable<ReturnType<typeof useAppContext>['supabase']>;
}) {
  const sessao = useSession(supabase);
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!sessao) return;
    let ativo = true;
    void supabase.rpc('sou_admin_da_plataforma').then(({ data }) => {
      if (ativo) setAdmin(data === true);
    });
    return () => {
      ativo = false;
    };
  }, [supabase, sessao]);

  if (sessao === undefined) return null;
  if (!sessao) return <Login supabase={supabase} />;
  if (admin === undefined) return null;
  if (!admin) {
    return (
      <Tela>
        <h1 className="font-display text-title-screen text-ink">Acesso só para a equipe usefood</h1>
        <p className="text-body text-ink-muted">
          Você entrou como {sessao.user.email}. Para administrar a sua loja, use o painel em /pdv.
        </p>
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => void supabase.auth.signOut()}
        >
          Sair
        </Button>
      </Tela>
    );
  }
  return (
    <AppShell
      header={
        <div className="flex flex-col gap-1">
          <span className="font-display text-wordmark text-ink">usefood</span>
          <span className="text-caption text-ink-muted">Console da plataforma</span>
        </div>
      }
      groups={[
        {
          items: [
            { id: 'lojas', label: 'Lojas', icon: 'loja', active: true },
            { id: 'numeros', label: 'Números', icon: 'grafico', soon: true },
            { id: 'marcas', label: 'Marcas', icon: 'marca', soon: true },
            { id: 'dominios', label: 'Domínios', icon: 'globo', soon: true },
          ],
        },
      ]}
      footer={
        <div className="flex flex-col gap-2">
          <span className="truncate text-caption text-ink-muted">{sessao.user.email}</span>
          <Button
            variant="ghost"
            className="justify-start px-3"
            onClick={() => void supabase.auth.signOut()}
          >
            Sair
          </Button>
        </div>
      }
    >
      <Lojas supabase={supabase} email={sessao.user.email ?? ''} />
    </AppShell>
  );
}
