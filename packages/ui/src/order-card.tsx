import type { ReactNode } from 'react';
import { cn } from './cn';

export interface OrderCardItem {
  id: string;
  quantidade: number;
  nome: string;
  /** Tamanho e adicionais, um por linha. */
  detalhes: string[];
  observacao?: string | null;
  /** Já feito nesta praça: aparece riscado. */
  feito?: boolean;
}

export type OrderCardTone = 'normal' | 'atencao' | 'atrasado';

export interface OrderCardProps {
  /** O que a cozinha grita: "Senha 047", "Mesa 12", "João". */
  title: string;
  /** "Pedido #047 · Balcão" */
  subtitle: string;
  /** Tempo de espera, já formatado: "4:07". */
  timer: string;
  tone: OrderCardTone;
  items: OrderCardItem[];
  /** Ação principal no rodapé (Pronto). */
  action?: ReactNode;
}

const FAIXA: Record<OrderCardTone, string> = {
  normal: 'bg-surface-strong text-ink',
  atencao: 'bg-sun text-sun-ink',
  atrasado: 'bg-danger text-canvas',
};
const ROTULO_DO_TEMPO: Record<OrderCardTone, string> = {
  normal: '',
  atencao: ' · atenção',
  atrasado: ' · atrasado',
};

/** Cartão de pedido da tela da cozinha: legível de longe, com o tempo de espera em cor. */
export function OrderCard({ title, subtitle, timer, tone, items, action }: OrderCardProps) {
  return (
    <article
      aria-label={`${title}, esperando ${timer}`}
      className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface"
    >
      <header className={cn('flex items-start justify-between gap-3 px-4 py-3', FAIXA[tone])}>
        <div className="min-w-0">
          <h3 className="truncate font-display text-title-section">{title}</h3>
          <p className="text-caption opacity-90">{subtitle}</p>
        </div>
        <span className="shrink-0 font-display text-title-section tabular-nums">
          {timer}
          <span className="sr-only">{ROTULO_DO_TEMPO[tone]}</span>
        </span>
      </header>
      <ul className="flex flex-1 flex-col gap-3 px-4 py-3">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn('flex flex-col gap-1', item.feito && 'text-ink-muted line-through')}
          >
            <span className={cn('text-title-card', item.feito ? 'text-ink-muted' : 'text-ink')}>
              <span className="tabular-nums">{item.quantidade}×</span> {item.nome}
            </span>
            {item.detalhes.map((d) => (
              <span key={d} className="pl-6 text-body text-ink-muted">
                {d}
              </span>
            ))}
            {item.observacao && (
              <span className="ml-6 self-start rounded-sm bg-sun px-2 py-0.5 text-body-strong text-sun-ink">
                {item.observacao}
              </span>
            )}
          </li>
        ))}
      </ul>
      {action && <footer className="border-t border-line p-3">{action}</footer>}
    </article>
  );
}
