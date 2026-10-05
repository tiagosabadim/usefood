import { formatarPreco, formatarTelefone } from '@usefood/core';
import { canalUnico, type AppSupabaseClient } from '@usefood/db';
import { Alert, Button, Chip, Panel, Sheet, TextField } from '@usefood/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { tocarAviso } from './tela-escura';

interface PedidoOnline {
  id: string;
  number: number;
  type: string;
  created_at: string;
  notes: string | null;
  order_items: {
    id: string;
    product_name: string;
    quantity: number;
    variant_name: string | null;
    total_cents: number;
  }[];
  tabs: {
    customer_name: string | null;
    customer_phone: string | null;
    delivery_address: {
      rua?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      referencia?: string;
    } | null;
    delivery_fee_cents: number;
    total_cents: number;
    expected_method: string | null;
    change_for_cents: number | null;
  } | null;
}

const PAGAMENTO: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Crédito',
  debito: 'Débito',
};
const MOTIVOS = [
  'Fora da área de entrega',
  'Produto esgotado',
  'Loja muito cheia agora',
  'Vamos fechar',
];

/** Faixa no topo do PDV com os pedidos online esperando resposta, com bipe a cada pedido novo. */
export function PedidosOnline({
  supabase,
  lojaId,
  emLinha = false,
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
  /** Mostra a lista na própria tela (menu Online do PDV), sem a faixa amarela. */
  emLinha?: boolean;
}) {
  const [pedidos, setPedidos] = useState<PedidoOnline[]>([]);
  const [aberto, setAberto] = useState(false);
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const audio = useRef<AudioContext | null>(null);
  const conhecidos = useRef<Set<string> | null>(null);

  // O navegador só libera som depois de um toque na tela: prepara o som no primeiro toque
  useEffect(() => {
    const liberar = () => {
      audio.current ??= new AudioContext();
    };
    window.addEventListener('pointerdown', liberar, { once: true });
    return () => window.removeEventListener('pointerdown', liberar);
  }, []);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select(
        'id, number, type, created_at, notes, order_items(id, product_name, quantity, variant_name, total_cents), tabs(customer_name, customer_phone, delivery_address, delivery_fee_cents, total_cents, expected_method, change_for_cents)',
      )
      .eq('restaurant_id', lojaId)
      .eq('status', 'aguardando')
      .order('created_at');
    if (!data) return;
    const lista = data as unknown as PedidoOnline[];
    const ids = new Set(lista.map((p) => p.id));
    if (conhecidos.current && audio.current && [...ids].some((id) => !conhecidos.current!.has(id)))
      tocarAviso(audio.current);
    conhecidos.current = ids;
    setPedidos(lista);
  }, [supabase, lojaId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    const canal = canalUnico(supabase, `online-${lojaId}`)
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
      clearInterval(t);
      void supabase.removeChannel(canal);
    };
  }, [supabase, lojaId, carregar]);

  async function aceitar(id: string) {
    setErro('');
    setOcupado(id);
    const { error } = await supabase.rpc('aceitar_pedido', { p_pedido: id });
    setOcupado(null);
    if (error) setErro(error.message);
    await carregar();
  }

  async function recusar(id: string) {
    setErro('');
    setOcupado(id);
    const { error } = await supabase.rpc('recusar_pedido', { p_pedido: id, p_motivo: motivo });
    setOcupado(null);
    if (error) return setErro(error.message);
    setRecusando(null);
    setMotivo('');
    await carregar();
  }

  const lista = (
    <>
      <Alert>{erro}</Alert>
      {pedidos.length === 0 && <p className="text-body text-ink-muted">Nenhum pedido esperando.</p>}
      {pedidos.map((p) => {
        const t = p.tabs;
        const end = t?.delivery_address;
        return (
          <Panel
            key={p.id}
            title={`${t?.customer_name ?? 'Cliente'} · ${p.type === 'delivery' ? 'Entrega' : 'Retirada'}`}
          >
            <p className="text-caption text-ink-muted">
              Pedido #{String(p.number).padStart(3, '0')} ·{' '}
              {new Date(p.created_at).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {t?.customer_phone && ` · ${formatarTelefone(t.customer_phone)}`}
            </p>
            {end && (
              <p className="text-body text-ink">
                {end.rua}, {end.numero}
                {end.complemento ? ` (${end.complemento})` : ''} · {end.bairro}
                {end.referencia ? ` · ${end.referencia}` : ''}
              </p>
            )}
            <ul className="flex flex-col gap-1 text-body text-ink">
              {p.order_items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>
                    {i.quantity}× {i.product_name}
                    {i.variant_name ? ` · ${i.variant_name}` : ''}
                  </span>
                  <span className="text-ink-muted tabular-nums">
                    {formatarPreco(i.total_cents)}
                  </span>
                </li>
              ))}
            </ul>
            {p.notes && (
              <p className="rounded-sm bg-sun px-2 py-1 text-body text-sun-ink">Obs.: {p.notes}</p>
            )}
            <p className="text-body-strong text-ink">
              Total {formatarPreco(t?.total_cents ?? 0)}
              {t?.delivery_fee_cents ? ` (entrega ${formatarPreco(t.delivery_fee_cents)})` : ''} ·
              paga em {PAGAMENTO[t?.expected_method ?? ''] ?? '—'}
              {t?.change_for_cents ? `, troco para ${formatarPreco(t.change_for_cents)}` : ''}
            </p>
            {recusando === p.id ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {MOTIVOS.map((m) => (
                    <Chip key={m} selected={motivo === m} onClick={() => setMotivo(m)}>
                      {m}
                    </Chip>
                  ))}
                </div>
                <TextField
                  label="Motivo (o cliente vê)"
                  maxLength={200}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    loading={ocupado === p.id}
                    disabled={!motivo.trim()}
                    onClick={() => void recusar(p.id)}
                  >
                    Recusar pedido
                  </Button>
                  <Button variant="ghost" onClick={() => setRecusando(null)}>
                    Voltar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Button
                  className="h-target-pdv"
                  loading={ocupado === p.id}
                  onClick={() => void aceitar(p.id)}
                >
                  Aceitar
                </Button>
                <Button variant="ghost" className="text-danger" onClick={() => setRecusando(p.id)}>
                  Recusar
                </Button>
              </div>
            )}
          </Panel>
        );
      })}
    </>
  );

  // Dentro do PDV (menu Online): a lista direto na tela, sem a faixa
  if (emLinha) return <div className="flex flex-col gap-4">{lista}</div>;

  if (pedidos.length === 0 && !aberto) return null;

  return (
    <>
      {pedidos.length > 0 && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="flex items-center justify-between gap-3 rounded-md bg-sun px-4 py-3 text-left text-sun-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="text-body-strong">
            {pedidos.length === 1
              ? '1 pedido online esperando a loja'
              : `${pedidos.length} pedidos online esperando a loja`}
          </span>
          <span className="text-label underline">Ver</span>
        </button>
      )}
      {aberto && (
        <Sheet open onClose={() => setAberto(false)} title="Pedidos online">
          {lista}
        </Sheet>
      )}
    </>
  );
}
