import { defineConfig } from 'vite';

// Relative asset paths so the build works under GitHub Pages' /banana-basket/ subpath.
export default defineConfig({ base: './' });
