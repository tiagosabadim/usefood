import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  // Publicado em usefood.com.br/
  base: '/',
  plugins: [react(), tailwindcss()],
  // Todos os apps leem o mesmo .env da raiz do monorepo.
  envDir: '../..',
  // Landing pages estáticas (HTML pronto, sem React): melhor para SEO e para abrir rápido
  build: {
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        inicio: resolve(import.meta.dirname, 'inicio/index.html'),
        restaurantes: resolve(import.meta.dirname, 'restaurantes/index.html'),
        franquia: resolve(import.meta.dirname, 'franquia/index.html'),
      },
    },
  },
  server: { port: 5175, strictPort: true },
  preview: { port: 5175, strictPort: true },
});
