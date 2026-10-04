import { describe, expect, it } from 'vitest';
import { cronometro, nivelDeAtraso, pendentesDaPraca } from './kitchen';

const agora = Date.parse('2026-10-04T20:00:00Z');
const ha = (segundos: number) => new Date(agora - segundos * 1000).toISOString();

describe('cronometro', () => {
  it('mostra minutos e segundos, e horas quando passa de uma', () => {
    expect(cronometro(ha(247), agora)).toBe('4:07');
    expect(cronometro(ha(750), agora)).toBe('12:30');
    expect(cronometro(ha(3909), agora)).toBe('1:05:09');
  });
});

describe('nivelDeAtraso', () => {
  it('normal até 8 min, atenção até 15, atrasado depois', () => {
    expect(nivelDeAtraso(ha(5 * 60), agora)).toBe('normal');
    expect(nivelDeAtraso(ha(9 * 60), agora)).toBe('atencao');
    expect(nivelDeAtraso(ha(16 * 60), agora)).toBe('atrasado');
  });
});

describe('pendentesDaPraca', () => {
  const itens = [
    { id: 'a', station_id: 'cozinha', prepared_at: null },
    { id: 'b', station_id: 'bar', prepared_at: null },
    { id: 'c', station_id: 'cozinha', prepared_at: '2026-10-04T19:59:00Z' },
  ];
  it('só o que falta naquela praça', () => {
    expect(pendentesDaPraca(itens, 'cozinha').map((i) => i.id)).toEqual(['a']);
    expect(pendentesDaPraca(itens, null).map((i) => i.id)).toEqual(['a', 'b']);
  });
});
