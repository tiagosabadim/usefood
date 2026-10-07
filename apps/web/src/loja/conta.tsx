import { useAppContext, usePreferenciaDeTema } from '@usefood/app';
import { formatarTelefone, fraseDoPedido, lerTelefone, type SituacaoDoPedido } from '@usefood/core';
import { Alert, Button, cn, Icon, Panel, TextField, ThemeToggle } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { ENDERECO_EM_BRANCO, gravarConta, lerConta, novoId, type Conta } from '../guardado';
import { navegar } from '../rotas';
import { BarraDoApp } from '../vitrine/barra';
import { cidadeGuardada } from '../vitrine/vitrine-dados';
import {
  CamposDeEndereco,
  enderecoCompleto,
  resumoDoEndereco,
  type EnderecoEditavel,
} from './endereco-form';

/** Minha conta: dados, endereços com nome e pedidos. Fica neste aparelho. */
export function MinhaConta({
  base,
  modo = 'tudo',
}: {
  base: string;
  modo?: 'tudo' | 'pedidos' | 'perfil';
}) {
  const [abaDosPedidos, setAbaDosPedidos] = useState<'andamento' | 'anteriores'>('andamento');
  const { supabase } = useAppContext();
  const [tema, setTema] = usePreferenciaDeTema();
  const [conta, setConta] = useState<Conta>(() => lerConta());
  const [dados, setDados] = useState({
    nome: conta.nome,
    celular: conta.celular ? formatarTelefone(conta.celular) : '',
  });
  const [editando, setEditando] = useState<{ id: string | null; valor: EnderecoEditavel } | null>(
    null,
  );
  const [situacoes, setSituacoes] = useState<
    Record<string, { situacao: SituacaoDoPedido; tipo: string }>
  >({});
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');

  // Pedidos: em andamento (ainda não entregue nem recusado) ou anteriores
  const encerrado = (token: string) => {
    const s = situacoes[token]?.situacao;
    return s === 'concluido' || s === 'cancelado';
  };
  const listaDePedidos =
    modo === 'pedidos'
      ? conta.pedidos
          .filter((p) => (abaDosPedidos === 'andamento' ? !encerrado(p.token) : encerrado(p.token)))
          .slice(0, 30)
      : conta.pedidos.slice(0, 10);

  const salvar = (nova: Conta, texto: string) => {
    gravarConta(nova);
    setConta(nova);
    setErro('');
    setAviso(texto);
  };

  useEffect(() => {
    if (!supabase) return;
    let ativo = true;
    void Promise.all(
      conta.pedidos.slice(0, 10).map(async (p) => {
        const { data } = await supabase.rpc('acompanhar_pedido', { p_token: p.token });
        return [p.token, data as { situacao: SituacaoDoPedido; tipo: string } | null] as const;
      }),
    ).then((pares) => {
      if (ativo)
        setSituacoes(
          Object.fromEntries(pares.filter(([, s]) => s)) as Record<
            string,
            { situacao: SituacaoDoPedido; tipo: string }
          >,
        );
    });
    return () => {
      ativo = false;
    };
  }, [supabase, conta.pedidos]);

  function salvarDados() {
    const celular = lerTelefone(dados.celular);
    if (!dados.nome.trim()) return setErro('Informe seu nome.');
    if (!celular) return setErro('Informe o celular com DDD.');
    salvar({ ...conta, nome: dados.nome.trim(), celular }, 'Dados salvos.');
  }

  function salvarEndereco() {
    if (!editando) return;
    const v = editando.valor;
    if (!v.apelido.trim()) return setErro('Dê um nome ao endereço, como Casa ou Trabalho.');
    if (!enderecoCompleto(v)) return setErro('Preencha rua, número e bairro.');
    const enderecos = editando.id
      ? conta.enderecos.map((e) => (e.id === editando.id ? { ...v, id: e.id } : e))
      : [...conta.enderecos, { ...v, id: novoId() }];
    salvar({ ...conta, enderecos }, `${v.apelido.trim()} salvo.`);
    setEditando(null);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-5 py-6">
      {modo === 'tudo' && (
        <button
          type="button"
          className="self-start text-label text-ink-muted"
          onClick={() => navegar(base || '/')}
        >
          ← Voltar à loja
        </button>
      )}
      <h1 className="text-title-screen font-extrabold tracking-[-0.02em] text-ink">
        {modo === 'pedidos' ? 'Meus pedidos' : modo === 'perfil' ? 'Meu perfil' : 'Minha conta'}
      </h1>
      {modo !== 'pedidos' && (
        <p className="text-caption text-ink-muted">
          Seus dados ficam guardados neste aparelho para os próximos pedidos.
        </p>
      )}
      <Alert>{erro}</Alert>
      <Alert tone="sucesso">{aviso}</Alert>

      {modo !== 'pedidos' && (
        <>
          <Panel title="Seus dados">
            <TextField
              label="Nome"
              autoComplete="name"
              value={dados.nome}
              onChange={(e) => setDados({ ...dados, nome: e.target.value })}
            />
            <TextField
              label="Celular com DDD"
              inputMode="tel"
              autoComplete="tel"
              value={dados.celular}
              onChange={(e) => setDados({ ...dados, celular: e.target.value })}
            />
            <Button variant="secondary" className="self-start" onClick={salvarDados}>
              Salvar dados
            </Button>
          </Panel>

          <Panel title="Endereços">
            {editando ? (
              <>
                <CamposDeEndereco
                  comApelido
                  valor={editando.valor}
                  onChange={(valor) => setEditando({ ...editando, valor })}
                />
                <div className="flex gap-2">
                  <Button onClick={salvarEndereco}>Salvar endereço</Button>
                  <Button variant="ghost" onClick={() => setEditando(null)}>
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <>
                {conta.enderecos.length === 0 && (
                  <p className="text-body text-ink-muted">Nenhum endereço salvo ainda.</p>
                )}
                <ul className="flex flex-col divide-y divide-line">
                  {conta.enderecos.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 py-3">
                      <span className="mt-1 text-ink-muted">
                        <Icon name="local" size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-body-strong text-ink">{e.apelido}</p>
                        <p className="text-caption text-ink-muted">{resumoDoEndereco(e)}</p>
                      </div>
                      <Button variant="ghost" onClick={() => setEditando({ id: e.id, valor: e })}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-danger"
                        onClick={() =>
                          salvar(
                            { ...conta, enderecos: conta.enderecos.filter((x) => x.id !== e.id) },
                            `${e.apelido} removido.`,
                          )
                        }
                      >
                        Remover
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="secondary"
                  className="self-start"
                  onClick={() => setEditando({ id: null, valor: { ...ENDERECO_EM_BRANCO } })}
                >
                  Adicionar endereço
                </Button>
              </>
            )}
          </Panel>

          <Panel title="Aparência">
            <ThemeToggle value={tema} onChange={setTema} />
          </Panel>
        </>
      )}

      {modo !== 'perfil' && (
        <Panel title={modo === 'pedidos' ? '' : 'Meus pedidos'}>
          {modo === 'pedidos' && (
            <div
              role="tablist"
              aria-label="Pedidos"
              className="grid grid-cols-2 gap-1 rounded-pill bg-surface-strong p-1"
            >
              {(
                [
                  ['andamento', 'Em andamento'],
                  ['anteriores', 'Anteriores'],
                ] as const
              ).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  role="tab"
                  aria-selected={abaDosPedidos === valor}
                  onClick={() => setAbaDosPedidos(valor)}
                  className={cn(
                    'h-10 rounded-pill text-label font-bold transition',
                    abaDosPedidos === valor ? 'bg-brand text-brand-ink' : 'text-ink-muted',
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          )}
          {listaDePedidos.length === 0 ? (
            <p className="text-body text-ink-muted">
              {modo === 'pedidos' && abaDosPedidos === 'andamento'
                ? 'Nenhum pedido em andamento agora.'
                : 'Os pedidos que você fizer aparecem aqui.'}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {listaDePedidos.map((p) => (
                <li key={p.token}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 py-3 text-left"
                    onClick={() =>
                      navegar(`${base === '/delivery' ? `/${p.lojaSlug}` : base}/pedido/${p.token}`)
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-body-strong text-ink">
                        {p.lojaNome} · #{String(p.numero).padStart(3, '0')}
                      </p>
                      <p className="text-caption text-ink-muted">
                        {new Date(p.criadoEm).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {situacoes[p.token]
                          ? ` · ${fraseDoPedido(situacoes[p.token]!.tipo, situacoes[p.token]!.situacao)}`
                          : ''}
                      </p>
                    </div>
                    <span className="rotate-180 text-ink-muted">
                      <Icon name="voltar" size={18} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
      {base === '/delivery' && (
        <BarraDoApp ativo={modo === 'perfil' ? 'perfil' : 'pedidos'} cidade={cidadeGuardada()} />
      )}
    </main>
  );
}
