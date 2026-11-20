// Ticket-04 soak test: N nights back to back in one process (nights 1 -> 2 -> 3 rotating), random seeded input.
// Usage: npm run soak -- --seed 7 --nights 10 --out soak.json     Exit 0 ok, 1 usage error.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { soakNight } from '../core/bench';
import type { Game } from '../core/sim';

const mb = (k: 'rss' | 'heapUsed' = 'rss') => Math.round((process.memoryUsage()[k] / 2 ** 20) * 10) / 10;
const gc = () => (globalThis as { gc?: () => void }).gc?.();

export function soak(seed: number, nights: number, onFirst: () => void = () => {}) {
  const results: string[] = [];
  let crashes = 0;
  let g: Game | null = null;
  for (let i = 1; i <= nights; i++) {
    try {
      g = soakNight(seed, i, i === 1 ? onFirst : undefined);
      results.push(g.state === 'won' ? 'won' : g.state === 'lost' ? 'lost' : 'crash');
      if (g.state !== 'won' && g.state !== 'lost') crashes++;
    } catch (e) {
      crashes++;
      results.push('crash');
      process.stderr.write(`night ${i} crashed: ${(e as Error).stack}\n`);
    }
    g = null; // reset: drop the night before the next one
  }
  return { results, crashes };
}

function main() {
  const a = process.argv.slice(2);
  const opt = (k: string, d?: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const seed = Number(opt('--seed', '7')), nights = Number(opt('--nights', '10')), out = opt('--out');
  if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1 || !out) {
    process.stderr.write('usage: soak --seed <int> --nights <int >= 1> --out <file>\n');
    process.exit(1);
  }
  const t0 = performance.now();
  // mem_start: RSS right after the first night is loaded (created, before its first tick).
  let memStart = 0, heapStart = 0;
  const { results, crashes } = soak(seed, nights, () => (gc(), (memStart = mb()), (heapStart = mb('heapUsed'))));
  gc();
  const report = {
    nights, crashes, results, mem_start_mb: memStart, mem_end_mb: mb(), duration_s: Math.round((performance.now() - t0) / 100) / 10,
    // extra (not in the contract): JS heap after GC, to tell a leak from RSS warm-up
    heap_start_mb: heapStart, heap_end_mb: mb('heapUsed'),
  };
  mkdirSync(dirname(out!) || '.', { recursive: true });
  writeFileSync(out!, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}

if (process.argv[1] && /soak\.(ts|js|mjs)$/.test(process.argv[1])) main();
