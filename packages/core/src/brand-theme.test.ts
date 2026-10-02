import { describe, expect, it } from 'vitest';
import { brandThemeCss } from './brand-theme';

describe('brandThemeCss', () => {
  it('aplica cores separadas para claro e escuro', () => {
    const css = brandThemeCss({
      light: { brand: '#B4441B', 'brand-ink': '#ffffff' },
      dark: { brand: '#ff8a5c' },
    });
    expect(css).toContain(':root { --uf-brand: #b4441b; --uf-brand-ink: #ffffff; }');
    expect(css).toContain(
      ":root[data-theme='dark'] { --uf-brand: #ff8a5c; --uf-brand-ink: #ffffff; }",
    );
  });

  it('um objeto só vale para os dois modos', () => {
    const css = brandThemeCss({ brand: '#123456' });
    expect(css.match(/--uf-brand: #123456/g)).toHaveLength(3);
  });

  it('ignora tokens que a marca não pode trocar e valores que não são cor', () => {
    const css = brandThemeCss({
      canvas: '#000000',
      brand: 'red; } body { display: none',
      'brand-text': 'url(https://exemplo.com/x)',
    });
    expect(css).toBe('');
  });

  it('tema vazio ou inválido não gera CSS', () => {
    expect(brandThemeCss({})).toBe('');
    expect(brandThemeCss(null)).toBe('');
    expect(brandThemeCss('azul')).toBe('');
  });
});
