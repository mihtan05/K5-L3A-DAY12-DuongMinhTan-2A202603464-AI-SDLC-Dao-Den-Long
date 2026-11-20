// Procedural prefabs (self-made, no external license). Render-only.
// Colors of every component listed in Ticket-02 come from palette.ts.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { NightMap } from '../core/maps';
import { makeRng } from '../core/rng';
import { P } from './palette';

const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });

/** Mây: young lantern keeper (humanoid, ~1.45 m) in áo, quần, khăn and nón lá. Feet at y=0, faces +Z.
 *  animate(): legs and arms swing with ground speed; legs tuck while airborne. */
export function makeMay() {
  const g = new THREE.Group();
  const skin = mat(0xf1d4b3), pants = mat(0x2e3550), shoe = mat(0x2a1d1a), shirt = mat(P.mayShirt);
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, parent: THREE.Object3D, x = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  // Limb = pivot group at the joint; meshes hang below it, so rotation.x swings the limb.
  const limb = (x: number, y: number, len: number, r: number, m: THREE.Material, end: THREE.Material, endGeo: THREE.BufferGeometry) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    part(new THREE.CapsuleGeometry(r, len - 2 * r, 4, 8), m, -len / 2, pivot);
    const tip = part(endGeo, end, -len, pivot);
    g.add(pivot);
    return { pivot, tip };
  };
  const foot = new THREE.BoxGeometry(0.11, 0.07, 0.2).translate(0, 0, 0.04);
  const hand = new THREE.SphereGeometry(0.05, 8, 6);
  const legL = limb(-0.09, 0.62, 0.6, 0.065, pants, shoe, foot);
  const legR = limb(0.09, 0.62, 0.6, 0.065, pants, shoe, foot);
  const armL = limb(-0.2, 1.02, 0.46, 0.05, shirt, skin, hand);
  const armR = limb(0.2, 1.02, 0.46, 0.05, shirt, skin, hand);
  part(new THREE.CylinderGeometry(0.15, 0.19, 0.46, 10), shirt, 0.83, g); // áo
  part(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), pants, 0.62, g); // hông
  const scarf = part(new THREE.TorusGeometry(0.1, 0.045, 6, 14), mat(P.mayScarf), 1.07, g); // khăn
  scarf.rotation.x = Math.PI / 2;
  const tail = part(new THREE.BoxGeometry(0.08, 0.22, 0.03), mat(P.mayScarf), 0.97, g, 0.05, -0.12);
  part(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8), skin, 1.1, g); // cổ
  const head = new THREE.Group();
  head.position.y = 1.24;
  g.add(head);
  part(new THREE.SphereGeometry(0.15, 16, 12), skin, 0, head);
  part(new THREE.SphereGeometry(0.155, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x1c1414), 0.01, head, 0, -0.01); // tóc
  for (const x of [-0.055, 0.055]) part(new THREE.SphereGeometry(0.02, 6, 6), shoe, 0.01, head, x, 0.14);
  const hat = part(new THREE.ConeGeometry(0.36, 0.2, 28, 1, true), mat(0xe8d39a, { side: THREE.DoubleSide }), 0.16, head);
  hat.rotation.x = -0.08;
  // Hand lantern, held in the right hand (follows the arm swing).
  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 8).scale(1, 1.25, 1),
    mat(P.lanternLit, { emissive: P.lanternLit, emissiveIntensity: 0.6 }),
  );
  lantern.position.set(0, -0.16, 0.04);
  armR.tip.add(lantern);
  const light = new THREE.PointLight(P.lanternLit, 1.5, 5, 1.5);
  light.position.set(0.3, 0.6, 0.15);
  g.add(light);
  const setGlow = (k: number) => {
    (lantern.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + k * 1.6;
    light.intensity = 1 + k * 4;
  };
  let phase = 0;
  /** speed: horizontal m/s; grounded: false while jumping/falling. */
  const animate = (speed: number, grounded: boolean, dt: number) => {
    const k = Math.min(1, speed / 6); // full stride at running speed
    phase += dt * (2 + speed * 1.6);
    const s = Math.sin(phase) * 0.75 * k;
    if (grounded) {
      legL.pivot.rotation.x = s;
      legR.pivot.rotation.x = -s;
    } else {
      legL.pivot.rotation.x = -0.6; // tuck
      legR.pivot.rotation.x = 0.3;
    }
    armL.pivot.rotation.x = grounded ? -s * 0.8 : -1.2;
    armR.pivot.rotation.x = grounded ? s * 0.5 - 0.25 : -0.9; // lantern arm swings less
    armL.pivot.rotation.z = -0.08;
    armR.pivot.rotation.z = 0.08;
    const bob = grounded ? Math.abs(Math.cos(phase)) * 0.04 * k : 0;
    for (const o of g.children) if (o !== light) o.position.y = (o.userData.y ??= o.position.y) + bob;
    tail.rotation.x = 0.3 + k * 0.6 + Math.sin(phase * 2) * 0.1;
    head.rotation.y = Math.sin(phase * 0.5) * 0.05 * (1 - k); // idle glance
  };
  return { object: g, setGlow, animate };
}

