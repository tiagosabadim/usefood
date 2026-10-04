import { describe, expect, it } from 'vitest';
import {
  deslocamentoAoMudarZoom,
  deslocamentoCentralizado,
  escalaDeCobertura,
  limitarDeslocamento,
  recorteCentral,
  recorteNaImagem,
} from './crop';

const moldura = { largura: 400, altura: 300 };

describe('escalaDeCobertura', () => {
  it('foto vertical de celular cobre pela largura', () => {
    expect(escalaDeCobertura({ largura: 3000, altura: 4000 }, moldura)).toBeCloseTo(400 / 3000);
  });
  it('foto panorâmica cobre pela altura', () => {
    expect(escalaDeCobertura({ largura: 4000, altura: 1000 }, moldura)).toBeCloseTo(300 / 1000);
  });
});

describe('limitarDeslocamento', () => {
  it('não deixa sobrar fundo vazio em nenhuma borda', () => {
    const naTela = { largura: 400, altura: 533 };
    expect(limitarDeslocamento({ x: 50, y: 20 }, naTela, moldura)).toEqual({ x: 0, y: 0 });
    expect(limitarDeslocamento({ x: -10, y: -999 }, naTela, moldura)).toEqual({ x: 0, y: -233 });
  });
});

describe('recorteNaImagem', () => {
  it('foto vertical centralizada recorta a faixa do meio, em 4:3', () => {
    const imagem = { largura: 3000, altura: 4000 };
    const escala = escalaDeCobertura(imagem, moldura);
    const naTela = { largura: imagem.largura * escala, altura: imagem.altura * escala };
    const r = recorteNaImagem(deslocamentoCentralizado(naTela, moldura), escala, moldura);
    expect(r.largura).toBeCloseTo(3000);
    expect(r.altura).toBeCloseTo(2250);
    expect(r.y).toBeCloseTo(875);
    expect(r.largura / r.altura).toBeCloseTo(4 / 3);
  });

  it('com zoom, recorta um pedaço menor', () => {
    const r = recorteNaImagem({ x: -100, y: -50 }, 2, moldura);
    expect(r).toEqual({ x: 50, y: 25, largura: 200, altura: 150 });
  });
});

describe('deslocamentoAoMudarZoom', () => {
  it('o centro da moldura fica no mesmo ponto da foto', () => {
    const centro = (r: { x: number; y: number; largura: number; altura: number }) => ({
      x: r.x + r.largura / 2,
      y: r.y + r.altura / 2,
    });
    const antes = { x: -100, y: -50 };
    const depois = deslocamentoAoMudarZoom(antes, 1, 2, moldura);
    expect(centro(recorteNaImagem(depois, 2, moldura))).toEqual(
      centro(recorteNaImagem(antes, 1, moldura)),
    );
  });
});

describe('recorteCentral', () => {
  it('corta as sobras igualmente dos dois lados', () => {
    expect(recorteCentral({ largura: 1600, altura: 900 })).toEqual({
      x: 200,
      y: 0,
      largura: 1200,
      altura: 900,
    });
    expect(recorteCentral({ largura: 900, altura: 1600 })).toEqual({
      x: 0,
      y: 462.5,
      largura: 900,
      altura: 675,
    });
  });
});
