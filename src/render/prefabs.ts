// Procedural prefabs (self-made, no external license). Render-only.
// Colors of every component listed in Ticket-02 come from palette.ts.
import * as THREE from 'three';
import type { NightMap } from '../core/maps';
import { P } from './palette';

const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });

/** Mây: chibi lantern keeper wearing a nón lá. Feet at y=0, faces +Z. */
export function makeMay() {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.35, 8), mat(0x3a2a22));
  legs.position.y = 0.18;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.45, 10), mat(P.mayShirt)); // áo
  body.position.y = 0.55;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.06, 6, 14), mat(P.mayScarf)); // khăn
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), mat(0xf1d4b3));
  head.position.y = 0.98;
  const eyeGeo = new THREE.SphereGeometry(0.025, 6, 6);
  for (const x of [-0.08, 0.08]) {
    const eye = new THREE.Mesh(eyeGeo, mat(0x2a1d1a));
    eye.position.set(x, 1.0, 0.2);
    g.add(eye);
  }
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.24, 28, 1, true), mat(0xe8d39a, { side: THREE.DoubleSide }));
  hat.position.y = 1.2;
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.14, 8),
    mat(P.lanternLit, { emissive: P.lanternLit, emissiveIntensity: 0.6 }),
  );
  lantern.position.set(0.3, 0.5, 0.12);
  const light = new THREE.PointLight(P.lanternLit, 1.5, 5, 1.5);
  light.position.copy(lantern.position);
  g.add(legs, body, scarf, head, hat, lantern, light);
  const setGlow = (k: number) => {
    (lantern.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + k * 1.6;
    light.intensity = 1 + k * 4;
  };
  return { object: g, setGlow };
}

/** Bóng Mực: dark wobbling ink blob with a violet rim and round sad eyes. Center at origin. */
export function makeShade() {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.45, 2);
  const base = Float32Array.from(geo.attributes.position.array as Float32Array);
  const m = mat(P.shadeBody, { emissive: P.shadeRim, emissiveIntensity: 0.12, transparent: true, opacity: 0.95 });
  const blob = new THREE.Mesh(geo, m);
  const rim = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: P.shadeRim, side: THREE.BackSide, transparent: true, opacity: 0.8 }));
  rim.scale.setScalar(1.08);
  const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: P.shadeRim });
  for (const x of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(x, 0.08, 0.4);
    g.add(eye);
  }
  g.add(blob, rim);
  /** rimColor: P.shadeRim, or P_CB.shadeRim in colorblind mode (rim and eyes). */
  const update = (t: number, state: string, rimColor: number) => {
    (rim.material as THREE.MeshBasicMaterial).color.set(rimColor);
    eyeMat.color.set(rimColor);
    m.emissive.set(rimColor);
    const p = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < p.length; i += 3) {
      const w = 1 + 0.08 * Math.sin(t * 3 + base[i] * 6 + base[i + 1] * 4);
      p[i] = base[i] * w;
      p[i + 1] = base[i + 1] * w * (base[i + 1] > 0 ? 1.15 : 1);
      p[i + 2] = base[i + 2] * w;
    }
    geo.attributes.position.needsUpdate = true;
    const stunned = state === 'stunned';
    m.color.set(stunned ? P.shadeStunned : P.shadeBody);
    rim.visible = !stunned;
    m.opacity = state === 'spawning' ? 0.4 + 0.3 * Math.sin(t * 8) : stunned ? 0.6 : 0.95;
    g.scale.setScalar(stunned ? 0.8 : 1);
  };
  return { object: g, update };
}

