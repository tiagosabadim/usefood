import {
  Login,
  StatusScreen,
  Tela,
  useAppContext,
  usePreferenciaDeTema,
  useSession,
} from '@usefood/app';
import { AppShell, Button, ThemeSwitcher } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { Leads } from './leads';
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
  const [area, setArea] = useState<'lojas' | 'leads'>('lojas');
  const [tema, setTema] = usePreferenciaDeTema();

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
            {
              id: 'lojas',
              label: 'Lojas',
              icon: 'loja',
              active: area === 'lojas',
              onClick: () => setArea('lojas'),
            },
            {
              id: 'leads',
              label: 'Leads',
              icon: 'conversa',
              active: area === 'leads',
              onClick: () => setArea('leads'),
            },
            { id: 'numeros', label: 'Números', icon: 'grafico', soon: true },
            { id: 'marcas', label: 'Marcas', icon: 'marca', soon: true },
            { id: 'dominios', label: 'Domínios', icon: 'globo', soon: true },
          ],
        },
      ]}
      footer={
        <div className="flex flex-col gap-2">
          <ThemeSwitcher value={tema} onChange={setTema} />
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
      {area === 'leads' ? (
        <Tela larga>
          <div className="flex gap-2 lg:hidden">
            <Button variant="secondary" onClick={() => setArea('lojas')}>
              Ver lojas
            </Button>
          </div>
          <Leads supabase={supabase} />
        </Tela>
      ) : (
        <Lojas
          supabase={supabase}
          email={sessao.user.email ?? ''}
          onLeads={() => setArea('leads')}
        />
      )}
    </AppShell>
  );
}
