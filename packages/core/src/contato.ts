/** Só os números: "(17) 99123-4567" → "17991234567". */
export const soNumeros = (texto: string) => texto.replace(/\D/g, '');

/** Telefone com DDD (10 ou 11 números) ou null. */
export function lerTelefone(texto: string): string | null {
  const n = soNumeros(texto);
  return /^[0-9]{10,11}$/.test(n) ? n : null;
}

/** "17991234567" → "(17) 99123-4567" */
export function formatarTelefone(numeros: string): string {
  const n = soNumeros(numeros);
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return numeros;
}

/** CEP com 8 números ou null. */
export function lerCep(texto: string): string | null {
  const n = soNumeros(texto);
  return n.length === 8 ? n : null;
}

export const DIAS_DA_SEMANA = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;
