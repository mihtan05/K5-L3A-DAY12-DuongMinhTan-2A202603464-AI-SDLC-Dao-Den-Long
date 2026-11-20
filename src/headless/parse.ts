// Trust boundary: CLI args, inputs file and scenario file. Bad files -> FormatError (exit 2), bad args -> UsageError (exit 1).
import type { Input, Scenario, Vec3 } from '../core/sim';

export class FormatError extends Error {}
export class UsageError extends Error {}
export type Frame = { tick: number } & Partial<Input>;
export type Args = { seed: number; night: number; ticks: number; out: string; scenario?: string; inputs?: string; every: number };

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const vec3 = (x: unknown, where: string): Vec3 => {
  if (!Array.isArray(x) || x.length !== 3 || !x.every(isNum)) throw new FormatError(`${where}: expected [x, y, z] numbers`);
  return [x[0], x[1], x[2]];
};
const json = (text: string, what: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new FormatError(`${what}: invalid JSON (${(e as Error).message})`);
  }
};

export function parseArgs(argv: string[]): Args {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) throw new UsageError(`bad argument near "${argv[i]}"`);
    m.set(argv[i].slice(2), argv[i + 1]);
  }
  const int = (k: string, min: number, def?: number) => {
    const s = m.get(k);
    if (s === undefined) {
      if (def !== undefined) return def;
      throw new UsageError(`missing --${k}`);
    }
    const n = Number(s);
    if (!Number.isInteger(n) || n < min) throw new UsageError(`--${k} must be an integer >= ${min}`);
    return n;
  };
  const out = m.get('out');
  if (!out) throw new UsageError('missing --out');
  const night = int('night', 1);
  if (night !== 1) throw new UsageError(`--night ${night} not available (only night 1)`);
  return {
    seed: int('seed', Number.MIN_SAFE_INTEGER),
    night,
    ticks: int('ticks', 0),
    out,
    scenario: m.get('scenario'),
    inputs: m.get('inputs'),
    every: int('snapshot-every', 1, 10),
  };
}

export function parseInputs(text: string): Frame[] {
  const d = json(text, 'inputs');
  if (!isObj(d) || !Array.isArray(d.frames)) throw new FormatError('inputs: expected {"frames": [...]}');
  let last = -1;
  return d.frames.map((f, i) => {
    const w = `inputs.frames[${i}]`;
    if (!isObj(f) || !Number.isInteger(f.tick) || (f.tick as number) < 0) throw new FormatError(`${w}: tick must be an integer >= 0`);
    if ((f.tick as number) <= last) throw new FormatError(`${w}: ticks must be strictly increasing`);
    last = f.tick as number;
    const fr: Frame = { tick: last };
    if ('move' in f) {
      const mv = f.move;
      if (!Array.isArray(mv) || mv.length !== 2 || !mv.every((x) => isNum(x) && x >= -1 && x <= 1))
        throw new FormatError(`${w}.move: expected [x, z] each in [-1, 1]`);
      fr.move = [mv[0], mv[1]];
    }
    if ('cam_yaw_deg' in f) {
      if (!isNum(f.cam_yaw_deg)) throw new FormatError(`${w}.cam_yaw_deg: expected number`);
      fr.cam_yaw_deg = f.cam_yaw_deg;
    }
    for (const k of ['jump', 'interact', 'pulse'] as const) {
      if (!(k in f)) continue;
      if (typeof f[k] !== 'boolean') throw new FormatError(`${w}.${k}: expected boolean`);
      fr[k] = f[k] as boolean;
    }
    return fr;
  });
}

export function parseScenario(text: string): Scenario {
  const d = json(text, 'scenario');
  if (!isObj(d)) throw new FormatError('scenario: expected an object');
  const sc: Scenario = {};
  if ('player' in d) {
    const p = d.player;
    if (!isObj(p)) throw new FormatError('scenario.player: expected object');
    sc.player = {};
    if ('pos' in p) sc.player.pos = vec3(p.pos, 'scenario.player.pos');
    for (const k of ['carried', 'flames'] as const)
      if (k in p) {
        if (!Number.isInteger(p[k]) || (p[k] as number) < 0) throw new FormatError(`scenario.player.${k}: expected integer >= 0`);
        sc.player[k] = p[k] as number;
      }
  }
  for (const k of ['random_motes', 'random_shades'] as const)
    if (k in d) {
      if (typeof d[k] !== 'boolean') throw new FormatError(`scenario.${k}: expected boolean`);
      sc[k] = d[k] as boolean;
    }
  if ('motes' in d) {
    if (!Array.isArray(d.motes)) throw new FormatError('scenario.motes: expected array');
    sc.motes = d.motes.map((m, i) => vec3(m, `scenario.motes[${i}]`));
  }
  if ('shades' in d) {
    if (!Array.isArray(d.shades)) throw new FormatError('scenario.shades: expected array');
    const seen = new Set<string>();
    sc.shades = d.shades.map((s, i) => {
      if (!isObj(s)) throw new FormatError(`scenario.shades[${i}]: expected object`);
      if ('id' in s && (typeof s.id !== 'string' || !s.id || seen.has(s.id)))
        throw new FormatError(`scenario.shades[${i}].id: expected unique non-empty string`);
      if (typeof s.id === 'string') seen.add(s.id);
      return { ...(typeof s.id === 'string' ? { id: s.id } : {}), pos: vec3(s.pos, `scenario.shades[${i}].pos`) };
    });
  }
  if ('lanterns' in d) {
    if (!Array.isArray(d.lanterns)) throw new FormatError('scenario.lanterns: expected array');
    sc.lanterns = d.lanterns.map((l, i) => {
      const w = `scenario.lanterns[${i}]`;
      if (!isObj(l) || typeof l.id !== 'string' || !/^L[1-5]$/.test(l.id)) throw new FormatError(`${w}.id: expected L1..L5`);
      const out: NonNullable<Scenario['lanterns']>[number] = { id: l.id };
      if ('pos' in l) out.pos = vec3(l.pos, `${w}.pos`);
      if ('lit' in l) {
        if (typeof l.lit !== 'boolean') throw new FormatError(`${w}.lit: expected boolean`);
        out.lit = l.lit;
      }
      if ('deposited' in l) {
        if (!Number.isInteger(l.deposited) || (l.deposited as number) < 0) throw new FormatError(`${w}.deposited: expected integer >= 0`);
        out.deposited = l.deposited as number;
      }
      return out;
    });
  }
  if ('time_left_s' in d) {
    if (!isNum(d.time_left_s) || d.time_left_s <= 0) throw new FormatError('scenario.time_left_s: expected number > 0');
    sc.time_left_s = d.time_left_s;
  }
  return sc;
}
