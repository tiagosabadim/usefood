import { useAppContext } from '@usefood/app';
import type { AppSupabaseClient, Enums, Session } from '@usefood/db';
import {
  Alert,
  AppShell,
  Button,
  Icon,
  type IconName,
  type NavGroup,
  Panel,
  SelectField,
} from '@usefood/ui';
import { type ReactNode, useEffect, useState } from 'react';
import { Cardapio } from './cardapio';
import { CriarRestaurante } from './criar-restaurante';
import { AlertasDeImpressao } from './alerta-impressao';
import { PdvComCaixa } from './caixa';
import { PedidosOnline } from './pedidos-online';
import { PainelDeChamada } from './chamada';
import { Configuracoes } from './configuracoes';
import { Equipe } from './equipe';
import { TelaDaCozinha } from './cozinha';
import { Impressao } from './impressao';
import { LojaOnline } from './loja-online';
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
  entregador: 'Entregador',
};

/** Depois do login: cria a primeira loja ou mostra o painel das lojas da pessoa. */
type TelaDoPainel =
  | 'inicio'
  | 'cardapio'
  | 'pdv'
  | 'salao'
  | 'impressao'
  | 'cozinha'
  | 'chamada'
  | 'configuracoes'
  | 'equipe'
  | 'loja-online';

