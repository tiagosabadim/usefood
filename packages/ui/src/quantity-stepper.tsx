import { Icon } from './icon';

/** − quantidade +, com alvos de 44 px. Tirar a última unidade cabe a quem usa decidir (remover o item). */
export function QuantityStepper({
  value,
  itemName,
  onDecrement,
  onIncrement,
}: {
  value: number;
  /** Para os rótulos: "Tirar um Pastel de carne". */
  itemName: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const botao =
    'flex size-11 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={botao}
        aria-label={`Tirar um ${itemName}`}
        onClick={onDecrement}
      >
        <Icon name="menos" size={18} />
      </button>
      <span className="w-8 text-center text-body-strong text-ink tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={botao}
        aria-label={`Mais um ${itemName}`}
        onClick={onIncrement}
      >
        <Icon name="mais" size={18} />
      </button>
    </div>
  );
}
