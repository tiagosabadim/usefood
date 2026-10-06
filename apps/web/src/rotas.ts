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

export function navegar(caminho: string, opcoes: { substituir?: boolean } = {}): void {
  if (opcoes.substituir) window.history.replaceState(null, '', caminho);
  else window.history.pushState(null, '', caminho);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}
