import { formatarPreco, formatarTelefone } from '@usefood/core';
import { canalUnico, type AppSupabaseClient } from '@usefood/db';
import { Alert, Button, Panel, SegmentedControl, TextField } from '@usefood/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Entrega {
  id: string;
  number: number;
  status: string;
  courier_id: string | null;
  delivered_at: string | null;
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
const numero = (n: number) => `#${String(n).padStart(3, '0')}`;

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

/**
 * Entregas de delivery prontas e a caminho.
 * - "entregador" (app /garcom): Prontos e Comigo; conclui só com o código do cliente.
 * - "loja" (painel, dono/gerente/caixa): Prontos e Em entrega (todas); o código é opcional.
 */
export function ListaDeEntregas({
  supabase,
  lojaId,
  euId,
  modo,
  abaInicial = 'prontos',
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
  euId: string;
  modo: 'entregador' | 'loja';
  /** Abre já numa aba (o aviso de entregue abre em Entregues). */
  abaInicial?: 'prontos' | 'saiu' | 'entregues';
}) {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [aba, setAba] = useState<'prontos' | 'saiu' | 'entregues'>(abaInicial);
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const conhecidos = useRef<Set<string> | null>(null);
  const entreguesConhecidos = useRef<Set<string> | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select(
        'id, number, status, courier_id, delivered_at, tabs(customer_name, customer_phone, delivery_address, total_cents, paid_cents, expected_method, change_for_cents)',
      )
      .eq('restaurant_id', lojaId)
      .eq('type', 'delivery')
      .in('status', ['pronto', 'em_entrega', 'concluido'])
      .gte('created_at', new Date(Date.now() - JANELA_MS).toISOString())
      .order('ready_at');
    if (!data) return;
    const lista = data as unknown as Entrega[];
    const prontos = new Set(lista.filter((e) => e.status === 'pronto').map((e) => e.id));
    if (conhecidos.current && [...prontos].some((id) => !conhecidos.current!.has(id)))
      navigator.vibrate?.([200, 100, 200]);
    conhecidos.current = prontos;
    // Loja: avisa quando o entregador dá baixa (pedido passou para entregue)
    const entregues = lista.filter((e) => e.status === 'concluido');
    if (modo === 'loja' && entreguesConhecidos.current) {
      const novo = entregues.find((e) => !entreguesConhecidos.current!.has(e.id));
      if (novo)
        setAviso(
          `Entregue: pedido ${numero(novo.number)} · ${novo.tabs?.customer_name ?? 'cliente'}.`,
        );
    }
    entreguesConhecidos.current = new Set(entregues.map((e) => e.id));
    setEntregas(lista);
  }, [supabase, lojaId, modo]);

  useEffect(() => {
    void carregar();
    const canal = canalUnico(supabase, `entregas-${modo}-${lojaId}`)
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
  }, [supabase, lojaId, modo, carregar]);

  async function sair(e: Entrega) {
    setErro('');
    setAviso('');
    setOcupado(e.id);
    const { error } = await supabase.rpc('sair_para_entrega', { p_pedido: e.id });
    setOcupado(null);
    if (error) return setErro(error.message);
    setAviso(
      modo === 'entregador'
        ? `Pedido ${numero(e.number)} com você. Boa entrega!`
        : `Pedido ${numero(e.number)} saiu para entrega.`,
    );
    setAba('saiu');
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
    setAviso(`Pedido ${numero(e.number)} entregue.`);
    await carregar();
  }

  const prontos = entregas.filter((e) => e.status === 'pronto');
  const saiu = entregas.filter(
    (e) => e.status === 'em_entrega' && (modo === 'loja' || e.courier_id === euId),
  );
  const entregues = entregas
    .filter((e) => e.status === 'concluido' && (modo === 'loja' || e.courier_id === euId))
    .sort((x, y) => (y.delivered_at ?? '').localeCompare(x.delivered_at ?? ''));
  const mapa = (e: Entrega) => {
    const a = e.tabs?.delivery_address;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a?.rua ?? ''} ${a?.numero ?? ''}, ${a?.bairro ?? ''}, ${a?.cidade ?? ''}`)}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label="Entregas"
        className="self-stretch sm:self-start [&>button]:flex-1"
        options={[
          { value: 'prontos', label: prontos.length ? `Prontos (${prontos.length})` : 'Prontos' },
          {
            value: 'saiu',
            label:
              modo === 'entregador'
                ? saiu.length
                  ? `Comigo (${saiu.length})`
                  : 'Comigo'
                : saiu.length
                  ? `Em entrega (${saiu.length})`
                  : 'Em entrega',
          },
          {
            value: 'entregues',
            label: entregues.length ? `Entregues (${entregues.length})` : 'Entregues',
          },
        ]}
        value={aba}
        onChange={setAba}
      />
      <Alert>{erro}</Alert>
      <Alert tone="sucesso">{aviso}</Alert>

      {aba === 'prontos' &&
        (prontos.length === 0 ? (
          <p className="text-body text-ink-muted">
            Nenhum pedido de entrega pronto.{' '}
            {modo === 'entregador'
              ? 'O celular vibra quando a cozinha terminar um.'
              : 'Eles aparecem aqui quando a cozinha toca em Pronto.'}
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {prontos.map((e) => (
              <Panel
                key={e.id}
                title={`${e.tabs?.customer_name ?? 'Cliente'} · ${numero(e.number)}`}
              >
                <p className="text-body text-ink">{endereco(e)}</p>
                <p className="text-body-strong text-ink">{cobrar(e)}</p>
                <Button
                  className="h-target-pdv"
                  loading={ocupado === e.id}
                  onClick={() => void sair(e)}
                >
                  Saiu para entrega
                </Button>
              </Panel>
            ))}
          </div>
        ))}

      {aba === 'saiu' &&
        (saiu.length === 0 ? (
          <p className="text-body text-ink-muted">
            {modo === 'entregador' ? 'Nenhuma entrega com você agora.' : 'Nenhum pedido a caminho.'}
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {saiu.map((e) => {
              const temCelular = Boolean(e.tabs?.customer_phone);
              const codigo = codigos[e.id] ?? '';
              const precisaCodigo = modo === 'entregador' && temCelular;
              return (
                <Panel
                  key={e.id}
                  title={`${e.tabs?.customer_name ?? 'Cliente'} · ${numero(e.number)}`}
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
                  {temCelular && (
                    <TextField
                      label={precisaCodigo ? 'Código do cliente' : 'Código do cliente (opcional)'}
                      hint="Os 4 últimos números do celular do cliente."
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
                    disabled={
                      precisaCodigo ? codigo.length !== 4 : codigo.length > 0 && codigo.length !== 4
                    }
                    onClick={() => void confirmar(e)}
                  >
                    Confirmar entrega
                  </Button>
                </Panel>
              );
            })}
          </div>
        ))}

      {aba === 'entregues' &&
        (entregues.length === 0 ? (
          <p className="text-body text-ink-muted">
            Nenhuma entrega concluída nas últimas 12 horas.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {entregues.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-body-strong text-ink">
                    {e.tabs?.customer_name ?? 'Cliente'} · {numero(e.number)}
                  </span>
                  <span className="text-caption text-ink-muted">{endereco(e)}</span>
                </div>
                <span className="text-label text-success">
                  Entregue
                  {e.delivered_at
                    ? ` às ${new Date(e.delivered_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
