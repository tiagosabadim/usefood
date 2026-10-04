import { rotuloDoPapel, tempoDesde, type Papel } from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { Salao } from '@usefood/pedidos';
import { Alert, Button, SegmentedControl } from '@usefood/ui';
import { useState } from 'react';
import { useAgora } from './agora';
import { Lancar } from './lancar';
import { Mesa } from './mesa';
import { useProntos } from './prontos';

type Tela =
  | { tipo: 'salao' }
  | { tipo: 'mesa'; contaId: string }
  | { tipo: 'lancar'; mesa: string; contaId: string | null };

/** Comanda do garçom: Salão, mesa, nova rodada e prontos para levar. */
export function Comanda({
  supabase,
  lojaId,
  loja,
  pessoa,
  onBloquear,
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
  loja: string;
  pessoa: { nome: string; papel: Papel };
  onBloquear: () => void;
}) {
  const [aba, setAba] = useState<'salao' | 'prontos'>('salao');
  const [tela, setTela] = useState<Tela>({ tipo: 'salao' });
  const [aviso, setAviso] = useState('');
  const [entregando, setEntregando] = useState<string | null>(null);
  const { prontos, recarregar } = useProntos(supabase, lojaId);
  const agora = useAgora();

  async function entregar(pedidoId: string) {
    setEntregando(pedidoId);
    await supabase.rpc('marcar_entregue', { p_pedido: pedidoId });
    setEntregando(null);
    await recarregar();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-5 pt-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-caption text-ink-muted">{loja}</p>
          <p className="truncate text-body-strong text-ink">
            {pessoa.nome} · {rotuloDoPapel(pessoa.papel)}
          </p>
        </div>
        <Button variant="ghost" onClick={onBloquear}>
          Bloquear
        </Button>
      </header>

      {tela.tipo === 'salao' && (
        <SegmentedControl
          label="Comanda"
          className="self-stretch [&>button]:flex-1"
          options={[
            { value: 'salao', label: 'Salão' },
            { value: 'prontos', label: prontos.length ? `Prontos (${prontos.length})` : 'Prontos' },
          ]}
          value={aba}
          onChange={setAba}
        />
      )}

      <Alert tone="sucesso">{aviso}</Alert>

      {tela.tipo === 'salao' && aba === 'salao' && (
        <Salao
          supabase={supabase}
          lojaId={lojaId}
          onMesaLivre={(mesa) => {
            setAviso('');
            setTela({ tipo: 'lancar', mesa, contaId: null });
          }}
          onMesaOcupada={(contaId) => {
            setAviso('');
            setTela({ tipo: 'mesa', contaId });
          }}
        />
      )}

      {tela.tipo === 'salao' && aba === 'prontos' && (
        <section aria-label="Prontos para levar" className="flex flex-col gap-3 pb-6">
          {prontos.length === 0 ? (
            <p className="text-body text-ink-muted">
              Nada pronto agora. O celular vibra quando a cozinha terminar um pedido.
            </p>
          ) : (
            prontos.map((p) => (
              <article
                key={p.id}
                className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-title-section text-ink">Mesa {p.identifier}</h3>
                  <span className="text-caption text-ink-muted">
                    pronto {p.ready_at ? tempoDesde(p.ready_at, agora) : ''}
                  </span>
                </div>
                <ul className="flex flex-col gap-1 text-body text-ink">
                  {p.order_items.map((i) => (
                    <li key={i.id}>
                      {i.quantity}× {i.product_name}
                      {i.variant_name ? ` · ${i.variant_name}` : ''}
                    </li>
                  ))}
                </ul>
                <Button
                  className="h-target-pdv"
                  loading={entregando === p.id}
                  onClick={() => void entregar(p.id)}
                >
                  Entregue
                </Button>
              </article>
            ))
          )}
        </section>
      )}

      {tela.tipo === 'mesa' && (
        <Mesa
          supabase={supabase}
          contaId={tela.contaId}
          onVoltar={() => setTela({ tipo: 'salao' })}
          onNovaRodada={(mesa) => setTela({ tipo: 'lancar', mesa, contaId: tela.contaId })}
        />
      )}

      {tela.tipo === 'lancar' && (
        <Lancar
          supabase={supabase}
          lojaId={lojaId}
          mesa={tela.mesa}
          onVoltar={() =>
            setTela(tela.contaId ? { tipo: 'mesa', contaId: tela.contaId } : { tipo: 'salao' })
          }
          onEnviado={(contaId, numero) => {
            setAviso(
              `Mesa ${tela.mesa}: pedido #${String(numero).padStart(3, '0')} enviado para a cozinha.`,
            );
            setTela({ tipo: 'mesa', contaId });
          }}
        />
      )}
    </main>
  );
}