/** Bóng Mực: dark wobbling ink blob with a violet rim and round sad eyes. Center at origin. */
// One wobbling body shared by every shade: deformed once per frame, not once per shade (200 shades in the Ticket-04 bench).
const shadeGeo = new THREE.IcosahedronGeometry(0.45, 2);
const shadeBase = Float32Array.from(shadeGeo.attributes.position.array as Float32Array);
let shadeT = NaN;
function wobble(t: number) {
  if (t === shadeT) return;
  shadeT = t;
  const p = shadeGeo.attributes.position.array as Float32Array, base = shadeBase;
  for (let i = 0; i < p.length; i += 3) {
    const w = 1 + 0.08 * Math.sin(t * 3 + base[i] * 6 + base[i + 1] * 4);
    p[i] = base[i] * w;
    p[i + 1] = base[i + 1] * w * (base[i + 1] > 0 ? 1.15 : 1);
    p[i + 2] = base[i + 2] * w;
  }
  shadeGeo.attributes.position.needsUpdate = true;
}
export function makeShade() {
  const g = new THREE.Group();
  const geo = shadeGeo;
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
    wobble(t);
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
  const stone = mat(0x6d6a74), gold = mat(P.gold, { metalness: 0.5, roughness: 0.5 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number) => {
    const o = new THREE.Mesh(geo, m);
    o.position.y = y;
    g.add(o);
    return o;
  };
  add(new THREE.CylinderGeometry(0.62, 0.72, 0.18, 8), stone, 0.09); // bệ đá, 2 bậc
  add(new THREE.CylinderGeometry(0.42, 0.52, 0.2, 8), stone, 0.28);
  add(new THREE.CylinderGeometry(0.11, 0.15, 1.3, 8), mat(P.wood), 1.03); // cột gỗ
  add(new THREE.CylinderGeometry(0.2, 0.14, 0.12, 8), gold, 1.62); // đế đèn
  // Bulging lantern (lathe), gold ribs following the bulge, caps and a red tassel.
  const prof = [[0.16, -0.36], [0.32, -0.22], [0.4, 0], [0.32, 0.22], [0.16, 0.36]].map(([r, y]) => new THREE.Vector2(r, y));
  const cageMat = mat(P.lanternOff, { emissive: P.lanternLit, emissiveIntensity: 0, side: THREE.DoubleSide, flatShading: false });
  const cage = add(new THREE.LatheGeometry(prof, 16), cageMat, 2.04);
  const ribs = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pts = prof.map((v) => new THREE.Vector3(Math.sin(a) * (v.x + 0.01), v.y, Math.cos(a) * (v.x + 0.01)));
    ribs.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.015, 4), gold));
  }
  cage.add(ribs); // ribs deflate with the cage
  add(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12), gold, 1.67);
  add(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12), gold, 2.41);
  for (const a of [0, 2.1, 4.2]) {
    const tassel = add(new THREE.ConeGeometry(0.035, 0.26, 6).rotateX(Math.PI), mat(P.mayScarf), 1.58); // tua rua
    tassel.position.x = Math.sin(a) * 0.2;
    tassel.position.z = Math.cos(a) * 0.2;
  }
  const core = add(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: P.lanternCore }), 2.04);
  add(new THREE.ConeGeometry(0.55, 0.3, 6), mat(0x7a2e1e), 2.58);
  add(new THREE.SphereGeometry(0.06, 8, 6), gold, 2.76); // chóp
  // Soft halo (additive sprite): reads as glow through the fog.
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: P.lanternLit, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.position.y = 2.04;
  halo.scale.setScalar(3.2);
  g.add(halo);
  const light = new THREE.PointLight(P.lanternLit, 0, 12, 1.5);
  light.position.y = 2.1;
  // Torn paper (Ticket-03: an out lantern must read as "off" without color): dark jagged slits on the cage.
  const tear = new THREE.Group();
  const tearMat = new THREE.MeshBasicMaterial({ color: 0xe8e2d0, side: THREE.DoubleSide }); // pale torn paper edges
  for (const a of [0.3, 2.4, 4.4]) {
    const s = new THREE.Shape();
    s.moveTo(0, 0.22);
    [[0.05, 0.1], [-0.03, 0.02], [0.06, -0.08], [-0.02, -0.2], [-0.07, -0.05], [0.0, 0.05], [-0.05, 0.15]].forEach(([x, y]) => s.lineTo(x, y));
    const slit = new THREE.Mesh(new THREE.ShapeGeometry(s), tearMat);
    slit.position.set(Math.sin(a) * 0.42, 2.04, Math.cos(a) * 0.42);
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
  bar.position.y = 3.1;
  g.add(light, tear, bar);
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
    halo.visible = on || (!lit && fill > 0);
    halo.material.opacity = on ? 0.55 : lit ? 0.15 : fill * 0.3;
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
const CLIFF = 0x4a4652, ROCK = 0x6a6672, LEAF = 0x2a5a3e, LEAF2 = 0x3b7a4a, BARK = 0x5a3d28;

/** One InstancedMesh for many copies of a prop (one draw call per prop kind). */
function instanced(geo: THREE.BufferGeometry, m: THREE.Material, xs: THREE.Matrix4[], colors?: number[]) {
  const im = new THREE.InstancedMesh(geo, m, Math.max(1, xs.length));
  im.count = xs.length;
  xs.forEach((x, i) => {
    im.setMatrixAt(i, x);
    if (colors) im.setColorAt(i, new THREE.Color(colors[i]));
  });
  return im;
}
const at = (x: number, y: number, z: number, rotY: number, sx: number, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(sx, sy, sz));

/** Prop geometries, built once and shared by every night. */
const GEO = (() => {
  const broad = mergeGeometries([
    new THREE.IcosahedronGeometry(1.1, 0).translate(0, 2.3, 0),
    new THREE.IcosahedronGeometry(0.8, 0).translate(0.5, 2.9, 0.2),
    new THREE.IcosahedronGeometry(0.75, 0).translate(-0.5, 2.6, -0.3),
  ]);
  const pine = mergeGeometries([0, 1, 2].map((i) => new THREE.ConeGeometry(1.3 - i * 0.35, 1.4, 7).translate(0, 1.6 + i * 0.85, 0)));
  // Cau (areca palm): drooping fronds around the top of a tall thin trunk.
  const palm = mergeGeometries(
    Array.from({ length: 7 }, (_, i) =>
      new THREE.ConeGeometry(0.22, 2.2, 4)
        .translate(0, 1.1, 0)
        .rotateZ(-1.15)
        .rotateY((i / 7) * Math.PI * 2)
        .translate(0, 4.6, 0),
    ),
  );
  const tuft = mergeGeometries([-0.3, 0, 0.3].map((a) => new THREE.ConeGeometry(0.05, 0.4, 3).translate(0, 0.2, 0).rotateZ(a)));
  return {
    broad, pine, palm, tuft,
    trunk: new THREE.CylinderGeometry(0.12, 0.2, 1.8, 6).translate(0, 0.9, 0),
    palmTrunk: new THREE.CylinderGeometry(0.08, 0.12, 4.7, 6).translate(0, 2.35, 0),
    rock: new THREE.DodecahedronGeometry(0.5, 0),
    bush: new THREE.IcosahedronGeometry(0.55, 0),
    flower: new THREE.SphereGeometry(0.07, 5, 4).translate(0, 0.12, 0),
  };
})();

/** Island geometry for one night (matches the core ground() function) plus render-only scenery.
 *  Scenery has no collision in the sim, so trees stay near the rim and away from lanterns, motes and pads. */
export function makeWorld(map: NightMap) {
  const g = new THREE.Group();
  const grass = mat(P.grass);
  const sand = mat(P.sand);
  const cliff = mat(CLIFF);
  const islands: [number, number, number][] = []; // [r, x, z]
  const disk = (r: number, top: number, depth: number, x = 0, z = 0) => {
    // Grass top, rocky cliff side that narrows down into the cloud sea.
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, depth, 64), [cliff, grass, cliff]);
    d.position.set(x, top - depth / 2, z);
    g.add(d);
    islands.push([r, x, z]);
  };
  const shore = (r: number, x = 0, z = 0) => {
    const s = new THREE.Mesh(new THREE.RingGeometry(r - 1.5, r, 64), sand);
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, 0.02, z);
    g.add(s);
    // Edge line drawn without fog: every island's outline stays readable from across the sea.
    const edge = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2) * r, 0.06, Math.sin((i / 96) * Math.PI * 2) * r))),
      new THREE.LineBasicMaterial({ color: P.lanternCore, transparent: true, opacity: 0.45, fog: false }),
    );
    edge.position.set(x, 0, z);
    g.add(edge);
    // Cloud foam where the cliff meets the sea.
    const foam = new THREE.Mesh(new THREE.RingGeometry(r * 0.75, r * 1.3, 64), new THREE.MeshBasicMaterial({ color: 0x8fa3d9, transparent: true, opacity: 0.18, depthWrite: false }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(x, -5.9, z);
    g.add(foam);
  };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: P.sea, roughness: 0.4 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -6;
  g.add(sea);
  if (map.night === 1) {
    disk(40, 0, 6);
    shore(40);
  } else if (map.night === 2) {
    disk(28, 0, 6);
    disk(28, 0, 6, 70);
    shore(28);
    shore(28, 70);
    // Plank bridge with posts and rope rails (walkable strip: x 26..44, |z| ≤ 2).
    const wood = mat(P.wood);
    const planks: THREE.Matrix4[] = [];
    for (let x = 25.5; x <= 44.5; x += 0.55) planks.push(at(x, -0.12, 0, (x * 7) % 0.06, 1));
    g.add(instanced(new THREE.BoxGeometry(0.5, 0.2, 4), wood, planks));
    const posts: THREE.Matrix4[] = [];
    for (let x = 26; x <= 44; x += 3) for (const z of [-2.1, 2.1]) posts.push(at(x, 0.45, z, 0, 1));
    g.add(instanced(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6), wood, posts));
    for (const z of [-2.1, 2.1]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 18, 4).rotateZ(Math.PI / 2), mat(0xc9b48a));
      rope.position.set(35, 0.9, z);
      g.add(rope);
    }
  } else {
    disk(45, 0, 6);
    shore(45);
    const s = new THREE.Shape();
    s.absarc(0, 0, 24, 0, Math.PI, false);
    s.absarc(0, 0, 12, Math.PI, 0, true);
    const tier1 = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false, curveSegments: 32 }), [grass, cliff]);
    tier1.rotation.x = Math.PI / 2; // shape y -> world z (> 0), extrude goes down
    tier1.position.y = 3;
    g.add(tier1);
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), [cliff, grass, cliff]);
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
  g.add(scatter(map, islands));
  return g;
}

