import { useId, useRef } from 'react';
import { Button } from './button';

export interface PhotoFieldProps {
  label: string;
  /** Foto atual; sem ela, aparece o espaço reservado. */
  imageUrl?: string | null;
  onSelect: (arquivo: File) => void;
  onRemove?: () => void;
  /** Reabre o enquadramento da foto atual. */
  onAdjust?: () => void;
  /** Formato da prévia: 4:3 (produto, padrão), 1 (logo) ou 3 (capa). */
  aspect?: number;
  /** Texto do espaço vazio. */
  placeholder?: string;
  /** Enviando: o botão mostra "Aguarde…". */
  busy?: boolean;
  error?: string | undefined;
}

/** Escolher, trocar ou remover a foto de um produto, com prévia quadrada. */
export function PhotoField({
  label,
  imageUrl,
  onSelect,
  onRemove,
  onAdjust,
  busy,
  error,
  aspect = 4 / 3,
  placeholder = 'foto do produto',
}: PhotoFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-label text-ink">
        {label}
      </span>
      <div className="flex items-center gap-4">
        <div
          className="flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-strong"
          style={{
            aspectRatio: String(aspect),
            width: aspect > 2 ? '15rem' : aspect === 1 ? '7rem' : '9rem',
          }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="px-2 text-center text-caption text-ink-muted">{placeholder}</span>
          )}
        </div>
        <div className="flex flex-col items-start gap-1">
          <Button
            variant="secondary"
            loading={busy}
            aria-describedby={id}
            onClick={() => input.current?.click()}
          >
            {imageUrl ? 'Trocar foto' : 'Escolher foto'}
          </Button>
          {imageUrl && onAdjust && !busy && (
            <Button variant="ghost" onClick={onAdjust}>
              Ajustar enquadramento
            </Button>
          )}
          {imageUrl && onRemove && !busy && (
            <Button variant="ghost" onClick={onRemove}>
              Remover foto
            </Button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) onSelect(arquivo);
          e.target.value = '';
        }}
      />
      <p className={error ? 'text-caption text-danger' : 'text-caption text-ink-muted'}>
        {error || 'Depois de escolher, você enquadra a foto no formato padrão. JPG, PNG ou WebP.'}
      </p>
    </div>
  );
}
