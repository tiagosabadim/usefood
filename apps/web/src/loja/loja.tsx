import { useAppContext } from '@usefood/app';
import {
  adicionarItem,
  DIAS_DA_SEMANA,
  formatarPreco,
  itemSimples,
  quantidadeDoProduto,
  quantidadeTotal,
  subtotalCentavos,
  type ItemCarrinho,
} from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import {
  carregarCardapio,
  MontarItem,
  temOpcoes,
  urlDaFoto,
  type Cardapio,
  type ProdutoDoCardapio,
} from '@usefood/pedidos';
import { Button, CartList, Chip, ProductTile, Sheet, StatusPill } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { gravarSacola, lerSacola } from '../guardado';
import { navegar } from '../rotas';
import { Checkout } from './checkout';
import { buscarLoja, whatsapp, type Horario, type LojaPublica } from './dados';

const hora = (t: string) => t.slice(0, 5);

function horarioDeHoje(horarios: Horario[]): string {
  const hoje = new Date().getDay();
  const doDia = horarios.filter((h) => h.weekday === hoje);
  return doDia.length
    ? `Hoje ${doDia.map((h) => `${hora(h.opens)}–${hora(h.closes)}`).join(' e ')}`
    : `${DIAS_DA_SEMANA[hoje]}: fechado`;
}

function resumoDaEntrega(loja: LojaPublica): string {
  const tempo = `${loja.prep_minutes_min}–${loja.prep_minutes_max} min`;
  if (!loja.accepts_delivery) return `Só retirada · ${tempo}`;
  const taxa =
    loja.delivery_fee_mode === 'gratis'
      ? 'entrega grátis'
      : loja.free_delivery_above_cents
        ? `entrega grátis acima de ${formatarPreco(loja.free_delivery_above_cents)}`
        : loja.delivery_fee_mode === 'bairro'
          ? 'taxa conforme o bairro'
          : 'taxa conforme a distância';
  return `${tempo} · ${taxa}`;
}

/** Loja online do restaurante: capa, cardápio, sacola e checkout. */
export function Loja({ slug, base }: { slug: string; base: string }) {
  const { supabase, brand } = useAppContext();
  const [estado, setEstado] = useState<
    | { tipo: 'carregando' }
    | { tipo: 'nao-encontrada' }
    | {
        tipo: 'pronta';
        loja: LojaPublica;
        horarios: Horario[];
        aberta: boolean;
        cardapio: Cardapio;
      }
  >({ tipo: 'carregando' });

  useEffect(() => {
    if (!supabase) return;
    let ativo = true;
    void (async () => {
      const achada = await buscarLoja(supabase, brand, slug).catch(() => null);
      if (!achada) {
        if (ativo) setEstado({ tipo: 'nao-encontrada' });
        return;
      }
      const cardapio = await carregarCardapio(supabase, achada.loja.id).catch(() => null);
      if (ativo)
        setEstado(cardapio ? { tipo: 'pronta', ...achada, cardapio } : { tipo: 'nao-encontrada' });
    })();
    return () => {
      ativo = false;
    };
  }, [supabase, brand, slug]);

  if (!supabase || estado.tipo === 'carregando') {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10 text-body text-ink-muted">Abrindo a loja…</main>
    );
  }
  if (estado.tipo === 'nao-encontrada') {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-3 px-5 py-16">
        <h1 className="font-display text-display text-ink">Loja não encontrada</h1>
        <p className="text-body text-ink-muted">
          Confira o endereço. Lojas em cadastro ou fora do ar não aparecem.
        </p>
      </main>
    );
  }
  return <LojaPronta supabase={supabase} base={base} {...estado} />;
}

