import { defineConfig } from 'vite';

// Relative asset paths so the build works under GitHub Pages' /banana-basket/ subpath.
export default defineConfig({
  base: './',
  resolve: { alias: [{ find: /^three$/, replacement: 'three/webgpu' }] },
  build: { chunkSizeWarningLimit: 1600 },
});
