import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Texto de apoio abaixo do campo. */
  hint?: ReactNode;
  /** Mensagem de erro; quando existe, substitui o hint e marca o campo como inválido. */
  error?: string | undefined;
}

/** Campo com rótulo sempre visível, ajuda e erro ligados ao input para leitores de tela. */
export function TextField({ label, hint, error, className, ...props }: TextFieldProps) {
  const id = useId();
  const helpId = `${id}-ajuda`;
  const help = error || hint;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-label text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={help ? helpId : undefined}
        className={cn(
          'h-target-control rounded-md border bg-canvas px-4 text-body text-ink',
          'placeholder:text-ink-muted focus:outline-2 focus:outline-offset-2 focus:outline-brand',
          error ? 'border-danger' : 'border-line-strong',
        )}
        {...props}
      />
      {help && (
        <p id={helpId} className={cn('text-caption', error ? 'text-danger' : 'text-ink-muted')}>
          {help}
        </p>
      )}
    </div>
  );
}
