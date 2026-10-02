import { cn } from './cn';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Texto lido por leitores de tela (e mostrado ao lado, se showLabel). */
  label: string;
  showLabel?: boolean;
  disabled?: boolean;
}

/** Liga/desliga com alvo de toque de 44 px. */
export function Switch({ checked, onChange, label, showLabel = false, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={showLabel ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-target-min items-center gap-3 rounded-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-7 w-12 items-center rounded-pill p-1 transition-colors',
          checked ? 'bg-brand' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'size-5 rounded-pill bg-canvas transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        ></span>
      </span>
      {showLabel && <span className="text-label text-ink">{label}</span>}
    </button>
  );
}
