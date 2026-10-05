import { useAppContext } from './app-context';
import type { ReactNode } from 'react';

/**
 * Moldura das telas. Estreita para entrar (login); `larga` para os painéis:
 * no computador cresce e esconde a marca do topo (o menu lateral já mostra).
 */
export function Tela({ children, larga = false }: { children: ReactNode; larga?: boolean }) {
  const { brand } = useAppContext();
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full flex-col gap-10 px-5 py-10 ${
        larga ? 'max-w-3xl lg:max-w-6xl lg:gap-8 lg:px-10 lg:py-8' : 'max-w-md'
      }`}
    >
      <span className={`font-display text-wordmark text-ink ${larga ? 'lg:hidden' : ''}`}>
        {brand}
      </span>
      <div className="flex flex-col gap-8">{children}</div>
    </main>
  );
}

/** Cabeçalho da página; no computador as ações ficam à direita do título. */
export function Titulo({
  titulo,
  texto,
  acoes,
}: {
  titulo: string;
  texto: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-title-screen text-ink">{titulo}</h1>
        <p className="text-body text-ink-muted">{texto}</p>
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </header>
  );
}

/** Duas colunas no computador; uma embaixo da outra no celular. */
export function Colunas({ esquerda, direita }: { esquerda: ReactNode; direita: ReactNode }) {
  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="flex flex-col gap-8 lg:gap-6">{esquerda}</div>
      <div className="flex flex-col gap-8 lg:gap-6">{direita}</div>
    </div>
  );
}

/** Botão de voltar das telas de gestão: só no celular (no computador, o menu lateral navega). */
export const SO_NO_CELULAR = 'lg:hidden';
