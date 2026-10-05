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

export interface FaixaDeHorario {
  weekday: number;
  opens: string;
  closes: string;
}

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hora = (hhmm: string) => hhmm.slice(0, 5);

/**
 * Card de horário da loja: "Aberto · até 23:00" ou "Fechado · abre 18:00" / "abre amanhã 18:00" / "abre sexta 18:00".
 * `aberta` vem do banco (loja_aberta_agora); aqui só montamos a frase.
 */
export function resumoDoHorario(
  horarios: FaixaDeHorario[],
  aberta: boolean,
  agora: Date,
): { titulo: string; detalhe: string } {
  const dia = agora.getDay();
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  if (aberta) {
    const ontem = (dia + 6) % 7;
    const atual =
      horarios.find(
        (h) =>
          h.weekday === dia &&
          minutos(h.opens) <= agoraMin &&
          (minutos(h.closes) > agoraMin || minutos(h.closes) < minutos(h.opens)),
      ) ??
      horarios.find(
        (h) =>
          h.weekday === ontem &&
          minutos(h.closes) < minutos(h.opens) &&
          agoraMin < minutos(h.closes),
      );
    return { titulo: 'Aberto', detalhe: atual ? `até ${hora(atual.closes)}` : 'agora' };
  }
  for (let d = 0; d < 7; d++) {
    const semana = (dia + d) % 7;
    const proximas = horarios
      .filter((h) => h.weekday === semana && (d > 0 || minutos(h.opens) > agoraMin))
      .sort((a, b) => minutos(a.opens) - minutos(b.opens));
    if (proximas[0]) {
      const quando =
        d === 0 ? '' : d === 1 ? 'amanhã ' : `${DIAS_DA_SEMANA[semana]!.toLowerCase()} `;
      return { titulo: 'Fechado', detalhe: `abre ${quando}${hora(proximas[0].opens)}` };
    }
  }
  return { titulo: 'Fechado', detalhe: 'sem horário' };
}
