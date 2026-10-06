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

/** Preferência de aparência guardada neste aparelho, para todas as telas. */
export function usePreferenciaDeTema(): [PreferenciaDeTema, (p: PreferenciaDeTema) => void] {
  const [preferencia, setPreferencia] = useState<PreferenciaDeTema>(lerPreferenciaDeTema);
  const mudar = (p: PreferenciaDeTema) => {
    try {
      localStorage.setItem(CHAVE, p);
    } catch {
      // sem armazenamento: vale só nesta visita
    }
    aplicarPreferenciaDeTema(p);
    setPreferencia(p);
  };
  return [preferencia, mudar];
}
