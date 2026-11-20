// Deterministic game simulation, 60 ticks/s. Pure: no DOM, no wall clock, no Math.random.
import { makeRng, type Rng } from './rng';
import { TUNING as T, WORLD as W } from './tuning';

export const TPS = 60;
export type Vec3 = [number, number, number];
export type Input = { move: [number, number]; cam_yaw_deg: number; jump: boolean; interact: boolean; pulse: boolean };
export const IDLE: Input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };

export type Mote = { id: string; pos: Vec3 };
export type Shade = { id: string; pos: Vec3; state: 'chase' | 'stunned'; stun: number };
export type Lantern = { id: string; pos: Vec3; lit: boolean; deposited: number };
export type GameEvent = { type: 'event'; tick: number; name: string; data: Record<string, unknown> };
export type Scenario = {
  player?: { pos?: Vec3; carried?: number; flames?: number };
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: Vec3[];
  shades?: { id?: string; pos: Vec3 }[];
  lanterns?: { id: string; pos?: Vec3; lit?: boolean; deposited?: number }[];
  time_left_s?: number;
};

export type Game = {
  rng: Rng;
  tick: number; // steps run
  state: 'playing' | 'won' | 'lost';
  score: number;
  startTimeLeft: number;
  player: { pos: Vec3; vy: number; flames: number; carried: number; invuln: number };
  pulseCd: number;
  lanterns: Lantern[];
  shades: Shade[];
  motes: Mote[];
  randomMotes: boolean;
  randomShades: boolean;
  moteTimer: number;
  shadeTimer: number;
  ids: { M: number; S: number; used: Set<string> };
  prev: Input;
};

const EPS = 1e-9;
const distXZ = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const timeLeft = (g: Game) => g.startTimeLeft - g.tick / TPS;

function newId(g: Game, p: 'M' | 'S') {
  let id: string;
  do id = p + ++g.ids[p];
  while (g.ids.used.has(id));
  g.ids.used.add(id);
  return id;
}
function randomMote(g: Game): Mote {
  const r = W.island_radius * 0.93 * Math.sqrt(g.rng.next());
  const a = g.rng.next() * Math.PI * 2;
  return { id: newId(g, 'M'), pos: [r * Math.cos(a), 0, r * Math.sin(a)] };
}
function randomShade(g: Game): Shade {
  const a = g.rng.next() * Math.PI * 2;
  const R = W.shade_spawn_ring;
  return { id: newId(g, 'S'), pos: [R * Math.cos(a), W.shade_height, R * Math.sin(a)], state: 'chase', stun: 0 };
}

export function createGame(seed: number, sc: Scenario = {}): Game {
  const lanterns: Lantern[] = Array.from({ length: T.lantern_count_night1 }, (_, k) => {
    const a = (k * 2 * Math.PI) / T.lantern_count_night1;
    const R = W.lantern_ring_radius;
    return { id: `L${k + 1}`, pos: [R * Math.sin(a), 0, R * Math.cos(a)], lit: false, deposited: 0 };
  });
  for (const l of sc.lanterns ?? []) {
    const t = lanterns.find((x) => x.id === l.id)!; // existence checked by the scenario parser
    if (l.pos) t.pos = [...l.pos];
    if (l.deposited !== undefined) t.deposited = l.deposited;
    if (l.lit !== undefined) t.lit = l.lit;
  }
  const g: Game = {
    rng: makeRng(seed),
    tick: 0,
    state: 'playing',
    score: 0,
    startTimeLeft: sc.time_left_s ?? T.night1_duration_s,
    player: {
      pos: sc.player?.pos ? [...sc.player.pos] : [0, 0, 0],
      vy: 0,
      flames: sc.player?.flames ?? T.flames,
      carried: sc.player?.carried ?? 0,
      invuln: 0,
    },
    pulseCd: 0,
    lanterns,
    shades: [],
    motes: [],
    randomMotes: sc.random_motes !== false,
    randomShades: sc.random_shades !== false,
    moteTimer: 0,
    shadeTimer: 0,
    ids: { M: 0, S: 0, used: new Set((sc.shades ?? []).flatMap((s) => (s.id ? [s.id] : []))) },
    prev: { ...IDLE },
  };
  g.shades = sc.shades
    ? sc.shades.map((s) => ({ id: s.id ?? newId(g, 'S'), pos: [...s.pos] as Vec3, state: 'chase' as const, stun: 0 }))
    : g.randomShades
      ? Array.from({ length: W.shades_initial }, () => randomShade(g))
      : [];
  g.motes = sc.motes
    ? sc.motes.map((pos) => ({ id: newId(g, 'M'), pos: [...pos] as Vec3 }))
    : g.randomMotes
      ? Array.from({ length: W.motes_initial }, () => randomMote(g))
      : [];
  return g;
}

