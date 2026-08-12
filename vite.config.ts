import { defineConfig } from 'vite';

export default defineConfig({
  // Relative assets work both at a custom domain and /repository-name/ on Pages.
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
