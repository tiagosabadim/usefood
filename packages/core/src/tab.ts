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
