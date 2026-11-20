// Headless runner (Test Contract v1.0). Exit 0 ok, 1 usage error, 2 malformed inputs/scenario file.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createGame, IDLE, step, timeLeft, type Game, type Input, type Vec3 } from '../core/sim';
import { FormatError, parseArgs, parseInputs, parseScenario, UsageError, type Frame } from './parse';

const r3 = (x: number) => Math.round(x * 1000) / 1000 + 0; // +0 turns -0 into 0
const v3 = (v: Vec3) => v.map(r3);

export function snapshot(g: Game) {
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.tick,
    state: g.state,
    time_left_s: r3(timeLeft(g)),
    score: g.score,
    player: { pos: v3(g.player.pos), flames: g.player.flames, carried: g.player.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: v3(m.pos) })),
  };
}

/** Pure run: returns JSONL lines. Used by the CLI and by tests. */
export function run(seed: number, ticks: number, every: number, scenario = {}, frames: Frame[] = []): string[] {
  const g = createGame(seed, scenario);
  const lines: object[] = [snapshot(g)];
  const input: Input = { ...IDLE };
  let fi = 0;
  for (let k = 0; k < ticks && g.state === 'playing'; k++) {
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
    const sc = a.scenario ? parseScenario(readFile(a.scenario, 'scenario')) : {};
    const frames = a.inputs ? parseInputs(readFile(a.inputs, 'inputs')) : [];
    const lines = run(a.seed, a.ticks, a.every, sc, frames);
    mkdirSync(dirname(a.out), { recursive: true });
    writeFileSync(a.out, lines.join('\n') + '\n');
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    process.exit(e instanceof FormatError ? 2 : e instanceof UsageError ? 1 : 3);
  }
}

if (process.argv[1] && /cli\.(ts|js|mjs)$/.test(process.argv[1])) main();
