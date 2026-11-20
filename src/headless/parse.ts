// Trust boundary: CLI args, inputs file and scenario file. Bad files -> FormatError (exit 2), bad args -> UsageError (exit 1).
import { DRIFTER_STATES, SHADE_STATES, type Input, type Scenario, type Vec3 } from '../core/sim';
import { mapFor } from '../core/maps';

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
  if (night > 3) throw new UsageError('--night must be 1, 2 or 3');
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
    for (const k of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) {
      if (!(k in f)) continue;
      if (typeof f[k] !== 'boolean') throw new FormatError(`${w}.${k}: expected boolean`);
      fr[k] = f[k] as boolean;
    }
    return fr;
  });
}

export function parseScenario(text: string, night = 1): Scenario {
  const d = json(text, 'scenario');
  if (!isObj(d)) throw new FormatError('scenario: expected an object');
  const sc: Scenario = {};
  const uint = (o: Record<string, unknown>, k: string, w: string) => {
    if (!Number.isInteger(o[k]) || (o[k] as number) < 0) throw new FormatError(`${w}.${k}: expected integer >= 0`);
    return o[k] as number;
  };
  const bool = (o: Record<string, unknown>, k: string, w: string) => {
    if (typeof o[k] !== 'boolean') throw new FormatError(`${w}.${k}: expected boolean`);
    return o[k] as boolean;
  };
  const arr = (k: string) => {
    if (!Array.isArray(d[k])) throw new FormatError(`scenario.${k}: expected array`);
    return d[k] as unknown[];
  };
  const ids = new Set<string>();
  const id = (o: Record<string, unknown>, w: string) => {
    if (!('id' in o)) return {};
    if (typeof o.id !== 'string' || !o.id || ids.has(o.id)) throw new FormatError(`${w}.id: expected unique non-empty string`);
    ids.add(o.id);
    return { id: o.id };
  };
  const state = <S extends string>(o: Record<string, unknown>, w: string, allowed: readonly S[]) => {
    if (!('state' in o)) return {};
    if (!allowed.includes(o.state as S)) throw new FormatError(`${w}.state: expected one of ${allowed.join(', ')}`);
    return { state: o.state as S };
  };

  if ('player' in d) {
    const p = d.player;
    if (!isObj(p)) throw new FormatError('scenario.player: expected object');
    const out: NonNullable<Scenario['player']> = {};
    if ('pos' in p) out.pos = vec3(p.pos, 'scenario.player.pos');
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights'] as const)
      if (k in p) out[k] = uint(p, k, 'scenario.player');
    sc.player = out;
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'] as const) if (k in d) sc[k] = bool(d, k, 'scenario');
  if ('motes' in d) sc.motes = arr('motes').map((m, i) => vec3(m, `scenario.motes[${i}]`));
  const nLanterns = mapFor(night).lanterns.length;
  const lanternId = (x: unknown, w: string) => {
    const k = typeof x === 'string' ? /^L(\d+)$/.exec(x) : null;
    if (!k || +k[1] < 1 || +k[1] > nLanterns) throw new FormatError(`${w}: expected L1..L${nLanterns}`);
    return x as string;
  };
  if ('shades' in d)
    sc.shades = arr('shades').map((s, i) => {
      const w = `scenario.shades[${i}]`;
      if (!isObj(s)) throw new FormatError(`${w}: expected object`);
      return {
        ...id(s, w),
        pos: vec3(s.pos, `${w}.pos`),
        ...state(s, w, SHADE_STATES),
        ...('state_ticks_left' in s ? { state_ticks_left: uint(s, 'state_ticks_left', w) } : {}),
        ...('target_lantern_id' in s ? { target_lantern_id: lanternId(s.target_lantern_id, `${w}.target_lantern_id`) } : {}),
      };
    });
  if ('drifters' in d)
    sc.drifters = arr('drifters').map((s, i) => {
      const w = `scenario.drifters[${i}]`;
      if (!isObj(s)) throw new FormatError(`${w}: expected object`);
      return {
        ...id(s, w),
        pos: vec3(s.pos, `${w}.pos`),
        ...state(s, w, DRIFTER_STATES),
        ...('stolen' in s ? { stolen: uint(s, 'stolen', w) } : {}),
        ...('state_ticks_left' in s ? { state_ticks_left: uint(s, 'state_ticks_left', w) } : {}),
      };
    });
  if ('charms' in d)
    sc.charms = arr('charms').map((c, i) => {
      const w = `scenario.charms[${i}]`;
      if (!isObj(c)) throw new FormatError(`${w}: expected object`);
      return {
        ...id(c, w),
        ...('pos' in c ? { pos: vec3(c.pos, `${w}.pos`) } : {}),
        ...('available' in c ? { available: bool(c, 'available', w) } : {}),
        ...('respawn_ticks' in c ? { respawn_ticks: uint(c, 'respawn_ticks', w) } : {}),
      };
    });
  if ('lanterns' in d) {
    sc.lanterns = arr('lanterns').map((l, i) => {
      const w = `scenario.lanterns[${i}]`;
      if (!isObj(l)) throw new FormatError(`${w}: expected object`);
      const out: NonNullable<Scenario['lanterns']>[number] = { id: lanternId(l.id, `${w}.id`) };
      if ('pos' in l) out.pos = vec3(l.pos, `${w}.pos`);
      if ('lit' in l) out.lit = bool(l, 'lit', w);
      if ('deposited' in l) out.deposited = uint(l, 'deposited', w);
      if ('ever_lit' in l) out.ever_lit = bool(l, 'ever_lit', w);
      if ('fuel' in l) {
        if (!isNum(l.fuel) || l.fuel < 0 || l.fuel > 100) throw new FormatError(`${w}.fuel: expected number in [0, 100]`);
        out.fuel = l.fuel;
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
