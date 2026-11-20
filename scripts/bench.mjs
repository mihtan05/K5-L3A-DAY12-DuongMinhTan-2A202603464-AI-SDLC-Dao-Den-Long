// Ticket-04 benchmark (bench_cmd): npm run bench -- --seed 42 --duration 30 --out bench.json
// Builds dist/ (npm script), serves it, opens a 1280x720 browser window with vsync off, runs the bench scene
// (?bench: night 1, 200 shades, 100 motes, orbit camera), 3 s warm-up, measures --duration s, writes JSON, exits 0.
// Browser: installed Edge on Windows, else Playwright Chromium (BROWSER_CHANNEL to override). BENCH_HEADLESS=1 for no window.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';
import { REVISION } from 'three';
import { startServer } from './server.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const seed = Number(opt('--seed', '42')), duration = Number(opt('--duration', '30')), out = opt('--out', 'bench.json');
if (!Number.isInteger(seed) || !(duration > 0)) {
  console.error('usage: bench --seed <int> --duration <seconds> --out <file>');
  process.exit(1);
}

const server = await startServer(0);
const vsyncFlags = ['--disable-gpu-vsync', '--disable-frame-rate-limit'];
const launchOpts = {
  headless: process.env.BENCH_HEADLESS === '1',
  // no throttling when the window is covered or loses focus (other apps on the bench machine)
  args: [...vsyncFlags, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,800', '--window-position=40,40'],
};
// Installed Edge (Windows) / Chrome (macOS, Linux) first, then Playwright's own Chromium.
const tries = process.env.BROWSER_CHANNEL ? [process.env.BROWSER_CHANNEL] : [process.platform === 'win32' ? 'msedge' : 'chrome', undefined];
let browser, channel;
for (channel of tries) {
  try {
    browser = await chromium.launch({ ...launchOpts, channel });
    break;
  } catch (e) {
    if (channel === tries.at(-1)) {
      console.error(`no browser to run the bench: install Edge/Chrome or run \`npx playwright install chromium\`\n${e.message}`);
      server.close();
      process.exit(4);
    }
  }
}
let code = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/?bench&seed=${seed}&duration=${duration}`);
  await page.waitForFunction(() => window.__bench, null, { timeout: (duration + 3 + 120) * 1000, polling: 250 });
  const r = await page.evaluate(() => window.__bench);
  const gl = await page.evaluate(() => {
    const c = document.querySelector('canvas').getContext('webgl2');
    const d = c.getExtension('WEBGL_debug_renderer_info');
    return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER);
  });
  const canvas = await page.evaluate(() => [innerWidth, innerHeight]);
  const cpu = os.cpus()[0]?.model.trim() ?? 'unknown CPU';
  const report = {
    contract_version: '1.3',
    avg_fps: r.avg_fps,
    p1_low_fps: r.p1_low_fps,
    frame_ms_p95: r.frame_ms_p95,
    frames: r.frames,
    load_ms: Math.round(r.first_frame_epoch_ms - performance.timeOrigin), // from this process's start to the first bench frame
    peak_mem_mb: null,
    vsync_off: true,
    renderer: `Three.js r${REVISION}, WebGL2 (${gl}), ${browser.browserType().name()} ${channel ?? 'chromium'} ${browser.version()}, flags ${vsyncFlags.join(' ')}`,
    os: `${os.type()} ${os.release()} ${os.arch()}; ${cpu} x${os.cpus().length}; RAM ${(os.totalmem() / 2 ** 30).toFixed(1)} GB`,
    // extra fields (not in the contract)
    seed,
    duration_s: duration,
    viewport: canvas.join('x'),
    js_heap_peak_mb: r.js_heap_peak_mb,
    peak_mem_note: 'Web build: the page cannot read the RSS of the browser processes, so peak_mem_mb is null; js_heap_peak_mb is the peak JS heap (Chromium performance.memory).',
    page_errors: errors,
  };
  mkdirSync(dirname(out) || '.', { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) code = 2;
} catch (e) {
  console.error(`bench failed: ${e.message}`);
  code = 3;
} finally {
  await browser.close();
  server.close();
}
process.exit(code);
