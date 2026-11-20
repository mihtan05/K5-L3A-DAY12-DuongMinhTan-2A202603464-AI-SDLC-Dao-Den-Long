// Playable game: drives the same src/core sim as headless at a fixed 60 ticks/s, then draws it.
import * as THREE from 'three';
import { createGame, IDLE, step, timeLeft, TPS, type Game, type GameEvent, type Input } from '../core/sim';
import { TUNING as T, WORLD as W } from '../core/tuning';
import { makeBigLantern, makeIsland, makeMay, makeMote, makeShade } from './prefabs';
import { playSfx } from './audio';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0a14);
const fog = new THREE.FogExp2(0x1a1028, 0.05); // sương đen, thins as lanterns light up
scene.fog = fog;
const hemi = new THREE.HemisphereLight(0x8a7ab8, 0x1a1420, 0.5);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xb8c4ff, 0.45);
moon.position.set(-5, 10, 4);
scene.add(moon);
scene.add(makeIsland(W.island_radius));

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- Input: WASD move (camera-relative), Space jump, E deposit, F pulse, mouse drag / ←→ camera, R replay
const keys = new Set<string>();
const tapped = new Set<string>(); // taps shorter than one tick still count once
addEventListener('keydown', (e) => {
  keys.add(e.code);
  tapped.add(e.code);
  if (e.code === 'KeyR' && game.state !== 'playing') reset();
});
addEventListener('keyup', (e) => keys.delete(e.code));
let yaw = 0;
let dragging = false;
addEventListener('mousedown', () => (dragging = true));
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => dragging && (yaw -= e.movementX * 0.3));
function readInput(): Input {
  const k = (c: string) => (keys.has(c) ? 1 : 0);
  if (keys.has('ArrowLeft')) yaw += 2;
  if (keys.has('ArrowRight')) yaw -= 2;
  const btn = (c: string) => keys.has(c) || tapped.has(c);
  // Camera looks along +Z at yaw 0, so screen-right is world -X.
  const inp: Input = {
    move: [k('KeyA') - k('KeyD'), k('KeyW') - k('KeyS')],
    cam_yaw_deg: yaw,
    jump: btn('Space'),
    interact: btn('KeyE'),
    pulse: btn('KeyF'),
  };
  tapped.clear();
  return inp;
}

// ---- World objects
const may = makeMay();
scene.add(may.object);
const lanterns = new Map<string, ReturnType<typeof makeBigLantern>>();
const shades = new Map<string, ReturnType<typeof makeShade>>();
const motes = new Map<string, THREE.Sprite>();
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 1, 48),
  new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
);
ring.rotation.x = -Math.PI / 2;
scene.add(ring);
let ringT = 1;

let game: Game;
function reset() {
  for (const l of lanterns.values()) scene.remove(l.object);
  for (const s of shades.values()) scene.remove(s.object);
  for (const m of motes.values()) scene.remove(m);
  lanterns.clear();
  shades.clear();
  motes.clear();
  game = createGame(Math.floor(Math.random() * 2 ** 31)); // render only: seed varies per play
  for (const l of game.lanterns) {
    const o = makeBigLantern();
    o.object.position.set(...l.pos);
    scene.add(o.object);
    lanterns.set(l.id, o);
  }
  yaw = 0;
  msg.style.display = 'none';
}

function onEvent(e: GameEvent) {
  switch (e.name) {
    case 'mote_picked': return playSfx('pickup');
    case 'deposit': return playSfx('deposit');
    case 'lantern_lit': return playSfx('lit');
    case 'pulse': ringT = 0; return playSfx('pulse');
    case 'player_hit': return playSfx('hit');
    case 'game_over': {
      const won = e.data.result === 'won';
      playSfx(won ? 'win' : 'lose');
      msg.innerHTML = `${won ? '🏮 Đảo đã sáng trở lại!' : e.data.reason === 'dawn' ? 'Trời đã sáng… đèn chưa thắp đủ' : 'Mây đã hết lửa…'}
        <div style="font-size:18px;margin-top:12px">Điểm: ${game.score} · Nhấn R để chơi lại</div>`;
      msg.style.display = 'flex';
    }
  }
}

