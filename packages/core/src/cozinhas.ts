/** Tipos de cozinha da vitrine (mesma ordem e nomes do banco: public.cuisine_type). */
export const COZINHAS = [
  { valor: 'lanches', rotulo: 'Lanches' },
  { valor: 'pastel', rotulo: 'Pastel' },
  { valor: 'pizza', rotulo: 'Pizza' },
  { valor: 'brasileira', rotulo: 'Brasileira' },
  { valor: 'marmita', rotulo: 'Marmita' },
  { valor: 'japonesa', rotulo: 'Japonesa' },
  { valor: 'arabe', rotulo: 'Árabe' },
  { valor: 'acai', rotulo: 'Açaí' },
  { valor: 'sorvetes', rotulo: 'Sorvetes' },
  { valor: 'doces', rotulo: 'Doces' },
  { valor: 'padaria', rotulo: 'Padaria' },
  { valor: 'saudavel', rotulo: 'Saudável' },
  { valor: 'porcoes', rotulo: 'Porções' },
  { valor: 'bebidas', rotulo: 'Bebidas' },
  { valor: 'outros', rotulo: 'Outros' },
] as const;

export type Cozinha = (typeof COZINHAS)[number]['valor'];

export const rotuloDaCozinha = (valor: string): string =>
  COZINHAS.find((c) => c.valor === valor)?.rotulo ?? valor;

/** Até 3 tipos por loja. */
export const MAXIMO_DE_COZINHAS = 3;
