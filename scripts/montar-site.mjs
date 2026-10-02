// Junta o build dos quatro apps num único site, na pasta dist/ da raiz.
// Cada app já foi buildado com o `base` do seu caminho (vite.config.ts).
import { cpSync, existsSync, rmSync } from 'node:fs';

const destinos = [
  { app: 'web', caminho: '' },
  { app: 'admin', caminho: 'pdv' },
  { app: 'garcom', caminho: 'garcom' },
  { app: 'console', caminho: 'console' },
];

rmSync('dist', { recursive: true, force: true });

for (const { app, caminho } of destinos) {
  const origem = `apps/${app}/dist`;
  if (!existsSync(origem)) throw new Error(`Build de ${app} não encontrado em ${origem}`);
  cpSync(origem, caminho ? `dist/${caminho}` : 'dist', { recursive: true });
  console.log(`${origem} → dist/${caminho}`);
}
