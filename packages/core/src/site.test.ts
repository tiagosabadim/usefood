import { describe, expect, it } from 'vitest';
import { resolveSite } from './site';

describe('resolveSite', () => {
  it('domínio de loja abre direto na loja', () => {
    expect(
      resolveSite('ranchopasteis.com.br', {
        kind: 'loja',
        brand_slug: 'usefood',
        restaurant_slug: 'ranchopasteis',
      }),
    ).toEqual({ kind: 'loja', brand: 'usefood', store: 'ranchopasteis' });
  });

  it('domínio de marca abre a vitrine da marca', () => {
    expect(
      resolveSite('guapifood.com.br', {
        kind: 'marca',
        brand_slug: 'guapifood',
        restaurant_slug: null,
      }),
    ).toEqual({ kind: 'marca', brand: 'guapifood' });
  });

  it('domínio de loja sem loja visível cai na vitrine da marca', () => {
    expect(
      resolveSite('lojafechada.com.br', {
        kind: 'loja',
        brand_slug: 'usefood',
        restaurant_slug: null,
      }),
    ).toEqual({ kind: 'marca', brand: 'usefood' });
  });

  it('sem cadastro: .localhost em desenvolvimento, senão a marca padrão', () => {
    expect(resolveSite('guapifood.localhost:5175', null)).toEqual({
      kind: 'marca',
      brand: 'guapifood',
    });
    expect(resolveSite('usefood.netlify.app', null)).toEqual({ kind: 'marca', brand: 'usefood' });
  });
});
