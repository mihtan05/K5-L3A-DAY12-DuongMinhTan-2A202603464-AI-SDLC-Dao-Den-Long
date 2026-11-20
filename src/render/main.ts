// Playable game: drives the same src/core sim as headless at a fixed 60 ticks/s, then draws it.
// Flow (Ticket-02): main menu -> night intro -> play -> result -> next night; night 3 won -> Dawn screen.
import * as THREE from 'three';
import { capacity, createGame, FUEL_MAX, IDLE, lightCost, step, timeLeft, TPS, weak, winNeed, type Game, type GameEvent, type Input } from '../core/sim';
import { mapFor } from '../core/maps';
import { TUNING as T } from '../core/tuning';
import { createBench } from '../core/bench';
import { playSfx, setVolume, startMusic, stopMusic } from './audio';
import { BENCH_CAM, frameStats, orbit } from './bench';
import { addEntry, cleanName, isoLocal, loadBoard, type Entry } from '../leaderboard';
import { ambientIntensity, P, P_CB } from './palette';
import { makeBigLantern, makeCharm, makeDrifter, makeLeaves, makeMay, makeMote, makeShade, makeWorld } from './prefabs';

const $ = (id: string) => document.getElementById(id)!;
// Ticket-04 bench scene: ?bench&seed=42&duration=30 (scripts/bench.mjs). No player input; camera on a fixed orbit.
const query = new URLSearchParams(location.search);
const BENCH = query.has('bench') ? { seed: Number(query.get('seed') ?? 42), duration: Number(query.get('duration') ?? 30) } : null;

