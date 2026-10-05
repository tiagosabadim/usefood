import {
  csv,
  formatarPreco,
  formatarTelefone,
  noSegmento,
  reaisNaPlanilha,
  type Segmento,
} from '@usefood/core';
import type { AppSupabaseClient, Database } from '@usefood/db';
import { Alert, Button, SegmentedControl, SelectField, Sheet, TextField } from '@usefood/ui';
import { useEffect, useMemo, useState } from 'react';
import { Titulo } from './tela';

type Cliente = Database['public']['Functions']['clientes_da_loja']['Returns'][number];
interface Ficha {
  enderecos: {
    rua?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    referencia?: string;
  }[];
  produtos: { nome: string; quantidade: number }[];
  pedidos: { numero: number; tipo: string; situacao: string; total: number; em: string }[];
}

const CANAIS: Record<string, string> = {
  online: 'Loja online',
  delivery: 'Delivery',
  retirada: 'Retirada',
};
const ORDENS = [
  { value: 'recentes', label: 'Último pedido' },
  { value: 'gasto', label: 'Quem mais gastou' },
  { value: 'pedidos', label: 'Quem mais pediu' },
];
const SEGMENTOS: { value: Segmento; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'frequentes', label: 'Frequentes' },
  { value: 'novos', label: 'Novos' },
  { value: 'sumidos', label: 'Sumidos' },
];
const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const semAcento = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const zap = (tel: string) => `https://wa.me/55${tel}`;

