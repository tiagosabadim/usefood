import { useEffect } from 'react';
import { cn } from './cn';
import { Icon } from './icon';

export interface PinPadProps {
  /** Números digitados até agora. */
  value: string;
  onChange: (valor: string) => void;
  /** Chamado quando completa os dígitos. */
  onComplete: (pin: string) => void;
  digits?: number;
  disabled?: boolean;
  /** Mensagem de erro abaixo dos pontos. */
  error?: string | undefined;
  label?: string;
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'apagar'] as const;

/** Teclado numérico grande para o PIN da equipe; também aceita o teclado físico. */
export function PinPad({
  value,
  onChange,
  onComplete,
  digits = 4,
  disabled,
  error,
  label = 'Digite seu PIN',
}: PinPadProps) {
  function digitar(tecla: string) {
    if (disabled) return;
    if (tecla === 'apagar') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= digits) return;
    const novo = value + tecla;
    onChange(novo);
    if (novo.length === digits) onComplete(novo);
  }

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) digitar(e.key);
      if (e.key === 'Backspace') digitar('apagar');
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-label text-ink">{label}</p>
      <div
        className="flex gap-4"
        role="status"
        aria-label={`${value.length} de ${digits} números digitados`}
      >
        {Array.from({ length: digits }, (_, i) => (
          <span
            key={i}
            className={cn(
              'size-4 rounded-pill border-2',
              i < value.length ? 'border-brand bg-brand' : 'border-line-strong',
              error && 'border-danger',
            )}
          />
        ))}
      </div>
      <p role="alert" className="min-h-6 text-center text-body text-danger">
        {error}
      </p>
      <div className="grid w-full max-w-72 grid-cols-3 gap-3">
        {TECLAS.map((tecla, i) =>
          tecla === '' ? (
            <span key={i} />
          ) : (
            <button
              key={tecla}
              type="button"
              disabled={disabled}
              onClick={() => digitar(tecla)}
              aria-label={tecla === 'apagar' ? 'Apagar' : tecla}
              className="flex h-16 items-center justify-center rounded-lg bg-surface font-display text-title-screen text-ink hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
            >
              {tecla === 'apagar' ? <Icon name="voltar" /> : tecla}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
