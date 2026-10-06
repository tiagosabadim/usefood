import { SegmentedControl } from './segmented-control';

export type ThemePreference = 'sistema' | 'claro' | 'escuro';

export interface ThemeSwitcherProps {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
  label?: string;
  className?: string;
}

/** Aparência: Claro, Escuro ou Automático (segue o aparelho). */
export function ThemeSwitcher({
  value,
  onChange,
  label = 'Aparência',
  className,
}: ThemeSwitcherProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption text-ink-muted">{label}</span>
      <SegmentedControl
        label={label}
        className={className ?? 'self-stretch [&>button]:flex-1'}
        options={[
          { value: 'claro', label: 'Claro' },
          { value: 'escuro', label: 'Escuro' },
          { value: 'sistema', label: 'Auto' },
        ]}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
