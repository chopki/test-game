import { defineConfig, devices } from '@playwright/test';

// Browser regression tests. They run against the production build served by `vite preview`.
// WebGL runs on SwiftShader (software rendering), so this works on CI runners without a GPU.
const webglArgs = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // software WebGL is CPU-heavy; parallel workers just slow each other down
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: webglArgs },
    // No UI animations (the build wheel's fan-out): at software WebGL's frame rate they take seconds to settle.
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'desktop', testMatch: /desktop\.spec\.js/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', testMatch: /mobile\.spec\.js/, use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