// ---- Settings (saved between sessions)
// Ticket-04: every action can be rebound; captions; reduced motion; large text (x1.25).
const ACTIONS = ['up', 'down', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause'] as const;
type Action = (typeof ACTIONS)[number];
const ACTION_LABEL: Record<Action, string> = {
  up: 'Đi tới', down: 'Đi lùi', left: 'Sang trái', right: 'Sang phải', jump: 'Nhảy', dash: 'Lướt', interact: 'Tương tác (nạp / châm dầu)', pulse: 'Tỏa sáng', pause: 'Tạm dừng',
};
const DEFAULT_KEYS: Record<Action, string> = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'Escape',
};
type Settings = { volume: number; sens: number; colorblind: boolean; keys: Record<Action, string>; captions: boolean; reduceMotion: boolean; largeText: boolean };
const settings: Settings = {
  volume: 0.7, sens: 1, colorblind: false, keys: { ...DEFAULT_KEYS }, captions: true,
  reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, largeText: false,
};
try {
  const saved = JSON.parse(localStorage.getItem('ddl.settings') ?? '{}');
  Object.assign(settings, saved, { keys: { ...DEFAULT_KEYS, ...saved.keys } });
} catch {}
const keyName = (code: string) =>
  ({ Space: 'Space', Escape: 'Esc', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải', AltLeft: 'Alt trái', AltRight: 'Alt phải',
     ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab', Backquote: '`' } as Record<string, string>)[code] ??
  code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
const K = (a: Action) => keyName(settings.keys[a]);
/** Actions sharing a key with another action. */
const clashes = () => ACTIONS.filter((a) => ACTIONS.some((b) => b !== a && settings.keys[b] === settings.keys[a]));
const saveSettings = () => {
  try {
    localStorage.setItem('ddl.settings', JSON.stringify(settings));
  } catch {}
  setVolume(settings.volume);
  applyLook();
};
setVolume(settings.volume);

// ---- Scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(P.sky);
scene.fog = new THREE.FogExp2(P.fog, 0.022);
const ambient = new THREE.HemisphereLight(0xb8c4ff, P.grass, ambientIntensity(0, 1));
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xb8c4ff, 0.5);
moon.position.set(-5, 10, 4);
scene.add(moon);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- Input: WASD move (camera-relative), Space jump, Shift dash, E deposit, F pulse, Esc/P pause, drag/←→ camera
const keys = new Set<string>();
const tapped = new Set<string>(); // taps shorter than one tick still count once
let queuedPause = false;
addEventListener('keydown', (e) => {
  if (capture) return captureKey(e);
  if (e.target instanceof HTMLInputElement && e.target.type === 'text') return; // typing a leaderboard name
  if (e.code === 'Escape' && settingsOpen) return closeSettings();
  keys.add(e.code);
  tapped.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow') || Object.values(settings.keys).includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
let yaw = 0;
let dragging = false;
renderer.domElement.addEventListener('mousedown', () => (dragging = true));
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => dragging && (yaw -= e.movementX * 0.3 * settings.sens));
function readInput(): Input {
  if (BENCH) return IDLE;
  const kb = settings.keys;
  const k = (a: Action) => (keys.has(kb[a]) ? 1 : 0);
  const bound = new Set(Object.values(kb));
  if (keys.has('ArrowLeft') && !bound.has('ArrowLeft')) yaw += 2 * settings.sens;
  if (keys.has('ArrowRight') && !bound.has('ArrowRight')) yaw -= 2 * settings.sens;
  const btn = (a: Action) => keys.has(kb[a]) || tapped.has(kb[a]);
  // Camera looks along +Z at yaw 0, so screen-right is world -X.
  const inp: Input = {
    move: [k('left') - k('right'), k('up') - k('down')],
    cam_yaw_deg: yaw,
    jump: btn('jump'),
    interact: btn('interact'),
    pulse: btn('pulse'),
    dash: btn('dash'),
    pause: btn('pause') || queuedPause,
  };
  queuedPause = false;
  tapped.clear();
  return inp;
}

// ---- Flow
type Mode = 'menu' | 'intro' | 'play' | 'result' | 'dawn';
let mode: Mode = 'menu';
let night: 1 | 2 | 3 = 1;
let total = 0; // sum of won nights
let nightsWon = 0;
let runSeed = 0; // leaderboard seed; night n plays seed runSeed + n - 1
let game: Game;
let settingsOpen = false;
let overlayKind = '';
const DANG: Record<number, string> = {
  1: 'Sương đen đã nuốt ánh đèn của Đảo Bến. Con nhặt đom đóm, đem về thắp lại năm ngọn đèn lớn nhé. Gặp Bóng Mực thì giơ đèn lên mà tỏa sáng!',
  2: 'Đảo Cau có hai hòn, nối nhau bằng chiếc cầu tre. Bục vàng sẽ đưa con bay qua biển mây. Cẩn thận Gió Lạc, nó thích giật đom đóm lắm.',
  3: 'Đảo Chuông cao ba tầng, gió mạnh thổi từng cơn. Lên dốc, lên bục, thắp bảy ngọn đèn để tháp chuông ngân lúc bình minh.',
};
const overlay = $('overlay');
function show(kind: string, html: string) {
  overlayKind = kind;
  $('panel').innerHTML = html;
  overlay.hidden = false;
  overlay.querySelector('button')?.focus();
}
const hide = () => {
  overlay.hidden = true;
  overlayKind = '';
};
overlay.addEventListener('click', (e) => {
  const act = (e.target as HTMLElement).closest('button')?.dataset.act;
  if (!act) return;
  (e.target as HTMLElement).blur();
  const acts: Record<string, () => unknown> = {
    start: () => ((total = 0), (nightsWon = 0), (runSeed = Math.floor(Math.random() * 2 ** 31)), intro(1)),
    settings: () => openSettings(),
    board: () => showBoard(),
    save: () => saveScore(),
    keys: () => openKeys(),
    'keys-default': () => ((settings.keys = { ...DEFAULT_KEYS }), saveSettings(), openKeys('Đã khôi phục phím mặc định.')),
    'keys-back': () => openSettings(settingsReturn),
    play: () => startNight(),
    next: () => intro((night + 1) as 2 | 3),
    retry: () => intro(night),
    dawn: () => dawn(),
    menu: () => mainMenu(),
    resume: () => (queuedPause = true),
    restart: () => startNight(),
    back: () => closeSettings(),
  };
  acts[act]?.();
});

function mainMenu() {
  mode = 'menu';
  stopMusic();
  $('hud').hidden = true;
  show('menu', `<h1>🏮 Đảo Đèn Lồng</h1><p>Ba đêm, ba hòn đảo. Giữ đèn lồng sáng tới bình minh.</p>
    <button data-act="start">Bắt đầu</button><button data-act="board">Bảng xếp hạng</button><button data-act="settings">Cài đặt</button>`);
}
function intro(n: 1 | 2 | 3) {
  mode = 'intro';
  night = n;
  $('hud').hidden = true;
  const m = mapFor(n);
  show('intro', `<h2>Đêm ${n} — ${m.name}</h2><p class="dang">Ông Đăng: “${DANG[n]}”</p>
    <p>${m.lanterns.length} đèn · ${m.duration_s / 60 | 0}:${String(m.duration_s % 60).padStart(2, '0')} trước bình minh</p>
    <button data-act="play">Vào đêm</button>`);
}
function result(won: boolean, reason: string) {
  mode = 'result';
  stopMusic();
  if (won) (total += game.score), nightsWon++;
  const msg = won ? '🌅 Đảo còn sáng tới bình minh!' : reason === 'dawn' ? `Trời đã sáng… cần ít nhất ${winNeed(game)} đèn còn sáng` : 'Mây đã hết lửa…';
  const btn = won
    ? night === 3 ? '<button data-act="dawn">Đón bình minh</button>' : '<button data-act="next">Đêm kế tiếp</button>'
    : `${saveForm()}<button data-act="retry">Chơi lại Đêm</button><button data-act="menu">Về menu</button>`;
  show('result', `<h2>Đêm ${night} — ${won ? 'Thắng' : 'Thua'}</h2><p>${msg}</p>
    <p>Điểm đêm này: <span class="big">${game.score}</span></p><p>Tổng điểm: ${total}</p>${btn}`);
}
function dawn() {
  mode = 'dawn';
  $('hud').hidden = true;
  show('dawn', `<h1>🌅 Bình Minh</h1><p>Ba hòn đảo đã sáng đèn. Tiếng chuông ngân khắp biển mây.</p>
    <p>Tổng điểm</p><p class="big">${total}</p>${saveForm()}<button data-act="menu">Về menu</button>`);
}
// Key help lives in the pause menu (and README), not on the play screen.
const helpText = () =>
  `${['up', 'left', 'down', 'right'].map((a) => K(a as Action)).join('/')} đi · ${K('jump')} nhảy · ${K('dash')} lướt · ${K('interact')} nạp/châm dầu · ${K('pulse')} tỏa sáng · ${K('pause')} tạm dừng · kéo chuột xoay`;
function pauseMenu() {
  show('pause', `<h2>Tạm dừng</h2><p id="help">${esc(helpText())}</p><button data-act="resume">Tiếp tục</button><button data-act="restart">Chơi lại Đêm</button>
    <button data-act="settings">Cài đặt</button><button data-act="menu">Về menu</button>`);
}
let settingsReturn = '';
function openSettings(from = overlayKind) {
  settingsOpen = true;
  settingsReturn = from;
  const box = (id: string, label: string, on: boolean) => `<label>${label} <input id="${id}" type="checkbox" ${on ? 'checked' : ''}><span></span></label>`;
  show('settings', `<h2>Cài đặt</h2>
    <label>Âm lượng <input id="vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"><output id="volv">${Math.round(settings.volume * 100)}</output></label>
    <label>Độ nhạy chuột <input id="sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sens}"><output id="sensv">${settings.sens.toFixed(1)}</output></label>
    ${box('cb', 'Bảng màu dễ phân biệt', settings.colorblind)}
    ${box('cap', 'Phụ đề và chỉ báo hình ảnh', settings.captions)}
    ${box('rm', 'Giảm chuyển động', settings.reduceMotion)}
    ${box('lt', 'Chữ lớn (×1.25)', settings.largeText)}
    <button data-act="keys">Đổi phím</button><button data-act="back">Xong</button>`);
  const vol = $('vol') as HTMLInputElement, sens = $('sens') as HTMLInputElement;
  vol.oninput = () => ((settings.volume = +vol.value), ($('volv').textContent = String(Math.round(settings.volume * 100))), saveSettings());
  sens.oninput = () => ((settings.sens = +sens.value), ($('sensv').textContent = settings.sens.toFixed(1)), saveSettings());
  const toggle = (id: string, key: 'colorblind' | 'captions' | 'reduceMotion' | 'largeText') => {
    const el = $(id) as HTMLInputElement;
    el.onchange = () => ((settings[key] = el.checked), saveSettings(), applyLook());
  };
  toggle('cb', 'colorblind');
  toggle('cap', 'captions');
  toggle('rm', 'reduceMotion');
  toggle('lt', 'largeText');
}
// Key rebinding: click an action, press a key. A key already used by another action is refused and reported.
let capture: Action | null = null;
function openKeys(msg = '') {
  settingsOpen = true;
  capture = null;
  const bad = clashes();
  const rows = ACTIONS.map((a) => `<label>${ACTION_LABEL[a]} <button class="key${bad.includes(a) ? ' clash' : ''}" data-key="${a}" aria-label="${ACTION_LABEL[a]}: ${K(a)}">${K(a)}</button><span></span></label>`).join('');
  const warn = bad.length ? `⚠ Trùng phím: ${bad.map((a) => ACTION_LABEL[a]).join(', ')}` : msg;
  show('keys', `<h2>Đổi phím</h2><p id="keymsg" role="status" class="${bad.length ? 'warn' : ''}">${warn || 'Bấm vào một hành động rồi nhấn phím mới.'}</p>${rows}
    <button data-act="keys-default">Khôi phục mặc định</button><button data-act="keys-back">Xong</button>`);
  for (const b of $('panel').querySelectorAll<HTMLButtonElement>('button[data-key]'))
    b.onclick = () => {
      if (capture === b.dataset.key) return openKeys(); // second click cancels
      capture = b.dataset.key as Action;
      b.textContent = 'Nhấn phím…';
      $('keymsg').textContent = `Nhấn phím cho "${ACTION_LABEL[capture]}" (bấm lại để hủy).`;
      $('keymsg').className = '';
    };
}
function captureKey(e: KeyboardEvent) {
  e.preventDefault();
  const a = capture!;
  const other = ACTIONS.find((b) => b !== a && settings.keys[b] === e.code);
  if (other) {
    openKeys();
    $('keymsg').textContent = `⚠ Phím ${keyName(e.code)} đang dùng cho "${ACTION_LABEL[other]}". Chọn phím khác hoặc đổi phím của "${ACTION_LABEL[other]}" trước.`;
    $('keymsg').className = 'warn';
    return;
  }
  settings.keys[a] = e.code;
  saveSettings();
  openKeys(`Đã gán ${keyName(e.code)} cho "${ACTION_LABEL[a]}".`);
}
function closeSettings() {
  settingsOpen = false;
  capture = null;
  if (settingsReturn === 'pause') pauseMenu();
  else mainMenu();
}

// ---- Leaderboard (Ticket-04): on disk through the game server (npm start / npm run dev); localStorage when served as plain static files.
const LB_LOCAL = 'ddl.leaderboard';
let lastSaved: Entry | null = null;
async function lbLoad(): Promise<Entry[]> {
  try {
    const r = await fetch('api/leaderboard');
    return loadBoard(JSON.stringify(await r.json()));
  } catch {
    try {
      return loadBoard(localStorage.getItem(LB_LOCAL));
    } catch {
      return [];
    }
  }
}
async function lbSave(e: Omit<Entry, 'achieved_at'>): Promise<Entry | string> {
  try {
    const r = await fetch('api/leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(e) });
    const body = await r.json();
    return r.ok ? body.entry : String(body.error);
  } catch {
    const entry = { ...e, achieved_at: isoLocal(new Date()) };
    try {
      localStorage.setItem(LB_LOCAL, JSON.stringify({ entries: addEntry(loadBoard(localStorage.getItem(LB_LOCAL)), entry) }));
    } catch {}
    return entry;
  }
}
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const saveForm = () => `<form id="lbform" onsubmit="return false"><label class="name">Tên của bạn <input id="lbname" type="text" maxlength="24" autocomplete="nickname" placeholder="3–12 chữ, số hoặc _" aria-describedby="lbmsg"></label>
  <p id="lbmsg" role="status"></p><button data-act="save" type="submit">Lưu điểm (${total} · ${nightsWon} Đêm thắng)</button></form>`;
async function saveScore() {
  const raw = ($('lbname') as HTMLInputElement).value;
  const name = cleanName(raw);
  if (!name) return void (($('lbmsg').textContent = '⚠ Tên cần 3–12 ký tự: chữ (có dấu cũng được), số hoặc _'), $('lbmsg').classList.add('warn'));
  const r = await lbSave({ name, score: total, nights_won: nightsWon, seed: runSeed });
  if (typeof r === 'string') return void (($('lbmsg').textContent = `⚠ ${r}`), $('lbmsg').classList.add('warn'));
  lastSaved = r;
  showBoard();
}
async function showBoard() {
  const list = await lbLoad();
  const rows = list.map((e, i) => {
    const me = lastSaved && e.name === lastSaved.name && e.achieved_at === lastSaved.achieved_at && e.score === lastSaved.score;
    return `<tr class="${me ? 'me' : ''}"><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}</td><td>${esc(e.achieved_at.slice(0, 16).replace('T', ' '))}</td></tr>`;
  }).join('');
  show('board', `<h2>🏆 Bảng xếp hạng</h2>${list.length ? `<table><thead><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Lúc</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>Chưa có ai. Hãy là người đầu tiên!</p>'}
    <button data-act="menu">Về menu</button>`);
}