/** Đèn Lồng Lớn. Base of pillar at y=0. */
export function makeBigLantern() {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.6, 8), mat(P.wood));
  pillar.position.y = 0.8;
  const cageMat = mat(P.lanternOff, { emissive: P.lanternLit, emissiveIntensity: 0 });
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.7, 8), cageMat);
  cage.position.y = 1.95;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: P.lanternCore }));
  core.position.y = 1.95;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 8), mat(0x7a2e1e));
  roof.position.y = 2.47;
  const light = new THREE.PointLight(P.lanternLit, 0, 12, 1.5);
  light.position.y = 2;
  // Torn paper (Ticket-03: an out lantern must read as "off" without color): dark jagged slits on the cage.
  const tear = new THREE.Group();
  const tearMat = new THREE.MeshBasicMaterial({ color: 0xe8e2d0, side: THREE.DoubleSide }); // pale torn paper edges
  for (const a of [0.3, 2.4, 4.4]) {
    const s = new THREE.Shape();
    s.moveTo(0, 0.22);
    [[0.05, 0.1], [-0.03, 0.02], [0.06, -0.08], [-0.02, -0.2], [-0.07, -0.05], [0.0, 0.05], [-0.05, 0.15]].forEach(([x, y]) => s.lineTo(x, y));
    const slit = new THREE.Mesh(new THREE.ShapeGeometry(s), tearMat);
    slit.position.set(Math.sin(a) * 0.36, 1.95, Math.cos(a) * 0.36);
    slit.rotation.y = a;
    tear.add(slit);
  }
  // Fuel bar above a lit lantern; faces the camera.
  const bar = new THREE.Group();
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.16), new THREE.MeshBasicMaterial({ color: 0x0e1430, transparent: true, opacity: 0.8, depthTest: false }));
  const fillGeo = new THREE.PlaneGeometry(1.1, 0.1).translate(0.55, 0, 0); // grows from the left edge
  const barFill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: P.lanternLit, depthTest: false, transparent: true }));
  barFill.position.set(-0.55, 0, 0.001);
  barBg.renderOrder = 10; // background first, fill on top
  barFill.renderOrder = 11;
  bar.add(barBg, barFill);
  bar.position.y = 2.9;
  g.add(pillar, cage, core, roof, light, tear, bar);
  /** fuel 0..100 (lit lanterns), blinkOn: false during the dark half of the 1 Hz low-fuel blink. */
  const setLevel = (fill: number, lit: boolean, fuel: number, blinkOn: boolean, camera: THREE.Camera) => {
    const low = lit && fuel < 30;
    const on = lit && (!low || blinkOn);
    cageMat.color.set(lit ? P.lanternLit : P.lanternOff);
    cageMat.emissiveIntensity = on ? 1.6 : lit ? 0.3 : fill * 0.6;
    core.visible = on || (!lit && fill > 0);
    core.scale.setScalar(lit ? 1 : 0.4 + fill * 0.6);
    light.intensity = on ? 8 : lit ? 1.5 : fill * 1.5;
    cage.scale.set(lit ? 1 : 0.8, lit ? 1 : 0.8, lit ? 1 : 0.8); // out: deflated 20%
    tear.visible = !lit;
    bar.visible = lit && (!low || blinkOn);
    barFill.scale.x = Math.max(0.001, fuel / 100);
    (barFill.material as THREE.MeshBasicMaterial).color.set(low ? 0xff5a5f : P.lanternLit);
    bar.quaternion.copy(camera.quaternion);
  };
  return { object: g, setLevel };
}

/** Đom đóm: additive glowing dot (core → halo). */
export function makeMote() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(0.4);
  return s;
}

/** Gió Lạc: grey-blue silk ribbon that ripples. Center at origin. */
export function makeDrifter() {
  const geo = new THREE.PlaneGeometry(0.35, 2.2, 1, 16);
  const base = Float32Array.from(geo.attributes.position.array as Float32Array);
  const m = new THREE.MeshStandardMaterial({ color: P.drifter, side: THREE.DoubleSide, transparent: true, opacity: 0.85, emissive: P.drifter, emissiveIntensity: 0.25 });
  const mesh = new THREE.Mesh(geo, m);
  mesh.rotation.z = Math.PI / 2.4;
  const g = new THREE.Group();
  g.add(mesh);
  const update = (t: number, state: string) => {
    const p = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < p.length; i += 3) p[i + 2] = base[i + 2] + 0.25 * Math.sin(t * 6 + base[i + 1] * 3);
    geo.attributes.position.needsUpdate = true;
    m.opacity = state === 'flee' ? 0.5 : 0.85;
  };
  return { object: g, update };
}

