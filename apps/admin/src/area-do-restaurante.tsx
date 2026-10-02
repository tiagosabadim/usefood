import type { AppSupabaseClient, Enums, Session } from '@usefood/db';
import { Button } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { CriarRestaurante } from './criar-restaurante';
import { Aviso, Tela, Titulo } from './tela';

type Papel = Enums<'restaurant_role'>;
interface Vinculo {
  papel: Papel;
  loja: { id: string; name: string; slug: string; status: Enums<'restaurant_status'> };
}
type Estado = { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'pronto'; vinculos: Vinculo[] };

const PAPEL: Record<Papel, string> = {
  dono: 'Dono',
  gerente: 'Gerente',
  caixa: 'Caixa',
  garcom: 'Garçom',
  cozinha: 'Cozinha',
};

/** Depois do login: cria a primeira loja ou mostra o painel das lojas da pessoa. */
export function AreaDoRestaurante({
  supabase,
  session,
}: {
  supabase: AppSupabaseClient;
  session: Session;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [versao, setVersao] = useState(0);
  const [selecionada, setSelecionada] = useState(0);

  useEffect(() => {
    let ativo = true;
    void supabase
      .from('memberships')
      .select('role, restaurants(id, name, slug, status)')
      .eq('user_id', session.user.id)
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) {
          setEstado({ tipo: 'erro' });
          return;
        }
        const vinculos = (data ?? []).flatMap((linha) =>
          linha.restaurants ? [{ papel: linha.role, loja: linha.restaurants }] : [],
        );
        setEstado({ tipo: 'pronto', vinculos });
      });
    return () => {
      ativo = false;
    };
  }, [supabase, session.user.id, versao]);

  if (estado.tipo === 'carregando') {
    return (
      <Tela>
        <p className="text-body text-ink-muted">Carregando suas lojas…</p>
      </Tela>
    );
  }

  if (estado.tipo === 'erro') {
    return (
      <Tela>
        <Aviso>Não conseguimos carregar suas lojas. Confira a internet e tente de novo.</Aviso>
        <Button onClick={() => setVersao((v) => v + 1)}>Tentar de novo</Button>
      </Tela>
    );
  }

  if (estado.vinculos.length === 0) {
    return <CriarRestaurante supabase={supabase} onCriado={() => setVersao((v) => v + 1)} />;
  }

  const atual = estado.vinculos[selecionada] ?? estado.vinculos[0]!;
  const noAr = atual.loja.status === 'ativo';

  return (
    <Tela>
      <Titulo
        titulo={atual.loja.name}
        texto={`${PAPEL[atual.papel]} · ${noAr ? 'Loja no ar' : 'Loja em cadastro'}`}
      />

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
        <h2 className="font-display text-title-section text-ink">Próximos passos</h2>
        <ul className="flex flex-col gap-2 text-body text-ink-muted">
          <li>Montar o cardápio, com fotos e adicionais.</li>
          <li>Convidar a equipe: caixa, garçons e cozinha.</li>
          <li>Configurar as impressoras da cozinha.</li>
        </ul>
        <p className="text-caption text-ink-muted">
          {noAr
            ? `Sua loja está em ${window.location.host}/${atual.loja.slug}`
            : `Quando for ativada, sua loja vai aparecer em ${window.location.host}/${atual.loja.slug}`}
        </p>
      </section>

      {estado.vinculos.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-label text-ink">Suas outras lojas</h2>
          {estado.vinculos.map((v, i) =>
            i === selecionada ? null : (
              <Button key={v.loja.id} variant="secondary" onClick={() => setSelecionada(i)}>
                {v.loja.name}
              </Button>
            ),
          )}
        </section>
      )}

      <footer className="flex items-center justify-between gap-4 border-t border-line pt-5">
        <span className="min-w-0 truncate text-caption text-ink-muted">{session.user.email}</span>
        <Button variant="secondary" onClick={() => void supabase.auth.signOut()}>
          Sair
        </Button>
      </footer>
    </Tela>
  );
}