/** Clientes da loja (delivery, retirada e online): os dados são do restaurante. */
export function Clientes({
  supabase,
  loja,
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
}) {
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [erro, setErro] = useState('');
  const [segmento, setSegmento] = useState<Segmento>('todos');
  const [ordem, setOrdem] = useState('recentes');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<Cliente | null>(null);

  useEffect(() => {
    let ativo = true;
    void supabase.rpc('clientes_da_loja', { p_restaurant_id: loja.id }).then(({ data, error }) => {
      if (!ativo) return;
      if (error) setErro('Não conseguimos carregar os clientes agora.');
      else setClientes(data);
    });
    return () => {
      ativo = false;
    };
  }, [supabase, loja.id]);

  const agora = useMemo(() => new Date(), []);
  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    const lista = (clientes ?? []).filter(
      (c) =>
        noSegmento(c, segmento, agora) &&
        (!termo ||
          semAcento(`${c.nome ?? ''} ${c.telefone} ${c.bairro ?? ''}`).includes(termo) ||
          c.telefone.includes(termo.replace(/\D/g, '') || '§')),
    );
    const por = {
      recentes: (a: Cliente, b: Cliente) => b.ultimo_em.localeCompare(a.ultimo_em),
      gasto: (a: Cliente, b: Cliente) => Number(b.total_cents) - Number(a.total_cents),
      pedidos: (a: Cliente, b: Cliente) => b.pedidos - a.pedidos,
    }[ordem as 'recentes'];
    return [...lista].sort(por);
  }, [clientes, segmento, ordem, busca, agora]);

  const resumo = useMemo(() => {
    const l = clientes ?? [];
    return {
      total: l.length,
      novos: l.filter((c) => noSegmento(c, 'novos', agora)).length,
      voltaram: l.length
        ? Math.round((l.filter((c) => c.pedidos >= 2).length / l.length) * 100)
        : 0,
      sumidos: l.filter((c) => noSegmento(c, 'sumidos', agora)).length,
    };
  }, [clientes, agora]);

  function exportar() {
    const linhas: (string | number)[][] = [
      [
        'Nome',
        'Celular',
        'Bairro',
        'Pedidos',
        'Total gasto (R$)',
        'Ticket médio (R$)',
        'Primeiro pedido',
        'Último pedido',
        'Canais',
        'Favorito',
      ],
      ...visiveis.map((c) => [
        c.nome ?? '',
        formatarTelefone(c.telefone),
        c.bairro ?? '',
        c.pedidos,
        reaisNaPlanilha(Number(c.total_cents)),
        reaisNaPlanilha(Math.round(Number(c.total_cents) / Math.max(1, c.pedidos))),
        data(c.primeiro_em),
        data(c.ultimo_em),
        c.canais.map((x) => CANAIS[x] ?? x).join(', '),
        c.favorito ?? '',
      ]),
    ];
    const url = URL.createObjectURL(new Blob([csv(linhas)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Clientes - ${loja.name}.csv`.replace(/[\\/:*?"<>|]/g, '');
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <Titulo
        titulo="Clientes"
        texto="Quem pediu por delivery, retirada e loja online. Os dados são seus."
        acoes={
          <Button variant="secondary" disabled={!visiveis.length} onClick={exportar}>
            Exportar planilha
          </Button>
        }
      />
      <Alert>{erro}</Alert>

      <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { t: 'Clientes', v: String(resumo.total) },
          { t: 'Novos (30 dias)', v: String(resumo.novos) },
          { t: 'Voltaram a pedir', v: `${resumo.voltaram}%` },
          { t: 'Sumidos (30+ dias)', v: String(resumo.sumidos) },
        ].map((c) => (
          <li
            key={c.t}
            className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4"
          >
            <span className="text-caption text-ink-muted">{c.t}</span>
            <span className="font-display text-title-section text-ink tabular-nums">{c.v}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-3">
        <SegmentedControl
          label="Grupo"
          className="flex-wrap"
          options={SEGMENTOS}
          value={segmento}
          onChange={setSegmento}
        />
        <SelectField
          label="Ordenar por"
          className="w-52"
          options={ORDENS}
          value={ordem}
          onChange={setOrdem}
        />
        <TextField
          label="Buscar"
          placeholder="Nome, celular ou bairro"
          className="min-w-56 flex-1"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {!clientes ? (
        <p className="text-body text-ink-muted">{erro ? '' : 'Carregando os clientes…'}</p>
      ) : visiveis.length === 0 ? (
        <p className="text-body text-ink-muted">
          {clientes.length
            ? 'Ninguém neste grupo.'
            : 'Os clientes aparecem aqui depois dos primeiros pedidos de delivery, retirada ou loja online.'}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3 lg:hidden">
            {visiveis.map((c) => (
              <li key={c.telefone}>
                <button
                  type="button"
                  onClick={() => setAberto(c)}
                  className="flex w-full flex-col gap-1 rounded-lg border border-line bg-surface p-4 text-left"
                >
                  <span className="text-body-strong text-ink">{c.nome ?? 'Cliente'}</span>
                  <span className="text-caption text-ink-muted">
                    {formatarTelefone(c.telefone)}
                    {c.bairro ? ` · ${c.bairro}` : ''}
                  </span>
                  <span className="text-caption text-ink">
                    {c.pedidos} pedidos · {formatarPreco(Number(c.total_cents))} · último em{' '}
                    {data(c.ultimo_em)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border border-line lg:block">
            <table className="w-full text-left text-body">
              <thead className="bg-surface-strong text-label text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-normal">Cliente</th>
                  <th className="px-4 py-3 font-normal">Bairro</th>
                  <th className="px-4 py-3 text-right font-normal">Pedidos</th>
                  <th className="px-4 py-3 text-right font-normal">Total gasto</th>
                  <th className="px-4 py-3 text-right font-normal">Ticket médio</th>
                  <th className="px-4 py-3 font-normal">Último pedido</th>
                  <th className="px-4 py-3 font-normal">Favorito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {visiveis.map((c) => (
                  <tr
                    key={c.telefone}
                    className="cursor-pointer hover:bg-surface-strong"
                    onClick={() => setAberto(c)}
                  >
                    <td className="px-4 py-3">
                      <button type="button" className="text-left" onClick={() => setAberto(c)}>
                        <span className="block text-body-strong text-ink">
                          {c.nome ?? 'Cliente'}
                        </span>
                        <span className="text-caption text-ink-muted">
                          {formatarTelefone(c.telefone)}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{c.bairro ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.pedidos}</td>
                    <td className="px-4 py-3 text-right text-body-strong tabular-nums">
                      {formatarPreco(Number(c.total_cents))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatarPreco(Math.round(Number(c.total_cents) / Math.max(1, c.pedidos)))}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{data(c.ultimo_em)}</td>
                    <td className="px-4 py-3 text-ink-muted">{c.favorito ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aberto && (
        <FichaDoCliente
          supabase={supabase}
          lojaId={loja.id}
          cliente={aberto}
          onFechar={() => setAberto(null)}
        />
      )}
    </div>
  );
}

function FichaDoCliente({
  supabase,
  lojaId,
  cliente,
  onFechar,
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
  cliente: Cliente;
  onFechar: () => void;
}) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  useEffect(() => {
    void supabase
      .rpc('cliente_da_loja', { p_restaurant_id: lojaId, p_telefone: cliente.telefone })
      .then(({ data }) => setFicha(data as unknown as Ficha));
  }, [supabase, lojaId, cliente.telefone]);

  return (
    <Sheet
      open
      onClose={onFechar}
      title={cliente.nome ?? 'Cliente'}
      footer={
        <a href={zap(cliente.telefone)} target="_blank" rel="noreferrer">
          <Button className="h-target-pdv w-full">
            WhatsApp · {formatarTelefone(cliente.telefone)}
          </Button>
        </a>
      }
    >
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-3">
          {[
            { t: 'Pedidos', v: String(cliente.pedidos) },
            { t: 'Total gasto', v: formatarPreco(Number(cliente.total_cents)) },
            { t: 'Cliente desde', v: data(cliente.primeiro_em) },
            { t: 'Último pedido', v: data(cliente.ultimo_em) },
          ].map((x) => (
            <div key={x.t}>
              <dt className="text-caption text-ink-muted">{x.t}</dt>
              <dd className="text-body-strong text-ink">{x.v}</dd>
            </div>
          ))}
        </dl>
        {!ficha ? (
          <p className="text-body text-ink-muted">Abrindo a ficha…</p>
        ) : (
          <>
            {ficha.produtos.length > 0 && (
              <section className="flex flex-col gap-1">
                <h3 className="text-label text-ink-muted">O que mais pede</h3>
                <p className="text-body text-ink">
                  {ficha.produtos.map((p) => `${p.nome} (${p.quantidade})`).join(', ')}
                </p>
              </section>
            )}
            {ficha.enderecos.length > 0 && (
              <section className="flex flex-col gap-1">
                <h3 className="text-label text-ink-muted">Endereços</h3>
                <ul className="flex flex-col gap-1">
                  {ficha.enderecos.map((e, i) => (
                    <li key={i} className="text-body text-ink">
                      {e.rua}, {e.numero}
                      {e.complemento ? ` (${e.complemento})` : ''} · {e.bairro}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="flex flex-col gap-1">
              <h3 className="text-label text-ink-muted">Últimos pedidos</h3>
              <ul className="flex flex-col divide-y divide-line">
                {ficha.pedidos.map((p) => (
                  <li
                    key={`${p.em}-${p.numero}`}
                    className="flex justify-between gap-3 py-2 text-body"
                  >
                    <span className="text-ink">
                      {data(p.em)} · #{String(p.numero).padStart(3, '0')} ·{' '}
                      {CANAIS[p.tipo] ?? p.tipo}
                      {p.situacao === 'cancelado' ? ' · cancelado' : ''}
                    </span>
                    <span className="text-ink-muted tabular-nums">{formatarPreco(p.total)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </Sheet>
  );
}
