import { describe, expect, it } from 'vitest';
import { formatarTelefone, lerCep, lerTelefone } from './contato';

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
