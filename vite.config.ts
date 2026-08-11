import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/oncheck/' : '/',
  build: {
    sourcemap: false,
    target: 'es2022',
  },
});
