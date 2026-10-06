import { describe, expect, it } from 'vitest';
import arquivoDeTokens from '../../ui/tokens/usefood.tokens.json';
import { contrasteApca, contrasteWcag } from './contraste';

// Confere o design system inteiro: toda combinação de texto e fundo, nos dois temas
const tokens = arquivoDeTokens as unknown as {
  color: { tokens: { name: string; value: { light: string; dark: string } }[] };
};
const cor = (nome: string, tema: 'light' | 'dark') => {
  const t = tokens.color.tokens.find((x) => x.name === nome);
  if (!t) throw new Error(`Token ${nome} não existe`);
  return t.value[tema];
};

// [texto, fundo]: texto comum (WCAG 4,5 e APCA 60)
const TEXTO: [string, string][] = [
  ['ink', 'canvas'],
  ['ink', 'surface'],
  ['ink', 'surface-strong'],
  ['ink-muted', 'canvas'],
  ['ink-muted', 'surface'],
  ['ink-muted', 'surface-strong'],
  ['brand-ink', 'brand'],
  ['brand-text', 'canvas'],
  ['brand-text', 'surface'],
  ['brand-text', 'brand-soft'],
  ['sun-ink', 'sun'],
  ['success', 'success-soft'],
  ['success', 'surface'],
  ['danger', 'danger-soft'],
  ['danger', 'surface'],
];
// [elemento, fundo]: botões, bordas de campo e controles (WCAG 3)
const INTERFACE: [string, string][] = [
  ['brand', 'canvas'],
  ['brand', 'surface'],
  ['line-strong', 'canvas'],
  ['line-strong', 'surface'],
];

describe.each(['light', 'dark'] as const)('contraste do design system (%s)', (tema) => {
  it.each(TEXTO)('texto %s sobre %s', (texto, fundo) => {
    const a = cor(texto, tema);
    const b = cor(fundo, tema);
    expect(contrasteWcag(a, b), `WCAG ${texto}/${fundo}`).toBeGreaterThanOrEqual(4.5);
    expect(contrasteApca(a, b), `APCA ${texto}/${fundo}`).toBeGreaterThanOrEqual(60);
  });
  it.each(INTERFACE)('%s sobre %s', (el, fundo) => {
    expect(contrasteWcag(cor(el, tema), cor(fundo, tema))).toBeGreaterThanOrEqual(3);
  });
});

describe('por que o laranja de ação não é o do guia', () => {
  it('texto preto sobre o laranja vivo passa na WCAG mas falha no APCA (o olho cansa)', () => {
    expect(contrasteWcag('#000000', '#fe5401')).toBeGreaterThan(4.5);
    expect(contrasteApca('#000000', '#fe5401')).toBeLessThan(60);
  });
});
