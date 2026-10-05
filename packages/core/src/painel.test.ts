import { describe, expect, it } from 'vitest';
import { csv, periodo, reaisNaPlanilha, variacao } from './painel';

describe('periodo', () => {
  const agora = new Date(2026, 9, 15, 14, 30); // 15/10/2026 14:30
  it('hoje vai da meia-noite à meia-noite de amanhã', () => {
    const p = periodo('hoje', agora);
    expect([p.inicio.getDate(), p.inicio.getHours(), p.fim.getDate()]).toEqual([15, 0, 16]);
  });
  it('7 dias inclui hoje', () => {
    expect(periodo('7dias', agora).inicio.getDate()).toBe(9);
  });
  it('este mês começa no dia 1', () => {
    expect(periodo('mes', agora).inicio.getDate()).toBe(1);
  });
});

describe('variacao', () => {
  it('compara com o período anterior', () => {
    expect(variacao(112, 100)).toEqual({ texto: '+12%', tom: 'alta' });
    expect(variacao(95, 100)).toEqual({ texto: '−5%', tom: 'baixa' });
    expect(variacao(50, 0)).toEqual({ texto: 'novo', tom: 'alta' });
    expect(variacao(0, 0)).toEqual({ texto: '—', tom: 'igual' });
  });
});

describe('planilha', () => {
  it('ponto e vírgula, aspas quando precisa e valores em reais', () => {
    expect(
      csv([
        ['Produto', 'Total'],
        ['X; Tudo', reaisNaPlanilha(1234)],
      ]),
    ).toBe('\uFEFFProduto;Total\r\n"X; Tudo";12,34');
  });
});
