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
