import { formatarPreco } from './money';

export type ToneFechamento = 'sucesso' | 'destaque' | 'erro';

/** Como o fechamento aparece para quem contou o dinheiro. */
export function resultadoDoFechamento(diferencaCentavos: number): {
  texto: string;
  tom: ToneFechamento;
} {
  if (diferencaCentavos === 0) return { texto: 'Bateu certinho', tom: 'sucesso' };
  if (diferencaCentavos > 0)
    return { texto: `Sobrou ${formatarPreco(diferencaCentavos)}`, tom: 'destaque' };
  return { texto: `Faltou ${formatarPreco(-diferencaCentavos)}`, tom: 'erro' };
}

/** "08:12" no fuso de São Paulo, para mostrar quando o caixa abriu. */
export function horaCurta(iso: string, fuso = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: fuso,
  }).format(new Date(iso));
}
