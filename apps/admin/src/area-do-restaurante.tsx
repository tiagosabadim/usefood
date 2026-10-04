import type { AppSupabaseClient, Enums, Session } from '@usefood/db';
import { Alert, Button, Panel } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { Cardapio } from './cardapio';
import { CriarRestaurante } from './criar-restaurante';
import { AlertasDeImpressao } from './alerta-impressao';
import { PdvComCaixa } from './caixa';
import { PainelDeChamada } from './chamada';
import { Configuracoes } from './configuracoes';
import { TelaDaCozinha } from './cozinha';
import { Impressao } from './impressao';
import { Pdv } from './pdv';
import { Tela, Titulo } from './tela';

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
  const [tela, setTela] = useState<
    'inicio' | 'cardapio' | 'pdv' | 'salao' | 'impressao' | 'cozinha' | 'chamada' | 'configuracoes'
  >('inicio');

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
        <Alert>Não conseguimos carregar suas lojas. Confira a internet e tente de novo.</Alert>
        <Button onClick={() => setVersao((v) => v + 1)}>Tentar de novo</Button>
      </Tela>
    );
  }

  if (estado.vinculos.length === 0) {
    return <CriarRestaurante supabase={supabase} onCriado={() => setVersao((v) => v + 1)} />;
  }

  const atual = estado.vinculos[selecionada] ?? estado.vinculos[0]!;
  const noAr = atual.loja.status === 'ativo';
  const podeEditar = atual.papel === 'dono' || atual.papel === 'gerente';
  const podeVender = podeEditar || atual.papel === 'caixa';

  if (tela === 'pdv' || tela === 'salao') {
    return (
      <PdvComCaixa supabase={supabase} loja={atual.loja} onVoltar={() => setTela('inicio')}>
        {(cabecalho) => (
          <Pdv
            supabase={supabase}
            loja={atual.loja}
            onVoltar={() => setTela('inicio')}
            cabecalhoDoCaixa={cabecalho}
            avisos={<AlertasDeImpressao supabase={supabase} lojaId={atual.loja.id} />}
            modoInicial={tela === 'salao' ? 'salao' : 'cardapio'}
          />
        )}
      </PdvComCaixa>
    );
  }

  if (tela === 'cozinha') {
    return (
      <TelaDaCozinha supabase={supabase} loja={atual.loja} onVoltar={() => setTela('inicio')} />
    );
  }

  if (tela === 'chamada') {
    return (
      <PainelDeChamada supabase={supabase} loja={atual.loja} onVoltar={() => setTela('inicio')} />
    );
  }

  if (tela === 'configuracoes') {
    return (
      <Configuracoes supabase={supabase} loja={atual.loja} onVoltar={() => setTela('inicio')} />
    );
  }

  if (tela === 'impressao') {
    return <Impressao supabase={supabase} loja={atual.loja} onVoltar={() => setTela('inicio')} />;
  }

  if (tela === 'cardapio') {
    return (
      <Cardapio
        supabase={supabase}
        loja={atual.loja}
        podeEditar={podeEditar}
        onVoltar={() => setTela('inicio')}
      />
    );
  }

  return (
    <Tela>
      <Titulo
        titulo={atual.loja.name}
        texto={`${PAPEL[atual.papel]} · ${noAr ? 'Loja no ar' : 'Loja em cadastro'}`}
      />

      <Panel title="Operação">
        <div className="flex flex-wrap gap-2">
          {podeVender && (
            <Button className="h-target-pdv" onClick={() => setTela('pdv')}>
              Abrir o PDV
            </Button>
          )}
          {podeVender && (
            <Button variant="secondary" className="h-target-pdv" onClick={() => setTela('salao')}>
              Salão
            </Button>
          )}
          <Button
            variant={atual.papel === 'cozinha' ? 'primary' : 'secondary'}
            className="h-target-pdv"
            onClick={() => setTela('cozinha')}
          >
            Tela da cozinha
          </Button>
          <Button variant="secondary" className="h-target-pdv" onClick={() => setTela('chamada')}>
            Painel de chamada
          </Button>
        </div>
        <p className="text-caption text-ink-muted">
          O painel de chamada é para a TV do balcão: mostra quem está sendo preparado e quem pode
          retirar.
        </p>
      </Panel>

      <Panel title="Gestão">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="h-target-pdv" onClick={() => setTela('cardapio')}>
            {podeEditar ? 'Cardápio' : 'Ver o cardápio'}
          </Button>
          {podeEditar && (
            <Button
              variant="secondary"
              className="h-target-pdv"
              onClick={() => setTela('impressao')}
            >
              Impressão
            </Button>
          )}
          {podeEditar && (
            <Button
              variant="secondary"
              className="h-target-pdv"
              onClick={() => setTela('configuracoes')}
            >
              Configurações
            </Button>
          )}
        </div>
        <p className="text-caption text-ink-muted">
          {noAr
            ? `Sua loja está em ${window.location.host}/${atual.loja.slug}`
            : `Quando for ativada, sua loja vai aparecer em ${window.location.host}/${atual.loja.slug}`}
        </p>
      </Panel>

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
