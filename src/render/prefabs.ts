// Procedural prefabs (self-made, no external license). Render-only: never import from src/core or headless.
import * as THREE from 'three';

const AMBER = 0xffb347;
const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });

/** Mây: chibi lantern keeper wearing a nón lá (conical hat). Feet at y=0, faces +Z. */
export function makeMay() {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.35, 8), mat(0x3a2a22));
  legs.position.y = 0.18;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.45, 10), mat(0x8a5a3c)); // áo bà ba
  body.position.y = 0.55;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.06, 6, 14), mat(AMBER));
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
  // Nón lá: wide shallow cone + chin strap.
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.24, 28, 1, true),
    mat(0xe8d39a, { side: THREE.DoubleSide }),
  );
  hat.position.y = 1.2;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 4, 20, Math.PI), mat(0xb03030));
  strap.position.set(0, 1.03, 0);
  strap.rotation.z = Math.PI;
  // Hand lantern: glows brighter with carried motes (see setGlow).
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.14, 8),
    mat(AMBER, { emissive: AMBER, emissiveIntensity: 0.6 }),
  );
  lantern.position.set(0.3, 0.5, 0.12);
  const light = new THREE.PointLight(AMBER, 1.5, 4, 1.5);
  light.position.copy(lantern.position);
  g.add(legs, body, scarf, head, hat, strap, lantern, light);
  const setGlow = (k: number) => {
    (lantern.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + k * 1.6;
    light.intensity = 1 + k * 4;
  };
  return { object: g, setGlow };
}

/** Bóng Mực: soft wobbling ink blob with round sad eyes. Center at origin. */
export function makeShade() {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.45, 2);
  const base = Float32Array.from(geo.attributes.position.array as Float32Array);
  const m = mat(0x2a1838, { emissive: 0x3d1f5c, emissiveIntensity: 0.35, transparent: true, opacity: 0.92 });
  const blob = new THREE.Mesh(geo, m);
  const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd8c8ff });
  for (const x of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(x, 0.08, 0.4);
    g.add(eye);
  }
  g.add(blob);
  const update = (t: number, stunned = false) => {
    const p = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < p.length; i += 3) {
      const w = 1 + 0.08 * Math.sin(t * 3 + base[i] * 6 + base[i + 1] * 4);
      p[i] = base[i] * w;
      p[i + 1] = base[i + 1] * w * (base[i + 1] > 0 ? 1.15 : 1); // taller wavy top
      p[i + 2] = base[i + 2] * w;
    }
    geo.attributes.position.needsUpdate = true;
    m.opacity = stunned ? 0.45 : 0.92; // stunned: fades like mist, no violence
    g.scale.setScalar(stunned ? 0.8 : 1);
  };
  return { object: g, update };
}

/** Đèn Lồng Lớn. Base of pillar at y=0. */
export function makeBigLantern() {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.6, 8), mat(0x5b4636));
  pillar.position.y = 0.8;
  const cageMat = mat(0x6b6b6b, { emissive: AMBER, emissiveIntensity: 0 });
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.7, 8), cageMat);
  cage.position.y = 1.95;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 8), mat(0x7a2e1e));
  roof.position.y = 2.47;
  const light = new THREE.PointLight(AMBER, 0, 9, 1.5);
  light.position.y = 2;
  g.add(pillar, cage, roof, light);
  const setLevel = (fill: number, lit: boolean) => {
    cageMat.color.set(lit ? 0xffe0a0 : 0x6b6b6b);
    cageMat.emissiveIntensity = lit ? 2 : fill * 0.8;
    light.intensity = lit ? 6 : fill * 1.5;
  };
  return { object: g, setLevel };
}

/** Đom đóm: additive glowing dot. Ground position at y=0, hovers above. */
export function makeMote() {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff1a8, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  s.scale.setScalar(0.35);
  return s;
}

export function makeIsland(radius: number) {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.85, 1, 48), mat(0x3f5a3a));
  ground.position.y = -0.5;
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 4, 48),
    new THREE.MeshStandardMaterial({ color: 0x141a2e, roughness: 0.3 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.6;
  g.add(ground, water);
  return g;
}

let _glow: THREE.Texture | undefined;
function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,230,150,0.6)');
  gr.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 64, 64);
  return (_glow = new THREE.CanvasTexture(c));
}
