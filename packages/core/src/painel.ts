export type ChaveDoPeriodo = 'hoje' | '7dias' | '30dias' | 'mes';

export const PERIODOS: { value: ChaveDoPeriodo; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7dias', label: '7 dias' },
  { value: '30dias', label: '30 dias' },
  { value: 'mes', label: 'Este mês' },
];

/** Início e fim do período no horário do aparelho (fim = meia-noite de amanhã). */
export function periodo(chave: ChaveDoPeriodo, agora: Date): { inicio: Date; fim: Date } {
  const meiaNoite = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const fim = new Date(meiaNoite);
  fim.setDate(fim.getDate() + 1);
  const inicio = new Date(meiaNoite);
  if (chave === '7dias') inicio.setDate(inicio.getDate() - 6);
  if (chave === '30dias') inicio.setDate(inicio.getDate() - 29);
  if (chave === 'mes') inicio.setDate(1);
  return { inicio, fim };
}

/** "+12%" em verde, "−5%" em vermelho; sem base de comparação, "novo". */
export function variacao(
  atual: number,
  anterior: number,
): { texto: string; tom: 'alta' | 'baixa' | 'igual' } {
  if (anterior === 0)
    return atual === 0 ? { texto: '—', tom: 'igual' } : { texto: 'novo', tom: 'alta' };
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return { texto: '0%', tom: 'igual' };
  return pct > 0
    ? { texto: `+${pct}%`, tom: 'alta' }
    : { texto: `−${Math.abs(pct)}%`, tom: 'baixa' };
}

/** Planilha (CSV com ponto e vírgula, que o Excel em português abre direto). */
export function csv(linhas: (string | number)[][]): string {
  const celula = (v: string | number) => {
    const t = String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return '\uFEFF' + linhas.map((l) => l.map(celula).join(';')).join('\r\n');
}

/** Centavos como número de planilha em português: 1234 → "12,34". */
export const reaisNaPlanilha = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',');

export type Segmento = 'todos' | 'frequentes' | 'novos' | 'sumidos';
const DIA_MS = 86_400_000;

/** Cliente novo (primeiro pedido nos últimos 30 dias), frequente (3+ pedidos) ou sumido (sem pedir há 30+ dias). */
export function noSegmento(
  cliente: { pedidos: number; primeiro_em: string; ultimo_em: string },
  segmento: Segmento,
  agora: Date,
): boolean {
  const dias = (iso: string) => (agora.getTime() - new Date(iso).getTime()) / DIA_MS;
  if (segmento === 'novos') return dias(cliente.primeiro_em) <= 30;
  if (segmento === 'frequentes') return cliente.pedidos >= 3;
  if (segmento === 'sumidos') return dias(cliente.ultimo_em) > 30;
  return true;
}
