import { Icon } from './icon';
import { StatusPill } from './status-pill';

export interface StoreCardProps {
  name: string;
  href: string;
  /** "Pastel · 1,2 km" */
  meta: string;
  /** "20–30 min · Entrega R$ 4,90" */
  delivery: string;
  /** "4,8"; sem nota, sem estrela. */
  rating?: string;
  open: boolean;
  /** Quando fechada: "Abre às 18h". */
  closedLabel?: string;
  photoUrl?: string;
}

/** Loja na vitrine: foto no topo, nome, nota e como chega. A loja inteira é o link. */
export function StoreCard({
  name,
  href,
  meta,
  delivery,
  rating,
  open,
  closedLabel = 'Fechada',
  photoUrl,
}: StoreCardProps) {
  return (
    <a
      href={href}
      className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface text-ink no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="relative flex h-32 items-end justify-between bg-surface-strong p-3">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="text-caption text-ink-muted">foto da loja</span>
        )}
        <span className="relative ml-auto">
          {open ? (
            <StatusPill tone="sucesso">Aberto</StatusPill>
          ) : (
            <StatusPill>{closedLabel}</StatusPill>
          )}
        </span>
      </div>
      <div className="flex flex-col gap-1 px-4 pt-3.5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-title-card">{name}</span>
          {rating && (
            <span className="flex items-center gap-1 text-label tabular-nums">
              <Icon name="estrela" size={15} className="text-star" />
              {rating}
            </span>
          )}
        </div>
        <span className="text-body text-ink-muted">{meta}</span>
        <span className="text-body">{delivery}</span>
      </div>
    </a>
  );
}
