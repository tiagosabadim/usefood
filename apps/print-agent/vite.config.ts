import { defineConfig } from 'vite';

// Um arquivo só, com tudo dentro, para rodar com `node` no computador da loja.
export default defineConfig({
  build: {
    ssr: 'src/main.ts',
    outDir: 'dist',
    target: 'node22',
    rollupOptions: { output: { entryFileNames: 'usefood-impressao.mjs' } },
  },
  ssr: { noExternal: true },
});