// ---- Sync scene from sim state
function sync(dt: number, t: number) {
  const p = game.player;
  const prev = may.object.position.clone();
  may.object.position.set(...p.pos);
  const d = may.object.position.clone().sub(prev);
  if (d.x * d.x + d.z * d.z > 1e-6) may.object.rotation.y = Math.atan2(d.x, d.z);
  may.setGlow(p.carried / T.carry_capacity);
  may.object.visible = p.invuln === 0 || Math.floor(t * 10) % 2 === 0; // blink while invulnerable

  let lit = 0;
  for (const l of game.lanterns) {
    lanterns.get(l.id)!.setLevel(l.deposited / T.lantern_cost, l.lit);
    lit += +l.lit;
  }
  // Island brightens as lanterns are lit.
  hemi.intensity = 0.5 + lit * 0.25;
  fog.density = 0.05 - lit * 0.007;

  const alive = new Set(game.shades.map((s) => s.id));
  for (const [id, o] of shades) if (!alive.has(id)) (scene.remove(o.object), shades.delete(id));
  for (const s of game.shades) {
    let o = shades.get(s.id);
    if (!o) shades.set(s.id, (o = makeShade())), scene.add(o.object);
    o.object.position.set(...s.pos);
    o.object.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    o.update(t, s.state === 'stunned');
  }
  const mIds = new Set(game.motes.map((m) => m.id));
  for (const [id, o] of motes) if (!mIds.has(id)) (scene.remove(o), motes.delete(id));
  for (const m of game.motes) {
    let o = motes.get(m.id);
    if (!o) motes.set(m.id, (o = makeMote())), scene.add(o);
    o.position.set(m.pos[0], 0.5 + 0.15 * Math.sin(t * 2 + m.pos[0]), m.pos[2]);
  }

  // Pulse ring grows to pulse_radius and fades.
  ringT = Math.min(1, ringT + dt / 0.45);
  ring.position.set(p.pos[0], 0.05, p.pos[2]);
  ring.scale.setScalar(Math.max(0.01, ringT * T.pulse_radius));
  (ring.material as THREE.MeshBasicMaterial).opacity = 1 - ringT;

  const th = (yaw * Math.PI) / 180;
  camera.position.set(p.pos[0] - Math.sin(th) * 7, p.pos[1] + 4, p.pos[2] - Math.cos(th) * 7);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);

  const tl = Math.max(0, timeLeft(game));
  const cd = game.pulseCd > 0 ? `hồi ${(game.pulseCd / TPS).toFixed(1)}s` : p.carried >= T.pulse_cost ? 'sẵn sàng' : `cần ${T.pulse_cost} đom đóm`;
  hud.innerHTML = `🏮 Đèn: ${lit}/${game.lanterns.length} &nbsp; ✨ Đom đóm: ${p.carried}/${T.carry_capacity}
    &nbsp; 🔥 Lửa: ${'●'.repeat(p.flames)}${'○'.repeat(Math.max(0, T.flames - p.flames))}<br>
    ⭐ Điểm: ${game.score} &nbsp; 🌙 ${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')} &nbsp; 💡 Tỏa sáng (F): ${cd}<br>
    <span style="opacity:.7">WASD đi · Space nhảy · E nạp đèn · F tỏa sáng · kéo chuột / ←→ xoay camera</span>`;
}

const hud = document.getElementById('hud')!;
const msg = document.getElementById('msg')!;
reset();

const clock = new THREE.Clock();
let acc = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.25);
  acc += dt;
  while (acc >= 1 / TPS) {
    acc -= 1 / TPS;
    for (const e of step(game, game.state === 'playing' ? readInput() : IDLE)) onEvent(e);
  }
  sync(dt, clock.elapsedTime);
  renderer.render(scene, camera);
});
(window as any).__game = () => game; // for Playwright evidence checks
