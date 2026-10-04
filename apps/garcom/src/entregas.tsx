import { formatarPreco, formatarTelefone, rotuloDoPapel, type Papel } from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { Alert, Button, Panel, SegmentedControl, TextField } from '@usefood/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Entrega {
  id: string;
  number: number;
  status: string;
  courier_id: string | null;
  tabs: {
    customer_name: string | null;
    customer_phone: string | null;
    delivery_address: {
      rua?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      referencia?: string;
    } | null;
    total_cents: number;
    paid_cents: number;
    expected_method: string | null;
    change_for_cents: number | null;
  } | null;
}

const PAGAMENTO: Record<string, string> = {
  dinheiro: 'dinheiro',
  pix: 'Pix',
  credito: 'cartão de crédito',
  debito: 'cartão de débito',
};
const JANELA_MS = 12 * 3_600_000;

function endereco(e: Entrega): string {
  const a = e.tabs?.delivery_address;
  if (!a) return 'Endereço não informado';
  return `${a.rua ?? ''}, ${a.numero ?? ''}${a.complemento ? ` (${a.complemento})` : ''} · ${a.bairro ?? ''}`;
}

function cobrar(e: Entrega): string {
  const t = e.tabs;
  if (!t) return '';
  const falta = t.total_cents - t.paid_cents;
  if (falta <= 0) return 'Já pago';
  const troco = t.change_for_cents ? ` · troco para ${formatarPreco(t.change_for_cents)}` : '';
  return `Cobrar ${formatarPreco(falta)} em ${PAGAMENTO[t.expected_method ?? ''] ?? 'combinado'}${troco}`;
}

