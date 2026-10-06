import { cn } from './cn';
import { Icon } from './icon';

export interface ProductRowProps {
  name: string;
  description?: string | null;
  /** Preço já formatado: "R$ 14,00" ou "a partir de R$ 12,00". */
  priceLabel: string;
  imageUrl?: string | null;
  /** Unidades na sacola; 0 esconde o selo. */
  quantity?: number;
  onClick: () => void;
}

/** Produto em lista (loja online): texto à esquerda, foto 4:3 à direita. Toque abre o detalhe. */
export function ProductRow({
  name,
  description,
  priceLabel,
  imageUrl,
  quantity = 0,
  onClick,
}: ProductRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name}, ${priceLabel}${quantity ? `, ${quantity} no carrinho` : ''}`}
      className={cn(
        'relative flex w-full items-start gap-4 py-4 pr-12 text-left transition',
        'active:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
      )}
    >
      {imageUrl && (
        <span className="relative size-[5.5rem] shrink-0 overflow-hidden rounded-lg bg-surface-strong">
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-body-strong text-ink">{name}</span>
        {description && (
          <span className="line-clamp-2 text-caption text-ink-muted">{description}</span>
        )}
        <span className="pt-1 text-body-strong text-ink tabular-nums">{priceLabel}</span>
      </span>
      <span
        aria-hidden="true"
        className="absolute right-0 bottom-4 flex size-9 items-center justify-center rounded-pill bg-brand text-label font-black text-brand-ink"
      >
        {quantity > 0 ? quantity : <Icon name="mais" size={20} />}
      </span>
    </button>
  );
}
