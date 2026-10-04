/** Formato padrão das fotos de produto em todas as telas. */
export const PROPORCAO_DA_FOTO = 4 / 3;
/** Tamanho em que a foto é salva depois do recorte. */
export const TAMANHO_DA_FOTO = { largura: 1200, altura: 900 } as const;

export interface Tamanho {
  largura: number;
  altura: number;
}
/** Deslocamento do canto da imagem em relação ao canto da moldura (px na tela; 0 ou negativo). */
export interface Deslocamento {
  x: number;
  y: number;
}
/** Pedaço da imagem original, em pixels da própria imagem. */
export interface Recorte {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Escala que faz a imagem cobrir a moldura inteira, sem sobrar espaço. */
export function escalaDeCobertura(imagem: Tamanho, moldura: Tamanho): number {
  return Math.max(moldura.largura / imagem.largura, moldura.altura / imagem.altura);
}

/** Mantém a imagem cobrindo a moldura: nunca aparece fundo vazio nas bordas. */
export function limitarDeslocamento(
  d: Deslocamento,
  imagemNaTela: Tamanho,
  moldura: Tamanho,
): Deslocamento {
  const limitar = (v: number, min: number) => Math.min(0, Math.max(min, v));
  return {
    x: limitar(d.x, moldura.largura - imagemNaTela.largura),
    y: limitar(d.y, moldura.altura - imagemNaTela.altura),
  };
}

/** Imagem centralizada na moldura, com o zoom dado. */
export function deslocamentoCentralizado(imagemNaTela: Tamanho, moldura: Tamanho): Deslocamento {
  return {
    x: (moldura.largura - imagemNaTela.largura) / 2,
    y: (moldura.altura - imagemNaTela.altura) / 2,
  };
}

/** Ao mudar o zoom, o ponto no centro da moldura continua no centro. */
export function deslocamentoAoMudarZoom(
  d: Deslocamento,
  escalaAntes: number,
  escalaDepois: number,
  moldura: Tamanho,
): Deslocamento {
  const cx = moldura.largura / 2;
  const cy = moldura.altura / 2;
  const fator = escalaDepois / escalaAntes;
  return { x: cx - (cx - d.x) * fator, y: cy - (cy - d.y) * fator };
}

/** Converte o que está dentro da moldura para o pedaço da imagem original. */
export function recorteNaImagem(d: Deslocamento, escala: number, moldura: Tamanho): Recorte {
  return {
    x: Math.max(0, -d.x / escala),
    y: Math.max(0, -d.y / escala),
    largura: moldura.largura / escala,
    altura: moldura.altura / escala,
  };
}

/** Recorte central no formato padrão, para quando não houve enquadramento manual. */
export function recorteCentral(imagem: Tamanho, proporcao = PROPORCAO_DA_FOTO): Recorte {
  if (imagem.largura / imagem.altura > proporcao) {
    const largura = imagem.altura * proporcao;
    return { x: (imagem.largura - largura) / 2, y: 0, largura, altura: imagem.altura };
  }
  const altura = imagem.largura / proporcao;
  return { x: 0, y: (imagem.altura - altura) / 2, largura: imagem.largura, altura };
}