/** Run one step with the input of tick g.tick; returns events stamped tick+1. */
export function step(g: Game, inp: Input): GameEvent[] {
  if (g.state !== 'playing') return [];
  const t = g.tick + 1;
  const ev: GameEvent[] = [];
  const emit = (name: string, data: Record<string, unknown>) => ev.push({ type: 'event', tick: t, name, data });
  const pressed = (k: 'jump' | 'interact' | 'pulse') => inp[k] && !g.prev[k];
  const p = g.player;
  const end = (result: 'won' | 'lost', reason: string) => {
    g.state = result;
    if (result === 'won')
      g.score += T.score.per_second_left * Math.floor(Math.max(0, g.startTimeLeft - t / TPS) + EPS) + T.score.per_flame_left * p.flames;
    emit('game_over', { result, reason });
  };
  const finish = () => {
    g.tick = t;
    g.prev = { ...inp };
    return ev;
  };

  // Timers
  p.invuln = Math.max(0, p.invuln - 1);
  g.pulseCd = Math.max(0, g.pulseCd - 1);
  for (const s of g.shades) if (s.state === 'stunned' && --s.stun <= 0) s.state = 'chase';

  // Move (camera-relative, normalized when longer than 1)
  let [mx, mz] = inp.move;
  const len = Math.hypot(mx, mz);
  if (len > 1) [mx, mz] = [mx / len, mz / len];
  const th = (inp.cam_yaw_deg * Math.PI) / 180;
  const v = T.player_speed / TPS;
  p.pos[0] += (mx * Math.cos(th) + mz * Math.sin(th)) * v;
  p.pos[2] += (-mx * Math.sin(th) + mz * Math.cos(th)) * v;
  const r = Math.hypot(p.pos[0], p.pos[2]);
  if (r > W.island_radius) {
    // fall_enabled=false: the island edge holds the player in
    p.pos[0] *= W.island_radius / r;
    p.pos[2] *= W.island_radius / r;
  }

  // Jump
  if (pressed('jump') && p.pos[1] <= 0 && p.vy === 0) p.vy = W.jump_speed;
  if (p.pos[1] > 0 || p.vy > 0) {
    p.vy -= W.gravity / TPS;
    p.pos[1] += p.vy / TPS;
    if (p.pos[1] <= 0) [p.pos[1], p.vy] = [0, 0];
  }

  // Pick up motes (automatic, in list order, up to capacity)
  g.motes = g.motes.filter((m) => {
    if (p.carried >= T.carry_capacity || distXZ(m.pos, p.pos) > T.pickup_radius + EPS) return true;
    p.carried++;
    g.score += T.score.per_mote;
    emit('mote_picked', { carried: p.carried });
    return false;
  });

  // Deposit into the nearest unlit lantern within interact radius
  if (pressed('interact') && p.carried > 0) {
    let best: Lantern | undefined;
    for (const l of g.lanterns)
      if (!l.lit && distXZ(l.pos, p.pos) <= T.interact_radius + EPS && (!best || distXZ(l.pos, p.pos) < distXZ(best.pos, p.pos)))
        best = l;
    const amount = best ? Math.min(p.carried, T.lantern_cost - best.deposited) : 0;
    if (best && amount > 0) {
      best.deposited += amount;
      p.carried -= amount;
      emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      if (best.deposited >= T.lantern_cost) {
        best.lit = true;
        g.score += T.score.per_lantern;
        emit('lantern_lit', { lantern_id: best.id });
      }
    }
  }
  if (g.lanterns.every((l) => l.lit)) {
    end('won', 'all_lit');
    return finish();
  }

  // Pulse: costs carried light, stuns and pushes shades in radius
  if (pressed('pulse') && g.pulseCd === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    g.pulseCd = Math.round(T.pulse_cooldown_s * TPS);
    const ids: string[] = [];
    for (const s of g.shades) {
      const d = distXZ(s.pos, p.pos);
      if (d > T.pulse_radius + EPS) continue;
      const [dx, dz] = d > 0 ? [(s.pos[0] - p.pos[0]) / d, (s.pos[2] - p.pos[2]) / d] : [1, 0];
      s.pos[0] += dx * T.pulse_push_m;
      s.pos[2] += dz * T.pulse_push_m;
      s.state = 'stunned';
      s.stun = Math.round(T.pulse_stun_s * TPS);
      ids.push(s.id);
    }
    g.score += T.score.per_stun * ids.length;
    emit('pulse', { stunned_ids: ids });
  }

  // Shades chase, but never enter the safe radius of a lit lantern
  for (const s of g.shades) {
    if (s.state === 'chase') {
      const d = distXZ(s.pos, p.pos);
      const k = d > 0 ? Math.min(T.shade_speed / TPS, d) / d : 0;
      s.pos[0] += (p.pos[0] - s.pos[0]) * k;
      s.pos[2] += (p.pos[2] - s.pos[2]) * k;
    }
    for (const l of g.lanterns) {
      if (!l.lit) continue;
      const d = distXZ(s.pos, l.pos);
      if (d >= T.safe_radius) continue;
      const [dx, dz] = d > 0 ? [(s.pos[0] - l.pos[0]) / d, (s.pos[2] - l.pos[2]) / d] : [1, 0];
      s.pos[0] = l.pos[0] + dx * T.safe_radius;
      s.pos[2] = l.pos[2] + dz * T.safe_radius;
    }
  }

  // Hit by a chasing shade (one hit, then invulnerable)
  if (p.invuln === 0) {
    const s = g.shades.find((s) => s.state === 'chase' && distXZ(s.pos, p.pos) <= T.shade_hit_radius + EPS);
    if (s) {
      p.flames--;
      const dropped = Math.floor(p.carried * T.hit_drop_ratio);
      p.carried -= dropped;
      p.invuln = Math.round(T.invuln_s * TPS);
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      if (p.flames <= 0) {
        end('lost', 'no_flames');
        return finish();
      }
    }
  }

  // Spawns
  if (g.randomMotes && ++g.moteTimer >= W.mote_respawn_s * TPS) {
    g.moteTimer = 0;
    if (g.motes.length < W.motes_max) g.motes.push(randomMote(g));
  }
  if (g.randomShades && ++g.shadeTimer >= W.shade_spawn_s * TPS) {
    g.shadeTimer = 0;
    if (g.shades.length < W.shades_max) {
      const s = randomShade(g);
      g.shades.push(s);
      emit('shade_spawned', { id: s.id });
    }
  }

  if (g.startTimeLeft - t / TPS <= EPS) end('lost', 'dawn');
  return finish();
}
