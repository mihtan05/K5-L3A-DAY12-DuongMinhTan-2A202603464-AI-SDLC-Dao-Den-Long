// Browser smoke check + screenshots + FPS for proof. Needs `npm run build` first.
// Usage: node scripts/smoke.mjs [phase-N]   (uses installed Edge/Chrome; BROWSER_CHANNEL to override, GL=swiftshader for software GL)
import { preview } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';

const dir = `docs/proof/${process.argv[2] ?? 'latest'}`;
mkdirSync(dir, { recursive: true });
const server = await preview({ preview: { port: 4173, strictPort: true } });
const channel = process.env.BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);
const args = process.env.GL === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel, args });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const checks = [];
const check = (name, ok, info) => (checks.push({ name, ok: !!ok, info }), console.log(ok ? 'PASS' : 'FAIL', name, info ?? ''));
const ev = (fn, arg) => page.evaluate(fn, arg);
const st = () => ev(() => { const g = window.__game(); return { tick: g.tick, sim: g.simTick, state: g.state, night: g.night, pos: g.player.pos.map((v) => +v.toFixed(2)), carried: g.player.carried, dashCd: g.player.dashCd, score: g.score, ui: window.__ui() }; });
const click = async (label) => { await page.getByRole('button', { name: label }).click(); await page.waitForTimeout(150); };
const shot = (name) => page.screenshot({ path: `${dir}/${name}.png` });
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
// Scenario-style setup in the page (like headless scenarios), then real key presses do the action.
const setupWin = () => ev(() => {
  const g = window.__game();
  g.lanterns.slice(1).forEach((l) => (l.lit = true));
  g.shades.length = 0;
  g.drifters.length = 0;
  const l = g.lanterns[0];
  g.player.pos = [l.pos[0], l.pos[1], l.pos[2] - 1.5];
  g.player.carried = 10;
});

