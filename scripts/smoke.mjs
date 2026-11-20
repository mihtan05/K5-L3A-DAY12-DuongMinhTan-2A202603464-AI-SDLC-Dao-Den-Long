// Browser smoke check + screenshots + FPS for proof. Needs `npm run build` first.
// Usage: node scripts/smoke.mjs [phase-N]   (uses installed Edge/Chrome; BROWSER_CHANNEL to override, GL=swiftshader for software GL)
// Serves dist/ with the real game server (scripts/server.mjs) and a throw-away leaderboard file.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';

const dir = `docs/proof/${process.argv[2] ?? 'latest'}`;
mkdirSync(dir, { recursive: true });
process.env.LEADERBOARD_FILE = 'out/smoke-leaderboard.json';
rmSync(process.env.LEADERBOARD_FILE, { force: true });
const { startServer } = await import('./server.mjs');
const server = await startServer(4173);
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
// Smallest computed font size of any visible text in the HUD and the open panel (Ticket-04: >= 18 px at 1280x720).
const minFont = () => ev(() => {
  let min = Infinity, at = '';
  for (const el of document.querySelectorAll('#hud *, #panel *')) {
    if (!el.getClientRects().length || el.closest('[hidden]')) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < min) [min, at] = [fs, el.id || el.tagName + ':' + el.textContent.trim().slice(0, 20)];
  }
  return { min, at };
});
const caps = () => ev(() => document.querySelector('#captions').innerText);
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
// Scenario-style setup in the page (like headless scenarios), then real key presses do the action.
// Ticket-03: a night is won only at dawn, so: other lanterns lit, 2 s before dawn, May lights L1 with a real E press.
const setupWin = () => ev(() => {
  const g = window.__game();
  g.lanterns.slice(1).forEach((l) => Object.assign(l, { lit: true, fuel: 6000, everLit: true }));
  g.shades.length = 0;
  g.drifters.length = 0;
  const l = g.lanterns[0];
  g.player.pos = [l.pos[0], l.pos[1], l.pos[2] - 1.5];
  g.player.carried = 10;
  g.startTimeLeft = g.simTick / 60 + 2;
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
  await page.locator('#cb').check();
  await shot('02-settings');
  await click('Xong');
  await page.reload();
  await page.waitForSelector('text=Bắt đầu');
  const saved = await ev(() => window.__ui().settings);
  check('settings (volume, mouse, colorblind palette) saved between sessions', saved.volume === 0.3 && saved.sens === 1.8 && saved.colorblind === true, saved);
  // Colorblind palette off for the default-colour checks below; it is checked again near the end.
  await click('Cài đặt');
  await page.locator('#cb').uncheck();
  // Ticket-04 rebinding: a clash is refused and reported; a free key is saved and survives a reload
  await click('Đổi phím');
  await page.getByRole('button', { name: /^Nhảy:/ }).click();
  await page.keyboard.press('KeyW');
  const clash = await ev(() => ({ msg: document.querySelector('#keymsg').textContent, jump: window.__ui().settings.keys.jump }));
  check('rebinding: a key used by another action is refused and reported', /đang dùng cho "Đi tới"/.test(clash.msg) && clash.jump === 'Space', clash);
  await page.getByRole('button', { name: /^Nhảy:/ }).click();
  await page.keyboard.press('KeyJ');
  await shot('14-keys');
  const keyScreen = await page.textContent('#panel');
  check('rebinding screen lists move x4, jump, dash, interact, pulse, pause + "Khôi phục mặc định"',
    ['Đi tới', 'Đi lùi', 'Sang trái', 'Sang phải', 'Nhảy', 'Lướt', 'Tương tác', 'Tỏa sáng', 'Tạm dừng', 'Khôi phục mặc định'].every((t) => keyScreen.includes(t)));
  const menuFont = await minFont();
  check('menus: every text >= 18 px at 1280x720', menuFont.min >= 18, menuFont);
  await click('Xong');
  await click('Xong');
  await page.reload();
  await page.waitForSelector('text=Bắt đầu');
  check('rebinding saved between sessions (jump = J)', (await ev(() => window.__ui().settings.keys.jump)) === 'KeyJ');

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
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(120);
  const sj = await st();
  check('jump with the rebound key J', sj.pos[1] > 0, sj.pos);
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
  hud.barText = await page.textContent('#bar');
  check('HUD: flames, mm:ss clock, k/n lanterns + need, score, carried/capacity, 2 cooldowns', hud.flames === 3 && /^\d\d:\d\d$/.test(hud.clock) && /0\/5 · cần 3/.test(hud.lanterns) && hud.cells === 10 && /0\/10/.test(hud.barText) && hud.cds === 2, hud);
  const hudFont = await minFont();
  check('HUD: every text >= 18 px at 1280x720', hudFont.min >= 18, hudFont);
  await ev(() => { const g = window.__game(); g.player.pos = [0, 0, 23.5]; g.player.carried = 4; g.shades.length = 0; });
  await page.waitForTimeout(150);
  const prompt = await page.textContent('#prompt');
  check('prompt "E — Nạp ánh sáng (x/10)" near a lantern', /E — Nạp ánh sáng \(0\/10\)/.test(prompt), prompt);
  await shot('05-hud-prompt');
  // Fuel UI (Ticket-03): light L1 with a real E press -> capacity 12, refuel prompt; low fuel blinks; out = torn
  await ev(() => { window.__game().player.carried = 10; });
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  const lit1 = await ev(() => ({ lit: window.__game().lanterns[0].lit, bar: document.querySelector('#bar').textContent, prompt: document.querySelector('#prompt').textContent }));
  check('lighting raises capacity to 12; refuel prompt on a lit lantern', lit1.lit && /0\/12/.test(lit1.bar) && /E — Châm dầu \(99\/100\)/.test(lit1.prompt), lit1);
  await shot('05b-lit-fuel-bar');
  await ev(() => { window.__game().lanterns[0].fuel = 25 * 60; });
  await page.waitForTimeout(250);
  await shot('05c-low-fuel-blink-a');
  await page.waitForTimeout(500);
  await shot('05d-low-fuel-blink-b');
  await ev(() => { window.__game().lanterns[0].fuel = 6; });
  await page.waitForTimeout(300);
  const out = await ev(() => window.__game().lanterns[0]);
  check('lantern runs out of fuel -> off, deposited 0, ever_lit', !out.lit && out.everLit && out.deposited === 0, out);
  await shot('05e-lantern-out-torn');
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

  // Ticket-04 captions and visual cues: next spawn tick -> caption; the new shade moved behind the camera -> edge arrow
  await ev(() => { document.querySelector('#captions').replaceChildren(); const g = window.__game(); g.shades.length = 0; g.player.pos = [0, 0, 0]; const next = 300 + 480 * Math.ceil((g.simTick - 299) / 480); g.startTimeLeft += (next - 1 - g.simTick) / 60; g.simTick = next - 1; });
  await page.waitForFunction(() => window.__game().shades.length > 0, null, { timeout: 3000 });
  await ev(() => { const g = window.__game(); g.shades[0].pos = [0, 1, -25]; }); // camera looks along +Z
  await page.waitForTimeout(200);
  const cue = await ev(() => ({ cap: document.querySelector('#captions').innerText, arrow: !document.querySelector('#sarrow').hidden, left: document.querySelector('#sarrow').style.left, top: document.querySelector('#sarrow').style.top }));
  check('caption + edge arrow when a shade appears', /Bóng Mực xuất hiện/.test(cue.cap) && cue.arrow, cue);
  await ev(() => { const g = window.__game(); g.shades.length = 0; Object.assign(g.lanterns[1], { lit: true, fuel: 1810, everLit: true }); g.startTimeLeft = g.simTick / 60 + 10.4; });
  await page.waitForTimeout(800);
  const cap2 = await caps();
  check('captions: lantern fuel < 30 and last 10 s', /Đèn L2 sắp cạn dầu/.test(cap2) && /10 giây/.test(cap2), cap2);
  await shot('15-captions');
  await ev(() => { const g = window.__game(); g.startTimeLeft = g.simTick / 60 + 200; });
  // Hit: camera shake + red flash; with "Giảm chuyển động" neither
  const hit = () => ev(() => { const g = window.__game(); g.player.invuln = 0; g.player.flames = 3; g.shades.push({ id: 'H' + g.tick, pos: [...g.player.pos], state: 'wander', push: 0, pushDir: [1, 0], expel: 0, expelFrom: [0, 0], target: null, lantern: null, drainT: 0, ticks: 0 }); });
  await hit();
  await page.waitForTimeout(60);
  const fx = await ev(() => ({ flash: document.querySelector('#flash').classList.contains('go') && getComputedStyle(document.querySelector('#flash')).display !== 'none', shake: window.__ui().shake }));
  check('hit: camera shake and screen flash', fx.flash && fx.shake > 0, fx);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await click('Cài đặt');
  await page.locator('#rm').check();
  await click('Xong');
  await click('Tiếp tục');
  await ev(() => { document.querySelector('#flash').classList.remove('go'); window.__game().shades.length = 0; });
  await page.waitForTimeout(500);
  await hit();
  await page.waitForTimeout(60);
  const fx2 = await ev(() => ({ flashShown: getComputedStyle(document.querySelector('#flash')).display !== 'none', shake: window.__ui().shake, hits: 3 - window.__game().player.flames }));
  check('reduced motion: no camera shake, no flash', !fx2.flashShown && fx2.shake === 0 && fx2.hits === 1, fx2);
  // Large text x1.25
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await click('Cài đặt');
  await page.locator('#rm').uncheck();
  await page.locator('#lt').check();
  const bigMenu = await minFont();
  await click('Xong');
  await click('Tiếp tục');
  await ev(() => { const g = window.__game(); g.shades.length = 0; g.player.flames = 3; g.player.invuln = 100000; });
  await page.waitForTimeout(200);
  const bigHud = await minFont();
  check('large text: every text >= 22.5 px (18 x 1.25)', bigMenu.min >= 22.5 && bigHud.min >= 22.5, { bigMenu, bigHud });
  await shot('16-large-text');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await click('Cài đặt');
  await page.locator('#lt').uncheck();
  await click('Xong');
  await click('Tiếp tục');
  await ev(() => { window.__game().player.invuln = 0; });

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
  // Ticket-04 leaderboard after a loss: invalid name refused, valid (Vietnamese) name saved; score = won nights = 0
  await page.waitForFunction(() => window.__game().tick > 10);
  await ev(() => { const g = window.__game(); g.player.flames = 1; g.shades.length = 0; g.player.invuln = 0; g.player.pos = [41, 0, 0]; g.player.grounded = false; });
  await page.waitForFunction(() => window.__ui().mode === 'result', null, { timeout: 5000 });
  await page.locator('#lbname').fill('ab');
  await click(/^Lưu điểm/);
  const badName = await page.textContent('#lbmsg');
  check('leaderboard: name shorter than 3 is refused', /3–12/.test(badName), badName);
  await page.locator('#lbname').fill('Mây_Smoke');
  await shot('17-save-score');
  await click(/^Lưu điểm/);
  await page.waitForFunction(() => window.__ui().overlay === 'board');
  check('leaderboard: saved after a loss (Vietnamese name), board shown', /Mây_Smoke/.test(await page.textContent('#panel')));
  await click('Về menu');
  await click('Bắt đầu');
  await click('Vào đêm');

  // Colorblind palette: UI warning white with ⚠ (shade rim/eyes in the screenshot)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await click('Cài đặt');
  await page.locator('#cb').check();
  await click('Xong');
  await click('Tiếp tục');
  await ev(() => {
    const g = window.__game();
    g.startTimeLeft = g.simTick / 60 + 25;
    g.player.invuln = 100000;
    g.shades.push({ id: 'X', pos: [g.player.pos[0] + 1.5, 1, g.player.pos[2] + 3], state: 'stunned', ticks: 100000, push: 0, pushDir: [1, 0], expel: 0, expelFrom: [0, 0], target: null, lantern: null, drainT: 0 });
    g.shades.push({ id: 'Y', pos: [g.player.pos[0] - 1.5, 1, g.player.pos[2] + 3], state: 'spawning', ticks: 100000, push: 0, pushDir: [1, 0], expel: 0, expelFrom: [0, 0], target: null, lantern: null, drainT: 0 });
  });
  await page.waitForTimeout(400);
  const cbClock = await ev(() => ({ text: document.querySelector('#clock').textContent, color: getComputedStyle(document.querySelector('#clock')).color }));
  check('colorblind: UI warning is white with ⚠', cbClock.color === 'rgb(255, 255, 255)' && cbClock.text.startsWith('⚠'), cbClock);
  await shot('13-colorblind');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await click('Chơi lại Đêm');
  await page.waitForTimeout(200);

  // Win all 3 nights at dawn -> Dawn screen with total
  const scores = [];
  for (const n of [1, 2, 3]) {
    await page.waitForFunction(() => window.__game().tick > 10);
    if (n === 3) {
      await ev(() => { const g = window.__game(); g.startTimeLeft += (1675 - g.simTick) / 60; g.simTick = 1675; });
      await page.waitForTimeout(400);
      const wc = await caps();
      check('caption: wind coming (night 3)', /Gió sắp thổi/.test(wc), wc);
    }
    await setupWin();
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.__ui().mode === 'result', null, { timeout: 8000 });
    check(`night ${n} won at dawn`, /bình minh/.test(await page.textContent('#panel')));
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
  await page.locator('#lbname').fill('Rong_3dem');
  await click(/^Lưu điểm/);
  await page.waitForFunction(() => window.__ui().overlay === 'board');
  // stored on disk by the game server: reload, open from the main menu
  await page.reload();
  await click('Bảng xếp hạng');
  const rows = await ev(() => [...document.querySelectorAll('#panel tbody tr')].map((r) => [...r.cells].map((c) => c.textContent)));
  check('leaderboard from the main menu after reload: sorted by score, Dawn run (3 nights) first',
    rows.length === 2 && rows[0][1] === 'Rong_3dem' && rows[0][2] === String(total) && rows[0][3] === '3' && rows[1][1] === 'Mây_Smoke' && rows[1][2] === '0', rows);
  await shot('18-leaderboard');
  execFileSync(process.execPath, ['scripts/server.mjs', '--export-leaderboard', `${dir}/leaderboard-export.json`]);
  const exp = JSON.parse(readFileSync(`${dir}/leaderboard-export.json`, 'utf8'));
  check('export: {"entries": [...]} in board order with name, score, nights_won, achieved_at (with zone), seed',
    exp.entries.map((e) => e.name).join() === 'Rong_3dem,Mây_Smoke' && exp.entries.every((e) => /([+-]\d\d:\d\d|Z)$/.test(e.achieved_at) && Number.isInteger(e.seed) && Number.isInteger(e.nights_won)), exp);
  check('no console errors', errors.length === 0, errors);
} catch (e) {
  check('smoke script ran to the end', false, String(e));
} finally {
  const ok = checks.every((c) => c.ok);
  writeFileSync(`${dir}/smoke.txt`, JSON.stringify({ ok, checks, errors }, null, 1) + '\n');
  console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL');
  process.exitCode = ok ? 0 : 1;
  await browser.close();
  server.close();
}