export function AreaDoRestaurante({
  supabase,
  session,
}: {
  supabase: AppSupabaseClient;
  session: Session;
}) {
  const { brand } = useAppContext();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [versao, setVersao] = useState(0);
  const [selecionada, setSelecionada] = useState(0);
  const [tela, setTela] = useState<TelaDoPainel>('inicio');

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
            avisos={
              <>
                <PedidosOnline supabase={supabase} lojaId={atual.loja.id} />
                <AlertasDeImpressao supabase={supabase} lojaId={atual.loja.id} />
              </>
            }
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

  // Itens do menu lateral (só aparece no computador)
  const ir = (destino: TelaDoPainel) => () => setTela(destino);
  const grupos: NavGroup[] = [
    {
      items: [
        {
          id: 'inicio',
          label: 'Início',
          icon: 'inicio',
          onClick: ir('inicio'),
          active: tela === 'inicio',
        },
      ],
    },
    {
      title: 'Operação',
      items: [
        ...(podeVender
          ? [
              { id: 'pdv', label: 'PDV', icon: 'pdv' as const, onClick: ir('pdv') },
              { id: 'salao', label: 'Salão', icon: 'mesa' as const, onClick: ir('salao') },
            ]
          : []),
        { id: 'cozinha', label: 'Tela da cozinha', icon: 'cozinha', onClick: ir('cozinha') },
        { id: 'chamada', label: 'Painel de chamada', icon: 'chamada', onClick: ir('chamada') },
      ],
    },
    {
      title: 'Gestão',
      items: [
        {
          id: 'cardapio',
          label: 'Cardápio',
          icon: 'cardapio',
          onClick: ir('cardapio'),
          active: tela === 'cardapio',
        },
        ...(podeEditar
          ? [
              {
                id: 'loja-online',
                label: 'Loja online',
                icon: 'loja' as const,
                onClick: ir('loja-online'),
                active: tela === 'loja-online',
              },
              {
                id: 'impressao',
                label: 'Impressão',
                icon: 'impressora' as const,
                onClick: ir('impressao'),
                active: tela === 'impressao',
              },
              {
                id: 'equipe',
                label: 'Equipe',
                icon: 'equipe' as const,
                onClick: ir('equipe'),
                active: tela === 'equipe',
              },
              {
                id: 'configuracoes',
                label: 'Configurações',
                icon: 'ajustes' as const,
                onClick: ir('configuracoes'),
                active: tela === 'configuracoes',
              },
            ]
          : []),
      ],
    },
  ];
  const menu = (conteudo: ReactNode) => (
    <AppShell
      header={
        <div className="flex flex-col gap-1">
          <span className="font-display text-wordmark text-ink">{brand}</span>
          <span className="truncate text-body-strong text-ink">{atual.loja.name}</span>
          <span className="text-caption text-ink-muted">
            {PAPEL[atual.papel]} · {noAr ? 'Loja no ar' : 'Loja em cadastro'}
          </span>
        </div>
      }
      groups={grupos}
      footer={
        <div className="flex flex-col gap-3">
          {estado.vinculos.length > 1 && (
            <SelectField
              label="Loja"
              options={estado.vinculos.map((v, i) => ({ value: String(i), label: v.loja.name }))}
              value={String(selecionada)}
              onChange={(v) => {
                setSelecionada(Number(v));
                setTela('inicio');
              }}
            />
          )}
          <span className="truncate text-caption text-ink-muted">{session.user.email}</span>
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
      {conteudo}
    </AppShell>
  );

  const gestao = ((): ReactNode => {
    if (tela === 'loja-online') {
      return (
        <LojaOnline supabase={supabase} loja={atual.loja} onVoltar={() => setTela('inicio')} />
      );
    }

    if (tela === 'equipe') {
      return (
        <Equipe
          supabase={supabase}
          loja={atual.loja}
          souDono={atual.papel === 'dono'}
          onVoltar={() => setTela('inicio')}
        />
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
    return null;
  })();
  if (gestao) return menu(gestao);

  // Atalhos do início no computador: cards com descrição
  const atalhos: {
    id: string;
    titulo: string;
    texto: string;
    icone: IconName;
    onClick: () => void;
    mostrar: boolean;
  }[] = [
    {
      id: 'pdv',
      titulo: 'PDV',
      texto: 'Vender no balcão, na mesa, para viagem e delivery.',
      icone: 'pdv',
      onClick: ir('pdv'),
      mostrar: podeVender,
    },
    {
      id: 'salao',
      titulo: 'Salão',
      texto: 'Mesas livres e ocupadas, com valor e tempo.',
      icone: 'mesa',
      onClick: ir('salao'),
      mostrar: podeVender,
    },
    {
      id: 'cozinha',
      titulo: 'Tela da cozinha',
      texto: 'Pedidos por praça, com cronômetro e som.',
      icone: 'cozinha',
      onClick: ir('cozinha'),
      mostrar: true,
    },
    {
      id: 'chamada',
      titulo: 'Painel de chamada',
      texto: 'Para a TV do balcão: preparando e pronto.',
      icone: 'chamada',
      onClick: ir('chamada'),
      mostrar: true,
    },
    {
      id: 'cardapio',
      titulo: 'Cardápio',
      texto: 'Produtos, fotos, tamanhos e adicionais.',
      icone: 'cardapio',
      onClick: ir('cardapio'),
      mostrar: true,
    },
    {
      id: 'loja-online',
      titulo: 'Loja online',
      texto: 'Dados, horários, entrega e publicar.',
      icone: 'loja',
      onClick: ir('loja-online'),
      mostrar: podeEditar,
    },
    {
      id: 'impressao',
      titulo: 'Impressão',
      texto: 'Computador da cozinha e impressoras.',
      icone: 'impressora',
      onClick: ir('impressao'),
      mostrar: podeEditar,
    },
    {
      id: 'equipe',
      titulo: 'Equipe',
      texto: 'Pessoas com PIN e aparelhos conectados.',
      icone: 'equipe',
      onClick: ir('equipe'),
      mostrar: podeEditar,
    },
    {
      id: 'configuracoes',
      titulo: 'Configurações',
      texto: 'Jeito de atender e mesas.',
      icone: 'ajustes',
      onClick: ir('configuracoes'),
      mostrar: podeEditar,
    },
  ];
  const cartao = (a: (typeof atalhos)[number]) => (
    <button
      key={a.id}
      type="button"
      onClick={a.onClick}
      className="flex items-start gap-4 rounded-lg border border-line bg-surface p-5 text-left transition hover:border-brand hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand-text">
        <Icon name={a.icone} size={22} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-body-strong text-ink">{a.titulo}</span>
        <span className="text-caption text-ink-muted">{a.texto}</span>
      </span>
    </button>
  );
  const operacao = ['pdv', 'salao', 'cozinha', 'chamada'];

  return menu(
    <Tela larga>
      <section className="hidden flex-col gap-8 lg:flex">
        <Titulo
          titulo={atual.loja.name}
          texto={
            noAr
              ? `Sua loja está no ar em ${window.location.host}/${atual.loja.slug}`
              : 'Loja em cadastro: complete em Loja online e publique.'
          }
        />
        <div className="flex flex-col gap-3">
          <h2 className="text-label text-ink-muted uppercase">Operação</h2>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {atalhos.filter((a) => a.mostrar && operacao.includes(a.id)).map(cartao)}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-label text-ink-muted uppercase">Gestão</h2>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {atalhos.filter((a) => a.mostrar && !operacao.includes(a.id)).map(cartao)}
          </div>
        </div>
      </section>
      <div className="flex flex-col gap-8 lg:hidden">
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
            <Button
              variant="secondary"
              className="h-target-pdv"
              onClick={() => setTela('cardapio')}
            >
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
                onClick={() => setTela('loja-online')}
              >
                Loja online
              </Button>
            )}
            {podeEditar && (
              <Button
                variant="secondary"
                className="h-target-pdv"
                onClick={() => setTela('equipe')}
              >
                Equipe
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
      </div>
    </Tela>,
  );
}
