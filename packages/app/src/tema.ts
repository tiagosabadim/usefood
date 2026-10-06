import { useState } from 'react';

/** Aparência escolhida pela pessoa: segue o aparelho (padrão), sempre clara ou sempre escura. */
export type PreferenciaDeTema = 'sistema' | 'claro' | 'escuro';

const CHAVE = 'usefood.tema';

export function lerPreferenciaDeTema(): PreferenciaDeTema {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'claro' || v === 'escuro' ? v : 'sistema';
  } catch {
    return 'sistema';
  }
}

/** Liga o tema na página: data-theme="light|dark", ou nenhum para seguir o aparelho. */
export function aplicarPreferenciaDeTema(p: PreferenciaDeTema): void {
  const raiz = document.documentElement;
  if (p === 'sistema') delete raiz.dataset.theme;
  else raiz.dataset.theme = p === 'claro' ? 'light' : 'dark';
}

/** Tema que está na tela: a escolha da pessoa ou, sem escolha, o do aparelho. */
export function temaEfetivo(p: PreferenciaDeTema): 'claro' | 'escuro' {
  if (p !== 'sistema') return p;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

/**
 * Tema guardado neste aparelho, para todas as telas. Devolve o tema que está na tela
 * (claro ou escuro) e a função para trocar: o botão de sol e lua.
 */
export function usePreferenciaDeTema(): ['claro' | 'escuro', (p: 'claro' | 'escuro') => void] {
  const [preferencia, setPreferencia] = useState<PreferenciaDeTema>(lerPreferenciaDeTema);
  const mudar = (p: 'claro' | 'escuro') => {
    try {
      localStorage.setItem(CHAVE, p);
    } catch {
      // sem armazenamento: vale só nesta visita
    }
    aplicarPreferenciaDeTema(p);
    setPreferencia(p);
  };
  return [temaEfetivo(preferencia), mudar];
}