/** Bùa Gió: red talisman with a gold border. */
export function makeCharm() {
  const g = new THREE.Group();
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.03), mat(P.gold, { emissive: P.gold, emissiveIntensity: 0.4 }));
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.05), mat(P.mayScarf, { emissive: P.mayScarf, emissiveIntensity: 0.3 }));
  g.add(border, paper);
  return g;
}

/** Island geometry for one night (matches the core ground() function). */
export function makeWorld(map: NightMap) {
  const g = new THREE.Group();
  const grass = mat(P.grass);
  const sand = mat(P.sand);
  const disk = (r: number, top: number, depth: number, x = 0, z = 0, m: THREE.Material = grass) => {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, depth, 64), m);
    d.position.set(x, top - depth / 2, z);
    g.add(d);
  };
  const shore = (r: number, x = 0, z = 0) => {
    const s = new THREE.Mesh(new THREE.RingGeometry(r - 1.5, r, 64), sand);
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, 0.02, z);
    g.add(s);
  };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: P.sea, roughness: 0.4 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -6;
  g.add(sea);
  if (map.night === 1) {
    disk(40, 0, 3);
    shore(40);
  } else if (map.night === 2) {
    disk(28, 0, 3);
    disk(28, 0, 3, 70);
    shore(28);
    shore(28, 70);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), mat(P.wood));
    bridge.position.set(35, -0.15, 0);
    g.add(bridge);
  } else {
    disk(45, 0, 3);
    shore(45);
    const s = new THREE.Shape();
    s.absarc(0, 0, 24, 0, Math.PI, false);
    s.absarc(0, 0, 12, Math.PI, 0, true);
    const tier1 = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false, curveSegments: 32 }), grass);
    tier1.rotation.x = Math.PI / 2; // shape y -> world z (> 0), extrude goes down
    tier1.position.y = 3;
    g.add(tier1);
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), grass);
    tier2.position.y = 3;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 16), mat(P.wood));
    tower.position.y = 10;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 2, 8), mat(0x7a2e1e));
    roof.position.y = 15;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(P.gold, { metalness: 0.6 }));
    bell.position.y = 13.2;
    g.add(tier2, tower, roof, bell);
    for (const a of [30, 150]) {
      const [ux, uz] = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, Math.hypot(6, 3)), sand);
      ramp.rotation.order = 'YXZ';
      ramp.rotation.y = Math.atan2(-ux, -uz); // local +Z toward the center
      ramp.rotation.x = -Math.atan2(3, 6); // rises toward the center
      ramp.position.set(27 * ux, 1.5 - 0.12, 27 * uz);
      g.add(ramp);
    }
  }
  for (const pad of map.pads) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 24), mat(P.gold, { emissive: P.gold, emissiveIntensity: 0.6 }));
    m.position.set(pad.pos[0], pad.pos[1] + 0.06, pad.pos[2]);
    g.add(m);
  }
  return g;
}

/** Leaves blown by the night-3 wind (warning + gust). */
export function makeLeaves(n = 80) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9bbf6a, size: 0.18 }));
  pts.frustumCulled = false;
  const update = (center: THREE.Vector3, dir: number, on: boolean, dt: number) => {
    pts.visible = on;
    if (!on) return;
    const [dx, dz] = [Math.cos((dir * Math.PI) / 180), Math.sin((dir * Math.PI) / 180)];
    for (let i = 0; i < n; i++) {
      let x = pos[i * 3] + dx * 8 * dt, z = pos[i * 3 + 2] + dz * 8 * dt;
      if (Math.hypot(x - center.x, z - center.z) > 14 || pos[i * 3 + 1] === 0) {
        x = center.x + (Math.random() - 0.5) * 24; // render-only randomness
        z = center.z + (Math.random() - 0.5) * 24;
        pos[i * 3 + 1] = center.y + 0.3 + Math.random() * 3;
      }
      pos[i * 3] = x;
      pos[i * 3 + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return { object: pts, update };
}

let _glow: THREE.Texture | undefined;
function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff6c2'); // core
  gr.addColorStop(0.3, 'rgba(255,229,138,0.7)'); // halo #FFE58A
  gr.addColorStop(1, 'rgba(255,229,138,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 64, 64);
  return (_glow = new THREE.CanvasTexture(c));
}
