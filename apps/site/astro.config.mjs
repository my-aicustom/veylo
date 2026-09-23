import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  compressHTML: true,
  vite: {
    build: { cssMinify: true }
  }
});
