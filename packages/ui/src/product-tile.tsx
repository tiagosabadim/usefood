import { cn } from './cn';
import { Icon } from './icon';

export interface ProductTileProps {
  name: string;
  /** Preço já formatado: "R$ 14,00". */
  priceLabel: string;
  /** Quantas unidades já estão no pedido; 0 esconde o selo. */
  quantity?: number;
  disabled?: boolean;
  onClick: () => void;
}

/** Bloco de produto do PDV: um toque adiciona uma unidade. */
export function ProductTile({
  name,
  priceLabel,
  quantity = 0,
  disabled,
  onClick,
}: ProductTileProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`Adicionar ${name}, ${priceLabel}${quantity ? `, ${quantity} no pedido` : ''}`}
      className={cn(
        'relative flex h-32 flex-col justify-between rounded-lg border bg-surface p-4 text-left transition',
        'hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        quantity ? 'border-brand' : 'border-line',
      )}
    >
      <span className="pr-8 text-body-strong text-ink">{name}</span>
      <span className="flex items-center justify-between">
        <span className="text-body-strong text-ink tabular-nums">{priceLabel}</span>
        <span className="flex size-8 items-center justify-center rounded-pill bg-brand-soft text-brand-text">
          <Icon name="mais" size={18} />
        </span>
      </span>
      {quantity > 0 && (
        <span className="absolute top-3 right-3 flex min-w-7 items-center justify-center rounded-pill bg-brand px-2 py-1 text-micro text-brand-ink">
          {quantity}
        </span>
      )}
    </button>
  );
}
