import type { ItemCarrinho } from '@usefood/core';

/** Dados que o cliente já digitou, para não digitar de novo no próximo pedido. */
export interface DadosDoCliente {
  nome: string;
  celular: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  referencia: string;
}

export const CLIENTE_VAZIO: DadosDoCliente = {
  nome: '',
  celular: '',
  cep: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  referencia: '',
};

function ler<T>(chave: string, padrao: T): T {
  try {
    const texto = localStorage.getItem(chave);
    return texto ? (JSON.parse(texto) as T) : padrao;
  } catch {
    return padrao;
  }
}
function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // sem armazenamento: só não lembra
  }
}

export const lerSacola = (lojaId: string) => ler<ItemCarrinho[]>(`usefood.sacola.${lojaId}`, []);
export const gravarSacola = (lojaId: string, itens: ItemCarrinho[]) =>
  gravar(`usefood.sacola.${lojaId}`, itens);
export const lerCliente = () => ({
  ...CLIENTE_VAZIO,
  ...ler<Partial<DadosDoCliente>>('usefood.cliente', {}),
});
export const gravarCliente = (dados: DadosDoCliente) => gravar('usefood.cliente', dados);
