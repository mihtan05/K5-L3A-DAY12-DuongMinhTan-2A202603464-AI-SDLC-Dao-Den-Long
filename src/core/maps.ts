// Standard maps from Ticket-02 Part 2. Angles from +X, counter-clockwise seen from above: (r cos a, y, r sin a).
import { RULES as R, TUNING as T } from './tuning';

export type Vec3 = [number, number, number];
export type Pad = { pos: Vec3; vy: number; vel: [number, number] }; // vel = horizontal launch velocity (x, z)
export type NightMap = {
  night: 1 | 2 | 3;
  name: string;
  duration_s: number;
  start: Vec3;
  facing: [number, number];
  lanterns: Vec3[];
  motePoints: Vec3[];
  shadePoints: Vec3[];
  shadeEvery: number; // ticks
  shadeMax: number;
  shadeSpeed: number;
  pads: Pad[];
  charms: Vec3[];
  drifters: boolean;
  wind: boolean;
  /** Surface height at (x, z); -Infinity over the cloud sea. */
  ground(x: number, z: number): number;
};

const ring = (r: number, start: number, step: number, n: number, y = 0, cx = 0): Vec3[] =>
  Array.from({ length: n }, (_, i) => {
    const a = ((start + i * step) * Math.PI) / 180;
    return [cx + r * Math.cos(a), y, r * Math.sin(a)];
  });
const toward = (from: Vec3, to: [number, number], speed: number): [number, number] => {
  const dx = to[0] - from[0], dz = to[1] - from[2], d = Math.hypot(dx, dz);
  return [(dx / d) * speed, (dz / d) * speed];
};

const night1: NightMap = {
  night: 1,
  name: 'Đảo Bến',
  duration_s: T.night1_duration_s,
  start: [0, 0, 0],
  facing: [0, 1],
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  motePoints: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
  shadePoints: ring(37, 15, 30, 12, R.shade_height),
  shadeEvery: 480,
  shadeMax: 6,
  shadeSpeed: T.shade_speed,
  pads: [],
  charms: [],
  drifters: false,
  wind: false,
  ground: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : -Infinity),
};

const padA: Vec3 = [20, 0, 18], padB: Vec3 = [50, 0, -18];
const night2: NightMap = {
  night: 2,
  name: 'Đảo Cau',
  duration_s: T.night2_duration_s,
  start: [0, 0, 0],
  facing: [0, 1],
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  motePoints: [0, 70].flatMap((cx) => [...ring(10, 0, 90, 4, 0, cx), ...ring(22, 0, 45, 8, 0, cx)]),
  shadePoints: [0, 70].flatMap((cx) => ring(26, 22.5, 45, 8, R.shade_height, cx)),
  shadeEvery: 420,
  shadeMax: 8,
  shadeSpeed: T.shade_speed,
  pads: [
    { pos: padA, vy: 14, vel: toward(padA, [70, 0], 24) },
    { pos: padB, vy: 14, vel: toward(padB, [0, 0], 24) },
  ],
  charms: [[35, 0, 0]],
  drifters: true,
  wind: false,
  ground: (x, z) =>
    Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28 || (x >= 26 && x <= 44 && Math.abs(z) <= 2) ? 0 : -Infinity,
};

const RAMPS = [30, 150].map((a) => [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)]);
function ground3(x: number, z: number) {
  const r = Math.hypot(x, z);
  if (r > 45) return -Infinity;
  if (r <= 2) return 6 + 8; // bell tower: a wall nobody can climb
  if (r <= 8) return 6;
  if (r >= 12 && r <= 24 && z > 0) return 3;
  let h = 0;
  for (const [ux, uz] of RAMPS) {
    const s = x * ux + z * uz; // along the ramp (radius)
    // Ramp runs r 30 (Y 0) -> 24 (Y 3); it starts at 23 so its corners overlap tier 1 without a gap.
    if (Math.abs(-x * uz + z * ux) <= 1.5 && s >= 23 && s <= 30) h = Math.max(h, Math.min(3, (3 * (30 - s)) / 6));
  }
  return h;
}
const night3: NightMap = {
  night: 3,
  name: 'Đảo Chuông',
  duration_s: T.night3_duration_s,
  start: [0, 0, -25], // assumption B5: (0,0,0) is inside the bell tower
  facing: [0, 1],
  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  motePoints: [...ring(34, 0, 20, 18), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
  shadePoints: ring(43, 0, 22.5, 16, R.shade_height),
  shadeEvery: 360,
  shadeMax: 10,
  shadeSpeed: R.shade_speed_night3,
  pads: [{ pos: [0, 3, 13], vy: 12, vel: [0, -8] }],
  charms: [[30, 0, 25], [-30, 0, 25]],
  drifters: true,
  wind: true,
  ground: ground3,
};

export const MAPS = { 1: night1, 2: night2, 3: night3 } as const;
export const mapFor = (night: number): NightMap => MAPS[night as 1 | 2 | 3] ?? night1;
