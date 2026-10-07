import type { SVGProps } from 'react';

const CAMINHOS = {
  inicio: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  busca: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  pedidos: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  perfil: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  local:
    'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  mais: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  baixo: 'M6 9l6 6 6-6',
  voltar: 'M15 6l-6 6 6 6',
  fechar: 'M6 6l12 12M18 6L6 18',
  editar: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  relogio: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  moto: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h8M16 17l-1.5-6H11M14 8h2.5l1.5 3M4 17l1.5-4H11v4',
  sacola: 'M6 8h12l-1 12H7zM9 8a3 3 0 0 1 6 0',
  calendario: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4',
  pdv: 'M3 4h18v12H3zM8 20h8M12 16v4',
  mesa: 'M3 8.5h18v2.5H3zM6 11l-1.5 8M18 11l1.5 8M8.5 11v4.5h7V11',
  cozinha: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 3 3 0-2 0-4 0-6z',
  chamada: 'M3 10v4h4l6 4V6l-6 4zM17 9a4 4 0 0 1 0 6',
  cardapio: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM9 8h6M9 12h6',
  loja: 'M4 9l2-5h12l2 5M4 9v11h16V9M4 9h16M9 20v-6h6v6',
  impressora: 'M7 8V3h10v5M5 8h14v8h-2v4H7v-4H5zM9 15h6',
  equipe:
    'M9 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 20c1-3.5 3.5-5 6-5s5 1.5 6 5M16 5a3 3 0 0 1 0 6M18 15c1.5.7 2.5 2.3 3 5',
  ajustes: 'M4 6h10M18 6h2M14 4v4M4 12h4M12 12h8M8 10v4M4 18h12M20 18h0M16 16v4',
  grafico: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
  marca: 'M3 12l9-9h8v8l-9 9zM15 8h.01',
  globo:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  sair: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  lanches:
    'M4 11c0-3.9 3.6-6 8-6s8 2.1 8 6H4zM3.5 14.5h17M5 17.5h14v.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-.5zM9 8h.01M12 7.5h.01M15 8h.01',
  pizza:
    'M3 7.5c5.6-3 12.4-3 18 0L12 21zM4.8 10.4c4.6-2 9.8-2 14.4 0M9 12.5h.01M14 13h.01M11.5 16.5h.01',
  brasileira:
    'M12 7a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM12 10.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 3v5a1.5 1.5 0 0 0 3 0V3M4.5 9.5V21M20 3c-1.5 1-2 3-2 5s1 2.5 2 2.5V21',
  japonesa:
    'M4 11.5a8 3.5 0 1 0 16 0 8 3.5 0 1 0-16 0zM4 11.5v3a8 3.5 0 0 0 16 0v-3M9.5 11c.8-.8 4.2-.8 5 0',
  arabe: 'M12 4l8.5 15h-17zM9.5 14.5h5M12 10v.01',
  acai: 'M3 11h18a9 8 0 0 1-18 0zM8 8.5a2 2 0 1 1 4 0M12 8a2 2 0 1 1 4 0M10.5 5.5l1.5-2',
  sorvetes: 'M7 10a5 5 0 0 1 10 0zM7 10l5 11 5-11M9.5 14h5',
  doces: 'M5 11.5h14l-2 8.5H7zM6 11.5a6 5 0 0 1 12 0M12 4v2.5M9.5 15.5v2M14.5 15.5v2',
  padaria:
    'M5 10a7 4.5 0 0 1 14 0v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5zM9 10v4M12 9.5v4.5M15 10v4',
  marmita:
    'M3 10h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM5 10V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2M12 10v10M3 15h9',
  saudavel: 'M5 19C5 10.5 10 5.5 20 4.5 20 14.5 15 19 6 19zM5 19l8.5-8.5',
  porcoes: 'M6 10.5h12l-2 9.5H8zM8 10.5V4.5M11 10.5V3.5M14 10.5V4.5M16.5 10.5V6',
  bebidas: 'M6 5h12l-1.5 15h-9zM6.4 9.5h11.2M14.5 5l2-2.5',
  outros: 'M5 12h.01M12 12h.01M19 12h.01M4 8a8 8 0 0 1 16 0M4 16a8 8 0 0 0 16 0',
  coracao: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  compartilhar: 'M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  pix: 'M12 2.8l9.2 9.2-9.2 9.2L2.8 12zM8.5 12l3.5-3.5 3.5 3.5-3.5 3.5z',
  cartao: 'M3 6h18v12H3zM3 10h18M7 15h4',
  dinheiro: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6.5 10v4M17.5 10v4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  ofertas: 'M19 5L5 19M7.5 5.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM16.5 14.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  sol: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  lua: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  conversa: 'M4 5h16v11H10l-6 4zM8 10h.01M12 10h.01M16 10h.01',
} as const;

export type IconName = keyof typeof CAMINHOS | 'estrela';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

/**
 * Ícones de traço 1,8 px, pontas arredondadas, caixa de 22 px, na cor do texto ao redor.
 * A estrela da nota é o único ícone preenchido. Decorativos por padrão (aria-hidden).
 */
export function Icon({ name, size = 22, ...props }: IconProps) {
  if (name === 'estrela') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        {...props}
      >
        <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={CAMINHOS[name]} />
    </svg>
  );
}
