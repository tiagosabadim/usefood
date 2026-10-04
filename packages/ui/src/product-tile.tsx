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
  /** Foto do produto. */
  imageUrl?: string | null;
  /**
   * Reserva o espaço da foto. Ligue quando algum produto da grade tiver foto,
   * para os blocos sem foto ficarem do mesmo tamanho (com as iniciais no lugar).
   */
  showImage?: boolean;
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** Bloco de produto do PDV: um toque adiciona uma unidade. */
export function ProductTile({
  name,
  priceLabel,
  quantity = 0,
  disabled,
  onClick,
  imageUrl,
  showImage = false,
}: ProductTileProps) {
  const comFoto = showImage || Boolean(imageUrl);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`Adicionar ${name}, ${priceLabel}${quantity ? `, ${quantity} no pedido` : ''}`}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-lg border bg-surface text-left transition',
        'hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        quantity ? 'border-brand' : 'border-line',
        !comFoto && 'h-32',
      )}
    >
      {comFoto && (
        // overflow-hidden impede a foto de esticar a moldura: o 4:3 vale para qualquer foto
        <span className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden bg-surface-strong">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center font-display text-title-screen text-ink-muted"
            >
              {iniciais(name)}
            </span>
          )}
        </span>
      )}
      <span className={cn('flex flex-1 flex-col justify-between gap-2', comFoto ? 'p-3' : 'p-4')}>
        <span className={cn('text-body-strong text-ink', !comFoto && 'pr-8')}>{name}</span>
        <span className="flex items-center justify-between">
          <span className="text-body-strong text-ink tabular-nums">{priceLabel}</span>
          <span className="flex size-8 items-center justify-center rounded-pill bg-brand-soft text-brand-text">
            <Icon name="mais" size={18} />
          </span>
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
