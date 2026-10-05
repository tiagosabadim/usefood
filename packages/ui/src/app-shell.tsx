import type { ReactNode } from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './icon';

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  onClick?: () => void;
  active?: boolean;
  /** Ainda não existe: aparece apagado, com "em breve". */
  soon?: boolean;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export interface AppShellProps {
  /** Topo do menu: nome da loja ou do produto. */
  header: ReactNode;
  groups: NavGroup[];
  /** Rodapé do menu: conta e Sair. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Moldura dos painéis no computador: menu lateral fixo + conteúdo.
 * No celular (abaixo de 1024 px) o menu some e o conteúdo ocupa a tela, como antes.
 */
export function AppShell({ header, groups, footer, children }: AppShellProps) {
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:overflow-y-auto lg:p-4">
        <div className="px-2 pt-2">{header}</div>
        <nav aria-label="Menu" className="flex flex-col gap-5">
          {groups.map((g, n) => (
            <div key={g.title ?? n} className="flex flex-col gap-1">
              {g.title && (
                <span className="px-3 pb-1 text-micro tracking-wide text-ink-muted uppercase">
                  {g.title}
                </span>
              )}
              {g.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.soon}
                  aria-current={item.active ? 'page' : undefined}
                  onClick={item.onClick}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-label transition',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    item.active
                      ? 'bg-brand-soft text-brand-text'
                      : 'text-ink hover:bg-surface-strong',
                    item.soon && 'cursor-not-allowed text-ink-muted hover:bg-transparent',
                  )}
                >
                  <Icon name={item.icon} size={20} />
                  <span className="flex-1">{item.label}</span>
                  {item.soon && <span className="text-micro text-ink-muted">em breve</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        {footer && <div className="mt-auto border-t border-line pt-4">{footer}</div>}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
