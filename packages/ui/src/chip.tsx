import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** Filtro de toque rápido (categorias da vitrine). O selecionado usa brand. */
export function Chip({ selected = false, className, type = 'button', ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-10 shrink-0 items-center rounded-pill px-4 text-label transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        selected
          ? 'bg-brand text-brand-ink'
          : 'border border-line bg-surface text-ink hover:bg-surface-strong',
        className,
      )}
      {...props}
    />
  );
}
