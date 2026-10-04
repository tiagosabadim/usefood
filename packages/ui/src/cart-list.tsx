import {
  detalheDoItem,
  formatarPreco,
  marcarParaViagem,
  marcarTudoParaViagem,
  removerUnidade,
  situacaoDeViagem,
  somarUnidade,
  type ItemCarrinho,
} from '@usefood/core';
import { Chip } from './chip';
import { QuantityStepper } from './quantity-stepper';
import { SegmentedControl } from './segmented-control';

export interface CartListProps {
  items: ItemCarrinho[];
  onChange: (items: ItemCarrinho[]) => void;
  /**
   * "escolher": mesa e comer aqui, com Comer aqui | Para viagem e a etiqueta em cada item.
   * "sempre": para viagem e delivery, tudo sai embalado.
   * "nenhum": sem aviso (loja online, onde tudo já é entrega ou retirada).
   */
  viagem?: 'escolher' | 'sempre' | 'nenhum';
  /** Miniatura 4:3 do produto, quando houver foto. */
  imageFor?: (productId: string) => string | null;
  emptyText?: string;
}

/** Itens do pedido antes de enviar para a cozinha: quantidade e, por item, se vai para viagem. */
export function CartList({
  items,
  onChange,
  viagem = 'escolher',
  imageFor,
  emptyText = 'Toque nos produtos para montar o pedido.',
}: CartListProps) {
  if (items.length === 0) return <p className="py-6 text-body text-ink-muted">{emptyText}</p>;
  const situacao = situacaoDeViagem(items);

  return (
    <div className="flex flex-col gap-3">
      {viagem === 'escolher' ? (
        <div className="flex flex-col gap-1">
          <SegmentedControl
            label="Para comer aqui ou para viagem"
            className="self-start"
            options={[
              { value: 'comer', label: 'Comer aqui' },
              { value: 'viagem', label: 'Para viagem' },
            ]}
            value={situacao === 'misto' ? null : situacao}
            onChange={(v) => onChange(marcarTudoParaViagem(items, v === 'viagem'))}
          />
          {situacao === 'misto' && (
            <p className="text-caption text-ink-muted">
              Misturado: só os itens marcados vão embalados.
            </p>
          )}
        </div>
      ) : viagem === 'sempre' ? (
        <p className="text-caption text-ink-muted">Tudo sai embalado para viagem.</p>
      ) : null}
      <ul className="flex flex-col divide-y divide-line">
        {items.map((i) => {
          const detalhe = detalheDoItem(i);
          const foto = imageFor?.(i.productId);
          return (
            <li key={i.chave} className="flex items-start gap-3 py-3">
              {foto && (
                <img
                  src={foto}
                  alt=""
                  loading="lazy"
                  className="aspect-[4/3] w-12 shrink-0 rounded-sm object-cover"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-body-strong text-ink">{i.nome}</p>
                {detalhe && <p className="text-caption text-ink-muted">{detalhe}</p>}
                <p className="text-caption text-ink-muted tabular-nums">
                  {formatarPreco(i.precoCentavos * i.quantidade)}
                </p>
                {viagem === 'escolher' && (
                  <Chip
                    selected={i.paraViagem}
                    className="mt-1 h-9 self-start px-3 text-micro"
                    aria-label={`${i.nome}: para viagem`}
                    onClick={() => onChange(marcarParaViagem(items, i.chave, !i.paraViagem))}
                  >
                    Pra viagem
                  </Chip>
                )}
              </div>
              <QuantityStepper
                value={i.quantidade}
                itemName={i.nome}
                onDecrement={() => onChange(removerUnidade(items, i.chave))}
                onIncrement={() => onChange(somarUnidade(items, i.chave))}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
