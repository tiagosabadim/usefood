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
