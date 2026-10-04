import {
  adicionarItem,
  detalheDoItem,
  formatarPreco,
  itemSimples,
  quantidadeDoProduto,
  quantidadeTotal,
  removerUnidade,
  somarUnidade,
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
import { Alert, Button, Chip, Icon, ProductTile, QuantityStepper, Sheet } from '@usefood/ui';
import { useEffect, useMemo, useState } from 'react';

const ERROS_CONHECIDOS = new Set(['P0001', 'P0002', '22023', '42501']);

/** Cardápio no celular para lançar uma rodada na mesa. */
export function Lancar({
  supabase,
  lojaId,
  mesa,
  onEnviado,
  onVoltar,
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
  mesa: string;
  /** Rodada enviada; recebe a conta da mesa. */
  onEnviado: (contaId: string, numero: number) => void;
  onVoltar: () => void;
}) {
  const [cardapio, setCardapio] = useState<Cardapio | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [montando, setMontando] = useState<ProdutoDoCardapio | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    carregarCardapio(supabase, lojaId)
      .then((c) => {
        if (!ativo) return;
        setCardapio(c);
        setCategoria(c.categorias[0]?.id ?? null);
      })
      .catch(() => ativo && setFalhou(true));
    return () => {
      ativo = false;
    };
  }, [supabase, lojaId]);

  const visiveis = useMemo(
    () => (cardapio ? cardapio.produtos.filter((p) => p.category_id === categoria) : []),
    [cardapio, categoria],
  );
  const comFotos = visiveis.some((p) => p.photo_path);
  const itens = quantidadeTotal(carrinho);

  function tocar(p: ProdutoDoCardapio) {
    if (cardapio && temOpcoes(cardapio, p.id)) setMontando(p);
    else setCarrinho((c) => adicionarItem(c, itemSimples(p)));
  }

  async function enviar() {
    setErro('');
    setEnviando(true);
    const { data, error } = await supabase.rpc('criar_pedido', {
      p_restaurant_id: lojaId,
      p_tipo: 'mesa',
      p_identificador_tipo: 'mesa',
      p_identificador: mesa,
      p_itens: carrinho.map((i) => ({
        product_id: i.productId,
        quantidade: i.quantidade,
        variant_id: i.tamanhoId,
        adicionais: i.adicionais.map((a) => a.id),
        observacao: i.observacao || null,
      })),
    });
    setEnviando(false);
    const linha = data?.[0];
    if (error || !linha) {
      setErro(
        error?.code && ERROS_CONHECIDOS.has(error.code) && error.message
          ? error.message
          : 'Não deu certo. Confira a internet e tente de novo.',
      );
      return;
    }
    setRevisando(false);
    onEnviado(linha.conta_id, linha.numero);
  }

  if (falhou) return <Alert>Não conseguimos carregar o cardápio. Confira a internet.</Alert>;
  if (!cardapio) return <p className="text-body text-ink-muted">Abrindo o cardápio…</p>;

  return (
    <div className="flex flex-col gap-4 pb-24">
      <button
        type="button"
        onClick={onVoltar}
        className="flex min-h-target-min items-center gap-1 self-start text-label text-ink-muted"
      >
        <Icon name="voltar" size={18} /> Voltar
      </button>
      <h2 className="font-display text-title-screen text-ink">Mesa {mesa}</h2>

      <div
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1"
        role="group"
        aria-label="Categorias"
      >
        {cardapio.categorias.map((c) => (
          <Chip key={c.id} selected={c.id === categoria} onClick={() => setCategoria(c.id)}>
            {c.name}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {visiveis.map((p) => {
          const tamanhos = cardapio.opcoes.get(p.id)?.tamanhos ?? [];
          const menor = tamanhos.length
            ? Math.min(...tamanhos.map((t) => t.precoCentavos))
            : p.price_cents;
          return (
            <ProductTile
              key={p.id}
              name={p.name}
              priceLabel={
                tamanhos.length > 1 ? `a partir de ${formatarPreco(menor)}` : formatarPreco(menor)
              }
              quantity={quantidadeDoProduto(carrinho, p.id)}
              imageUrl={urlDaFoto(supabase, p.photo_path)}
              showImage={comFotos}
              onClick={() => tocar(p)}
            />
          );
        })}
      </div>

      {itens > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-canvas px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button className="h-target-pdv w-full" onClick={() => setRevisando(true)}>
            Ver pedido · {itens === 1 ? '1 item' : `${itens} itens`} ·{' '}
            {formatarPreco(subtotalCentavos(carrinho))}
          </Button>
        </div>
      )}

      {revisando && (
        <Sheet
          open
          onClose={() => setRevisando(false)}
          title={`Rodada da mesa ${mesa}`}
          footer={
            <div className="flex flex-col gap-3">
              <Alert>{erro}</Alert>
              <Button
                className="h-target-pdv"
                loading={enviando}
                disabled={carrinho.length === 0}
                onClick={() => void enviar()}
              >
                Enviar para a cozinha · {formatarPreco(subtotalCentavos(carrinho))}
              </Button>
            </div>
          }
        >
          {carrinho.length === 0 ? (
            <p className="text-body text-ink-muted">O pedido está vazio.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {carrinho.map((i) => {
                const detalhe = detalheDoItem(i);
                return (
                  <li key={i.chave} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-body-strong text-ink">{i.nome}</p>
                      {detalhe && <p className="text-caption text-ink-muted">{detalhe}</p>}
                      <p className="text-caption text-ink-muted tabular-nums">
                        {formatarPreco(i.precoCentavos * i.quantidade)}
                      </p>
                    </div>
                    <QuantityStepper
                      value={i.quantidade}
                      itemName={i.nome}
                      onDecrement={() => setCarrinho((c) => removerUnidade(c, i.chave))}
                      onIncrement={() => setCarrinho((c) => somarUnidade(c, i.chave))}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Sheet>
      )}

      {montando && (
        <MontarItem
          produto={montando}
          tamanhos={cardapio.opcoes.get(montando.id)?.tamanhos ?? []}
          grupos={cardapio.opcoes.get(montando.id)?.grupos ?? []}
          fotoUrl={urlDaFoto(supabase, montando.photo_path)}
          onFechar={() => setMontando(null)}
          onAdicionar={(item) => {
            setCarrinho((c) => adicionarItem(c, item));
            setMontando(null);
          }}
        />
      )}
    </div>
  );
}
