export type SituacaoDoPedido =
  'aberto' | 'aguardando' | 'em_preparo' | 'pronto' | 'em_entrega' | 'concluido' | 'cancelado';

export interface Etapa {
  rotulo: string;
  estado: 'feito' | 'atual' | 'futuro';
}

/** Linha do tempo que o cliente vê, conforme o tipo (entrega ou retirada) e a situação. */
export function etapasDoPedido(
  tipo: 'delivery' | 'retirada' | string,
  situacao: SituacaoDoPedido,
): Etapa[] {
  const rotulos =
    tipo === 'delivery'
      ? ['Pedido enviado', 'Em preparo', 'Saiu para entrega', 'Entregue']
      : ['Pedido enviado', 'Em preparo', 'Pronto para retirar', 'Retirado'];
  const posicao: Record<SituacaoDoPedido, number> = {
    aberto: 0,
    aguardando: 0,
    em_preparo: 1,
    // Na entrega, "pronto" ainda espera o entregador sair
    pronto: tipo === 'delivery' ? 1 : 2,
    em_entrega: 2,
    concluido: 4,
    cancelado: -1,
  };
  const atual = posicao[situacao];
  return rotulos.map((rotulo, i) => ({
    rotulo,
    estado: atual === -1 ? 'futuro' : i < atual ? 'feito' : i === atual ? 'atual' : 'futuro',
  }));
}

/** Frase principal da página de acompanhamento. */
export function fraseDoPedido(tipo: string, situacao: SituacaoDoPedido): string {
  switch (situacao) {
    case 'aberto':
    case 'aguardando':
      return 'Esperando a loja aceitar o pedido';
    case 'em_preparo':
      return 'A loja aceitou e está preparando';
    case 'pronto':
      return tipo === 'delivery'
        ? 'Pronto, esperando o entregador'
        : 'Pronto! Pode retirar na loja';
    case 'em_entrega':
      return 'Saiu para entrega';
    case 'concluido':
      return tipo === 'delivery' ? 'Entregue. Bom apetite!' : 'Retirado. Bom apetite!';
    case 'cancelado':
      return 'Pedido não aceito pela loja';
  }
}
