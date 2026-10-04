export type TipoIdentificador = 'senha' | 'nome' | 'mesa' | 'comanda';
export type TipoPedido = 'balcao' | 'mesa' | 'retirada' | 'delivery';

/** Como a conta aparece na tela: "Mesa 12", "Senha 047", "João". */
export function rotuloDaConta(tipo: TipoIdentificador, identificador: string): string {
  if (tipo === 'mesa') return `Mesa ${identificador}`;
  if (tipo === 'senha') return `Senha ${identificador}`;
  if (tipo === 'comanda') return `Comanda ${identificador}`;
  return identificador;
}

const TIPOS: Record<TipoPedido, string> = {
  balcao: 'Balcão',
  mesa: 'Mesa',
  retirada: 'Retirada',
  delivery: 'Delivery',
};
export const rotuloDoTipo = (tipo: TipoPedido) => TIPOS[tipo];

/** A taxa de serviço vem ligada só nas mesas; nas outras contas fica desligada. */
export const taxaPadrao = (tipo: TipoPedido) => tipo === 'mesa';

/** Jeito de atender configurado na loja. */
export interface Atendimento {
  /** Para viagem e balcão com retirada: chamar pela senha ou pelo nome. */
  chamarPor: 'senha' | 'nome';
  /** Comer no local pedindo no balcão: o cliente busca ou o garçom leva até a mesa. */
  balcao: 'cliente_busca' | 'garcom_leva';
}

export interface Identificacao {
  tipo: TipoIdentificador;
  /** Campo que o PDV precisa pedir; null quando a senha sai sozinha. */
  campo: { rotulo: string; numerico: boolean } | null;
}

const MESA = { rotulo: 'Número da mesa', numerico: true };
const NOME = { rotulo: 'Nome do cliente', numerico: false };

/** O que identificar em cada tipo de pedido, seguindo o jeito de atender da loja. */
export function identificacaoPara(tipo: TipoPedido, atendimento: Atendimento): Identificacao {
  if (tipo === 'mesa') return { tipo: 'mesa', campo: MESA };
  if (tipo === 'delivery') return { tipo: 'nome', campo: NOME };
  if (tipo === 'balcao' && atendimento.balcao === 'garcom_leva') {
    return { tipo: 'mesa', campo: { rotulo: 'Mesa onde o cliente está', numerico: true } };
  }
  return atendimento.chamarPor === 'nome'
    ? { tipo: 'nome', campo: NOME }
    : { tipo: 'senha', campo: null };
}
