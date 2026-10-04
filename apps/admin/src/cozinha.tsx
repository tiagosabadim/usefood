import {
  cronometro,
  nivelDeAtraso,
  pendentesDaPraca,
  rotuloDaConta,
  rotuloDoTipo,
} from '@usefood/core';
import type { AppSupabaseClient, Enums } from '@usefood/db';
import { Alert, Button, EmptyState, Icon, OrderCard, SegmentedControl } from '@usefood/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface ItemDoPedido {
  id: string;
  product_name: string;
  quantity: number;
  variant_name: string | null;
  notes: string | null;
  station_id: string | null;
  prepared_at: string | null;
  order_item_modifiers: { name: string }[];
}
interface PedidoNaCozinha {
  id: string;
  number: number;
  type: Enums<'order_type'>;
  identifier_type: Enums<'identifier_type'>;
  identifier: string;
  status: Enums<'order_status'>;
  created_at: string;
  ready_at: string | null;
  notes: string | null;
  order_items: ItemDoPedido[];
}

const TODAS = 'todas';
const JANELA_MS = 12 * 3_600_000;

/** Bipe curto de dois tons quando chega pedido novo. */
function tocarAviso(contexto: AudioContext) {
  [880, 1175].forEach((frequencia, i) => {
    const oscilador = contexto.createOscillator();
    const volume = contexto.createGain();
    oscilador.frequency.value = frequencia;
    volume.gain.value = 0.15;
    oscilador.connect(volume).connect(contexto.destination);
    const inicio = contexto.currentTime + i * 0.18;
    oscilador.start(inicio);
    oscilador.stop(inicio + 0.14);
  });
}

