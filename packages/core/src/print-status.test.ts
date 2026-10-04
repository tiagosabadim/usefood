import { describe, expect, it } from 'vitest';
import {
  agenteLigado,
  alertasDeImpressao,
  tempoDesde,
  type AgenteResumo,
  type ImpressaoResumo,
} from './print-status';

const agora = Date.parse('2026-10-04T18:00:00Z');
const seg = (s: number) => new Date(agora - s * 1000).toISOString();
const agente = (vistoHa: number | null, desligado = false): AgenteResumo => ({
  id: 'a',
  nome: 'Caixa',
  vistoEm: vistoHa === null ? null : seg(vistoHa),
  desligado,
});
const impressao = (
  status: ImpressaoResumo['status'],
  criadaHa: number,
  erro: string | null = null,
): ImpressaoResumo => ({
  id: `j-${status}-${criadaHa}`,
  pedidoId: 'p1',
  status,
  criadaEm: seg(criadaHa),
  praca: 'Cozinha',
  identificador: '047',
  erro,
});

describe('agenteLigado', () => {
  it('ligado até 45 s sem sinal', () => {
    expect(agenteLigado(agente(10), agora)).toBe(true);
    expect(agenteLigado(agente(60), agora)).toBe(false);
    expect(agenteLigado(agente(5, true), agora)).toBe(false);
  });
});

describe('alertasDeImpressao', () => {
  it('tudo certo: nenhum alerta', () => {
    expect(alertasDeImpressao([agente(5)], true, [impressao('pendente', 3)], agora)).toEqual([]);
  });

  it('computador sem sinal', () => {
    const [alerta] = alertasDeImpressao([agente(120)], true, [], agora);
    expect(alerta?.chave).toBe('agente-desligado');
  });

  it('impressoras cadastradas sem nenhum computador', () => {
    expect(alertasDeImpressao([], true, [], agora)[0]?.chave).toBe('sem-agente');
  });

  it('sem impressoras cadastradas, não incomoda', () => {
    expect(alertasDeImpressao([], false, [], agora)).toEqual([]);
  });

  it('falha mostra o motivo e permite reimprimir', () => {
    const [alerta] = alertasDeImpressao(
      [agente(5)],
      true,
      [impressao('falhou', 30, 'A impressora não respondeu.')],
      agora,
    );
    expect(alerta?.texto).toBe(
      'O pedido (047) não imprimiu na Cozinha: A impressora não respondeu.',
    );
    expect(alerta?.pedidoId).toBe('p1');
  });

  it('fila parada há mais de 20 s', () => {
    expect(
      alertasDeImpressao([agente(5)], true, [impressao('pendente', 25)], agora)[0]?.chave,
    ).toMatch(/^parado-/);
  });

  it('com o computador desligado, não repete um alerta por pedido parado', () => {
    const alertas = alertasDeImpressao(
      [agente(120)],
      true,
      [impressao('pendente', 25), impressao('pendente', 40)],
      agora,
    );
    expect(alertas).toHaveLength(1);
  });
});

describe('tempoDesde', () => {
  it('fala o tempo do jeito curto', () => {
    expect(tempoDesde(seg(20), agora)).toBe('agora');
    expect(tempoDesde(seg(180), agora)).toBe('há 3 min');
    expect(tempoDesde(seg(7200), agora)).toBe('há 2 h');
    expect(tempoDesde(seg(86400 * 3), agora)).toBe('há 3 dias');
  });
});