function LojaPronta({
  supabase,
  base,
  loja,
  horarios,
  aberta,
  cardapio,
}: {
  supabase: AppSupabaseClient;
  base: string;
  loja: LojaPublica;
  horarios: Horario[];
  aberta: boolean;
  cardapio: Cardapio;
}) {
  const [sacola, setSacola] = useState<ItemCarrinho[]>(() => lerSacola(loja.id));
  const [montando, setMontando] = useState<ProdutoDoCardapio | null>(null);
  const [vendoSacola, setVendoSacola] = useState(false);
  const [fechando, setFechando] = useState(false);

  useEffect(() => gravarSacola(loja.id, sacola), [loja.id, sacola]);

  const foto = (caminho: string | null) => urlDaFoto(supabase, caminho);
  const itens = quantidadeTotal(sacola);
  const comFotos = cardapio.produtos.some((p) => p.photo_path);
  const categorias = cardapio.categorias.filter((c) =>
    cardapio.produtos.some((p) => p.category_id === c.id),
  );

  function tocar(p: ProdutoDoCardapio) {
    if (temOpcoes(cardapio, p.id)) setMontando(p);
    else setSacola((s) => adicionarItem(s, itemSimples(p)));
  }

  if (fechando) {
    return (
      <Checkout
        supabase={supabase}
        loja={loja}
        aberta={aberta}
        itens={sacola}
        onVoltar={() => setFechando(false)}
        onFeito={(token) => {
          setSacola([]);
          gravarSacola(loja.id, []);
          navegar(`${base}/pedido/${token}`);
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col pb-28">
      {loja.status !== 'ativo' && (
        // Só a equipe enxerga loja fora do ar (está logada); o cliente vê "Loja não encontrada"
        <p role="status" className="bg-sun px-5 py-3 text-body text-sun-ink">
          <strong>Prévia:</strong> só você está vendo. Para os clientes acessarem, publique a loja
          em Loja online no painel.
        </p>
      )}
      <div className="aspect-[3/1] w-full overflow-hidden bg-surface-strong sm:rounded-b-lg">
        {loja.cover_path && (
          <img src={foto(loja.cover_path)!} alt="" className="size-full object-cover" />
        )}
      </div>
      <header className="flex flex-col gap-3 px-5">
        <div className="-mt-10 flex size-20 items-center justify-center overflow-hidden rounded-lg border-4 border-canvas bg-surface-strong">
          {loja.logo_path ? (
            <img
              src={foto(loja.logo_path)!}
              alt={`Logo ${loja.name}`}
              className="size-full object-cover"
            />
          ) : (
            <span className="font-display text-title-section text-ink-muted">
              {loja.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-title-screen text-ink">{loja.name}</h1>
          {loja.description && <p className="text-body text-ink-muted">{loja.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
          <StatusPill tone={aberta ? 'sucesso' : 'neutro'}>
            {aberta ? 'Aberto' : 'Fechado'}
          </StatusPill>
          <span>{horarioDeHoje(horarios)}</span>
        </div>
        <p className="text-body text-ink">
          {resumoDaEntrega(loja)}
          {loja.min_order_cents > 0 && ` · pedido mínimo ${formatarPreco(loja.min_order_cents)}`}
        </p>
        {loja.phone && (
          <a
            className="self-start text-label text-brand-text underline"
            href={whatsapp(loja.phone)}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp da loja
          </a>
        )}
      </header>

      <nav
        aria-label="Categorias"
        className="sticky top-0 z-10 mt-5 flex gap-2 overflow-x-auto border-b border-line bg-canvas px-5 py-3"
      >
        {categorias.map((c) => (
          <Chip
            key={c.id}
            onClick={() =>
              document
                .getElementById(`cat-${c.id}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            {c.name}
          </Chip>
        ))}
      </nav>

      <div className="flex flex-col gap-8 px-5 pt-5">
        {categorias.map((c) => (
          <section
            key={c.id}
            id={`cat-${c.id}`}
            aria-labelledby={`t-${c.id}`}
            className="flex scroll-mt-20 flex-col gap-3"
          >
            <h2 id={`t-${c.id}`} className="font-display text-title-section text-ink">
              {c.name}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {cardapio.produtos
                .filter((p) => p.category_id === c.id)
                .map((p) => {
                  const tamanhos = cardapio.opcoes.get(p.id)?.tamanhos ?? [];
                  const menor = tamanhos.length
                    ? Math.min(...tamanhos.map((t) => t.precoCentavos))
                    : p.price_cents;
                  return (
                    <ProductTile
                      key={p.id}
                      name={p.name}
                      priceLabel={
                        tamanhos.length > 1
                          ? `a partir de ${formatarPreco(menor)}`
                          : formatarPreco(menor)
                      }
                      quantity={quantidadeDoProduto(sacola, p.id)}
                      imageUrl={foto(p.photo_path)}
                      showImage={comFotos}
                      onClick={() => tocar(p)}
                    />
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      {itens > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-canvas px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-2xl">
            <Button className="h-target-pdv w-full" onClick={() => setVendoSacola(true)}>
              Ver sacola · {itens === 1 ? '1 item' : `${itens} itens`} ·{' '}
              {formatarPreco(subtotalCentavos(sacola))}
            </Button>
          </div>
        </div>
      )}

      {vendoSacola && (
        <Sheet
          open
          onClose={() => setVendoSacola(false)}
          title="Sua sacola"
          footer={
            <Button
              className="h-target-pdv w-full"
              disabled={sacola.length === 0}
              onClick={() => {
                setVendoSacola(false);
                setFechando(true);
                window.scrollTo(0, 0);
              }}
            >
              Continuar · {formatarPreco(subtotalCentavos(sacola))}
            </Button>
          }
        >
          <CartList
            items={sacola}
            onChange={setSacola}
            viagem="nenhum"
            imageFor={(id) => foto(cardapio.produtos.find((p) => p.id === id)?.photo_path ?? null)}
            emptyText="Sua sacola está vazia."
          />
        </Sheet>
      )}

      {montando && (
        <MontarItem
          produto={montando}
          tamanhos={cardapio.opcoes.get(montando.id)?.tamanhos ?? []}
          grupos={cardapio.opcoes.get(montando.id)?.grupos ?? []}
          fotoUrl={foto(montando.photo_path)}
          onFechar={() => setMontando(null)}
          onAdicionar={(item) => {
            setSacola((s) => adicionarItem(s, item));
            setMontando(null);
          }}
        />
      )}
    </main>
  );
}
