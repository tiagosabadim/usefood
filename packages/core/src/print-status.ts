/** Computador de impressão como o PDV enxerga. */
export interface AgenteResumo {
  id: string;
  nome: string;
  vistoEm: string | null;
  desligado: boolean;
}

/** Ordem de impressão recente (pendente ou com falha). */
export interface ImpressaoResumo {
  id: string;
  pedidoId: string | null;
  status: 'pendente' | 'imprimindo' | 'impresso' | 'falhou';
  criadaEm: string;
  praca: string;
  identificador: string | null;
  erro: string | null;
}

export interface AlertaDeImpressao {
  chave: string;
  texto: string;
  /** Pedido que pode ser reimpresso a partir do alerta. */
  pedidoId: string | null;
}

/** Sem sinal há mais de 45 s (o agente avisa a cada 15 s): desligado. */
export const LIMITE_PRESENCA_MS = 45_000;
/** Ordem esperando há mais de 20 s: a impressão travou. */
export const LIMITE_FILA_MS = 20_000;

export function agenteLigado(agente: AgenteResumo, agora: number): boolean {
  return (
    !agente.desligado &&
    agente.vistoEm !== null &&
    agora - Date.parse(agente.vistoEm) <= LIMITE_PRESENCA_MS
  );
}

/** "agora", "há 3 min", "há 2 h", "há 3 dias" */
export function tempoDesde(iso: string, agora: number): string {
  const segundos = Math.max(0, Math.round((agora - Date.parse(iso)) / 1000));
  if (segundos < 60) return 'agora';
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

/** O que o PDV deve avisar sobre a impressão agora. Lista vazia = está tudo bem. */
export function alertasDeImpressao(
  agentes: readonly AgenteResumo[],
  temImpressoras: boolean,
  impressoes: readonly ImpressaoResumo[],
  agora: number,
): AlertaDeImpressao[] {
  const alertas: AlertaDeImpressao[] = [];
  const ativos = agentes.filter((a) => !a.desligado);

  if (temImpressoras && ativos.length > 0 && !ativos.some((a) => agenteLigado(a, agora))) {
    alertas.push({
      chave: 'agente-desligado',
      texto:
        'O computador de impressão está desligado ou sem internet. Os pedidos não estão saindo na cozinha.',
      pedidoId: null,
    });
  } else if (temImpressoras && ativos.length === 0) {
    alertas.push({
      chave: 'sem-agente',
      texto:
        'Nenhum computador de impressão conectado. Conecte um na tela Impressão para os pedidos saírem na cozinha.',
      pedidoId: null,
    });
  }

  for (const i of impressoes) {
    const quem = i.identificador ? ` (${i.identificador})` : '';
    if (i.status === 'falhou') {
      alertas.push({
        chave: `falhou-${i.id}`,
        texto: `O pedido${quem} não imprimiu na ${i.praca}: ${(i.erro ?? 'erro na impressora').replace(/\.+$/, '')}.`,
        pedidoId: i.pedidoId,
      });
    } else if (
      (i.status === 'pendente' || i.status === 'imprimindo') &&
      agora - Date.parse(i.criadaEm) > LIMITE_FILA_MS &&
      !alertas.some((a) => a.chave === 'agente-desligado')
    ) {
      alertas.push({
        chave: `parado-${i.id}`,
        texto: `O pedido${quem} está esperando para imprimir na ${i.praca} há mais de 20 segundos.`,
        pedidoId: i.pedidoId,
      });
    }
  }
  return alertas;
}
