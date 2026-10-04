import { formatarPreco, tempoDesde } from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { Button, Icon, StatusPill, type StatusTone } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { useAgora } from './agora';

interface Rodada {
  id: string;
  number: number;
  status: string;
  created_at: string;
  order_items: {
    id: string;
    product_name: string;
    quantity: number;
    variant_name: string | null;
    total_cents: number;
    to_go: boolean;
  }[];
}
interface ContaDaMesa {
  identifier: string;
  subtotal_cents: number;
  paid_cents: number;
  opened_at: string;
}

const SITUACAO: Record<string, { texto: string; tom: StatusTone }> = {
  em_preparo: { texto: 'Em preparo', tom: 'neutro' },
  pronto: { texto: 'Pronto', tom: 'destaque' },
  concluido: { texto: 'Entregue', tom: 'sucesso' },
  cancelado: { texto: 'Cancelado', tom: 'erro' },
};

/** Mesa ocupada: rodadas lançadas, total de consumo e Nova rodada. */
export function Mesa({
  supabase,
  contaId,
  onNovaRodada,
  onVoltar,
}: {
  supabase: AppSupabaseClient;
  contaId: string;
  onNovaRodada: (mesa: string) => void;
  onVoltar: () => void;
}) {
  const [conta, setConta] = useState<ContaDaMesa | null>(null);
  const [rodadas, setRodadas] = useState<Rodada[] | null>(null);
  const agora = useAgora();

  useEffect(() => {
    let ativo = true;
    void Promise.all([
      supabase
        .from('tabs')
        .select('identifier, subtotal_cents, paid_cents, opened_at')
        .eq('id', contaId)
        .single(),
      supabase
        .from('orders')
        .select(
          'id, number, status, created_at, order_items(id, product_name, quantity, variant_name, total_cents, to_go)',
        )
        .eq('tab_id', contaId)
        .order('created_at'),
    ]).then(([c, r]) => {
      if (!ativo) return;
      setConta(c.data);
      setRodadas(r.data ?? []);
    });
    return () => {
      ativo = false;
    };
  }, [supabase, contaId]);

  if (!conta || !rodadas) return <p className="text-body text-ink-muted">Abrindo a mesa…</p>;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onVoltar}
        className="flex min-h-target-min items-center gap-1 self-start text-label text-ink-muted"
      >
        <Icon name="voltar" size={18} /> Salão
      </button>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-title-screen text-ink">Mesa {conta.identifier}</h2>
        <span className="text-caption text-ink-muted">
          aberta {tempoDesde(conta.opened_at, agora)}
        </span>
      </div>

      <ul className="flex flex-col gap-3">
        {rodadas.map((r, i) => {
          const situacao = SITUACAO[r.status] ?? { texto: r.status, tom: 'neutro' as StatusTone };
          return (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-label text-ink">
                  Rodada {i + 1} ·{' '}
                  {new Date(r.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <StatusPill tone={situacao.tom}>{situacao.texto}</StatusPill>
              </div>
              <ul className="flex flex-col gap-1">
                {r.order_items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3 text-body text-ink">
                    <span>
                      {item.quantity}× {item.product_name}
                      {item.variant_name ? ` · ${item.variant_name}` : ''}
                      {item.to_go ? ' · pra viagem' : ''}
                    </span>
                    <span className="text-ink-muted tabular-nums">
                      {formatarPreco(item.total_cents)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-canvas py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-body-strong text-ink">Consumo</span>
          <span className="font-display text-display text-ink tabular-nums">
            {formatarPreco(conta.subtotal_cents)}
          </span>
        </div>
        <p className="text-caption text-ink-muted">
          A taxa de serviço entra no fechamento. Quem fecha a conta é o caixa.
          {conta.paid_cents > 0 && ` Já pago: ${formatarPreco(conta.paid_cents)}.`}
        </p>
        <Button className="h-target-pdv" onClick={() => onNovaRodada(conta.identifier)}>
          Nova rodada
        </Button>
      </div>
    </div>
  );
}
