import { lerPreco } from './money';

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

export type Papel = 'dono' | 'gerente' | 'caixa' | 'garcom' | 'cozinha' | 'entregador';
const PAPEIS: Record<Papel, string> = {
  dono: 'Dono',
  gerente: 'Gerente',
  caixa: 'Caixa',
  garcom: 'Garçom',
  cozinha: 'Cozinha',
  entregador: 'Entregador',
};
export const rotuloDoPapel = (papel: Papel) => PAPEIS[papel];

export type MetodoPagamento = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'vale_refeicao' | 'outro';

/** O que a pessoa escolheu antes de lançar: tipo, identificação e, no delivery e na retirada, como vai pagar. */
export interface DadosDoPedido {
  tipo: TipoPedido;
  identificador: string;
  previsto: MetodoPagamento | null;
  trocoPara: string;
}

export const DADOS_INICIAIS: DadosDoPedido = {
  tipo: 'balcao',
  identificador: '',
  previsto: null,
  trocoPara: '',
};

export type ParametrosDoPedido =
  | {
      ok: true;
      identificacao: Identificacao;
      p_tipo: TipoPedido;
      p_identificador_tipo: TipoIdentificador;
      p_identificador: string | null;
      p_pagamento_previsto: MetodoPagamento | null;
      p_troco_para_cents: number | null;
    }
  | { ok: false; motivo: string };

/** Confere os dados e monta o que vai para criar_pedido; igual no PDV e na comanda. */
export function parametrosDoPedido(
  dados: DadosDoPedido,
  atendimento: Atendimento,
): ParametrosDoPedido {
  const identificacao = identificacaoPara(dados.tipo, atendimento);
  const valor = dados.identificador.trim();
  if (identificacao.campo && !valor) {
    return {
      ok: false,
      motivo:
        identificacao.tipo === 'mesa' ? 'Digite o número da mesa.' : 'Digite o nome do cliente.',
    };
  }
  const pagaNaEntrega = dados.tipo === 'delivery' || dados.tipo === 'retirada';
  const previsto = pagaNaEntrega ? dados.previsto : null;
  let troco: number | null = null;
  if (previsto === 'dinheiro' && dados.trocoPara.trim()) {
    troco = lerPreco(dados.trocoPara);
    if (troco === null) return { ok: false, motivo: 'Confira o troco, por exemplo 100,00.' };
  }
  return {
    ok: true,
    identificacao,
    p_tipo: dados.tipo,
    p_identificador_tipo: identificacao.tipo,
    p_identificador: identificacao.campo ? valor : null,
    p_pagamento_previsto: previsto,
    p_troco_para_cents: troco,
  };
}
