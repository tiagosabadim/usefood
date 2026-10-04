/** O que fica guardado no aparelho depois de conectado à loja. */
export interface Aparelho {
  token: string;
  loja: string;
  restaurante: string;
}

const CHAVE = 'usefood.aparelho';

export function lerAparelho(): Aparelho | null {
  try {
    const texto = localStorage.getItem(CHAVE);
    return texto ? (JSON.parse(texto) as Aparelho) : null;
  } catch {
    return null;
  }
}

export function salvarAparelho(aparelho: Aparelho): void {
  localStorage.setItem(CHAVE, JSON.stringify(aparelho));
}

export function esquecerAparelho(): void {
  localStorage.removeItem(CHAVE);
}

/** Mensagem "erro" do corpo de uma Edge Function, e se o aparelho foi desconectado. */
export async function lerErroDaFuncao(
  erro: unknown,
): Promise<{ mensagem: string; desconectado: boolean }> {
  const contexto = (
    erro as { context?: { json?: () => Promise<{ erro?: string; desconectado?: boolean }> } } | null
  )?.context;
  try {
    const corpo = await contexto?.json?.();
    if (corpo?.erro) return { mensagem: corpo.erro, desconectado: corpo.desconectado === true };
  } catch {
    // corpo não era JSON
  }
  return { mensagem: 'Sem conexão. Confira a internet e tente de novo.', desconectado: false };
}
