import type { AppSupabaseClient } from '@usefood/db';
import { Button, Icon } from '@usefood/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { tocarAviso, useTelaEscura } from './tela-escura';

interface PedidoChamado {
  id: string;
  identifier_type: 'senha' | 'nome' | 'mesa' | 'comanda';
  identifier: string;
  status: string;
  ready_at: string | null;
}

const JANELA_MS = 4 * 3_600_000;
/** Pronto fica no painel por até 30 minutos, se ninguém marcar como entregue antes. */
const PRONTO_VISIVEL_MS = 30 * 60_000;

/** Painel para a TV do balcão: quem está sendo preparado e quem pode retirar. */
export function PainelDeChamada({
  supabase,
  loja,
  onVoltar,
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  onVoltar: () => void;
}) {
  useTelaEscura();
  const [pedidos, setPedidos] = useState<PedidoChamado[]>([]);
  const [agora, setAgora] = useState(() => Date.now());
  const [som, setSom] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const prontosConhecidos = useRef<Set<string> | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, identifier_type, identifier, status, ready_at')
      .eq('restaurant_id', loja.id)
      .in('type', ['balcao', 'retirada'])
      .in('identifier_type', ['senha', 'nome'])
      .in('status', ['em_preparo', 'pronto'])
      .gte('created_at', new Date(Date.now() - JANELA_MS).toISOString())
      .order('created_at');
    if (!data) return;
    const prontos = new Set(data.filter((p) => p.status === 'pronto').map((p) => p.id));
    if (
      prontosConhecidos.current &&
      audio.current &&
      [...prontos].some((id) => !prontosConhecidos.current!.has(id))
    ) {
      tocarAviso(audio.current);
    }
    prontosConhecidos.current = prontos;
    setPedidos(data);
    setAgora(Date.now());
  }, [supabase, loja.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    const canal = supabase
      .channel(`chamada-${loja.id}`)
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

  function alternarSom() {
    if (!audio.current) audio.current = new AudioContext();
    const ligar = !som;
    setSom(ligar);
    if (ligar) tocarAviso(audio.current);
    else void audio.current.close().then(() => (audio.current = null));
  }

  const preparando = pedidos.filter((p) => p.status === 'em_preparo');
  const prontos = pedidos
    .filter(
      (p) =>
        p.status === 'pronto' && p.ready_at && agora - Date.parse(p.ready_at) < PRONTO_VISIVEL_MS,
    )
    .sort((a, b) => Date.parse(b.ready_at ?? '') - Date.parse(a.ready_at ?? ''));
  const texto = (p: PedidoChamado) =>
    p.identifier_type === 'senha' ? p.identifier : p.identifier.toUpperCase();

  return (
    <div className="flex h-dvh flex-col bg-canvas text-ink">
      <header className="flex items-center gap-3 border-b border-line px-6 py-4">
        <button
          type="button"
          onClick={onVoltar}
          aria-label="Sair do painel de chamada"
          className="flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface"
        >
          <Icon name="voltar" />
        </button>
        <span className="mr-auto font-display text-title-screen">{loja.name}</span>
        <Button variant={som ? 'secondary' : 'primary'} onClick={alternarSom}>
          {som ? 'Som ligado' : 'Ligar som'}
        </Button>
        <span className="font-display text-title-screen tabular-nums">
          {new Date(agora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[2fr_3fr]">
        <section
          aria-label="Preparando"
          className="flex min-h-0 flex-col gap-4 border-b border-line p-6 md:border-r md:border-b-0"
        >
          <h2 className="font-display text-title-screen text-ink-muted">Preparando</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] content-start gap-3 overflow-y-auto">
            {preparando.map((p) => (
              <li
                key={p.id}
                className="truncate rounded-md bg-surface px-4 py-3 font-display text-title-section text-ink"
              >
                {texto(p)}
              </li>
            ))}
          </ul>
        </section>
        <section
          aria-label="Pronto, pode retirar"
          aria-live="polite"
          className="flex min-h-0 flex-col gap-4 p-6"
        >
          <h2 className="font-display text-title-screen text-success">Pronto! Pode retirar</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] content-start gap-4 overflow-y-auto">
            {prontos.map((p, i) => (
              <li
                key={p.id}
                className={
                  i === 0
                    ? 'truncate rounded-lg bg-sun px-5 py-6 text-center font-display text-display text-sun-ink'
                    : 'truncate rounded-lg bg-surface px-5 py-6 text-center font-display text-display text-ink'
                }
              >
                {texto(p)}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
