import { useId, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';
import { Icon } from './icon';

export interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange'
> {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}

/** Lista de escolha com a mesma cara do TextField. Usa o seletor nativo (no celular abre a roleta do sistema). */
export function SelectField({
  label,
  options,
  value,
  onChange,
  hint,
  className,
  ...props
}: SelectFieldProps) {
  const id = useId();
  const dica = hint ? `${id}-dica` : undefined;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-label text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          aria-describedby={dica}
          onChange={(e) => onChange(e.target.value)}
          className="h-target-pdv w-full appearance-none rounded-md border border-line-strong bg-surface pr-11 pl-4 text-body text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-muted">
          <Icon name="baixo" size={20} />
        </span>
      </div>
      {hint && (
        <p id={dica} className="text-caption text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
