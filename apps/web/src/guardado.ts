import type { ItemCarrinho } from '@usefood/core';

/**
 * Conta do cliente NESTE aparelho: criada sozinha no primeiro pedido.
 * Fica no aparelho (e não no servidor) porque ainda não confirmamos o celular por código:
 * sem isso, qualquer um digitaria o número de outra pessoa e veria os endereços dela.
 * Quando entrar a conta única (com código no celular), estes dados sobem para o servidor.
 */
export interface EnderecoSalvo {
  id: string;
  apelido: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  referencia: string;
}

export interface PedidoGuardado {
  token: string;
  lojaSlug: string;
  lojaNome: string;
  numero: number;
  criadoEm: string;
}

export interface Conta {
  nome: string;
  celular: string;
  enderecos: EnderecoSalvo[];
  pedidos: PedidoGuardado[];
}

export const ENDERECO_EM_BRANCO: Omit<EnderecoSalvo, 'id'> = {
  apelido: '',
  cep: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  referencia: '',
};

const CHAVE = 'usefood.conta';
const CONTA_VAZIA: Conta = { nome: '', celular: '', enderecos: [], pedidos: [] };

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

export const novoId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();

export function lerConta(): Conta {
  const conta = ler<Conta | null>(CHAVE, null);
  if (conta) return { ...CONTA_VAZIA, ...conta };
  // Dados do jeito antigo (um endereço só): viram o endereço "Casa"
  const antigo = ler<
    (Partial<Omit<EnderecoSalvo, 'id' | 'apelido'>> & { nome?: string; celular?: string }) | null
  >('usefood.cliente', null);
  if (!antigo) return CONTA_VAZIA;
  const migrada: Conta = {
    nome: antigo.nome ?? '',
    celular: antigo.celular ?? '',
    enderecos: antigo.rua
      ? [{ ...ENDERECO_EM_BRANCO, ...antigo, id: novoId(), apelido: 'Casa' } as EnderecoSalvo]
      : [],
    pedidos: [],
  };
  gravar(CHAVE, migrada);
  return migrada;
}

export const gravarConta = (conta: Conta) => gravar(CHAVE, conta);
export const temConta = (conta: Conta) => Boolean(conta.nome && conta.celular);

/** Pedidos recentes desta loja (para o card de acompanhamento). */
export function pedidosRecentes(conta: Conta, lojaSlug?: string, horas = 24): PedidoGuardado[] {
  const limite = Date.now() - horas * 3_600_000;
  return conta.pedidos.filter(
    (p) => (!lojaSlug || p.lojaSlug === lojaSlug) && new Date(p.criadoEm).getTime() > limite,
  );
}

export const lerSacola = (lojaId: string) => ler<ItemCarrinho[]>(`usefood.sacola.${lojaId}`, []);
export const gravarSacola = (lojaId: string, itens: ItemCarrinho[]) =>
  gravar(`usefood.sacola.${lojaId}`, itens);
