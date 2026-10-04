import { alertasDeImpressao, type AlertaDeImpressao } from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { Button } from '@usefood/ui';
import { useEffect, useState } from 'react';

const JANELA_MS = 30 * 60_000;

/** Avisos de impressão no PDV: computador desligado, ticket que falhou ou fila parada. */
export function AlertasDeImpressao({
  supabase,
  lojaId,
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
}) {
  const [alertas, setAlertas] = useState<AlertaDeImpressao[]>([]);
  const [dispensados, setDispensados] = useState<Set<string>>(new Set());
  const [reimprimindo, setReimprimindo] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    const verificar = async () => {
      const desde = new Date(Date.now() - JANELA_MS).toISOString();
      const [agentes, impressoras, jobs] = await Promise.all([
        supabase
          .from('print_agents')
          .select('id, name, last_seen_at, revoked_at')
          .eq('restaurant_id', lojaId)
          .is('revoked_at', null),
        supabase
          .from('printers')
          .select('id')
          .eq('restaurant_id', lojaId)
          .eq('is_active', true)
          .limit(1),
        supabase
          .from('print_jobs')
          .select(
            'id, order_id, status, created_at, error, praca:payload->>praca, identificador:payload->>identificador',
          )
          .eq('restaurant_id', lojaId)
          .neq('kind', 'teste')
          .in('status', ['pendente', 'imprimindo', 'falhou'])
          .gte('created_at', desde)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      if (!ativo || agentes.error || impressoras.error || jobs.error) return;
      setAlertas(
        alertasDeImpressao(
          agentes.data.map((a) => ({
            id: a.id,
            nome: a.name,
            vistoEm: a.last_seen_at,
            desligado: a.revoked_at !== null,
          })),
          impressoras.data.length > 0,
          jobs.data.map((j) => ({
            id: j.id,
            pedidoId: j.order_id,
            status: j.status,
            criadaEm: j.created_at,
            praca: String(j.praca ?? 'praça'),
            identificador: j.identificador ? String(j.identificador) : null,
            erro: j.error,
          })),
          Date.now(),
        ),
      );
    };
    void verificar();
    const t = setInterval(() => void verificar(), 10_000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [supabase, lojaId]);

  const dispensar = (chave: string) => setDispensados((d) => new Set(d).add(chave));

  async function reimprimir(alerta: AlertaDeImpressao) {
    if (!alerta.pedidoId) return;
    setReimprimindo(alerta.chave);
    const { error } = await supabase.rpc('reimprimir_pedido', { p_pedido: alerta.pedidoId });
    setReimprimindo(null);
    if (!error) dispensar(alerta.chave);
  }

  const visiveis = alertas.filter((a) => !dispensados.has(a.chave));
  if (visiveis.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" role="alert">
      {visiveis.map((a) => (
        <div
          key={a.chave}
          className="flex flex-wrap items-center gap-3 rounded-md bg-danger-soft px-4 py-3"
        >
          <p className="min-w-0 flex-1 text-body text-danger">{a.texto}</p>
          {a.pedidoId && (
            <Button
              variant="secondary"
              loading={reimprimindo === a.chave}
              onClick={() => void reimprimir(a)}
            >
              Reimprimir
            </Button>
          )}
          <Button variant="ghost" onClick={() => dispensar(a.chave)}>
            Dispensar
          </Button>
        </div>
      ))}
    </div>
  );
}
