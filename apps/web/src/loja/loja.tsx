import { useAppContext } from '@usefood/app';
import {
  adicionarItem,
  formatarPreco,
  type ItemCarrinho,
  itemSimples,
  quantidadeDoProduto,
  quantidadeTotal,
  resumoDoHorario,
  subtotalCentavos,
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
import { Button, CartList, Chip, Icon, ProductTile, Sheet, type IconName } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { gravarSacola, lerSacola } from '../guardado';
import { navegar } from '../rotas';
import { Checkout } from './checkout';
import { PedidoEmAndamento } from './pedido-em-andamento';
import { buscarLoja, whatsapp, type Horario, type LojaPublica } from './dados';

interface CardDaLoja {
  icone: IconName;
  titulo: string;
  valor: string;
  /** Título em verde (aberto) ou apagado (fechado). */
  tom?: 'sucesso' | 'apagado';
}

/** Cards do topo: horário (aberto ou fechado), tempo, entrega e pedido mínimo. */
function cardsDaLoja(loja: LojaPublica, horarios: Horario[], aberta: boolean): CardDaLoja[] {
  const horario = resumoDoHorario(horarios, aberta, new Date());
  const entrega = !loja.accepts_delivery
    ? 'Só retirada'
    : loja.delivery_fee_mode === 'gratis'
      ? 'Grátis'
      : loja.free_delivery_above_cents
        ? `Grátis acima de ${formatarPreco(loja.free_delivery_above_cents)}`
        : loja.delivery_fee_mode === 'bairro'
          ? 'Pelo bairro'
          : 'Pela distância';
  return [
    {
      icone: 'calendario',
      titulo: horario.titulo,
      valor: horario.detalhe,
      tom: aberta ? 'sucesso' : 'apagado',
    },
    {
      icone: 'relogio',
      titulo: 'Tempo',
      valor: `${loja.prep_minutes_min}–${loja.prep_minutes_max} min`,
    },
    { icone: 'moto', titulo: 'Entrega', valor: entrega },
    {
      icone: 'sacola',
      titulo: 'Mínimo',
      valor: loja.min_order_cents ? formatarPreco(loja.min_order_cents) : 'Sem mínimo',
    },
  ];
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
      <div className="relative aspect-[2/1] w-full overflow-hidden bg-surface-strong sm:rounded-b-lg">
        {loja.cover_path && (
          <img src={foto(loja.cover_path)!} alt="" className="size-full object-cover" />
        )}
        <button
          type="button"
          aria-label="Minha conta"
          onClick={() => navegar(`${base}/conta`)}
          className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-pill bg-canvas text-ink shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Icon name="perfil" size={22} />
        </button>
      </div>
      <header className="flex flex-col gap-3 px-5">
        <div className="relative z-10 -mt-12 flex size-24 items-center justify-center overflow-hidden rounded-lg border-4 border-canvas bg-surface-strong">
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
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {cardsDaLoja(loja, horarios, aberta).map((c) => (
            <li
              key={c.icone}
              className="flex flex-col items-start gap-2 rounded-lg border border-line bg-surface p-3"
            >
              <span className="flex size-9 items-center justify-center rounded-pill bg-brand-soft text-brand-text">
                <Icon name={c.icone} size={20} />
              </span>
              <span className="flex flex-col">
                <span
                  className={
                    c.tom === 'sucesso'
                      ? 'text-label text-success'
                      : c.tom === 'apagado'
                        ? 'text-label text-ink-muted'
                        : 'text-caption text-ink-muted'
                  }
                >
                  {c.titulo}
                </span>
                <span className="text-label text-ink">{c.valor}</span>
              </span>
            </li>
          ))}
          {loja.phone && (
            <li className="col-span-2 sm:col-span-1">
              <a
                href={whatsapp(loja.phone, `Oi, ${loja.name}! Vim pela loja online.`)}
                target="_blank"
                rel="noreferrer"
                className="flex h-full min-h-target-pdv items-center gap-3 rounded-lg bg-brand p-3 text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:flex-col sm:items-start"
              >
                <span className="flex size-9 items-center justify-center rounded-pill bg-brand-ink/15">
                  <Icon name="conversa" size={20} />
                </span>
                <span className="text-label">Falar com a loja</span>
              </a>
            </li>
          )}
        </ul>
        <PedidoEmAndamento lojaSlug={loja.slug} base={base} />
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
