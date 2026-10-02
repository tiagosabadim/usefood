import { useAppContext } from '@usefood/app';
import type { ReactNode } from 'react';

/** Moldura das telas de entrada: marca no topo e conteúdo numa coluna estreita. */
export function Tela({ children }: { children: ReactNode }) {
  const { brand } = useAppContext();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-10 px-5 py-10">
      <span className="font-display text-wordmark text-ink">{brand}</span>
      <div className="flex flex-col gap-8">{children}</div>
    </main>
  );
}

export function Titulo({ titulo, texto }: { titulo: string; texto: ReactNode }) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="font-display text-title-screen text-ink">{titulo}</h1>
      <p className="text-body text-ink-muted">{texto}</p>
    </header>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-body text-danger">
      {children}
    </p>
  );
}
