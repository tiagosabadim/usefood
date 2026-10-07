import { useEffect, useState } from 'react';

/** Caminho atual da página, que muda sem recarregar (voltar e avançar do navegador funcionam). */
export function useCaminho(): string {
  const [caminho, setCaminho] = useState(() => window.location.pathname);
  useEffect(() => {
    const aoMudar = () => setCaminho(window.location.pathname);
    window.addEventListener('popstate', aoMudar);
    return () => window.removeEventListener('popstate', aoMudar);
  }, []);
  return caminho;
}

/** Quantos passos de navegação dentro do app até esta página (fica guardado no histórico). */
const passos = (): number => (window.history.state as { passos?: number } | null)?.passos ?? 0;

export function navegar(caminho: string, opcoes: { substituir?: boolean } = {}): void {
  if (opcoes.substituir) window.history.replaceState({ passos: passos() }, '', caminho);
  else window.history.pushState({ passos: passos() + 1 }, '', caminho);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

/**
 * Voltar do app: a tela anterior, se a pessoa chegou aqui navegando pelo app;
 * senão (abriu esta tela direto), a tela de destino, sem sair do app.
 */
export function voltar(destino: string): void {
  if (passos() > 0) window.history.back();
  else navegar(destino, { substituir: true });
}
