import { cn } from './cn';

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
      aria-label={`${name}, ${priceLabel}${quantity ? `, ${quantity} na sacola` : ''}`}
      className={cn(
        'flex w-full items-start gap-4 rounded-lg py-4 text-left transition',
        'hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-body-strong text-ink">{name}</span>
        {description && (
          <span className="line-clamp-2 text-caption text-ink-muted">{description}</span>
        )}
        <span className="pt-1 text-body-strong text-ink tabular-nums">{priceLabel}</span>
      </span>
      {imageUrl && (
        <span className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-md bg-surface-strong">
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          {quantity > 0 && (
            <span className="absolute top-1.5 right-1.5 flex min-w-6 items-center justify-center rounded-pill bg-brand px-1.5 py-0.5 text-micro text-brand-ink">
              {quantity}
            </span>
          )}
        </span>
      )}
      {!imageUrl && quantity > 0 && (
        <span className="flex min-w-6 items-center justify-center rounded-pill bg-brand px-1.5 py-0.5 text-micro text-brand-ink">
          {quantity}
        </span>
      )}
    </button>
  );
}
