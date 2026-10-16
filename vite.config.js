import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works from any sub-path (e.g. GitHub Pages).
  base: './',
  test: {
    // Vitest runs the simulation tests only; e2e/ is Playwright's.
    include: ['test/**/*.test.js'],
  },
  build: {
    // Top-level await in main.js (the sprite atlas loads before the game starts); every WebGL2 browser has it.
    target: 'es2022',
    // three.js alone is ~550 kB; that's expected for a 3D game.
    chunkSizeWarningLimit: 800,
  },
});
