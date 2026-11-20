import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig } from 'vite';

// Same on-disk leaderboard API as `npm start` (scripts/server.mjs) for `npm run dev` / `vite preview`.
// Loaded at runtime (not bundled into the config) so the module keeps its own import.meta.url.
const api = async (s: any) => {
  const { leaderboardApi } = await import(pathToFileURL(resolve('scripts/server.mjs')).href);
  s.middlewares.use((q: any, r: any, next: any) => leaderboardApi(q, r) || next());
};

// base './' so dist/ opens from any static host or subfolder (Release v1.0.0).
export default defineConfig({
  base: './',
  plugins: process.env.VITEST ? [] : [{ name: 'leaderboard-api', configureServer: api, configurePreviewServer: api }],
  test: { include: ['tests/**/*.test.ts'] },
} as any);
