import type { ReactNode } from 'react';
import { Panel } from './panel';

/** Tela ou bloco sem conteúdo ainda: diz o que é e qual o primeiro passo. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Panel className="items-start gap-4 p-6">
      <h2 className="font-display text-title-section text-ink">{title}</h2>
      <p className="text-body text-ink-muted">{description}</p>
      {action}
    </Panel>
  );
}
