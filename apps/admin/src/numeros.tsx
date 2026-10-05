import {
  csv,
  formatarPreco,
  formatarTelefone,
  periodo,
  PERIODOS,
  reaisNaPlanilha,
  variacao,
  type ChaveDoPeriodo,
} from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { Alert, Button, cn, Panel, SegmentedControl, StatusPill } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { Colunas, Titulo } from './tela';

interface Periodo {
  vendas: number;
  pedidos: number;
  contas: number;
  recebido: number;
}
interface Painel {
  atual: Periodo;
  anterior: Periodo;
  canais: { canal: string; pedidos: number; vendas: number }[];
  pagamentos: { metodo: string; quantidade: number; valor: number }[];
  produtos: { nome: string; quantidade: number; total: number }[];
  por_hora: { hora: number; pedidos: number; vendas: number }[];
  por_dia: { dia: string; pedidos: number; vendas: number }[];
  cozinha: { prontos: number; media_min: number | null; atrasados: number };
  online: {
    aceitos: number;
    recusados: number;
    resposta_min: number | null;
    motivos: { motivo: string; quantidade: number }[];
  };
  caixas: {
    nome: string;
    situacao: string;
    aberto_em: string;
    fechado_em: string | null;
    fundo: number;
    diferenca: number | null;
    aberto_por: string | null;
  }[];
  clientes: { nome: string | null; telefone: string; pedidos: number; total: number }[];
}

