/** Contraste entre duas cores pela WCAG 2 (1 a 21). Texto comum: 4,5 ou mais; botão e borda: 3 ou mais. */
export function contrasteWcag(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (la + 0.05) / (lb + 0.05);
}

/**
 * Contraste percebido pelo APCA (Lc, 0 a ~106), o método novo que mede como o olho lê o texto.
 * Texto comum: 60 ou mais; títulos grandes: 45 ou mais. Pega casos que a WCAG deixa passar
 * (como texto preto sobre laranja vivo).
 */
export function contrasteApca(texto: string, fundo: string): number {
  const y = (h: string) => {
    const [r, g, b] = rgb(h).map((v) => v / 255) as [number, number, number];
    const v = 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
    return v > 0.022 ? v : v + (0.022 - v) ** 1.414;
  };
  const t = y(texto);
  const f = y(fundo);
  if (f > t) {
    const s = (f ** 0.56 - t ** 0.57) * 1.14;
    return s < 0.1 ? 0 : (s - 0.027) * 100;
  }
  const s = (f ** 0.65 - t ** 0.62) * 1.14;
  return s > -0.1 ? 0 : Math.abs((s + 0.027) * 100);
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
