import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages project site: https://totozZ.github.io/Framefall/
  base: '/Framefall/',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
