// Deterministic game simulation (Ticket-02 + Ticket-03 / Test Contract v1.2), 60 ticks/s.
// Pure: no DOM, no wall clock, no Math.random. Step order follows Ticket-02 "Thứ tự xử lý trong một tick"
// with Ticket-03 additions (fuel in step 2, lanterns out right after it). Design: docs/adr/0001-lantern-fuel-and-dawn-win.md
import { mapFor, type NightMap, type Vec3 } from './maps';
import { makeRng, type Rng } from './rng';
import { RULES as R, TUNING as T } from './tuning';

export type { Vec3 } from './maps';
export const TPS = 60;
export type Input = {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
};
export const IDLE: Input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };

export const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'] as const;
export type ShadeState = (typeof SHADE_STATES)[number];
export const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'] as const;
export type DrifterState = (typeof DRIFTER_STATES)[number];

export type Mote = { id: string; pos: Vec3; kind: 'random' | 'dropped'; ttl: number };
export type Shade = {
  id: string;
  pos: Vec3;
  state: ShadeState;
  ticks: number; // ticks left in spawning / stunned / recoil
  push: number; // pulse push-back ticks left
  pushDir: [number, number];
  expel: number; // safe-zone expulsion ticks left
  expelFrom: [number, number];
  target: Vec3 | null; // wander target point (when no lantern target)
  lantern: string | null; // wander/drain target lantern id
  drainT: number; // ticks spent draining (fuel_drain event every 60)
};
export type Drifter = { id: string; pos: Vec3; state: DrifterState; stolen: number; ticks: number; robbed: boolean; target: Vec3 | null };
export type Charm = { id: string; pos: Vec3; available: boolean; respawn: number };
/** fuel is stored in integer 1/60 units (6000 = 100) so thresholds are exact; it is 0 when not lit. */
export type Lantern = { id: string; pos: Vec3; lit: boolean; deposited: number; fuel: number; everLit: boolean; relitCount: number };
export type GameEvent = { type: 'event'; tick: number; name: string; data: Record<string, unknown> };
export type Scenario = {
  player?: {
    pos?: Vec3;
    carried?: number;
    flames?: number;
    invuln_ticks?: number;
    dash_cd_ticks?: number;
    pulse_cd_ticks?: number;
    charm_ticks?: number;
    successful_lights?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: Vec3[];
  shades?: { id?: string; pos: Vec3; state?: ShadeState; state_ticks_left?: number; target_lantern_id?: string }[];
  drifters?: { id?: string; pos: Vec3; state?: DrifterState; stolen?: number; state_ticks_left?: number }[];
  charms?: { id?: string; pos?: Vec3; available?: boolean; respawn_ticks?: number }[];
  lanterns?: { id: string; pos?: Vec3; lit?: boolean; deposited?: number; fuel?: number; ever_lit?: boolean }[];
  time_left_s?: number;
};

export type Player = {
  pos: Vec3;
  vel: Vec3;
  grounded: boolean;
  facing: [number, number];
  flames: number;
  carried: number;
  invuln: number;
  dashCd: number;
  dashTicks: number;
  dashDir: [number, number];
  pulseCd: number;
  charm: number;
  launch: [number, number] | null; // horizontal launch velocity from a jump pad, kept until landing
  respawn: number; // > 0 while waiting to respawn after a fall
  lights: number; // successful_lights this night (lights + relights)
};
export type Game = {
  night: 1 | 2 | 3;
  map: NightMap;
  rng: Rng;
  tick: number; // steps run, including paused ones
  simTick: number; // gameplay steps run
  state: 'playing' | 'paused' | 'won' | 'lost';
  score: number;
  startTimeLeft: number;
  player: Player;
  lanterns: Lantern[];
  shades: Shade[];
  drifters: Drifter[];
  charms: Charm[];
  motes: Mote[];
  randomMotes: boolean;
  randomShades: boolean;
  randomDrifters: boolean;
  windEnabled: boolean;
  bench: boolean; // Ticket-04 bench scene: no damage, pickup, fuel burn or end of night
  wind: { active: boolean; warn: boolean; dirDeg: number };
  ids: Record<'M' | 'S' | 'D' | 'C', number> & { used: Set<string> };
  prev: Input;
};

const EPS = 1e-9;
const STUN = Math.round(T.pulse_stun_s * TPS);
const INVULN = Math.round(T.invuln_s * TPS);
const DASH_TICKS = Math.round(T.dash_duration_s * TPS);
const DASH_CD = Math.round(T.dash_cooldown_s * TPS);
const PULSE_CD = Math.round(T.pulse_cooldown_s * TPS);
// Fuel in integer 1/60 units.
export const FUEL_MAX = T.fuel_max * TPS;
const FUEL_LOW = T.low_fuel_threshold * TPS;
const FUEL_PER_MOTE = T.fuel_per_mote * TPS;
const FUEL_DECAY = Math.round(T.fuel_decay_per_s); // units per tick
const FUEL_DRAIN = Math.round(T.drain_per_s); // units per tick per draining shade
/** Fuel as the contract shows it: 1 decimal. */
export const fuelOut = (units: number) => Math.round(units / 6) / 10;
/** Lit with fuel >= 30: has a safe zone. Exactly 30 still counts. */
export const zoneActive = (l: Lantern) => l.lit && l.fuel >= FUEL_LOW;
export const weak = (l: Lantern) => l.lit && l.fuel < FUEL_LOW;
export const lightCost = (l: Lantern) => (l.everLit ? T.relight_cost : T.lantern_cost);
export const capacity = (p: Player) => Math.min(T.capacity_max, T.carry_capacity + R.capacity_per_light * p.lights);
export const winNeed = (g: Game) => Math.ceil(T.win_ratio * g.lanterns.length - 1e-9);

const distXZ = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Unit XZ direction from a to b; +X when they coincide (Ticket-02). */
const dirXZ = (a: Vec3, b: Vec3): [number, number] => {
  const d = distXZ(a, b);
  return d > EPS ? [(b[0] - a[0]) / d, (b[2] - a[2]) / d] : [1, 0];
};
/** Natural id order: prefix, then trailing number (S2 < S10). Assumption B19. */
export const byId = (a: { id: string }, b: { id: string }) => {
  const [, pa, na] = /^(.*?)(\d*)$/.exec(a.id)!;
  const [, pb, nb] = /^(.*?)(\d*)$/.exec(b.id)!;
  if (pa !== pb) return pa < pb ? -1 : 1;
  return Number(na || -1) - Number(nb || -1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
};
export const timeLeft = (g: Game) => g.startTimeLeft - g.simTick / TPS;
const groundOr = (g: Game, x: number, z: number, fallback: number) => {
  const h = g.map.ground(x, z);
  return Number.isFinite(h) ? h : fallback;
};

function newId(g: Game, p: 'M' | 'S' | 'D' | 'C') {
  let id: string;
  do id = p + ++g.ids[p];
  while (g.ids.used.has(id));
  g.ids.used.add(id);
  return id;
}
const aware = (g: Game, pos: Vec3): ShadeState => (distXZ(pos, g.player.pos) <= R.shade_detect + EPS ? 'chase' : 'wander');
function makeShade(id: string, pos: Vec3, state: ShadeState, ticks: number): Shade {
  return { id, pos: [...pos], state, ticks, push: 0, pushDir: [1, 0], expel: 0, expelFrom: [0, 0], target: null, lantern: null, drainT: 0 };
}
/** Nearest lantern matching `ok`, ties -> smaller id (lanterns are kept in id order). */
function nearest(g: Game, from: Vec3, ok: (l: Lantern) => boolean) {
  let best: Lantern | undefined;
  for (const l of g.lanterns) if (ok(l) && (!best || distXZ(l.pos, from) < distXZ(best.pos, from) - EPS)) best = l;
  return best;
}
const DEFAULT_TICKS: Record<string, number> = { spawning: R.shade_spawning_ticks, stunned: STUN, recoil: R.recoil_ticks, flee: R.drifter_flee_ticks };

export function createGame(seed: number, sc: Scenario = {}, night: 1 | 2 | 3 = 1): Game {
  const map = mapFor(night);
  const lanterns: Lantern[] = map.lanterns.map((pos, k) => ({
    id: `L${k + 1}`, pos: [...pos], lit: false, deposited: 0, fuel: 0, everLit: false, relitCount: 0,
  }));
  for (const l of sc.lanterns ?? []) {
    const t = lanterns.find((x) => x.id === l.id)!; // existence checked by the scenario parser
    if (l.pos) t.pos = [...l.pos];
    if (l.deposited !== undefined) t.deposited = l.deposited;
    if (l.lit !== undefined) t.lit = l.lit;
    // lit without fuel -> 100; an unlit lantern holds no fuel. A lit lantern has been lit (assumption C3).
    t.fuel = t.lit ? Math.round((l.fuel ?? T.fuel_max) * TPS) : 0;
    t.everLit = l.ever_lit ?? t.lit;
  }
  const sp = sc.player ?? {};
  const pos: Vec3 = sp.pos ? [...sp.pos] : [...map.start];
  const h = map.ground(pos[0], pos[2]);
  const used = new Set([...(sc.shades ?? []), ...(sc.drifters ?? []), ...(sc.charms ?? [])].flatMap((s) => (s.id ? [s.id] : [])));
  const g: Game = {
    night,
    map,
    rng: makeRng(seed),
    tick: 0,
    simTick: 0,
    state: 'playing',
    score: 0,
    startTimeLeft: sc.time_left_s ?? map.duration_s,
    player: {
      pos,
      vel: [0, 0, 0],
      grounded: Number.isFinite(h) && Math.abs(pos[1] - h) <= R.step_up,
      facing: [...map.facing],
      flames: sp.flames ?? T.flames,
      carried: sp.carried ?? 0,
      invuln: sp.invuln_ticks ?? 0,
      dashCd: sp.dash_cd_ticks ?? 0,
      dashTicks: 0,
      dashDir: [...map.facing],
      pulseCd: sp.pulse_cd_ticks ?? 0,
      charm: sp.charm_ticks ?? 0,
      launch: null,
      respawn: 0,
      lights: sp.successful_lights ?? 0,
    },
    lanterns,
    shades: [],
    drifters: [],
    charms: [],
    motes: [],
    randomMotes: sc.random_motes !== false,
    randomShades: sc.random_shades !== false,
    randomDrifters: sc.random_drifters !== false && map.drifters,
    windEnabled: sc.wind_enabled ?? map.wind,
    bench: false,
    wind: { active: false, warn: false, dirDeg: 0 },
    ids: { M: 0, S: 0, D: 0, C: 0, used },
    prev: { ...IDLE },
  };
  g.shades = (sc.shades ?? []).map((s) => {
    const state = s.state ?? aware(g, s.pos);
    const sh = makeShade(s.id ?? newId(g, 'S'), s.pos, state, s.state_ticks_left ?? DEFAULT_TICKS[state] ?? 0);
    sh.lantern = s.target_lantern_id ?? null;
    return sh;
  });
  g.drifters = (sc.drifters ?? []).map((d) => {
    const state = d.state ?? 'idle';
    return {
      id: d.id ?? newId(g, 'D'),
      pos: [...d.pos],
      state,
      stolen: d.stolen ?? 0,
      ticks: d.state_ticks_left ?? DEFAULT_TICKS[state] ?? 0,
      robbed: state === 'flee' || state === 'removed' || (d.stolen ?? 0) > 0,
      target: null,
    };
  });
  const defaults = map.charms.map((pos, k) => ({ id: `C${k + 1}`, pos }));
  g.charms = (sc.charms ?? defaults).map((c) => {
    const id = c.id ?? newId(g, 'C');
    g.ids.used.add(id);
    const respawn = 'respawn_ticks' in c ? (c.respawn_ticks ?? 0) : 0;
    const available = 'available' in c && c.available !== undefined ? c.available : respawn === 0;
    return { id, pos: [...(c.pos ?? defaults.find((d) => d.id === id)?.pos ?? [0, 0, 0])], available, respawn };
  });
  if (sc.motes) g.motes = sc.motes.map((p) => ({ id: newId(g, 'M'), pos: [...p], kind: 'random', ttl: 0 }));
  else if (g.randomMotes) {
    const free = [...map.motePoints];
    for (let i = 0; i < R.motes_initial && free.length; i++) {
      const [p] = free.splice(g.rng.int(free.length), 1);
      g.motes.push({ id: newId(g, 'M'), pos: [...p], kind: 'random', ttl: 0 });
    }
  }
  return g;
}

/** Move a ground-bound shade by (dx, dz): no cliffs up, no stepping into the sea. Tries each axis to slide along walls. */
function shadeMove(g: Game, s: Shade, dx: number, dz: number): boolean {
  const base = s.pos[1] - R.shade_height;
  for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) {
    if (!mx && !mz) continue;
    const x = s.pos[0] + mx, z = s.pos[2] + mz, h = g.map.ground(x, z);
    if (!Number.isFinite(h) || h > base + R.step_up) continue;
    s.pos = [x, h + R.shade_height, z];
    return mx === dx && mz === dz;
  }
  return false;
}
function stepToward(from: Vec3, to: Vec3, speed: number): [number, number] {
  const d = distXZ(from, to);
  const k = d > EPS ? Math.min(speed / TPS, d) / d : 0;
  return [(to[0] - from[0]) * k, (to[2] - from[2]) * k];
}

/** Run one step with the input of tick g.tick; returns events stamped tick+1. */
export function step(g: Game, inp: Input): GameEvent[] {
  if (g.state === 'won' || g.state === 'lost') return [];
  const t = g.tick + 1;
  const ev: GameEvent[] = [];
  const emit = (name: string, data: Record<string, unknown>) => ev.push({ type: 'event', tick: t, name, data });
  const pressed = (k: 'jump' | 'interact' | 'pulse' | 'dash' | 'pause') => inp[k] && !g.prev[k];
  const finish = () => {
    g.tick = t;
    g.prev = { ...inp };
    return ev;
  };
  const p = g.player;
  const m = g.map;

  // 1. Input: pause first
  if (pressed('pause')) {
    if (g.state === 'playing') {
      g.state = 'paused';
      emit('paused', {});
      return finish();
    }
    g.state = 'playing';
    emit('resumed', {});
  } else if (g.state === 'paused') return finish();
  g.simTick++;
  const st = g.simTick;

  // 2. Timers
  const dec = (n: number) => Math.max(0, n - 1);
  p.invuln = dec(p.invuln);
  p.dashCd = dec(p.dashCd);
  p.pulseCd = dec(p.pulseCd);
  p.charm = dec(p.charm);
  const respawnNow = p.respawn > 0 && --p.respawn === 0;
  for (const s of g.shades) {
    if (s.state === 'stunned' && --s.ticks <= 0) [s.state, s.ticks] = ['wander', 0]; // Ticket-03: stun ends in wander
    if (s.state === 'spawning' && --s.ticks <= 0) [s.state, s.ticks] = [aware(g, s.pos), 0];
  }
  // Fuel: lit lanterns burn 1/60 per tick, each draining shade takes 5/60 more; at 0 the lantern goes out.
  if (!g.bench) for (const l of g.lanterns) if (l.lit) l.fuel -= FUEL_DECAY;
  for (const s of g.bench ? [] : [...g.shades].sort(byId)) {
    if (s.state !== 'drain') continue;
    const l = g.lanterns.find((l) => l.id === s.lantern);
    if (!l?.lit) continue;
    l.fuel -= FUEL_DRAIN;
    if (++s.drainT % TPS === 0) emit('fuel_drain', { lantern_id: l.id, shade_id: s.id, fuel: fuelOut(Math.max(0, l.fuel)) });
  }
  for (const l of g.lanterns)
    if (l.lit && l.fuel <= 0) {
      [l.lit, l.fuel, l.deposited] = [false, 0, 0];
      emit('lantern_out', { lantern_id: l.id });
    }
  g.motes = g.motes.filter((mo) => mo.kind === 'random' || --mo.ttl > 0);
  for (const d of g.drifters) if (d.state === 'flee' && --d.ticks <= 0) d.state = 'removed';
  for (const c of g.charms) if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
  if (g.windEnabled) {
    const ph = st % R.wind_every;
    if (ph === R.wind_every - R.wind_warn) g.wind.dirDeg = g.rng.int(360);
    g.wind.warn = ph >= R.wind_every - R.wind_warn;
    g.wind.active = st >= R.wind_every && ph < R.wind_ticks;
  }

  // 3. Move May (jump, dash, jump pads, wind), then the fall check
  const waiting = () => p.respawn > 0;
  if (respawnNow) {
    p.pos = [...m.start];
    p.vel = [0, 0, 0];
    p.grounded = true;
    p.facing = [...m.facing];
    p.launch = null;
    p.dashTicks = 0;
    p.invuln = INVULN;
  } else if (!waiting()) {
    let [mx, mz] = inp.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) [mx, mz] = [mx / len, mz / len];
    const th = (inp.cam_yaw_deg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const wl = Math.hypot(wx, wz);
    if (wl > EPS) p.facing = [wx / wl, wz / wl];
    if (pressed('dash') && p.dashTicks === 0 && (p.dashCd === 0 || p.charm > 0)) {
      p.dashTicks = DASH_TICKS;
      p.dashDir = [...p.facing];
      p.dashCd = DASH_CD;
      emit('dash', {});
    }
    if (pressed('jump') && p.grounded) {
      p.vel[1] = R.jump_speed;
      p.grounded = false;
    }
    const dashing = p.dashTicks > 0;
    let hx: number, hz: number;
    if (dashing) {
      [hx, hz] = [p.dashDir[0] * T.dash_speed, p.dashDir[1] * T.dash_speed];
      p.dashTicks--;
    } else if (p.launch) [hx, hz] = p.launch;
    else {
      const sp = p.charm > 0 ? R.charm_speed : T.player_speed;
      [hx, hz] = [wx * sp, wz * sp];
    }
    if (g.wind.active) {
      const a = (g.wind.dirDeg * Math.PI) / 180;
      hx += Math.cos(a) * R.wind_speed;
      hz += Math.sin(a) * R.wind_speed;
    }
    const [x0, y0, z0] = p.pos;
    const ok = (x: number, z: number) => m.ground(x, z) <= y0 + R.step_up;
    const nx = x0 + hx / TPS, nz = z0 + hz / TPS;
    if (ok(nx, nz)) [p.pos[0], p.pos[2]] = [nx, nz];
    else if (ok(nx, z0)) p.pos[0] = nx;
    else if (ok(x0, nz)) p.pos[2] = nz;
    const h = m.ground(p.pos[0], p.pos[2]);
    if (dashing) {
      // Dash keeps the height: no gravity; on the ground it still follows gentle slopes.
      if (p.grounded) {
        if (h >= y0 - R.step_up) p.pos[1] = h;
        else p.grounded = false;
      }
    } else if (p.grounded && p.vel[1] <= 0 && h >= y0 - R.step_up) {
      p.pos[1] = h;
      p.vel[1] = 0;
    } else {
      p.grounded = false;
      // exact parabola per tick: apex v²/2g, airtime 2v/g
      p.pos[1] += p.vel[1] / TPS - (0.5 * R.gravity) / (TPS * TPS);
      p.vel[1] -= R.gravity / TPS;
      if (p.pos[1] <= h) {
        p.pos[1] = h;
        p.vel[1] = 0;
        p.grounded = true;
        p.launch = null;
      }
    }
    p.vel[0] = (p.pos[0] - x0) * TPS;
    p.vel[2] = (p.pos[2] - z0) * TPS;
    if (p.grounded && !p.launch)
      for (const pad of m.pads)
        if (distXZ(pad.pos, p.pos) <= 1 + EPS && Math.abs(p.pos[1] - pad.pos[1]) <= R.step_up) {
          p.launch = [...pad.vel];
          p.vel[1] = pad.vy;
          p.grounded = false;
          break;
        }
    if (p.pos[1] < R.fall_y) {
      const lost = p.carried;
      p.carried = 0;
      p.flames--;
      p.respawn = R.respawn_wait;
      p.vel = [0, 0, 0];
      p.launch = null;
      p.dashTicks = 0;
      emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    }
  }

  // 4. Pick up motes and charms
  const reach = (pos: Vec3) => distXZ(pos, p.pos) <= T.pickup_radius + EPS && Math.abs(pos[1] - p.pos[1]) <= R.pickup_dy + EPS;
  if (!waiting() && !g.bench) {
    g.motes = g.motes.filter((mo) => {
      if (p.carried >= capacity(p) || !reach(mo.pos)) return true;
      p.carried++;
      emit('mote_picked', { carried: p.carried });
      return false;
    });
    for (const c of g.charms)
      if (c.available && reach(c.pos)) {
        c.available = false;
        c.respawn = R.charm_respawn;
        p.charm = R.charm_ticks;
        emit('charm_picked', { charm_id: c.id, charm_ticks: R.charm_ticks });
      }
  }

  // 5. Lanterns: nearest lantern that can take light (unlit, or lit and not full) within interact_radius, ties -> smaller id
  if (pressed('interact') && p.carried > 0 && !waiting()) {
    const refuelUse = (l: Lantern) => Math.min(p.carried, Math.ceil((FUEL_MAX - l.fuel) / FUEL_PER_MOTE));
    const takes = (l: Lantern) => (l.lit ? refuelUse(l) > 0 : lightCost(l) - l.deposited > 0);
    const best = nearest(g, p.pos, (l) => takes(l) && distXZ(l.pos, p.pos) <= T.interact_radius + EPS);
    if (best?.lit) {
      const used = refuelUse(best);
      best.fuel = Math.min(FUEL_MAX, best.fuel + FUEL_PER_MOTE * used);
      p.carried -= used;
      g.score += T.score.per_mote * used;
      emit('refuel', { lantern_id: best.id, amount: used, fuel: fuelOut(best.fuel) });
    } else if (best) {
      const amount = Math.min(p.carried, lightCost(best) - best.deposited);
      best.deposited += amount;
      p.carried -= amount;
      g.score += T.score.per_mote * amount;
      emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      if (best.deposited >= lightCost(best)) {
        const relight = best.everLit;
        [best.lit, best.fuel, best.everLit] = [true, FUEL_MAX, true];
        if (relight) best.relitCount++;
        p.lights++;
        g.score += relight ? R.score_relight : T.score.per_lantern;
        emit('lantern_lit', { lantern_id: best.id, relight });
      }
    }
  }

  // 6. Safe zones (lit, fuel >= 30): shades inside are pushed to the edge within 30 ticks.
  // Covers both "just lit" and "refuelled back to >= 30" (ADR 0001).
  const expelled = new Set<Shade>();
  for (const s of g.shades) {
    if (s.expel === 0) {
      const l = g.lanterns.find((l) => zoneActive(l) && distXZ(l.pos, s.pos) < T.safe_radius - 1e-6);
      if (!l) continue;
      s.expel = R.expel_ticks;
      s.expelFrom = [l.pos[0], l.pos[2]];
      if (s.state === 'drain') [s.state, s.lantern, s.drainT] = ['wander', null, 0];
    }
    const c: Vec3 = [s.expelFrom[0], 0, s.expelFrom[1]];
    const [dx, dz] = dirXZ(c, s.pos);
    const d = distXZ(c, s.pos);
    const k = Math.max(0, T.safe_radius - d) / s.expel;
    s.pos[0] += dx * k;
    s.pos[2] += dz * k;
    s.pos[1] = groundOr(g, s.pos[0], s.pos[2], s.pos[1] - R.shade_height) + R.shade_height;
    s.expel--;
    expelled.add(s);
  }

  // 7. Pulse: targets locked now (3D distance from foot + 0.8 m)
  if (pressed('pulse') && p.pulseCd === 0 && p.carried >= T.pulse_cost && !waiting()) {
    p.carried -= T.pulse_cost;
    p.pulseCd = PULSE_CD;
    const c: Vec3 = [p.pos[0], p.pos[1] + R.pulse_center_dy, p.pos[2]];
    const ids: string[] = [];
    for (const s of g.shades) {
      if (dist3(c, s.pos) > T.pulse_radius + EPS) continue;
      g.score += s.state === 'drain' ? R.score_stun_draining : T.score.per_stun;
      [s.lantern, s.drainT] = [null, 0];
      s.state = 'stunned';
      s.ticks = STUN;
      s.push = R.pulse_push_ticks;
      s.pushDir = dirXZ(c, s.pos);
      ids.push(s.id);
    }
    for (const d of g.drifters) {
      if (d.state === 'removed' || dist3(c, d.pos) > T.pulse_radius + EPS) continue;
      if (d.state === 'chase') [d.state, d.ticks, d.robbed] = ['flee', R.drifter_flee_ticks, true];
      else if (d.state === 'flee' && d.stolen > 0) {
        const y = groundOr(g, d.pos[0], d.pos[2], 0);
        for (let i = 0; i < d.stolen; i++) g.motes.push({ id: newId(g, 'M'), pos: [d.pos[0], y, d.pos[2]], kind: 'dropped', ttl: R.dropped_ttl });
        emit('drifter_drop', { drifter_id: d.id, amount: d.stolen });
        d.stolen = 0;
        d.ticks = R.drifter_drop_flee_ticks;
      }
    }
    emit('pulse', { stunned_ids: ids });
  }

  // 8. Move shades and drifters
  for (const s of g.shades) {
    if (expelled.has(s)) continue;
    if (s.state === 'stunned') {
      if (s.push > 0) {
        const k = T.pulse_push_m / R.pulse_push_ticks;
        s.push = shadeMove(g, s, s.pushDir[0] * k, s.pushDir[1] * k) ? s.push - 1 : 0; // stops at obstacles
      }
    } else if (s.state === 'recoil') {
      const [dx, dz] = dirXZ(p.pos, s.pos);
      const k = R.recoil_m / R.recoil_ticks;
      shadeMove(g, s, dx * k, dz * k);
      if (--s.ticks <= 0) [s.state, s.ticks] = [aware(g, s.pos), 0];
    } else if (s.state === 'drain') {
      const l = g.lanterns.find((l) => l.id === s.lantern);
      if (distXZ(s.pos, p.pos) <= R.drain_break + EPS) [s.state, s.lantern, s.drainT] = ['chase', null, 0];
      else if (!l || !weak(l) || distXZ(s.pos, l.pos) > R.drain_range + EPS) [s.state, s.lantern, s.drainT] = ['wander', null, 0];
      // otherwise it stays still and drains (step 2 of the next tick)
    } else if (s.state === 'wander' || s.state === 'chase') {
      const d = distXZ(s.pos, p.pos);
      if (s.state === 'wander' && d <= R.shade_detect + EPS) s.state = 'chase';
      else if (s.state === 'chase' && d > R.shade_giveup + EPS) s.state = 'wander';
      if (s.state === 'chase') {
        s.lantern = null;
        shadeMove(g, s, ...stepToward(s.pos, p.pos, m.shadeSpeed));
      } else {
        // Wander goal (Ticket-03): nearest weak lit lantern, else nearest unlit lantern, else a random point.
        const kept = g.lanterns.find((l) => l.id === s.lantern && weak(l));
        const goal = kept ?? nearest(g, s.pos, weak) ?? nearest(g, s.pos, (l) => !l.lit);
        s.lantern = goal?.id ?? null;
        if (goal && distXZ(s.pos, goal.pos) <= R.drain_range + EPS) {
          if (weak(goal)) [s.state, s.drainT] = ['drain', 0]; // next to an unlit lantern it just waits
        } else if (goal) shadeMove(g, s, ...stepToward(s.pos, goal.pos, R.shade_wander_speed));
        else {
          if (!s.target || distXZ(s.pos, s.target) < 0.5) s.target = m.motePoints[g.rng.int(m.motePoints.length)];
          if (!shadeMove(g, s, ...stepToward(s.pos, s.target, R.shade_wander_speed))) s.target = null;
        }
      }
    }
    for (const l of g.lanterns) {
      if (!zoneActive(l)) continue;
      const d = distXZ(s.pos, l.pos);
      if (d >= T.safe_radius) continue;
      const [dx, dz] = dirXZ(l.pos, s.pos);
      s.pos[0] = l.pos[0] + dx * T.safe_radius;
      s.pos[2] = l.pos[2] + dz * T.safe_radius;
    }
  }
  for (const d of g.drifters) {
    if (d.state === 'removed') continue;
    if (d.state === 'idle' || d.state === 'chase') {
      const want = !waiting() && p.carried >= R.drifter_carry_trigger && distXZ(d.pos, p.pos) <= R.drifter_detect + EPS;
      d.state = want ? 'chase' : 'idle';
    }
    let dx = 0, dz = 0;
    if (d.state === 'chase') [dx, dz] = stepToward(d.pos, p.pos, R.drifter_speed);
    else if (d.state === 'flee') {
      const [ux, uz] = dirXZ(p.pos, d.pos);
      [dx, dz] = [(ux * R.drifter_speed) / TPS, (uz * R.drifter_speed) / TPS];
    } else {
      if (!d.target || distXZ(d.pos, d.target) < 0.5) d.target = m.motePoints[g.rng.int(m.motePoints.length)];
      [dx, dz] = stepToward(d.pos, d.target, R.drifter_idle_speed);
    }
    d.pos[0] += dx;
    d.pos[2] += dz;
  }

  // 9. Touch: drifters steal first, then one shade hit (ids ascending)
  if (!waiting() && !g.bench) {
    for (const d of [...g.drifters].sort(byId)) {
      if ((d.state !== 'idle' && d.state !== 'chase') || d.robbed || p.carried === 0) continue;
      if (distXZ(d.pos, p.pos) > R.drifter_touch + EPS) continue;
      const amount = Math.min(R.drifter_steal, p.carried);
      p.carried -= amount;
      [d.stolen, d.robbed, d.state, d.ticks] = [amount, true, 'flee', R.drifter_flee_ticks];
      emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
    }
    if (p.invuln === 0) {
      const s = [...g.shades]
        .sort(byId)
        .find(
          (s) =>
            (s.state === 'wander' || s.state === 'chase') &&
            !expelled.has(s) &&
            distXZ(s.pos, p.pos) <= T.shade_hit_radius + EPS &&
            Math.abs(s.pos[1] - p.pos[1]) <= R.pickup_dy + EPS,
        );
      if (s) {
        p.flames--;
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped;
        for (let i = 0; i < dropped; i++) {
          const a = g.rng.next() * Math.PI * 2;
          const r = R.drop_ring[0] + g.rng.next() * (R.drop_ring[1] - R.drop_ring[0]);
          const x = p.pos[0] + r * Math.cos(a), z = p.pos[2] + r * Math.sin(a);
          g.motes.push({ id: newId(g, 'M'), pos: [x, groundOr(g, x, z, p.pos[1]), z], kind: 'dropped', ttl: R.dropped_ttl });
        }
        p.invuln = INVULN;
        [s.state, s.ticks, s.target] = ['recoil', R.recoil_ticks, null];
        emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      }
    }
  }

  // 10. Spawns (new entities act from the next tick)
  if (g.randomMotes && st % R.mote_spawn_every === 0 && g.motes.filter((mo) => mo.kind === 'random').length < R.motes_max) {
    const free = m.motePoints.filter((pt) => !g.motes.some((mo) => mo.kind === 'random' && distXZ(mo.pos, pt) < 0.5));
    if (free.length) g.motes.push({ id: newId(g, 'M'), pos: [...free[g.rng.int(free.length)]], kind: 'random', ttl: 0 });
  }
  if (g.randomShades && st >= R.shade_first_spawn && (st - R.shade_first_spawn) % m.shadeEvery === 0) {
    const taken = new Set<Vec3>();
    for (let i = st === R.shade_first_spawn ? 2 : 1; i > 0 && g.shades.length < m.shadeMax; i--) {
      const ok = m.shadePoints.filter((pt) => !taken.has(pt) && distXZ(pt, p.pos) >= R.shade_spawn_min_dist - EPS);
      if (!ok.length) break;
      const pt = ok[g.rng.int(ok.length)];
      taken.add(pt);
      const s = makeShade(newId(g, 'S'), pt, 'spawning', R.shade_spawning_ticks);
      g.shades.push(s);
      emit('shade_spawned', { id: s.id });
    }
  }
  if (g.randomDrifters && st % R.drifter_spawn_every === 0 && g.drifters.filter((d) => d.state !== 'removed').length < R.drifter_max) {
    const [x, , z] = m.shadePoints[g.rng.int(m.shadePoints.length)];
    const y = groundOr(g, x, z, 0) + R.drifter_height;
    g.drifters.push({ id: newId(g, 'D'), pos: [x, y, z], state: 'idle', stolen: 0, ticks: 0, robbed: false, target: null });
  }

  // 11. Win / lose
  if (g.bench) return finish();
  if (p.flames <= 0) {
    g.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'no_flames' });
  } else if (timeLeft(g) <= EPS) {
    // Dawn (Ticket-03): no early win; survive with >= ceil(0.6 × lanterns) lit at the last tick.
    const lit = g.lanterns.filter((l) => l.lit);
    if (lit.length >= winNeed(g)) {
      g.state = 'won';
      for (const l of lit) g.score += R.score_dawn_lantern + Math.floor(l.fuel / TPS);
      g.score += T.score.per_flame_left * p.flames;
      emit('game_over', { result: 'won', reason: 'dawn_survived' });
    } else {
      g.state = 'lost';
      emit('game_over', { result: 'lost', reason: 'dawn' });
    }
  }
  return finish();
}
