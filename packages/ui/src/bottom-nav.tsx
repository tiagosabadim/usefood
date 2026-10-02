import { cn } from './cn';
import { Icon, type IconName } from './icon';

export interface BottomNavItem {
  label: string;
  icon: IconName;
  href: string;
  current?: boolean;
}

/** Barra fixa da vitrine no celular: 3 a 5 destinos, ícone + rótulo sempre visível. */
export function BottomNav({
  items,
  label = 'Navegação principal',
}: {
  items: readonly BottomNavItem[];
  label?: string;
}) {
  return (
    <nav
      aria-label={label}
      className="grid border-t border-line bg-canvas px-2 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={item.current ? 'page' : undefined}
          className={cn(
            'flex min-h-target-min flex-col items-center justify-center gap-1 rounded-md text-micro no-underline',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            item.current ? 'text-brand-text' : 'text-ink-muted',
          )}
        >
          <Icon name={item.icon} />
          {item.label}
        </a>
      ))}
    </nav>
  );
}
