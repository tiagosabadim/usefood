export type SituacaoDoPedido =
  'aberto' | 'aguardando' | 'em_preparo' | 'pronto' | 'em_entrega' | 'concluido' | 'cancelado';

export interface Etapa {
  rotulo: string;
  estado: 'feito' | 'atual' | 'futuro';
}

const ETAPAS_DA_ENTREGA = [
  'Aguardando o restaurante aceitar',
  'Pedido aceito',
  'Em preparação',
  'Pronto',
  'Pedido a caminho',
  'Pedido entregue',
];
const ETAPAS_DA_RETIRADA = [
  'Aguardando o restaurante aceitar',
  'Pedido aceito',
  'Em preparação',
  'Pronto para retirar',
  'Retirado',
];

/**
 * Linha do tempo que o cliente vê. "Pedido aceito" fica feito assim que a loja aceita
 * (a situação passa a "em preparo", e a etapa atual é "Em preparação").
 */
export function etapasDoPedido(
  tipo: 'delivery' | 'retirada' | string,
  situacao: SituacaoDoPedido,
): Etapa[] {
  const entrega = tipo === 'delivery';
  const rotulos = entrega ? ETAPAS_DA_ENTREGA : ETAPAS_DA_RETIRADA;
  const posicao: Record<SituacaoDoPedido, number> = {
    aberto: 0,
    aguardando: 0,
    em_preparo: 2,
    pronto: 3,
    em_entrega: entrega ? 4 : 3,
    concluido: rotulos.length,
    cancelado: -1,
  };
  const atual = posicao[situacao];
  return rotulos.map((rotulo, i) => ({
    rotulo,
    estado: atual === -1 ? 'futuro' : i < atual ? 'feito' : i === atual ? 'atual' : 'futuro',
  }));
}

/** Frase principal do acompanhamento e do card no topo da loja. */
export function fraseDoPedido(tipo: string, situacao: SituacaoDoPedido): string {
  switch (situacao) {
    case 'aberto':
    case 'aguardando':
      return 'Aguardando o restaurante aceitar';
    case 'em_preparo':
      return 'Pedido aceito · em preparação';
    case 'pronto':
      return tipo === 'delivery'
        ? 'Pronto · aguardando o entregador'
        : 'Pronto! Pode retirar na loja';
    case 'em_entrega':
      return 'Pedido a caminho';
    case 'concluido':
      return tipo === 'delivery' ? 'Pedido entregue. Bom apetite!' : 'Retirado. Bom apetite!';
    case 'cancelado':
      return 'Pedido não aceito pelo restaurante';
  }
}
