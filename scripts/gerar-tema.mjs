// Gera packages/ui/src/theme.css a partir dos tokens do design system.
// Fonte da verdade: packages/ui/tokens/usefood.tokens.json (exportado do design system usefood).
// Rode `pnpm tokens` sempre que os tokens mudarem; nunca edite o theme.css à mão.
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGEM = 'packages/ui/tokens/usefood.tokens.json';
const DESTINO = 'packages/ui/src/theme.css';
const t = JSON.parse(readFileSync(ORIGEM, 'utf8'));

const [claro, escuro] = t.color.themes.map((tema) => tema.id);
const cor = (tema) =>
  t.color.tokens.map((c) => `    --uf-${c.name}: ${c.value[tema] ?? c.value[claro]};`).join('\n');
const lista = (familia) =>
  t[familia].tokens.map((x) => `    --uf-${x.name}: ${x.value};`).join('\n');

const familias = Object.entries(t.type.families)
  .map(([chave, pilha]) => `    --uf-font-${chave}: ${pilha};`)
  .join('\n');

const estilos = t.type.groups
  .flatMap((g) => g.styles)
  .map((s) =>
    [
      `  --text-${s.name}: ${s.fontSize};`,
      `  --text-${s.name}--line-height: ${s.lineHeight};`,
      `  --text-${s.name}--font-weight: ${s.fontWeight};`,
      s.letterSpacing ? `  --text-${s.name}--letter-spacing: ${s.letterSpacing};` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  )
  .join('\n');

const css = `/*
 * GERADO por scripts/gerar-tema.mjs a partir de ${ORIGEM}.
 * Não edite à mão: mude os tokens no design system e rode \`pnpm tokens\`.
 *
 * Uso no app:  @import "tailwindcss";  @import "@usefood/ui/theme.css";
 * Classes: bg-canvas, bg-surface, text-ink, text-ink-muted, border-line, bg-brand,
 * text-brand-ink, text-brand-text, rounded-lg, font-display, text-display, h-target-pdv…
 * Cores de marca (brand*) podem ser trocadas em tempo de execução pelo tema da marca no banco.
 */

@layer base {
  :root {
${cor(claro)}
${familias}
${lista('radius')}
${lista('size')}
    color-scheme: light;
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
${cor(escuro).replace(/^ {4}/gm, '      ')}
      color-scheme: dark;
    }
  }

  :root[data-theme='dark'] {
${cor(escuro)}
    color-scheme: dark;
  }

  body {
    background: var(--uf-canvas);
    color: var(--uf-ink);
    font-family: var(--uf-font-text);
    -webkit-font-smoothing: antialiased;
  }
}

@theme inline {
${t.color.tokens.map((c) => `  --color-${c.name}: var(--uf-${c.name});`).join('\n')}
  --font-display: var(--uf-font-display);
  --font-sans: var(--uf-font-text);
${t.radius.tokens.map((r) => `  --${r.name}: var(--uf-${r.name});`).join('\n')}
${t.size.tokens.map((s) => `  --spacing-${s.name}: var(--uf-${s.name});`).join('\n')}
${estilos}
}
`;

writeFileSync(DESTINO, css);
console.log(
  `${DESTINO} gerado com ${t.color.tokens.length} cores e ${t.type.groups.flatMap((g) => g.styles).length} estilos de texto.`,
);