/** Tela do entregador: pedidos prontos para sair e as entregas dele, concluídas com o código do cliente. */
export function Entregas({
  supabase,
  lojaId,
  loja,
  pessoa,
  euId,
  onSair,
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
  loja: string;
  pessoa: { nome: string; papel: Papel };
  euId: string;
  onSair: () => void;
}) {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [aba, setAba] = useState<'prontos' | 'minhas'>('prontos');
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const conhecidos = useRef<Set<string> | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select(
        'id, number, status, courier_id, tabs(customer_name, customer_phone, delivery_address, total_cents, paid_cents, expected_method, change_for_cents)',
      )
      .eq('restaurant_id', lojaId)
      .eq('type', 'delivery')
      .in('status', ['pronto', 'em_entrega'])
      .gte('created_at', new Date(Date.now() - JANELA_MS).toISOString())
      .order('ready_at');
    if (!data) return;
    const lista = data as unknown as Entrega[];
    const prontos = new Set(lista.filter((e) => e.status === 'pronto').map((e) => e.id));
    if (conhecidos.current && [...prontos].some((id) => !conhecidos.current!.has(id)))
      navigator.vibrate?.([200, 100, 200]);
    conhecidos.current = prontos;
    setEntregas(lista);
  }, [supabase, lojaId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    const canal = supabase
      .channel(`entregas-${lojaId}`)
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

  async function sair(e: Entrega) {
    setErro('');
    setAviso('');
    setOcupado(e.id);
    const { error } = await supabase.rpc('sair_para_entrega', { p_pedido: e.id });
    setOcupado(null);
    if (error) return setErro(error.message);
    setAviso(`Pedido #${String(e.number).padStart(3, '0')} com você. Boa entrega!`);
    setAba('minhas');
    await carregar();
  }

  async function confirmar(e: Entrega) {
    setErro('');
    setAviso('');
    setOcupado(e.id);
    const { error } = await supabase.rpc('confirmar_entrega', {
      p_pedido: e.id,
      p_codigo: codigos[e.id]?.trim() || null,
    });
    setOcupado(null);
    if (error) return setErro(error.message);
    setAviso(`Pedido #${String(e.number).padStart(3, '0')} entregue.`);
    await carregar();
  }

  const prontos = entregas.filter((e) => e.status === 'pronto');
  const minhas = entregas.filter((e) => e.status === 'em_entrega' && e.courier_id === euId);
  const mapa = (e: Entrega) => {
    const a = e.tabs?.delivery_address;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a?.rua ?? ''} ${a?.numero ?? ''}, ${a?.bairro ?? ''}, ${a?.cidade ?? ''}`)}`;
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-5 pt-4 pb-8">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-caption text-ink-muted">{loja}</p>
          <p className="truncate text-body-strong text-ink">
            {pessoa.nome} · {rotuloDoPapel(pessoa.papel)}
          </p>
        </div>
        <Button variant="ghost" onClick={onSair}>
          Sair
        </Button>
      </header>
      <SegmentedControl
        label="Entregas"
        className="self-stretch [&>button]:flex-1"
        options={[
          { value: 'prontos', label: prontos.length ? `Prontos (${prontos.length})` : 'Prontos' },
          { value: 'minhas', label: minhas.length ? `Comigo (${minhas.length})` : 'Comigo' },
        ]}
        value={aba}
        onChange={setAba}
      />
      <Alert>{erro}</Alert>
      <Alert tone="sucesso">{aviso}</Alert>

      {aba === 'prontos' &&
        (prontos.length === 0 ? (
          <p className="text-body text-ink-muted">
            Nenhum pedido pronto para sair. O celular vibra quando a cozinha terminar um.
          </p>
        ) : (
          prontos.map((e) => (
            <Panel
              key={e.id}
              title={`${e.tabs?.customer_name ?? 'Cliente'} · #${String(e.number).padStart(3, '0')}`}
            >
              <p className="text-body text-ink">{endereco(e)}</p>
              <p className="text-body-strong text-ink">{cobrar(e)}</p>
              <Button
                className="h-target-pdv"
                loading={ocupado === e.id}
                onClick={() => void sair(e)}
              >
                Saí para entrega
              </Button>
            </Panel>
          ))
        ))}

      {aba === 'minhas' &&
        (minhas.length === 0 ? (
          <p className="text-body text-ink-muted">Nenhuma entrega com você agora.</p>
        ) : (
          minhas.map((e) => {
            const precisaCodigo = Boolean(e.tabs?.customer_phone);
            const codigo = codigos[e.id] ?? '';
            return (
              <Panel
                key={e.id}
                title={`${e.tabs?.customer_name ?? 'Cliente'} · #${String(e.number).padStart(3, '0')}`}
              >
                <p className="text-body text-ink">{endereco(e)}</p>
                {e.tabs?.delivery_address?.referencia && (
                  <p className="text-caption text-ink-muted">
                    Referência: {e.tabs.delivery_address.referencia}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <a href={mapa(e)} target="_blank" rel="noreferrer">
                    <Button variant="secondary">Abrir no mapa</Button>
                  </a>
                  {e.tabs?.customer_phone && (
                    <a href={`tel:${e.tabs.customer_phone}`}>
                      <Button variant="secondary">
                        Ligar {formatarTelefone(e.tabs.customer_phone)}
                      </Button>
                    </a>
                  )}
                </div>
                <p className="text-body-strong text-ink">{cobrar(e)}</p>
                {precisaCodigo && (
                  <TextField
                    label="Código do cliente"
                    hint="Peça ao cliente os 4 últimos números do celular dele."
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    value={codigo}
                    onChange={(ev) =>
                      setCodigos({
                        ...codigos,
                        [e.id]: ev.target.value.replace(/\D/g, '').slice(0, 4),
                      })
                    }
                  />
                )}
                <Button
                  className="h-target-pdv"
                  loading={ocupado === e.id}
                  disabled={precisaCodigo && codigo.length !== 4}
                  onClick={() => void confirmar(e)}
                >
                  Confirmar entrega
                </Button>
              </Panel>
            );
          })
        ))}
    </main>
  );
}
