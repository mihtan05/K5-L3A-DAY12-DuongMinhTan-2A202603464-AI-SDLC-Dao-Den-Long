// Browser smoke check + screenshots for proof. Needs `npm run build` first.
// Usage: node scripts/smoke.mjs [phase-N]   (uses installed Edge/Chrome; set BROWSER_CHANNEL to override)
import { preview } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const dir = `docs/proof/${process.argv[2] ?? 'latest'}`;
mkdirSync(dir, { recursive: true });
const server = await preview({ preview: { port: 4173, strictPort: true } });
const channel = process.env.BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);
const browser = await chromium.launch({ channel, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const log = [];
const state = () => page.evaluate(() => { const g = window.__game(); return { tick: g.tick, state: g.state, pos: g.player.pos.map((v) => +v.toFixed(2)), carried: g.player.carried, motes: g.motes.length, shades: g.shades.length }; });

try {
  await page.goto('http://localhost:4173/');
  await page.waitForFunction(() => window.__game && window.__game().tick > 30, null, { timeout: 15000 });
  log.push(['loaded', await state()]);
  await page.screenshot({ path: `${dir}/01-start.png` });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  log.push(['after W 1.5s', await state()]);
  await page.screenshot({ path: `${dir}/02-moved.png` });
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  log.push(['jump', await state()]);
  const hud = await page.textContent('#hud');
  log.push(['hud', hud]);
  // Scenario-style setup (like the headless "win" scenario), then real key presses: E deposits and wins, R replays.
  await page.evaluate(() => {
    const g = window.__game();
    g.lanterns.slice(1).forEach((l) => (l.lit = true));
    g.shades.length = 0;
    g.player.pos = [g.lanterns[0].pos[0], 0, g.lanterns[0].pos[2] - 2];
    g.player.carried = 5;
  });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__game().state === 'won', null, { timeout: 5000 });
  await page.waitForTimeout(300);
  const winMsg = await page.textContent('#msg');
  log.push(['win', await state(), winMsg]);
  await page.screenshot({ path: `${dir}/03-won.png` });
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(300);
  log.push(['replay', await state()]);
  const ok =
    errors.length === 0 &&
    log[1][1].pos[2] > log[0][1].pos[2] &&
    log[2][1].pos[1] > 0 &&
    /Đèn/.test(hud ?? '') &&
    /chơi lại/.test(winMsg ?? '') &&
    log[5][1].state === 'playing' &&
    log[5][1].tick < 60;
  writeFileSync(`${dir}/smoke.txt`, JSON.stringify({ ok, errors, log }, null, 1) + '\n');
  console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL', JSON.stringify({ errors, log }));
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
  server.httpServer.close();
}
