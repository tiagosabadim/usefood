import { useAppContext } from '@usefood/app';
import { fraseDoPedido, type SituacaoDoPedido } from '@usefood/core';
import { Icon } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { lerConta, pedidosRecentes } from '../guardado';
import { navegar } from '../rotas';

interface EmAndamento {
  token: string;
  numero: number;
  tipo: string;
  situacao: SituacaoDoPedido;
}

const ENCERRADO: SituacaoDoPedido[] = ['concluido', 'cancelado'];

/** Card no topo da loja quando o cliente tem pedido em andamento (aguardando, em preparo, saiu…). */
export function PedidoEmAndamento({ lojaSlug, base }: { lojaSlug: string; base: string }) {
  const { supabase } = useAppContext();
  const [pedidos, setPedidos] = useState<EmAndamento[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let ativo = true;
    const carregar = async () => {
      const recentes = pedidosRecentes(lerConta(), lojaSlug, 12);
      const respostas = await Promise.all(
        recentes.map(async (p) => {
          const { data } = await supabase.rpc('acompanhar_pedido', { p_token: p.token });
          const d = data as { numero: number; tipo: string; situacao: SituacaoDoPedido } | null;
          return d && !ENCERRADO.includes(d.situacao)
            ? { token: p.token, numero: d.numero, tipo: d.tipo, situacao: d.situacao }
            : null;
        }),
      );
      if (ativo) setPedidos(respostas.filter((r): r is EmAndamento => r !== null));
    };
    void carregar();
    const t = setInterval(() => void carregar(), 15_000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [supabase, lojaSlug]);

  if (pedidos.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {pedidos.map((p) => (
        <button
          key={p.token}
          type="button"
          onClick={() => navegar(`${base}/pedido/${p.token}`)}
          className="flex items-center gap-3 rounded-lg bg-brand p-4 text-left text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-brand-ink/15">
            <Icon name={p.situacao === 'em_entrega' ? 'moto' : 'pedidos'} size={22} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-caption opacity-90">
              Pedido #{String(p.numero).padStart(3, '0')}
            </span>
            <span className="text-body-strong">{fraseDoPedido(p.tipo, p.situacao)}</span>
          </span>
          <span className="text-label underline">Acompanhar</span>
        </button>
      ))}
    </div>
  );
}
