import { defineConfig } from 'vite';

// base './' so dist/ opens from any static host or subfolder (Release v1.0.0).
export default defineConfig({
  base: './',
  test: { include: ['tests/**/*.test.ts'] },
} as any);
