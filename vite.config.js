import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works from any sub-path (e.g. GitHub Pages).
  base: './',
  build: {
    // three.js alone is ~550 kB; that's expected for a 3D game.
    chunkSizeWarningLimit: 800,
  },
});
