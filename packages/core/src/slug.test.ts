import { describe, expect, it } from 'vitest';
import { checkStoreSlug, slugify } from './slug';

describe('slugify', () => {
  it('tira acentos e símbolos', () => {
    expect(slugify('Lanchonete do Zé & Cia')).toBe('lanchonete-do-ze-cia');
  });

  it('limita a 40 caracteres sem terminar em hífen', () => {
    const slug = slugify('Restaurante com um nome muito comprido demais para caber');
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('checkStoreSlug', () => {
  it('aceita um endereço válido', () => {
    expect(checkStoreSlug('lanchoneteria')).toEqual({ ok: true });
  });

  it('recusa formato inválido', () => {
    expect(checkStoreSlug('ab')).toEqual({ ok: false, reason: 'formato' });
    expect(checkStoreSlug('-loja')).toEqual({ ok: false, reason: 'formato' });
    expect(checkStoreSlug('loja--nova')).toEqual({ ok: false, reason: 'formato' });
    expect(checkStoreSlug('Loja')).toEqual({ ok: false, reason: 'formato' });
  });

  it('recusa palavras reservadas', () => {
    expect(checkStoreSlug('admin')).toEqual({ ok: false, reason: 'reservado' });
    expect(checkStoreSlug('pdv')).toEqual({ ok: false, reason: 'reservado' });
    expect(checkStoreSlug('garcom')).toEqual({ ok: false, reason: 'reservado' });
  });
});