/** Tela da cozinha (KDS): pedidos em preparo por praça, com tempo de espera, e os prontos para entregar. */
export function TelaDaCozinha({
  supabase,
  loja,
  onVoltar,
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  onVoltar: () => void;
}) {
  const chavePraca = `usefood.cozinha.praca.${loja.id}`;
  const [pracas, setPracas] = useState<{ id: string; name: string }[]>([]);
  const [praca, setPraca] = useState<string>(() => {
    try {
      return localStorage.getItem(chavePraca) ?? TODAS;
    } catch {
      return TODAS;
    }
  });
  const [pedidos, setPedidos] = useState<PedidoNaCozinha[] | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [som, setSom] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const conhecidos = useRef<Set<string> | null>(null);

  // Tela escura enquanto a cozinha estiver aberta
  useEffect(() => {
    const raiz = document.documentElement;
    const anterior = raiz.dataset.theme;
    raiz.dataset.theme = 'dark';
    return () => {
      if (anterior) raiz.dataset.theme = anterior;
      else delete raiz.dataset.theme;
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const carregar = useCallback(async () => {
    const desde = new Date(Date.now() - JANELA_MS).toISOString();
    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, number, type, identifier_type, identifier, status, created_at, ready_at, notes, order_items(id, product_name, quantity, variant_name, notes, station_id, prepared_at, order_item_modifiers(name))',
      )
      .eq('restaurant_id', loja.id)
      .in('status', ['em_preparo', 'pronto'])
      .gte('created_at', desde)
      .order('created_at');
    if (error) {
      setErro('Sem conexão com o sistema. Tentando de novo…');
      return;
    }
    setErro('');
    // Pedido novo chegou: avisa com som (a primeira carga não toca)
    const ids = new Set(data.map((p) => p.id));
    if (
      conhecidos.current &&
      audio.current &&
      [...ids].some((id) => !conhecidos.current!.has(id))
    ) {
      tocarAviso(audio.current);
    }
    conhecidos.current = ids;
    setPedidos(data);
  }, [supabase, loja.id]);

  useEffect(() => {
    void supabase
      .from('stations')
      .select('id, name')
      .eq('restaurant_id', loja.id)
      .order('position')
      .order('created_at')
      .then(({ data }) => setPracas(data ?? []));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    const canal = supabase
      .channel(`cozinha-${loja.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${loja.id}` },
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
  }, [supabase, loja.id, carregar]);

  function escolherPraca(valor: string) {
    setPraca(valor);
    try {
      localStorage.setItem(chavePraca, valor);
    } catch {
      // sem armazenamento: só não lembra da escolha
    }
  }

  function alternarSom() {
    if (!audio.current) audio.current = new AudioContext();
    const ligar = !som;
    setSom(ligar);
    if (ligar) tocarAviso(audio.current);
    else void audio.current.close().then(() => (audio.current = null));
  }

  async function agir(acao: 'pronto' | 'desfazer' | 'entregue', pedidoId: string) {
    setOcupado(pedidoId);
    const pracaId = praca === TODAS ? null : praca;
    const { error } =
      acao === 'pronto'
        ? await supabase.rpc('marcar_pronto', { p_pedido: pedidoId, p_praca: pracaId })
        : acao === 'desfazer'
          ? await supabase.rpc('desfazer_pronto', { p_pedido: pedidoId, p_praca: pracaId })
          : await supabase.rpc('marcar_entregue', { p_pedido: pedidoId });
    setOcupado(null);
    if (error) setErro('Não deu certo. Tente de novo.');
    await carregar();
  }

  const pracaId = praca === TODAS ? null : praca;
  const emPreparo = useMemo(
    () =>
      (pedidos ?? []).filter(
        (p) => p.status === 'em_preparo' && pendentesDaPraca(p.order_items, pracaId).length > 0,
      ),
    [pedidos, pracaId],
  );
  const prontos = useMemo(() => (pedidos ?? []).filter((p) => p.status === 'pronto'), [pedidos]);
  const nomeDaPraca =
    praca === TODAS ? 'Todas as praças' : (pracas.find((p) => p.id === praca)?.name ?? 'Praça');

  return (
    <div className="flex h-dvh flex-col bg-canvas text-ink">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <button
          type="button"
          onClick={onVoltar}
          aria-label={`Sair da tela da cozinha e voltar para ${loja.name}`}
          className="flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface"
        >
          <Icon name="voltar" />
        </button>
        <div className="mr-auto flex flex-col">
          <h1 className="font-display text-title-section">{nomeDaPraca}</h1>
          <span className="text-caption text-ink-muted">
            {emPreparo.length === 1 ? '1 em preparo' : `${emPreparo.length} em preparo`} ·{' '}
            {prontos.length} pronto
            {prontos.length === 1 ? '' : 's'}
          </span>
        </div>
        {pracas.length > 1 && (
          <SegmentedControl
            label="Praça"
            options={[
              { value: TODAS, label: 'Todas' },
              ...pracas.map((p) => ({ value: p.id, label: p.name })),
            ]}
            value={praca}
            onChange={escolherPraca}
          />
        )}
        <Button variant={som ? 'secondary' : 'primary'} onClick={alternarSom}>
          {som ? 'Som ligado' : 'Ligar som'}
        </Button>
        <span className="font-display text-title-section tabular-nums">
          {new Date(agora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </header>

      {erro && <Alert className="mx-4 mt-3">{erro}</Alert>}

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-h-0 overflow-y-auto p-4">
          {pedidos === null ? (
            <p className="text-body text-ink-muted">Carregando os pedidos…</p>
          ) : emPreparo.length === 0 ? (
            <EmptyState
              title="Nada na fila"
              description="Os pedidos novos aparecem aqui na hora, com o tempo de espera."
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] items-start gap-4">
              {emPreparo.map((p) => {
                const itens = p.order_items.filter(
                  (i) => pracaId === null || i.station_id === pracaId,
                );
                return (
                  <OrderCard
                    key={p.id}
                    title={rotuloDaConta(p.identifier_type, p.identifier)}
                    subtitle={`Pedido #${String(p.number).padStart(3, '0')} · ${rotuloDoTipo(p.type)}`}
                    timer={cronometro(p.created_at, agora)}
                    tone={nivelDeAtraso(p.created_at, agora)}
                    items={itens.map((i) => ({
                      id: i.id,
                      quantidade: i.quantity,
                      nome: i.product_name,
                      detalhes: [
                        ...(i.variant_name ? [i.variant_name] : []),
                        ...i.order_item_modifiers.map((m) => `+ ${m.name}`),
                      ],
                      observacao: i.notes,
                      feito: i.prepared_at !== null,
                    }))}
                    action={
                      <Button
                        className="h-target-pdv w-full"
                        loading={ocupado === p.id}
                        onClick={() => void agir('pronto', p.id)}
                      >
                        Pronto
                      </Button>
                    }
                  />
                );
              })}
            </div>
          )}
        </main>

        <aside
          aria-label="Prontos para entregar"
          className="flex min-h-0 flex-col border-t border-line bg-surface xl:border-t-0 xl:border-l"
        >
          <h2 className="px-4 pt-4 font-display text-title-card">Prontos para entregar</h2>
          {prontos.length === 0 ? (
            <p className="px-4 py-3 text-body text-ink-muted">Nenhum esperando.</p>
          ) : (
            <ul className="flex flex-col gap-2 overflow-y-auto p-4">
              {prontos.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-2 rounded-md border border-line bg-canvas p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-title-card text-ink">
                      {rotuloDaConta(p.identifier_type, p.identifier)}
                    </span>
                    <span className="text-caption text-ink-muted tabular-nums">
                      pronto há {cronometro(p.ready_at ?? p.created_at, agora)}
                    </span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Button loading={ocupado === p.id} onClick={() => void agir('entregue', p.id)}>
                      Entregue
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={ocupado === p.id}
                      onClick={() => void agir('desfazer', p.id)}
                    >
                      Desfazer
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
