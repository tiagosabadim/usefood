import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Publicado em usefood.com.br/garcom/
  base: '/garcom/',
  plugins: [react(), tailwindcss()],
  // Todos os apps leem o mesmo .env da raiz do monorepo.
  envDir: '../..',
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
});
