// Giai đoạn 0 demo scene: shows the prefabs. Phase 1 replaces this with the real game loop driven by src/core.
import * as THREE from 'three';
import { makeBigLantern, makeIsland, makeMay, makeMote, makeShade } from './prefabs';
import { playSfx, type Sfx } from './audio';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0a14);
scene.fog = new THREE.FogExp2(0x1a1028, 0.045); // sương đen
scene.add(new THREE.HemisphereLight(0x8a7ab8, 0x1a1420, 0.6));
const moon = new THREE.DirectionalLight(0xb8c4ff, 0.5);
moon.position.set(-5, 10, 4);
scene.add(moon);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

scene.add(makeIsland(12));
const may = makeMay();
scene.add(may.object);
const shade = makeShade();
shade.object.position.set(2.5, 0.6, -1);
scene.add(shade.object);
const lanterns = [0, 1].map((i) => {
  const l = makeBigLantern();
  l.object.position.set(-3 + i * 1.6, 0, -3);
  l.setLevel(i ? 1 : 0.4, i === 1);
  scene.add(l.object);
  return l;
});
const motes = Array.from({ length: 8 }, (_, i) => {
  const m = makeMote();
  m.position.set(Math.cos(i) * 4, 0, Math.sin(i * 1.7) * 4);
  scene.add(m);
  return m;
});

const hud = document.getElementById('hud')!;
hud.textContent = 'Demo prefab — phím 1–7 thử âm thanh: pickup, deposit, lit, pulse, hit, win, lose';
const sfx: Sfx[] = ['pickup', 'deposit', 'lit', 'pulse', 'hit', 'win', 'lose'];
addEventListener('keydown', (e) => {
  const i = Number(e.key) - 1;
  if (sfx[i]) playSfx(sfx[i]);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  camera.position.set(Math.sin(t * 0.2) * 6, 3, Math.cos(t * 0.2) * 6);
  camera.lookAt(0, 0.8, 0);
  may.setGlow((Math.sin(t) + 1) / 2);
  shade.update(t, Math.sin(t * 0.5) > 0.6);
  motes.forEach((m, i) => (m.position.y = 0.5 + 0.15 * Math.sin(t * 2 + i)));
  void lanterns;
  renderer.render(scene, camera);
});
(window as any).__ready = true; // Playwright smoke check hook
