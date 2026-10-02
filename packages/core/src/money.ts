const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 1400 → "R$ 14,00". Dinheiro circula sempre em centavos inteiros. */
export function formatarPreco(centavos: number): string {
  return BRL.format(centavos / 100);
}

/**
 * Lê o que a pessoa digitou como preço: "14", "14,5", "R$ 1.234,56".
 * Retorna centavos, ou null se não for um preço válido.
 */
export function lerPreco(texto: string): number | null {
  const limpo = texto
    .replace(/[R$\s\u00a0]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(Number(limpo) * 100);
}

/** 1400 → "14,00", para preencher o campo de edição. */
export function precoParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}
