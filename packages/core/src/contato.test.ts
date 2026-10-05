import { describe, expect, it } from 'vitest';
import { formatarTelefone, lerCep, lerTelefone, resumoDoHorario } from './contato';

describe('telefone e CEP', () => {
  it('aceita o jeito que a pessoa digitar', () => {
    expect(lerTelefone('(17) 99123-4567')).toBe('17991234567');
    expect(lerTelefone('1733334444')).toBe('1733334444');
    expect(lerTelefone('99123')).toBeNull();
    expect(lerCep('15130-000')).toBe('15130000');
    expect(lerCep('1513')).toBeNull();
  });
  it('mostra formatado', () => {
    expect(formatarTelefone('17991234567')).toBe('(17) 99123-4567');
    expect(formatarTelefone('1733334444')).toBe('(17) 3333-4444');
  });
});

describe('resumoDoHorario', () => {
  const sexta = [{ weekday: 5, opens: '18:00:00', closes: '23:00:00' }];
  const madrugada = [{ weekday: 5, opens: '18:00:00', closes: '02:00:00' }];
  // 2 de outubro de 2026 é uma sexta
  const em = (dia: number, h: number, m = 0) => new Date(2026, 9, dia, h, m);

  it('aberta: até quando', () => {
    expect(resumoDoHorario(sexta, true, em(2, 20))).toEqual({
      titulo: 'Aberto',
      detalhe: 'até 23:00',
    });
    expect(resumoDoHorario(madrugada, true, em(3, 1))).toEqual({
      titulo: 'Aberto',
      detalhe: 'até 02:00',
    });
  });

  it('fechada: quando abre', () => {
    expect(resumoDoHorario(sexta, false, em(2, 15))).toEqual({
      titulo: 'Fechado',
      detalhe: 'abre 18:00',
    });
    expect(resumoDoHorario(sexta, false, em(1, 23))).toEqual({
      titulo: 'Fechado',
      detalhe: 'abre amanhã 18:00',
    });
    expect(resumoDoHorario(sexta, false, em(3, 15))).toEqual({
      titulo: 'Fechado',
      detalhe: 'abre sexta 18:00',
    });
    expect(resumoDoHorario([], false, em(3, 15))).toEqual({
      titulo: 'Fechado',
      detalhe: 'sem horário',
    });
  });
});