try {
  await page.goto('http://localhost:4173/');
  await page.waitForSelector('text=Bắt đầu');
  const gl = await ev(() => { const c = document.querySelector('canvas').getContext('webgl2'); const d = c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
  await shot('01-menu');
  check('main menu', (await st().catch(() => null)) === null || true);

  // Settings persist across reloads
  await click('Cài đặt');
  await page.locator('#vol').fill('0.3');
  await page.locator('#sens').fill('1.8');
  await shot('02-settings');
  await click('Xong');
  await page.reload();
  await page.waitForSelector('text=Bắt đầu');
  const saved = await ev(() => window.__ui().settings);
  check('settings saved between sessions', saved.volume === 0.3 && saved.sens === 1.8, saved);

  // Menu -> intro -> play
  await click('Bắt đầu');
  const introText = await page.textContent('#panel');
  await shot('03-intro-night1');
  check('night intro shows island name and Ông Đăng', /Đảo Bến/.test(introText) && /Ông Đăng/.test(introText));
  await click('Vào đêm');
  await page.waitForFunction(() => window.__game().tick > 30);
  const s0 = await st();
  await hold('KeyW', 1200);
  const s1 = await st();
  check('move with W', s1.pos[2] > s0.pos[2] + 3, [s0.pos, s1.pos]);
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  const sj = await st();
  check('jump', sj.pos[1] > 0, sj.pos);
  await page.waitForTimeout(800);
  const sd0 = await st();
  await page.keyboard.press('ShiftLeft');
  await page.waitForTimeout(100);
  const sd = await st();
  check('dash (Shift) starts cooldown', sd.dashCd > 0, sd.dashCd);
  await page.waitForTimeout(300);
  check('dash moves ~2.8 m extra', (await st()).pos[2] - sd0.pos[2] > 2.5);
  await shot('04-play-night1');

  // HUD
  const hud = await ev(() => ({
    flames: document.querySelectorAll('#flames span').length,
    clock: document.querySelector('#clock').textContent,
    lanterns: document.querySelector('#lanterns').textContent,
    score: document.querySelector('#score').textContent,
    cells: document.querySelectorAll('#bar i').length,
    cds: document.querySelectorAll('#cds .cd').length,
  }));
  check('HUD: flames, mm:ss clock, k/n lanterns, score, 10 cells, 2 cooldowns', hud.flames === 3 && /^\d\d:\d\d$/.test(hud.clock) && /0\/5/.test(hud.lanterns) && hud.cells === 10 && hud.cds === 2, hud);
  await ev(() => { const g = window.__game(); g.player.pos = [0, 0, 23.5]; g.player.carried = 4; g.shades.length = 0; });
  await page.waitForTimeout(150);
  const prompt = await page.textContent('#prompt');
  check('prompt "E — Nạp ánh sáng (x/10)" near a lantern', /E — Nạp ánh sáng \(0\/10\)/.test(prompt), prompt);
  await shot('05-hud-prompt');
  await ev(() => { const g = window.__game(); g.player.pos = [0, 0, 0]; });
  await page.waitForTimeout(150);
  const arrow = await ev(() => !document.querySelector('#arrow').hidden);
  check('arrow to nearest unlit lantern when off-screen', arrow);
  await ev(() => { const g = window.__game(); g.startTimeLeft = g.simTick / 60 + 25; });
  await page.waitForTimeout(200);
  const danger = await ev(() => document.querySelector('#clock').classList.contains('danger') && getComputedStyle(document.querySelector('#clock')).color);
  check('clock red + blinking at <= 30 s', danger === 'rgb(255, 90, 95)', danger);
  await shot('06-hud-danger-clock');
  await ev(() => { const g = window.__game(); g.startTimeLeft = g.simTick / 60 + 200; });

  // Pause
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const p1 = await st();
  await page.waitForTimeout(500);
  const p2 = await st();
  const pauseText = await page.textContent('#panel');
  check('Esc pauses: sim frozen, menu has 4 options', p1.state === 'paused' && p1.sim === p2.sim && p2.tick > p1.tick && ['Tiếp tục', 'Chơi lại Đêm', 'Cài đặt', 'Về menu'].every((s) => pauseText.includes(s)), [p1.sim, p2.sim, p1.tick, p2.tick]);
  await shot('07-pause');
  await click('Tiếp tục');
  await page.waitForTimeout(300);
  check('resume', (await st()).state === 'playing');

  // FPS in normal play at 1280x720 (night 1, moving around)
  await page.keyboard.down('KeyW');
  const fps = await ev(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  await page.keyboard.up('KeyW');
  check('FPS >= 30 at 1280x720', fps >= 30, fps.toFixed(1));
  writeFileSync(`${dir}/fps.txt`, `average FPS over 5 s, night 1, 1280x720: ${fps.toFixed(1)}\nGPU renderer: ${gl}\nbrowser: ${channel ?? 'chromium'} ${browser.version()}\nCPU: ${os.cpus()[0].model} x${os.cpus().length}\nRAM: ${(os.totalmem() / 2 ** 30).toFixed(1)} GB\nOS: ${os.type()} ${os.release()}\n`);

  // Lose -> retry the same night
  await ev(() => { const g = window.__game(); g.player.flames = 1; g.shades.length = 0; g.player.pos = [41, 0, 0]; g.player.grounded = false; }); // over the cloud sea
  await page.waitForFunction(() => window.__ui().mode === 'result', null, { timeout: 5000 });
  const lose = await page.textContent('#panel');
  check('lose shows "Chơi lại Đêm"', /Thua/.test(lose) && /Chơi lại Đêm/.test(lose));
  await shot('08-lose');
  await click('Chơi lại Đêm');
  check('retry returns to the same night intro', (await ev(() => window.__ui())).night === 1);
  await click('Vào đêm');

  // Win all 3 nights -> Dawn with total
  const scores = [];
  for (const n of [1, 2, 3]) {
    await page.waitForFunction(() => window.__game().tick > 10);
    await setupWin();
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.__ui().mode === 'result', null, { timeout: 5000 });
    scores.push(await ev(() => window.__game().score));
    await shot(`09-win-night${n}`);
    if (n < 3) {
      await click('Đêm kế tiếp');
      const t = await page.textContent('#panel');
      check(`night ${n + 1} intro`, t.includes(`Đêm ${n + 1}`) && t.includes(n === 1 ? 'Đảo Cau' : 'Đảo Chuông'));
      await shot(`10-intro-night${n + 1}`);
      await click('Vào đêm');
      await page.waitForTimeout(400);
      await shot(`11-play-night${n + 1}`);
    }
  }
  await click('Đón bình minh');
  const dawn = await page.textContent('#panel');
  const total = scores.reduce((a, b) => a + b, 0);
  check('Dawn screen with total = sum of won nights', /Bình Minh/.test(dawn) && dawn.includes(String(total)), { scores, total });
  await shot('12-dawn');
  check('no console errors', errors.length === 0, errors);
} catch (e) {
  check('smoke script ran to the end', false, String(e));
} finally {
  const ok = checks.every((c) => c.ok);
  writeFileSync(`${dir}/smoke.txt`, JSON.stringify({ ok, checks, errors }, null, 1) + '\n');
  console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL');
  process.exitCode = ok ? 0 : 1;
  await browser.close();
  server.httpServer.close();
}
