/** Regra do grupo de adicionais em português: "Obrigatório, escolha 1", "Opcional, até 3". */
export function regraDoGrupo(minimo: number, maximo: number | null): string {
  if (minimo <= 0) return maximo === null ? 'Opcional, sem limite' : `Opcional, até ${maximo}`;
  if (maximo === minimo) return `Obrigatório, escolha ${minimo}`;
  if (maximo === null) return `Escolha pelo menos ${minimo}`;
  return `Escolha de ${minimo} a ${maximo}`;
}

/** Valida a regra antes de salvar; retorna a mensagem de erro ou null. */
export function erroNaRegra(minimo: number, maximo: number | null): string | null {
  if (!Number.isInteger(minimo) || minimo < 0) return 'O mínimo precisa ser 0 ou mais.';
  if (maximo !== null && (!Number.isInteger(maximo) || maximo < Math.max(minimo, 1))) {
    return minimo > 0
      ? `O máximo precisa ser ${minimo} ou mais.`
      : 'O máximo precisa ser 1 ou mais, ou fique em branco para sem limite.';
  }
  return null;
}

/** Medidas para reduzir uma foto sem distorcer: o lado maior fica com no máximo `limite` px. */
export function dimensoesReduzidas(largura: number, altura: number, limite: number) {
  const escala = Math.min(1, limite / Math.max(largura, altura));
  return { largura: Math.round(largura * escala), altura: Math.round(altura * escala) };
}
