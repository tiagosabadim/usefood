import { cn } from './cn';

export interface Option<T extends string> {
  value: T;
  label: string;
}

interface ChoiceProps<T extends string> {
  /** Nome do grupo para leitores de tela: "Identificação do pedido". */
  label: string;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
}

/** Escolha compacta entre 2 a 4 opções na mesma linha (Senha · Nome · Mesa). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: ChoiceProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex gap-1 rounded-md border border-line bg-canvas p-1', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-10 rounded-sm px-4 text-label transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            o.value === value ? 'bg-brand text-brand-ink' : 'text-ink hover:bg-surface',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Escolha grande, em grade, para decisões com o dedo e com pressa (forma de pagamento). */
export function ChoiceGrid<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  columns = 2,
}: ChoiceProps<T> & { columns?: 2 | 3 | 4 }) {
  const grade = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[columns];
  return (
    <div role="group" aria-label={label} className={cn('grid gap-2', grade, className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-target-pdv rounded-md border text-label transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            o.value === value
              ? 'border-brand bg-brand text-brand-ink'
              : 'border-line bg-canvas text-ink hover:bg-surface',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