const CANAIS: Record<string, string> = {
  balcao: 'Balcão',
  mesa: 'Mesa',
  retirada: 'Para viagem',
  delivery: 'Delivery (PDV)',
  online: 'Loja online',
};
const METODOS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Crédito',
  debito: 'Débito',
  vale_refeicao: 'Vale-refeição',
  outro: 'Outro',
};
const chaveDoDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Gráfico de barras simples: altura proporcional ao maior valor, rótulos espaçados embaixo. */
function Barras({
  dados,
  rotular,
}: {
  dados: { rotulo: string; valor: number; dica: string }[];
  rotular: (i: number) => boolean;
}) {
  const maior = Math.max(1, ...dados.map((d) => d.valor));
  const pico = dados.reduce(
    (a, b) => (b.valor > a.valor ? b : a),
    dados[0] ?? { rotulo: '', valor: 0, dica: '' },
  );
  return (
    <div className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={
          pico.valor ? `Maior movimento: ${pico.rotulo}, ${pico.dica}` : 'Sem vendas no período'
        }
        className="flex h-40 items-end gap-1"
      >
        {dados.map((d) => (
          <div
            key={d.rotulo}
            title={`${d.rotulo}: ${d.dica}`}
            className="flex h-full flex-1 items-end"
          >
            <div
              className={cn(
                'w-full rounded-t-sm',
                d.valor === pico.valor && d.valor > 0 ? 'bg-brand' : 'bg-brand-soft',
              )}
              style={{ height: `${Math.max(d.valor ? 4 : 1, (d.valor / maior) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 text-micro text-ink-muted">
        {dados.map((d, i) => (
          <span key={d.rotulo} className="flex-1 text-center">
            {rotular(i) ? d.rotulo : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barras horizontais com a porcentagem de cada parte (canais, pagamentos). */
function Proporcoes({
  itens,
  vazio,
}: {
  itens: { rotulo: string; valor: number; detalhe: string }[];
  vazio: string;
}) {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  if (!total) return <p className="text-body text-ink-muted">{vazio}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {itens.map((i) => {
        const pct = Math.round((i.valor / total) * 100);
        return (
          <li key={i.rotulo} className="flex flex-col gap-1">
            <div className="flex justify-between gap-3 text-body">
              <span className="text-ink">{i.rotulo}</span>
              <span className="text-ink-muted tabular-nums">
                {i.detalhe} · {pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-pill bg-surface-strong">
              <div className="h-full rounded-pill bg-brand" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Dashboard do restaurante (dono e gerente). */
export function Numeros({
  supabase,
  loja,
  titulo = 'Números da loja',
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  titulo?: string;
}) {
  const [chave, setChave] = useState<ChaveDoPeriodo>('hoje');
  const [painel, setPainel] = useState<Painel | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    const { inicio, fim } = periodo(chave, new Date());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true);
    void supabase
      .rpc('painel_da_loja', {
        p_restaurant_id: loja.id,
        p_inicio: inicio.toISOString(),
        p_fim: fim.toISOString(),
      })
      .then(({ data, error }) => {
        if (!ativo) return;
        setCarregando(false);
        if (error) return setErro('Não conseguimos carregar os números agora.');
        setErro('');
        setPainel(data as unknown as Painel);
      });
    return () => {
      ativo = false;
    };
  }, [supabase, loja.id, chave]);

  const { inicio, fim } = periodo(chave, new Date());
  const dias: Date[] = [];
  for (const d = new Date(inicio); d < fim; d.setDate(d.getDate() + 1)) dias.push(new Date(d));

  function exportar() {
    if (!painel) return;
    const rotulo = PERIODOS.find((p) => p.value === chave)!.label;
    const linhas: (string | number)[][] = [
      [`${loja.name} · ${rotulo}`],
      [],
      ['Resumo', 'Valor'],
      ['Vendas (R$)', reaisNaPlanilha(painel.atual.vendas)],
      ['Recebido (R$)', reaisNaPlanilha(painel.atual.recebido)],
      ['Pedidos', painel.atual.pedidos],
      ['Contas', painel.atual.contas],
      [],
      ['Dia', 'Pedidos', 'Vendas (R$)'],
      ...painel.por_dia.map((d) => [
        d.dia.split('-').reverse().join('/'),
        d.pedidos,
        reaisNaPlanilha(d.vendas),
      ]),
      [],
      ['Produto', 'Quantidade', 'Total (R$)'],
      ...painel.produtos.map((p) => [p.nome, p.quantidade, reaisNaPlanilha(p.total)]),
      [],
      ['Forma de pagamento', 'Pagamentos', 'Valor (R$)'],
      ...painel.pagamentos.map((p) => [
        METODOS[p.metodo] ?? p.metodo,
        p.quantidade,
        reaisNaPlanilha(p.valor),
      ]),
      [],
      ['Canal', 'Pedidos', 'Vendas (R$)'],
      ...painel.canais.map((c) => [
        CANAIS[c.canal] ?? c.canal,
        c.pedidos,
        reaisNaPlanilha(c.vendas),
      ]),
    ];
    const url = URL.createObjectURL(new Blob([csv(linhas)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${loja.name} - ${rotulo}.csv`.replace(/[\\/:*?"<>|]/g, '');
    a.click();
    URL.revokeObjectURL(url);
  }

  const a = painel?.atual;
  const b = painel?.anterior;
  const ticket = (p?: Periodo) => (p && p.contas ? Math.round(p.vendas / p.contas) : 0);
  const kpis =
    a && b
      ? [
          { titulo: 'Vendas', valor: formatarPreco(a.vendas), v: variacao(a.vendas, b.vendas) },
          {
            titulo: 'Recebido',
            valor: formatarPreco(a.recebido),
            v: variacao(a.recebido, b.recebido),
          },
          {
            titulo: 'Pedidos',
            valor: a.pedidos.toLocaleString('pt-BR'),
            v: variacao(a.pedidos, b.pedidos),
          },
          {
            titulo: 'Ticket médio',
            valor: formatarPreco(ticket(a)),
            v: variacao(ticket(a), ticket(b)),
          },
        ]
      : [];

  return (
    <div className="flex flex-col gap-6">
      <Titulo
        titulo={titulo}
        texto={`${loja.name} · comparado com o período anterior`}
        acoes={
          <>
            <SegmentedControl
              label="Período"
              options={PERIODOS}
              value={chave}
              onChange={setChave}
            />
            <Button variant="secondary" disabled={!painel} onClick={exportar}>
              Exportar planilha
            </Button>
          </>
        }
      />
      <Alert>{erro}</Alert>
      {!painel ? (
        <p className="text-body text-ink-muted">{carregando ? 'Calculando os números…' : ''}</p>
      ) : (
        <div className={cn('flex flex-col gap-6 transition-opacity', carregando && 'opacity-60')}>
          <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {kpis.map((k) => (
              <li
                key={k.titulo}
                className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4"
              >
                <span className="text-caption text-ink-muted">{k.titulo}</span>
                <span className="font-display text-title-section text-ink tabular-nums">
                  {k.valor}
                </span>
                <span
                  className={cn(
                    'text-label',
                    k.v.tom === 'alta' && 'text-success',
                    k.v.tom === 'baixa' && 'text-danger',
                    k.v.tom === 'igual' && 'text-ink-muted',
                  )}
                >
                  {k.v.texto} <span className="text-caption text-ink-muted">vs. anterior</span>
                </span>
              </li>
            ))}
          </ul>

          <Colunas
            esquerda={
              <>
                {chave !== 'hoje' && (
                  <Panel title="Vendas por dia">
                    <Barras
                      dados={dias.map((d) => {
                        const x = painel.por_dia.find((p) => p.dia === chaveDoDia(d));
                        return {
                          rotulo: `${d.getDate()}/${d.getMonth() + 1}`,
                          valor: x?.vendas ?? 0,
                          dica: formatarPreco(x?.vendas ?? 0),
                        };
                      })}
                      rotular={(i) => dias.length <= 7 || i % 5 === 0}
                    />
                  </Panel>
                )}
                <Panel title="Movimento por hora">
                  <Barras
                    dados={Array.from({ length: 24 }, (_, h) => {
                      const x = painel.por_hora.find((p) => p.hora === h);
                      return {
                        rotulo: `${h}h`,
                        valor: x?.pedidos ?? 0,
                        dica: `${x?.pedidos ?? 0} pedidos, ${formatarPreco(x?.vendas ?? 0)}`,
                      };
                    })}
                    rotular={(i) => i % 3 === 0}
                  />
                </Panel>
                <Panel title="Mais vendidos">
                  {painel.produtos.length === 0 ? (
                    <p className="text-body text-ink-muted">Nenhuma venda no período.</p>
                  ) : (
                    <ol className="flex flex-col divide-y divide-line">
                      {painel.produtos.map((p, i) => (
                        <li key={p.nome} className="flex items-center gap-3 py-2 text-body">
                          <span className="w-6 text-ink-muted tabular-nums">{i + 1}.</span>
                          <span className="flex-1 text-ink">{p.nome}</span>
                          <span className="text-ink-muted tabular-nums">{p.quantidade} un.</span>
                          <span className="w-24 text-right text-body-strong text-ink tabular-nums">
                            {formatarPreco(p.total)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </Panel>
                <Panel title="Caixas">
                  {painel.caixas.length === 0 ? (
                    <p className="text-body text-ink-muted">Nenhum caixa aberto no período.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-line">
                      {painel.caixas.map((c) => (
                        <li
                          key={c.aberto_em}
                          className="flex flex-wrap items-center justify-between gap-2 py-2"
                        >
                          <div className="flex flex-col">
                            <span className="text-body text-ink">
                              {c.nome} · {quando(c.aberto_em)}
                              {c.fechado_em ? ` até ${quando(c.fechado_em)}` : ''}
                            </span>
                            <span className="text-caption text-ink-muted">
                              Aberto por {c.aberto_por ?? '—'}
                            </span>
                          </div>
                          {c.situacao === 'aberto' ? (
                            <StatusPill tone="destaque">Aberto</StatusPill>
                          ) : (
                            <StatusPill tone={c.diferenca ? 'erro' : 'sucesso'}>
                              {c.diferenca ? `Diferença ${formatarPreco(c.diferenca)}` : 'Bateu'}
                            </StatusPill>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </>
            }
            direita={
              <>
                <Panel title="Canais">
                  <Proporcoes
                    vazio="Nenhuma venda no período."
                    itens={painel.canais.map((c) => ({
                      rotulo: CANAIS[c.canal] ?? c.canal,
                      valor: c.vendas,
                      detalhe: formatarPreco(c.vendas),
                    }))}
                  />
                </Panel>
                <Panel title="Formas de pagamento">
                  <Proporcoes
                    vazio="Nenhum pagamento recebido no período."
                    itens={painel.pagamentos.map((p) => ({
                      rotulo: METODOS[p.metodo] ?? p.metodo,
                      valor: p.valor,
                      detalhe: formatarPreco(p.valor),
                    }))}
                  />
                </Panel>
                <Panel title="Cozinha e pedidos online">
                  <dl className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-caption text-ink-muted">Tempo médio de preparo</dt>
                      <dd className="text-body-strong text-ink">
                        {painel.cozinha.media_min != null ? `${painel.cozinha.media_min} min` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-caption text-ink-muted">Passaram de 15 min</dt>
                      <dd className="text-body-strong text-ink">
                        {painel.cozinha.prontos
                          ? `${painel.cozinha.atrasados} de ${painel.cozinha.prontos}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-caption text-ink-muted">Online aceitos / recusados</dt>
                      <dd className="text-body-strong text-ink">
                        {painel.online.aceitos} / {painel.online.recusados}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-caption text-ink-muted">Tempo para aceitar</dt>
                      <dd className="text-body-strong text-ink">
                        {painel.online.resposta_min != null
                          ? `${painel.online.resposta_min} min`
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                  {painel.online.motivos.length > 0 && (
                    <p className="text-caption text-ink-muted">
                      Motivos das recusas:{' '}
                      {painel.online.motivos.map((m) => `${m.motivo} (${m.quantidade})`).join(', ')}
                    </p>
                  )}
                </Panel>
                <Panel title="Melhores clientes">
                  {painel.clientes.length === 0 ? (
                    <p className="text-body text-ink-muted">
                      Aparecem aqui os clientes de delivery e da loja online, pelo celular.
                    </p>
                  ) : (
                    <ol className="flex flex-col divide-y divide-line">
                      {painel.clientes.map((c) => (
                        <li key={c.telefone} className="flex items-center gap-3 py-2">
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="text-body text-ink">{c.nome ?? 'Cliente'}</span>
                            <a
                              className="text-caption text-ink-muted underline"
                              href={`https://wa.me/55${c.telefone}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {formatarTelefone(c.telefone)}
                            </a>
                          </div>
                          <span className="text-caption text-ink-muted">{c.pedidos} pedidos</span>
                          <span className="w-24 text-right text-body-strong text-ink tabular-nums">
                            {formatarPreco(c.total)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </Panel>
              </>
            }
          />
        </div>
      )}
    </div>
  );
}