// ---- Captions and visual cues (Ticket-04): shade appeared (+ edge arrow), wind coming, last 10 s, lantern fuel < 30
function caption(text: string) {
  if (!settings.captions) return;
  const box = $('captions');
  const line = document.createElement('div');
  line.textContent = text;
  box.append(line);
  setTimeout(() => line.remove(), 3500);
  while (box.childElementCount > 3) box.firstElementChild!.remove();
}
let shadeCue: { id: string; until: number } | null = null;
// Camera shake and screen flash on a hit / pulse; both off with "Giảm chuyển động".
let shake = 0;
function flash(color: string) {
  if (settings.reduceMotion) return;
  const f = $('flash');
  f.style.background = color;
  f.classList.remove('go');
  void f.offsetWidth; // restart the CSS animation
  f.classList.add('go');
}

// ---- World objects (rebuilt per night)
const may = makeMay();
scene.add(may.object);
let world = new THREE.Group();
const lanterns = new Map<string, ReturnType<typeof makeBigLantern>>();
const shades = new Map<string, ReturnType<typeof makeShade>>();
const drifters = new Map<string, ReturnType<typeof makeDrifter>>();
const charms = new Map<string, THREE.Group>();
const motes = new Map<string, THREE.Sprite>();
const leaves = makeLeaves();
scene.add(leaves.object);
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 1, 48),
  new THREE.MeshBasicMaterial({ color: P.lanternLit, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
);
ring.rotation.x = -Math.PI / 2;
scene.add(ring);
let ringT = 1;

function clearWorld() {
  scene.remove(world);
  for (const m of [lanterns, shades, drifters] as Map<string, { object: THREE.Object3D }>[]) {
    for (const o of m.values()) scene.remove(o.object);
    m.clear();
  }
  for (const m of [charms, motes] as Map<string, THREE.Object3D>[]) {
    for (const o of m.values()) scene.remove(o);
    m.clear();
  }
}
function startNight(g?: Game) {
  clearWorld();
  game = g ?? createGame(runSeed + night - 1, {}, night); // render only: runSeed is random per run (leaderboard seed)
  world = makeWorld(game.map);
  scene.add(world);
  for (const l of game.lanterns) {
    const o = makeBigLantern();
    o.object.position.set(...l.pos);
    scene.add(o.object);
    lanterns.set(l.id, o);
  }
  for (const c of game.charms) {
    const o = makeCharm();
    scene.add(o);
    charms.set(c.id, o);
  }
  yaw = Math.atan2(game.player.facing[0], game.player.facing[1]) * (180 / Math.PI);
  lastSecond = Infinity;
  windWarned = false;
  lowFuel.clear();
  shadeCue = null;
  $('captions').replaceChildren();
  mode = 'play';
  hide();
  $('hud').hidden = false;
  if (!BENCH) startMusic();
}

let lastSecond = Infinity;
let windWarned = false;
const lowFuel = new Set<string>();
function onEvent(e: GameEvent) {
  switch (e.name) {
    case 'mote_picked': return playSfx('pickup');
    case 'deposit': return playSfx('deposit');
    case 'lantern_lit': return playSfx('lit');
    case 'refuel': return playSfx('deposit');
    case 'lantern_out': caption(`🏮 Đèn ${e.data.lantern_id} đã tắt`); return playSfx('lose');
    case 'pulse': ringT = 0; flash('#ffe58a55'); return playSfx('pulse');
    case 'player_hit': if (!settings.reduceMotion) shake = 0.4; flash('#ff5a5f66'); return playSfx('hit');
    case 'shade_spawned':
      shadeCue = { id: String(e.data.id), until: performance.now() + 3500 };
      caption('👁 Bóng Mực xuất hiện!');
      return playSfx('shade');
    case 'dash': return playSfx('dash');
    case 'charm_picked': return playSfx('charm');
    case 'drifter_steal': return playSfx('steal');
    case 'drifter_drop': return playSfx('pickup');
    case 'game_over': {
      const won = e.data.result === 'won';
      playSfx(won ? 'win' : 'lose');
      setTimeout(() => result(won, String(e.data.reason)), 900);
    }
  }
}

// ---- Sync scene + HUD from sim state
function sync<V extends { object: THREE.Object3D }>(map: Map<string, V>, ids: string[], make: () => V) {
  const keep = new Set(ids);
  for (const [id, o] of map) if (!keep.has(id)) (scene.remove(o.object), map.delete(id));
  return (id: string) => {
    let o = map.get(id);
    if (!o) map.set(id, (o = make())), scene.add(o.object);
    return o;
  };
}
const proj = new THREE.Vector3();
const hudCache = new Map<string, string>();
const setText = (id: string, v: string) => hudCache.get(id) !== v && (hudCache.set(id, v), ($(id).textContent = v));
const setHTML = (id: string, v: string) => hudCache.get('h:' + id) !== v && (hudCache.set('h:' + id, v), ($(id).innerHTML = v));
function draw(dt: number, t: number) {
  const g = game;
  const p = g.player;
  may.object.position.set(...p.pos);
  may.object.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  may.object.visible = p.respawn === 0 && (p.invuln === 0 || Math.floor(t * 10) % 2 === 0);
  may.setGlow(p.carried / T.carry_capacity);

  let lit = 0;
  for (const l of g.lanterns) {
    lanterns.get(l.id)!.setLevel(l.deposited / lightCost(l), l.lit, l.fuel / TPS, Math.floor(t * 2) % 2 === 0, camera); // 1 Hz blink when < 30
    lit += +l.lit;
  }
  ambient.intensity = ambientIntensity(lit, g.lanterns.length);

  const getShade = sync(shades, g.shades.map((s) => s.id), makeShade);
  for (const s of g.shades) {
    const o = getShade(s.id);
    o.object.position.set(...s.pos);
    o.object.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    o.update(t, s.state, settings.colorblind ? P_CB.shadeRim : P.shadeRim);
  }
  const live = g.drifters.filter((d) => d.state !== 'removed');
  const getDrifter = sync(drifters, live.map((d) => d.id), makeDrifter);
  for (const d of live) {
    const o = getDrifter(d.id);
    o.object.position.set(d.pos[0], d.pos[1] + 0.2 * Math.sin(t * 2), d.pos[2]);
    o.object.rotation.y = t * 0.7;
    o.update(t, d.state);
  }
  for (const c of g.charms) {
    const o = charms.get(c.id)!;
    o.visible = c.available;
    o.position.set(c.pos[0], c.pos[1] + 0.8 + 0.15 * Math.sin(t * 2), c.pos[2]);
    o.rotation.y = t * 1.5;
  }
  const mIds = new Set(g.motes.map((m) => m.id));
  for (const [id, o] of motes) if (!mIds.has(id)) (scene.remove(o), motes.delete(id));
  for (const m of g.motes) {
    let o = motes.get(m.id);
    if (!o) motes.set(m.id, (o = makeMote())), scene.add(o);
    o.position.set(m.pos[0], m.pos[1] + 0.5 + 0.15 * Math.sin(t * 2 + m.pos[0]), m.pos[2]);
    o.material.opacity = m.kind === 'dropped' && m.ttl < 120 ? 0.4 + 0.4 * Math.sin(t * 12) : 1;
  }
  leaves.update(may.object.position, g.wind.dirDeg, g.wind.warn || g.wind.active, dt);

  ringT = Math.min(1, ringT + dt / 0.45);
  ring.position.set(p.pos[0], p.pos[1] + 0.05, p.pos[2]);
  ring.scale.setScalar(Math.max(0.01, ringT * T.pulse_radius));
  (ring.material as THREE.MeshBasicMaterial).opacity = 1 - ringT;

  const th = (yaw * Math.PI) / 180;
  const fy = Math.max(p.pos[1], -6);
  if (bench) {
    camera.position.set(...orbit(bench.t));
    camera.lookAt(0, 0, 0);
  } else {
    camera.position.set(p.pos[0] - Math.sin(th) * 7, fy + 4, p.pos[2] - Math.cos(th) * 7);
    camera.lookAt(p.pos[0], fy + 1.2, p.pos[2]);
    if (shake > 0 && !settings.reduceMotion) {
      const a = 0.6 * shake; // render only: Math.random is fine here, never in src/core
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a;
    }
    shake = Math.max(0, shake - dt);
  }
  camera.updateMatrixWorld();

  // HUD (DOM is written only when a value changes: no per-frame style/layout work)
  setHTML('flames', Array.from({ length: T.flames }, (_, i) => `<span class="${i < p.flames ? '' : 'off'}">🔥</span>`).join(''));
  const tl = Math.max(0, timeLeft(g));
  const sec = Math.ceil(tl - 1e-9);
  const clock = $('clock');
  const mmss = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  setText('clock', tl <= 30 && settings.colorblind ? `⚠ ${mmss}` : mmss);
  if (clock.classList.contains('danger') !== tl <= 30) clock.classList.toggle('danger', tl <= 30);
  setText('lanterns', `🏮 Đèn sáng ${lit}/${g.lanterns.length} · cần ${winNeed(g)}`);
  setText('score', `⭐ ${g.score}`);
  const bar = $('bar');
  const cap = capacity(p);
  if (bar.childElementCount !== cap + 1) (bar.innerHTML = '<i></i>'.repeat(cap) + '<b></b>'), hudCache.delete('carried');
  if (hudCache.get('carried') !== `${p.carried}/${cap}`) {
    [...bar.children].forEach((c, i) => c.classList.toggle('on', i < p.carried));
    bar.lastElementChild!.textContent = `${p.carried}/${cap}`;
    hudCache.set('carried', `${p.carried}/${cap}`);
  }
  const cd = (id: string, left: number, full: number) => {
    ($(id).firstElementChild as HTMLElement).style.height = `${(100 * left) / full}%`;
  };
  cd('cd-dash', p.charm > 0 ? 0 : p.dashCd, T.dash_cooldown_s * TPS);
  $('cd-dash').classList.toggle('charmed', p.charm > 0);
  cd('cd-pulse', p.pulseCd, T.pulse_cooldown_s * TPS);
  const unlit = g.lanterns.filter((l) => !l.lit);
  const dist = (l: { pos: number[] }) => Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
  const near = g.lanterns.filter((l) => dist(l) <= T.interact_radius && (!l.lit || l.fuel < FUEL_MAX)).sort((a, b) => dist(a) - dist(b))[0];
  setText('prompt', !near ? '' : near.lit
    ? `${K('interact')} — Châm dầu (${Math.floor(near.fuel / TPS)}/100)`
    : `${K('interact')} — Nạp ánh sáng (${near.deposited}/${lightCost(near)})`);
  setText('wind', g.wind.active ? '🍃 Gió đang thổi!' : g.wind.warn ? '🍃 Gió sắp nổi…' : '');
  const target = unlit.sort((a, b) => dist(a) - dist(b))[0];
  edgeArrow($('arrow'), target ? [target.pos[0], target.pos[1] + 2, target.pos[2]] : null);
  // New shade: arrow at the screen edge towards it for 3.5 s while it is off-screen
  const cue = shadeCue && performance.now() < shadeCue.until && settings.captions ? g.shades.find((s) => s.id === shadeCue!.id) : undefined;
  edgeArrow($('sarrow'), cue ? cue.pos : null);
}
/** Shows el at the screen edge pointing at pos when pos is off-screen; hides it otherwise. */
function edgeArrow(el: HTMLElement, pos: readonly number[] | null) {
  el.hidden = true;
  if (!pos) return;
  proj.set(pos[0], pos[1], pos[2]).project(camera);
  const behind = proj.z > 1;
  if (!behind && Math.abs(proj.x) <= 0.95 && Math.abs(proj.y) <= 0.95) return;
  let [x, y] = behind ? [-proj.x, -proj.y] : [proj.x, proj.y];
  const k = 0.85 / Math.max(Math.abs(x), Math.abs(y), 1e-6);
  [x, y] = [x * k, y * k];
  el.hidden = false;
  el.style.left = `${((x + 1) / 2) * innerWidth}px`;
  el.style.top = `${((1 - y) / 2) * innerHeight}px`;
  (el.firstElementChild as HTMLElement).style.transform = `translate(-50%,-50%) rotate(${Math.atan2(-y, x)}rad)`;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
function applyLook() {
  const root = document.documentElement.style;
  root.setProperty('--danger', hex(settings.colorblind ? P_CB.uiDanger : P.uiDanger));
  root.setProperty('--shade', hex(settings.colorblind ? P_CB.shadeRim : P.shadeRim));
  root.setProperty('--fs', settings.largeText ? '1.25' : '1');
  document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
  $('cd-dash').querySelector('span')!.innerHTML = `Lướt<br>${esc(K('dash'))}`;
  $('cd-pulse').querySelector('span')!.innerHTML = `Tỏa<br>${esc(K('pulse'))}`;
}
applyLook();

// ---- Loop
let bench: { start: number; last: number; t: number; dts: number[]; heap: number; firstFrameEpoch: number } | null = null;
if (BENCH) {
  night = 1;
  startNight(createBench(BENCH.seed));
  bench = { start: -1, last: 0, t: 0, dts: [], heap: 0, firstFrameEpoch: 0 };
} else mainMenu();
const clock = new THREE.Clock();
let acc = 0;
renderer.setAnimationLoop((now: number) => {
  if (bench) benchFrame(now);
  const dt = Math.min(clock.getDelta(), 0.25);
  if (mode === 'play') {
    acc += dt;
    while (acc >= 1 / TPS && mode === 'play' && (game.state === 'playing' || game.state === 'paused')) {
      acc -= 1 / TPS;
      const was = game.player.grounded;
      for (const e of step(game, game.state === 'playing' || game.state === 'paused' ? readInput() : IDLE)) onEvent(e);
      const p = game.player;
      if (was && !p.grounded && p.vel[1] > 0) playSfx(p.launch ? 'dash' : 'jump');
      const s = Math.ceil(timeLeft(game));
      if (game.state === 'playing' && s < lastSecond && s <= 10 && s > 0) playSfx('tick');
      if (game.state === 'playing' && s < lastSecond && s === 10) caption('⏳ Còn 10 giây tới bình minh!');
      lastSecond = s;
      if (game.wind.warn && !windWarned) playSfx('wind'), caption('🍃 Gió sắp thổi!');
      windWarned = game.wind.warn;
      for (const l of game.lanterns) {
        const low = weak(l);
        if (low && !lowFuel.has(l.id)) caption(`🏮 Đèn ${l.id} sắp cạn dầu!`);
        if (low) lowFuel.add(l.id);
        else lowFuel.delete(l.id);
      }
    }
    if (game.state === 'paused' && !overlayKind) pauseMenu();
    if (game.state === 'playing' && (overlayKind === 'pause' || overlayKind === 'settings')) (settingsOpen = false), hide();
  } else acc = 0;
  if (game) draw(dt, clock.elapsedTime);
  renderer.render(scene, camera);
});
/** Frame times over [warmup, warmup + duration) from the first bench frame; then publish the result once. */
function benchFrame(now: number) {
  const b = bench!;
  if (b.start < 0) [b.start, b.last, b.firstFrameEpoch] = [now, now, performance.timeOrigin + now];
  b.t = (now - b.start) / 1000;
  const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
  b.heap = Math.max(b.heap, heap);
  const end = BENCH_CAM.warmup_s + BENCH!.duration;
  if (b.t > BENCH_CAM.warmup_s && b.t <= end) b.dts.push(now - b.last);
  b.last = now;
  if (b.t > end && !(window as unknown as { __bench?: unknown }).__bench)
    Object.assign(window, { __bench: { ...frameStats(b.dts), first_frame_epoch_ms: b.firstFrameEpoch, js_heap_peak_mb: heap ? Math.round(b.heap / 2 ** 20) : null } });
}
// For Playwright evidence checks
Object.assign(window, { __game: () => game, __ui: () => ({ mode, night, total, nightsWon, runSeed, shake, overlay: overlayKind, settings: { ...settings, keys: { ...settings.keys } } }) });
