// Playable game: drives the same src/core sim as headless at a fixed 60 ticks/s, then draws it.
// Flow (Ticket-02): main menu -> night intro -> play -> result -> next night; night 3 won -> Dawn screen.
import * as THREE from 'three';
import { createGame, IDLE, step, timeLeft, TPS, type Game, type GameEvent, type Input } from '../core/sim';
import { mapFor } from '../core/maps';
import { TUNING as T } from '../core/tuning';
import { playSfx, setVolume, startMusic, stopMusic } from './audio';
import { ambientIntensity, P } from './palette';
import { makeBigLantern, makeCharm, makeDrifter, makeLeaves, makeMay, makeMote, makeShade, makeWorld } from './prefabs';

const $ = (id: string) => document.getElementById(id)!;

// ---- Settings (saved between sessions)
type Settings = { volume: number; sens: number };
const settings: Settings = { volume: 0.7, sens: 1 };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem('ddl.settings') ?? '{}'));
} catch {}
const saveSettings = () => {
  try {
    localStorage.setItem('ddl.settings', JSON.stringify(settings));
  } catch {}
  setVolume(settings.volume);
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
  if (e.code === 'Escape' && settingsOpen) return closeSettings();
  keys.add(e.code);
  tapped.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
let yaw = 0;
let dragging = false;
renderer.domElement.addEventListener('mousedown', () => (dragging = true));
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => dragging && (yaw -= e.movementX * 0.3 * settings.sens));
function readInput(): Input {
  const k = (c: string) => (keys.has(c) ? 1 : 0);
  if (keys.has('ArrowLeft')) yaw += 2 * settings.sens;
  if (keys.has('ArrowRight')) yaw -= 2 * settings.sens;
  const btn = (...c: string[]) => c.some((x) => keys.has(x) || tapped.has(x));
  // Camera looks along +Z at yaw 0, so screen-right is world -X.
  const inp: Input = {
    move: [k('KeyA') - k('KeyD'), k('KeyW') - k('KeyS')],
    cam_yaw_deg: yaw,
    jump: btn('Space'),
    interact: btn('KeyE'),
    pulse: btn('KeyF'),
    dash: btn('ShiftLeft', 'ShiftRight'),
    pause: btn('Escape', 'KeyP') || queuedPause,
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
    start: () => ((total = 0), intro(1)),
    settings: () => openSettings(),
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
  show('menu', `<h1>🏮 Đảo Đèn Lồng</h1><p>Ba đêm, ba hòn đảo. Thắp lại đèn lồng trước khi trời sáng.</p>
    <button data-act="start">Bắt đầu</button><button data-act="settings">Cài đặt</button>`);
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
  if (won) total += game.score;
  const msg = won ? '🏮 Đảo đã sáng trở lại!' : reason === 'dawn' ? 'Trời đã sáng… đèn chưa thắp đủ' : 'Mây đã hết lửa…';
  const btn = won
    ? night === 3 ? '<button data-act="dawn">Đón bình minh</button>' : '<button data-act="next">Đêm kế tiếp</button>'
    : '<button data-act="retry">Chơi lại Đêm</button><button data-act="menu">Về menu</button>';
  show('result', `<h2>Đêm ${night} — ${won ? 'Thắng' : 'Thua'}</h2><p>${msg}</p>
    <p>Điểm đêm này: <span class="big">${game.score}</span></p><p>Tổng điểm: ${total}</p>${btn}`);
}
function dawn() {
  mode = 'dawn';
  $('hud').hidden = true;
  show('dawn', `<h1>🌅 Bình Minh</h1><p>Ba hòn đảo đã sáng đèn. Tiếng chuông ngân khắp biển mây.</p>
    <p>Tổng điểm</p><p class="big">${total}</p><button data-act="menu">Về menu</button>`);
}
function pauseMenu() {
  show('pause', `<h2>Tạm dừng</h2><button data-act="resume">Tiếp tục</button><button data-act="restart">Chơi lại Đêm</button>
    <button data-act="settings">Cài đặt</button><button data-act="menu">Về menu</button>`);
}
let settingsReturn = '';
function openSettings() {
  settingsOpen = true;
  settingsReturn = overlayKind;
  show('settings', `<h2>Cài đặt</h2>
    <label>Âm lượng <input id="vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"><output id="volv">${Math.round(settings.volume * 100)}</output></label>
    <label>Độ nhạy chuột <input id="sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sens}"><output id="sensv">${settings.sens.toFixed(1)}</output></label>
    <button data-act="back">Xong</button>`);
  const vol = $('vol') as HTMLInputElement, sens = $('sens') as HTMLInputElement;
  vol.oninput = () => ((settings.volume = +vol.value), ($('volv').textContent = String(Math.round(settings.volume * 100))), saveSettings());
  sens.oninput = () => ((settings.sens = +sens.value), ($('sensv').textContent = settings.sens.toFixed(1)), saveSettings());
}
function closeSettings() {
  settingsOpen = false;
  if (settingsReturn === 'pause') pauseMenu();
  else mainMenu();
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
function startNight() {
  clearWorld();
  game = createGame(Math.floor(Math.random() * 2 ** 31), {}, night); // render only: seed varies per play
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
  mode = 'play';
  hide();
  $('hud').hidden = false;
  startMusic();
}

let lastSecond = Infinity;
let windWarned = false;
function onEvent(e: GameEvent) {
  switch (e.name) {
    case 'mote_picked': return playSfx('pickup');
    case 'deposit': return playSfx('deposit');
    case 'lantern_lit': return playSfx('lit');
    case 'pulse': ringT = 0; return playSfx('pulse');
    case 'player_hit': return playSfx('hit');
    case 'shade_spawned': return playSfx('shade');
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
function draw(dt: number, t: number) {
  const g = game;
  const p = g.player;
  may.object.position.set(...p.pos);
  may.object.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  may.object.visible = p.respawn === 0 && (p.invuln === 0 || Math.floor(t * 10) % 2 === 0);
  may.setGlow(p.carried / T.carry_capacity);

  let lit = 0;
  for (const l of g.lanterns) {
    lanterns.get(l.id)!.setLevel(l.deposited / T.lantern_cost, l.lit);
    lit += +l.lit;
  }
  ambient.intensity = ambientIntensity(lit, g.lanterns.length);

  const getShade = sync(shades, g.shades.map((s) => s.id), makeShade);
  for (const s of g.shades) {
    const o = getShade(s.id);
    o.object.position.set(...s.pos);
    o.object.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    o.update(t, s.state);
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
  camera.position.set(p.pos[0] - Math.sin(th) * 7, fy + 4, p.pos[2] - Math.cos(th) * 7);
  camera.lookAt(p.pos[0], fy + 1.2, p.pos[2]);
  camera.updateMatrixWorld();

  // HUD
  $('flames').innerHTML = Array.from({ length: T.flames }, (_, i) => `<span class="${i < p.flames ? '' : 'off'}">🔥</span>`).join('');
  const tl = Math.max(0, timeLeft(g));
  const sec = Math.ceil(tl - 1e-9);
  const clock = $('clock');
  clock.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  clock.classList.toggle('danger', tl <= 30);
  $('lanterns').textContent = `🏮 Đèn ${lit}/${g.lanterns.length}`;
  $('score').textContent = `⭐ ${g.score}`;
  const bar = $('bar');
  if (bar.childElementCount !== T.carry_capacity) bar.innerHTML = '<i></i>'.repeat(T.carry_capacity);
  [...bar.children].forEach((c, i) => c.classList.toggle('on', i < p.carried));
  const cd = (id: string, left: number, full: number) => {
    ($(id).firstElementChild as HTMLElement).style.height = `${(100 * left) / full}%`;
  };
  cd('cd-dash', p.charm > 0 ? 0 : p.dashCd, T.dash_cooldown_s * TPS);
  $('cd-dash').classList.toggle('charmed', p.charm > 0);
  cd('cd-pulse', p.pulseCd, T.pulse_cooldown_s * TPS);
  const unlit = g.lanterns.filter((l) => !l.lit);
  const dist = (l: { pos: number[] }) => Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
  const near = unlit.find((l) => dist(l) <= T.interact_radius);
  $('prompt').textContent = near ? `E — Nạp ánh sáng (${near.deposited}/${T.lantern_cost})` : '';
  $('wind').textContent = g.wind.active ? '🍃 Gió đang thổi!' : g.wind.warn ? '🍃 Gió sắp nổi…' : '';
  const target = unlit.sort((a, b) => dist(a) - dist(b))[0];
  const arrow = $('arrow');
  arrow.hidden = true;
  if (target) {
    proj.set(target.pos[0], target.pos[1] + 2, target.pos[2]).project(camera);
    const behind = proj.z > 1;
    if (behind || Math.abs(proj.x) > 0.95 || Math.abs(proj.y) > 0.95) {
      let [x, y] = behind ? [-proj.x, -proj.y] : [proj.x, proj.y];
      const k = 0.85 / Math.max(Math.abs(x), Math.abs(y), 1e-6);
      [x, y] = [x * k, y * k];
      arrow.hidden = false;
      arrow.style.left = `${((x + 1) / 2) * innerWidth}px`;
      arrow.style.top = `${((1 - y) / 2) * innerHeight}px`;
      (arrow.firstElementChild as HTMLElement).style.transform = `translate(-50%,-50%) rotate(${Math.atan2(-y, x)}rad)`;
    }
  }
}

// ---- Loop
mainMenu();
const clock = new THREE.Clock();
let acc = 0;
renderer.setAnimationLoop(() => {
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
      lastSecond = s;
      if (game.wind.warn && !windWarned) playSfx('wind');
      windWarned = game.wind.warn;
    }
    if (game.state === 'paused' && !overlayKind) pauseMenu();
    if (game.state === 'playing' && (overlayKind === 'pause' || overlayKind === 'settings')) (settingsOpen = false), hide();
  } else acc = 0;
  if (game) draw(dt, clock.elapsedTime);
  renderer.render(scene, camera);
});
// For Playwright evidence checks
Object.assign(window, { __game: () => game, __ui: () => ({ mode, night, total, overlay: overlayKind, settings: { ...settings } }) });