/** Trees, rocks, bushes, grass and flowers. Placement is seeded per night, so each island looks the same every run. */
function scatter(map: NightMap, islands: [number, number, number][]) {
  const g = new THREE.Group();
  const rng = makeRng(9001 + map.night);
  const keep: [number, number, number][] = [ // [x, z, clearance]
    ...map.lanterns.map(([x, , z]) => [x, z, 3.5] as [number, number, number]),
    ...map.motePoints.map(([x, , z]) => [x, z, 2] as [number, number, number]),
    ...map.pads.map((p) => [p.pos[0], p.pos[2], 3] as [number, number, number]),
    ...map.charms.map(([x, , z]) => [x, z, 2.5] as [number, number, number]),
    [map.start[0], map.start[2], 4],
  ];
  /** Ground height at (x, z) if the spot is flat (no cliff, ramp or tier edge) and clear by `pad` m; else null. */
  const spot = (x: number, z: number, pad: number) => {
    const y = map.ground(x, z);
    if (!Number.isFinite(y)) return null;
    for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) if (map.ground(x + dx, z + dz) !== y) return null;
    for (const [kx, kz, c] of keep) if (Math.hypot(x - kx, z - kz) < c + pad) return null;
    return y;
  };
  /** Up to n spots; rim = true keeps them in the outer band of each island (out of the play paths). */
  const place = (n: number, pad: number, rim: boolean, tries = n * 30) => {
    const out: [number, number, number][] = [];
    for (let t = 0; t < tries && out.length < n; t++) {
      const [r, cx, cz] = islands[rng.int(islands.length)];
      const a = rng.range(0, Math.PI * 2);
      const d = rim ? rng.range(r - 7, r - 2) : Math.sqrt(rng.next()) * (r - 1.8);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const y = spot(x, z, pad);
      if (y !== null && !(map.night === 2 && x > 24 && x < 46 && Math.abs(z) < 4)) out.push([x, y, z]); // bridge ends
    }
    return out;
  };
  const sizes = (pts: [number, number, number][], lo: number, hi: number, squash = 1) =>
    pts.map(([x, y, z]) => {
      const s = rng.range(lo, hi);
      return at(x, y, z, rng.range(0, Math.PI * 2), s, s * squash, s);
    });
  const bark = mat(BARK), leaf = mat(LEAF), leaf2 = mat(LEAF2);
  // Night 1 Đảo Bến: broadleaf trees. Night 2 Đảo Cau: areca palms. Night 3 Đảo Chuông: pines + broadleaf.
  const trees = place(map.night === 2 ? 30 : 34, 1.5, true);
  const tx = sizes(trees, 0.8, 1.35);
  if (map.night === 2) {
    g.add(instanced(GEO.palmTrunk, bark, tx), instanced(GEO.palm, leaf2, tx));
  } else {
    const half = map.night === 3 ? Math.floor(tx.length / 2) : tx.length;
    const broad = tx.slice(0, half), pine = tx.slice(half);
    g.add(instanced(GEO.trunk, bark, tx), instanced(GEO.broad, leaf, broad));
    if (pine.length) g.add(instanced(GEO.pine, leaf2, pine));
  }
  g.add(instanced(GEO.rock, mat(ROCK), sizes(place(45, 0.6, false), 0.4, 1.4, 0.6)));
  g.add(instanced(GEO.bush, leaf2, sizes(place(40, 0.8, true), 0.6, 1.2, 0.7)));
  g.add(instanced(GEO.tuft, mat(0x4a8a5c), sizes(place(420, 0, false), 0.7, 1.3)));
  const flowers = place(160, 0, false);
  const petal = [0xf7a8c4, 0xfff1c9, 0xf2c14e, 0xc9a8f7];
  g.add(instanced(GEO.flower, new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0x332211 }), sizes(flowers, 0.8, 1.2), flowers.map(() => petal[rng.int(petal.length)])));
  // Rim stones: a low wall of stones along each shore marks where the island ends.
  const stones: THREE.Matrix4[] = [];
  for (const [r, cx, cz] of islands) {
    for (let a = 0; a < Math.PI * 2; a += 1.4 / r) {
      const x = cx + Math.cos(a) * (r - 0.5), z = cz + Math.sin(a) * (r - 0.5);
      if (map.night === 2 && x > 24 && x < 46 && Math.abs(z) < 3) continue; // bridge gap
      if (map.night === 3 && map.ground(x, z) !== 0) continue; // ramps
      const s = rng.range(0.35, 0.6);
      stones.push(at(x, 0.05, z, rng.range(0, 6), s, s * 0.7, s));
    }
  }
  g.add(instanced(GEO.rock, mat(ROCK), stones));
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
