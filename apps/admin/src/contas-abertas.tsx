import { formatarPreco, rotuloDaConta, rotuloDoTipo, tempoDesde } from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { Button, EmptyState, StatusPill } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { rotuloDoMetodo, type Conta } from './cobranca';

type ContaNaLista = Conta & { opened_at: string };
interface Rodada {
  id: string;
  number: number;
  created_at: string;
  status: string;
  order_items: {
    id: string;
    product_name: string;
    quantity: number;
    variant_name: string | null;
    notes: string | null;
    total_cents: number;
  }[];
}

const CAMPOS =
  'id, type, identifier_type, identifier, subtotal_cents, service_fee_cents, total_cents, paid_cents, expected_method, change_for_cents, opened_at';

/** Contas que ainda não foram pagas: mesas consumindo, pedidos a entregar e a retirar. */
export function ContasAbertas({
  supabase,
  lojaId,
  onCobrar,
  onNovaRodada,
  onQuantidade,
  abrirContaId = null,
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
  onCobrar: (conta: Conta) => void;
  onNovaRodada: (mesa: string) => void;
  onQuantidade?: (n: number) => void;
  /** Abre direto o detalhe desta conta (vindo do Salão). */
  abrirContaId?: string | null;
}) {
  const [contas, setContas] = useState<ContaNaLista[] | null>(null);
  const [aberta, setAberta] = useState<ContaNaLista | null>(null);
  const [rodadas, setRodadas] = useState<Rodada[] | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      const { data } = await supabase
        .from('tabs')
        .select(CAMPOS)
        .eq('restaurant_id', lojaId)
        .eq('status', 'aberta')
        .order('opened_at');
      if (!ativo || !data) return;
      setContas(data);
      setAgora(Date.now());
      onQuantidade?.(data.length);
    };
    void carregar();
    const t = setInterval(() => void carregar(), 15_000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [supabase, lojaId, onQuantidade]);

  useEffect(() => {
    if (!abrirContaId || !contas) return;
    const alvo = contas.find((c) => c.id === abrirContaId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (alvo) setAberta(alvo);
  }, [abrirContaId, contas]);

  useEffect(() => {
    if (!aberta) return;
    let ativo = true;
    void supabase
      .from('orders')
      .select(
        'id, number, created_at, status, order_items(id, product_name, quantity, variant_name, notes, total_cents)',
      )
      .eq('tab_id', aberta.id)
      .order('created_at')
      .then(({ data }) => {
        if (ativo) setRodadas(data ?? []);
      });
    return () => {
      ativo = false;
    };
  }, [supabase, aberta]);

  if (contas === null) return <p className="p-6 text-body text-ink-muted">Carregando as contas…</p>;

  if (aberta) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-5 lg:overflow-y-auto">
        <Button
          variant="ghost"
          className="self-start px-0"
          onClick={() => {
            setAberta(null);
            setRodadas(null);
          }}
        >
          ← Contas abertas
        </Button>
        <div className="flex flex-col gap-1">
          <span className="text-caption text-ink-muted">
            {rotuloDoTipo(aberta.type)} · aberta {tempoDesde(aberta.opened_at, agora)}
          </span>
          <span className="font-display text-display text-ink">
            {rotuloDaConta(aberta.identifier_type, aberta.identifier)}
          </span>
        </div>
        {rodadas === null ? (
          <p className="text-body text-ink-muted">Carregando os pedidos…</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rodadas.map((r, i) => (
              <li key={r.id} className="rounded-md border border-line bg-canvas p-3">
                <p className="text-caption text-ink-muted">
                  {rodadas.length > 1 ? `Rodada ${i + 1} · ` : ''}Pedido #
                  {String(r.number).padStart(3, '0')} ·{' '}
                  {new Date(r.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <ul className="mt-1 flex flex-col gap-1">
                  {r.order_items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3 text-body text-ink">
                      <span>
                        {item.quantity}× {item.product_name}
                        {item.variant_name ? ` · ${item.variant_name}` : ''}
                      </span>
                      <span className="tabular-nums text-ink-muted">
                        {formatarPreco(item.total_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-body-strong text-ink">Consumo</span>
            <span className="font-display text-display text-ink tabular-nums">
              {formatarPreco(aberta.subtotal_cents)}
            </span>
          </div>
          <Button className="h-target-pdv" onClick={() => onCobrar(aberta)}>
            Fechar conta
          </Button>
          {aberta.identifier_type === 'mesa' && (
            <Button
              variant="secondary"
              className="h-target-pdv"
              onClick={() => onNovaRodada(aberta.identifier)}
            >
              Nova rodada
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (contas.length === 0) {
    return (
      <div className="p-5">
        <EmptyState
          title="Nenhuma conta aberta"
          description="Pedidos de mesa, delivery e retirada que ainda não foram pagos aparecem aqui."
        />
      </div>
    );
  }

  return (
    <ul className="flex flex-1 flex-col gap-2 p-5 lg:overflow-y-auto">
      {contas.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => setAberta(c)}
            className="flex w-full items-center gap-3 rounded-lg border border-line bg-canvas p-4 text-left hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <div className="min-w-0 flex-1">
              <p className="text-body-strong text-ink">
                {rotuloDaConta(c.identifier_type, c.identifier)}
              </p>
              <p className="text-caption text-ink-muted">
                {rotuloDoTipo(c.type)} · {tempoDesde(c.opened_at, agora)}
                {c.expected_method &&
                  ` · paga em ${rotuloDoMetodo(c.expected_method).toLowerCase()}${
                    c.change_for_cents ? `, troco para ${formatarPreco(c.change_for_cents)}` : ''
                  }`}
              </p>
            </div>
            {c.paid_cents > 0 && <StatusPill tone="destaque">Parcial</StatusPill>}
            <span className="text-body-strong text-ink tabular-nums">
              {formatarPreco(c.total_cents)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
