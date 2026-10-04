export type NivelDeAtraso = 'normal' | 'atencao' | 'atrasado';

/** Limites padrão da cozinha, em minutos. */
export const LIMITES_DA_COZINHA = { atencao: 8, atraso: 15 } as const;

/** Tempo desde o pedido como relógio: "4:07", "12:30", "1:05:09". */
export function cronometro(desdeIso: string, agora: number): string {
  const total = Math.max(0, Math.floor((agora - Date.parse(desdeIso)) / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = String(total % 60).padStart(2, '0');
  return horas > 0
    ? `${horas}:${String(minutos).padStart(2, '0')}:${segundos}`
    : `${minutos}:${segundos}`;
}

/** Cor do cartão pelo tempo de espera. */
export function nivelDeAtraso(
  desdeIso: string,
  agora: number,
  limites: { atencao: number; atraso: number } = LIMITES_DA_COZINHA,
): NivelDeAtraso {
  const minutos = (agora - Date.parse(desdeIso)) / 60_000;
  if (minutos >= limites.atraso) return 'atrasado';
  if (minutos >= limites.atencao) return 'atencao';
  return 'normal';
}

/** Itens que a praça ainda precisa fazer; sem praça escolhida, todos os pendentes. */
export function pendentesDaPraca<
  T extends { station_id: string | null; prepared_at: string | null },
>(itens: readonly T[], pracaId: string | null): T[] {
  return itens.filter(
    (i) => i.prepared_at === null && (pracaId === null || i.station_id === pracaId),
  );
}
