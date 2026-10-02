// Empacota os componentes de packages/ui para o design system usefood:
// dist-ds/bundle.js (window.Usefood, usa React 18 global) e dist-ds/bundle.css.
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ui = fileURLToPath(new URL('../packages/ui/', import.meta.url));

await build({
  configFile: false,
  root: ui,
  logLevel: 'warn',
  plugins: [tailwindcss()],
  resolve: { alias: { 'react/jsx-runtime': `${ui}ds/jsx-runtime.js` } },
  build: {
    outDir: `${ui}dist-ds`,
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: `${ui}ds/entry.ts`,
      name: 'Usefood',
      formats: ['iife'],
      fileName: () => 'bundle.js',
      cssFileName: 'bundle',
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: { globals: { react: 'React', 'react-dom': 'ReactDOM' } },
    },
  },
});
console.log('Pacote do design system gerado em packages/ui/dist-ds/');
