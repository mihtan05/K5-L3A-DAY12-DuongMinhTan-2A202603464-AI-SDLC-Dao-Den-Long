// Headless runner (Test Contract v1.1). Exit 0 ok, 1 usage error, 2 malformed inputs/scenario file.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createGame, IDLE, step, timeLeft, TPS, type Game, type Input, type Scenario, type Vec3 } from '../core/sim';
import { FormatError, parseArgs, parseInputs, parseScenario, UsageError, type Frame } from './parse';

const r3 = (x: number) => Math.round(x * 1000) / 1000 + 0; // +0 turns -0 into 0
const v3 = (v: Vec3) => v.map(r3);
const sec = (ticks: number) => r3(ticks / TPS);

export function snapshot(g: Game) {
  const p = g.player;
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.simTick,
    state: g.state,
    night: g.night,
    time_left_s: r3(timeLeft(g)),
    score: g.score,
    wind: { active: g.wind.active, dir_deg: g.wind.dirDeg },
    player: {
      pos: v3(p.pos),
      vel: v3(p.vel),
      grounded: p.grounded,
      flames: p.flames,
      carried: p.carried,
      invuln: p.invuln > 0,
      dash_cd_s: sec(p.dashCd),
      pulse_cd_s: sec(p.pulseCd),
      charm_s: sec(p.charm),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: v3(d.pos), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, pos: v3(c.pos), available: c.available, respawn_s: sec(c.respawn) })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: v3(m.pos), kind: m.kind, ttl_s: m.kind === 'dropped' ? sec(m.ttl) : null })),
  };
}

/** Pure run: returns JSONL lines. Used by the CLI and by tests. */
export function run(seed: number, ticks: number, every: number, scenario: Scenario = {}, frames: Frame[] = [], night: 1 | 2 | 3 = 1): string[] {
  const g = createGame(seed, scenario, night);
  const lines: object[] = [snapshot(g), { type: 'event', tick: 0, name: 'night_start', data: { night } }];
  const input: Input = { ...IDLE };
  let fi = 0;
  for (let k = 0; k < ticks && (g.state === 'playing' || g.state === 'paused'); k++) {
    while (fi < frames.length && frames[fi].tick === k) {
      const { tick: _, ...f } = frames[fi++];
      Object.assign(input, f);
    }
    lines.push(...step(g, input));
    if (g.tick % every === 0) lines.push(snapshot(g));
  }
  lines.push({ type: 'end', ticks: g.tick, state: g.state, score: g.score });
  return lines.map((l) => JSON.stringify(l));
}

function readFile(path: string, what: string) {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    throw new FormatError(`${what}: cannot read ${path} (${(e as Error).message})`);
  }
}

function main() {
  try {
    const a = parseArgs(process.argv.slice(2));
    const night = a.night as 1 | 2 | 3;
    const sc = a.scenario ? parseScenario(readFile(a.scenario, 'scenario'), night) : {};
    const frames = a.inputs ? parseInputs(readFile(a.inputs, 'inputs')) : [];
    const lines = run(a.seed, a.ticks, a.every, sc, frames, night);
    mkdirSync(dirname(a.out), { recursive: true });
    writeFileSync(a.out, lines.join('\n') + '\n');
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    process.exit(e instanceof FormatError ? 2 : e instanceof UsageError ? 1 : 3);
  }
}

if (process.argv[1] && /cli\.(ts|js|mjs)$/.test(process.argv[1])) main();
