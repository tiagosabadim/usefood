import { cn } from './cn';
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
  /** Navegação do próprio app (sem recarregar a página). */
  onNavigate?: (href: string) => void;
  /** compacto: foto quadrada e o texto embaixo, sem borda (destaques da vitrine). */
  variant?: 'padrao' | 'compacto';
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
  onNavigate,
  variant = 'padrao',
}: StoreCardProps) {
  const navegar = (e: React.MouseEvent) => {
    if (!onNavigate || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    onNavigate(href);
  };
  if (variant === 'compacto') {
    return (
      <a
        href={href}
        onClick={navegar}
        className="flex flex-col gap-2 text-ink no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span className="relative block aspect-square w-full overflow-hidden rounded-lg bg-surface-strong">
          {photoUrl && (
            <img
              src={photoUrl}
              alt=""
              loading="lazy"
              className={cn('absolute inset-0 size-full object-cover', !open && 'grayscale')}
            />
          )}
          {!open && (
            <span className="absolute inset-x-1.5 bottom-1.5">
              <StatusPill>{closedLabel}</StatusPill>
            </span>
          )}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="truncate text-label font-bold">{name}</span>
          <span className="truncate text-caption text-ink-muted">{meta}</span>
          {rating && (
            <span className="flex items-center gap-1 text-caption tabular-nums">
              <Icon name="estrela" size={13} className="text-star" />
              {rating}
            </span>
          )}
          <span className="truncate text-caption text-ink-muted">{delivery}</span>
        </span>
      </a>
    );
  }
  return (
    <a
      href={href}
      onClick={navegar}
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
