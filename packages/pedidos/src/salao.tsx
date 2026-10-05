import { formatarPreco, tempoDesde } from '@usefood/core';
import { canalUnico, type AppSupabaseClient } from '@usefood/db';
import { cn, EmptyState, Icon, StatusPill } from '@usefood/ui';
import { useEffect, useState } from 'react';

interface MesaNoSalao {
  chave: string;
  label: string;
  area: string;
  conta: { id: string; total: number; abertaEm: string; parcial: boolean } | null;
  prontos: number;
}

/** Mesas: livres e ocupadas, com valor, tempo e pedidos prontos para levar. */
export function Salao({
  supabase,
  lojaId,
  onMesaLivre,
  onMesaOcupada,
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
  onMesaLivre: (label: string) => void;
  onMesaOcupada: (contaId: string) => void;
}) {
  const [mesas, setMesas] = useState<MesaNoSalao[] | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      const [cadastradas, contas, prontos] = await Promise.all([
        supabase
          .from('dining_tables')
          .select('id, label, area')
          .eq('restaurant_id', lojaId)
          .eq('is_active', true)
          .order('area')
          .order('position'),
        supabase
          .from('tabs')
          .select('id, identifier, total_cents, paid_cents, opened_at')
          .eq('restaurant_id', lojaId)
          .eq('status', 'aberta')
          .eq('identifier_type', 'mesa'),
        supabase
          .from('orders')
          .select('tab_id')
          .eq('restaurant_id', lojaId)
          .eq('status', 'pronto')
          .not('tab_id', 'is', null),
      ]);
      if (!ativo || cadastradas.error || contas.error || prontos.error) return;
      const prontosPorConta = new Map<string, number>();
      for (const p of prontos.data)
        if (p.tab_id) prontosPorConta.set(p.tab_id, (prontosPorConta.get(p.tab_id) ?? 0) + 1);
      const contaDaMesa = new Map(contas.data.map((c) => [c.identifier.trim().toLowerCase(), c]));

      const lista: MesaNoSalao[] = cadastradas.data.map((m) => {
        const c = contaDaMesa.get(m.label.trim().toLowerCase());
        contaDaMesa.delete(m.label.trim().toLowerCase());
        return {
          chave: m.id,
          label: m.label,
          area: m.area,
          conta: c
            ? { id: c.id, total: c.total_cents, abertaEm: c.opened_at, parcial: c.paid_cents > 0 }
            : null,
          prontos: c ? (prontosPorConta.get(c.id) ?? 0) : 0,
        };
      });
      // Conta aberta numa mesa que não está cadastrada (digitada no PDV): aparece em "Outras"
      for (const c of contaDaMesa.values()) {
        lista.push({
          chave: c.id,
          label: c.identifier,
          area: 'Outras',
          conta: {
            id: c.id,
            total: c.total_cents,
            abertaEm: c.opened_at,
            parcial: c.paid_cents > 0,
          },
          prontos: prontosPorConta.get(c.id) ?? 0,
        });
      }
      setMesas(lista);
      setAgora(Date.now());
    };
    void carregar();
    const canal = canalUnico(supabase, `salao-${lojaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${lojaId}` },
        () => {
          void carregar();
        },
      )
      .subscribe();
    const t = setInterval(() => void carregar(), 15_000);
    return () => {
      ativo = false;
      clearInterval(t);
      void supabase.removeChannel(canal);
    };
  }, [supabase, lojaId]);

  if (mesas === null) return <p className="text-body text-ink-muted">Carregando as mesas…</p>;
  if (mesas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma mesa cadastrada"
        description="O dono ou o gerente cadastra as mesas em Configurações. Enquanto isso, dá para lançar pedidos de mesa digitando o número."
      />
    );
  }

  const ocupadas = mesas.filter((m) => m.conta).length;
  const areas = [...new Set(mesas.map((m) => m.area))];

  return (
    <div className="flex flex-col gap-5">
      <p className="text-body text-ink-muted">
        {ocupadas === 1 ? '1 mesa ocupada' : `${ocupadas} mesas ocupadas`} ·{' '}
        {mesas.length - ocupadas} livres
      </p>
      {areas.map((area) => (
        <section key={area} className="flex flex-col gap-3" aria-label={area}>
          {areas.length > 1 && <h2 className="text-label text-ink-muted">{area}</h2>}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3">
            {mesas
              .filter((m) => m.area === area)
              .map((m) => (
                <button
                  key={m.chave}
                  type="button"
                  onClick={() => (m.conta ? onMesaOcupada(m.conta.id) : onMesaLivre(m.label))}
                  aria-label={
                    m.conta
                      ? `Mesa ${m.label}, ocupada, ${formatarPreco(m.conta.total)}${m.prontos ? `, ${m.prontos} pronto para levar` : ''}`
                      : `Mesa ${m.label}, livre`
                  }
                  className={cn(
                    'flex min-h-28 flex-col items-start justify-between gap-1 rounded-lg border p-3 text-left transition',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    m.conta
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-canvas hover:bg-surface',
                  )}
                >
                  <span className="flex w-full items-start justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex size-9 items-center justify-center rounded-pill',
                          m.conta ? 'bg-brand text-brand-ink' : 'bg-surface-strong text-ink-muted',
                        )}
                      >
                        <Icon name="mesa" size={20} />
                      </span>
                      <span className="font-display text-title-screen text-ink">{m.label}</span>
                    </span>
                    {m.prontos > 0 && <StatusPill tone="destaque">{m.prontos} pronto</StatusPill>}
                  </span>
                  {m.conta ? (
                    <span className="flex flex-col">
                      <span className="text-body-strong text-ink tabular-nums">
                        {formatarPreco(m.conta.total)}
                      </span>
                      <span className="text-caption text-ink-muted">
                        {tempoDesde(m.conta.abertaEm, agora)}
                        {m.conta.parcial && ' · parcial'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-caption text-ink-muted">Livre</span>
                  )}
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
