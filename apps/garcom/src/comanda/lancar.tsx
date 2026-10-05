import {
  adicionarItem,
  DADOS_INICIAIS,
  type DadosDoPedido,
  formatarPreco,
  type ItemCarrinho,
  itemSimples,
  parametrosDoPedido,
  quantidadeDoProduto,
  quantidadeTotal,
  rotuloDaConta,
  subtotalCentavos,
  type TipoPedido,
} from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import {
  type Cardapio,
  carregarCardapio,
  MontarItem,
  type ProdutoDoCardapio,
  temOpcoes,
  TipoEIdentificacao,
  urlDaFoto,
  useAtendimento,
} from '@usefood/pedidos';
import { Alert, Button, CartList, Chip, Icon, ProductTile, Sheet } from '@usefood/ui';
import { useEffect, useMemo, useState } from 'react';

const ERROS_CONHECIDOS = new Set(['P0001', 'P0002', '22023', '42501']);

/** Rodada numa mesa do Salão, ou pedido avulso com os mesmos tipos do PDV. */
export type ModoDeLancar =
  | { tipo: 'mesa'; mesa: string }
  | { tipo: 'livre'; titulo?: string; inicial?: Partial<DadosDoPedido>; observacao?: string };

export interface PedidoEnviado {
  contaId: string;
  numero: number;
  rotulo: string;
  tipo: TipoPedido;
}

/** Cardápio no celular para lançar uma rodada na mesa ou um pedido avulso (para viagem, delivery…). */
export function Lancar({
  supabase,
  lojaId,
  modo,
  onEnviado,
  onVoltar,
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
  modo: ModoDeLancar;
  onEnviado: (pedido: PedidoEnviado) => void;
  onVoltar?: () => void;
}) {
  const atendimento = useAtendimento(supabase, lojaId);
  const [dados, setDados] = useState<DadosDoPedido>(() =>
    modo.tipo === 'mesa'
      ? { ...DADOS_INICIAIS, tipo: 'mesa', identificador: modo.mesa }
      : { ...DADOS_INICIAIS, ...modo.inicial },
  );
  const parametros = parametrosDoPedido(dados, atendimento);
  const titulo = modo.tipo === 'mesa' ? `Mesa ${modo.mesa}` : (modo.titulo ?? 'Novo pedido');
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
    if (!parametros.ok) return;
    setErro('');
    setEnviando(true);
    const { data, error } = await supabase.rpc('criar_pedido', {
      p_restaurant_id: lojaId,
      p_tipo: parametros.p_tipo,
      p_identificador_tipo: parametros.p_identificador_tipo,
      p_identificador: parametros.p_identificador,
      p_pagamento_previsto: parametros.p_pagamento_previsto,
      p_troco_para_cents: parametros.p_troco_para_cents,
      p_celular: parametros.p_celular,
      p_endereco: parametros.p_endereco,
      p_taxa_entrega_cents: parametros.p_taxa_entrega_cents,
      p_observacao: modo.tipo === 'livre' ? (modo.observacao ?? null) : null,
      p_itens: carrinho.map((i) => ({
        product_id: i.productId,
        quantidade: i.quantidade,
        variant_id: i.tamanhoId,
        adicionais: i.adicionais.map((a) => a.id),
        observacao: i.observacao || null,
        para_viagem: i.paraViagem,
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
    onEnviado({
      contaId: linha.conta_id,
      numero: linha.numero,
      rotulo: rotuloDaConta(parametros.p_identificador_tipo, linha.identificador),
      tipo: parametros.p_tipo,
    });
  }

  if (falhou) return <Alert>Não conseguimos carregar o cardápio. Confira a internet.</Alert>;
  if (!cardapio) return <p className="text-body text-ink-muted">Abrindo o cardápio…</p>;

  return (
    <div className="flex flex-col gap-4 pb-24">
      {onVoltar && (
        <button
          type="button"
          onClick={onVoltar}
          className="flex min-h-target-min items-center gap-1 self-start text-label text-ink-muted"
        >
          <Icon name="voltar" size={18} /> Voltar
        </button>
      )}
      <h2 className="font-display text-title-screen text-ink">{titulo}</h2>

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
          title={modo.tipo === 'mesa' ? `Rodada da mesa ${modo.mesa}` : titulo}
          footer={
            <div className="flex flex-col gap-3">
              <Alert>{erro}</Alert>
              {!parametros.ok && carrinho.length > 0 && (
                <p className="text-caption text-ink-muted">{parametros.motivo}</p>
              )}
              <Button
                className="h-target-pdv"
                loading={enviando}
                disabled={carrinho.length === 0 || !parametros.ok}
                onClick={() => void enviar()}
              >
                Enviar para a cozinha · {formatarPreco(subtotalCentavos(carrinho))}
              </Button>
            </div>
          }
        >
          {modo.tipo === 'livre' && (
            <section className="flex flex-col gap-3 border-b border-line pb-5">
              <TipoEIdentificacao
                dados={dados}
                onChange={setDados}
                atendimento={atendimento}
                entrega={{ supabase, lojaId: lojaId, subtotalCentavos: subtotalCentavos(carrinho) }}
              />
              {modo.observacao && (
                <p className="text-caption text-ink-muted">Anotação no ticket: {modo.observacao}</p>
              )}
              <p className="text-caption text-ink-muted">Quem recebe o pagamento é o caixa.</p>
            </section>
          )}
          <CartList
            items={carrinho}
            onChange={setCarrinho}
            viagem={dados.tipo === 'retirada' || dados.tipo === 'delivery' ? 'sempre' : 'escolher'}
            imageFor={(id) =>
              urlDaFoto(supabase, cardapio.produtos.find((p) => p.id === id)?.photo_path ?? null)
            }
            emptyText="O pedido está vazio."
          />
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
