// Ticket-04: benchmark scene (core part) and soak runner.
import { describe, expect, it } from 'vitest';
import { createBench, soakInput, soakNight } from '../src/core/bench';
import { makeRng } from '../src/core/rng';
import { FUEL_MAX, IDLE, step, type GameEvent } from '../src/core/sim';
import { soak } from '../src/headless/soak';

describe('bench scene', () => {
  it('night 1: exactly 200 wandering shades and 100 motes on the island, L1-L3 lit at fuel 100, May at (0,0,0)', () => {
    const g = createBench(42);
    expect(g.night).toBe(1);
    expect(g.shades).toHaveLength(200);
    expect(g.shades.every((s) => s.state === 'wander')).toBe(true);
    expect(g.motes).toHaveLength(100);
    for (const o of [...g.shades, ...g.motes]) expect(Number.isFinite(g.map.ground(o.pos[0], o.pos[2]))).toBe(true);
    expect(g.lanterns.map((l) => [l.id, l.lit, l.fuel])).toEqual([
      ['L1', true, FUEL_MAX], ['L2', true, FUEL_MAX], ['L3', true, FUEL_MAX], ['L4', false, 0], ['L5', false, 0],
    ]);
    expect(g.player.pos).toEqual([0, 0, 0]);
  });

  it('spread uses the seed: same seed same scene, other seed differs; it covers the whole island', () => {
    expect(createBench(42).shades.map((s) => s.pos)).toEqual(createBench(42).shades.map((s) => s.pos));
    expect(createBench(43).shades[0].pos).not.toEqual(createBench(42).shades[0].pos);
    const r = createBench(42).shades.map((s) => Math.hypot(s.pos[0], s.pos[2]));
    // uniform over a disc of radius 40: about 25% fall inside r 20; and some reach the rim
    expect(r.filter((x) => x <= 20).length).toBeGreaterThan(30);
    expect(r.filter((x) => x <= 20).length).toBeLessThan(70);
    expect(Math.max(...r)).toBeGreaterThan(35);
  });

  it('no spawns, damage, pickup, fuel burn or end of night; shades still move', () => {
    const g = createBench(42);
    g.startTimeLeft = 2; // dawn would come at tick 120
    const before = g.shades.map((s) => [...s.pos]);
    const ev: GameEvent[] = [];
    for (let i = 0; i < 600; i++) ev.push(...step(g, IDLE));
    const names = new Set(ev.map((e) => e.name));
    for (const n of ['shade_spawned', 'player_hit', 'mote_picked', 'lantern_out', 'fuel_drain', 'game_over']) expect(names.has(n)).toBe(false);
    expect(g.state).toBe('playing');
    expect(g.shades).toHaveLength(200);
    expect(g.motes).toHaveLength(100);
    expect(g.drifters).toHaveLength(0);
    expect(g.player.flames).toBe(3);
    expect(g.player.carried).toBe(0);
    expect(g.lanterns.slice(0, 3).every((l) => l.fuel === FUEL_MAX)).toBe(true);
    expect(g.shades.filter((s, i) => s.pos[0] !== before[i][0] || s.pos[2] !== before[i][2]).length).toBeGreaterThan(150);
  });
});

describe('soak', () => {
  it('input: direction changes only every 30 ticks; ~5% jump, 3% dash, 2% pulse, 10% interact', () => {
    const rng = makeRng(1);
    let inp = { ...IDLE };
    const n = 60000;
    const c = { jump: 0, dash: 0, pulse: 0, interact: 0 };
    for (let k = 0; k < n; k++) {
      const next = soakInput(rng, k, inp);
      if (k % 30 !== 0) expect(next.move).toBe(inp.move);
      else expect(Math.hypot(...next.move)).toBeCloseTo(1, 9);
      for (const key of Object.keys(c) as (keyof typeof c)[]) c[key] += +next[key];
      inp = next;
    }
    expect(c.jump / n).toBeCloseTo(0.05, 2);
    expect(c.dash / n).toBeCloseTo(0.03, 2);
    expect(c.pulse / n).toBeCloseTo(0.02, 2);
    expect(c.interact / n).toBeCloseTo(0.1, 2);
  });

  it('night i uses seed + i and rotates nights 1 -> 2 -> 3; every night ends', () => {
    const nights = [1, 2, 3, 4].map((i) => soakNight(7, i));
    expect(nights.map((g) => g.night)).toEqual([1, 2, 3, 1]);
    expect(nights.every((g) => g.state === 'won' || g.state === 'lost')).toBe(true);
  });

  it('is deterministic and reports no crashes', () => {
    const a = soak(7, 4), b = soak(7, 4);
    expect(a).toEqual(b);
    expect(a.crashes).toBe(0);
    expect(a.results).toHaveLength(4);
  });
});

describe('bench camera and frame stats (render/bench.ts)', async () => {
  const { orbit, frameStats } = await import('../src/render/bench');
  it('starts at (30,15,0), goes counter-clockwise seen from above (+X -> -Z), 15 s per lap', () => {
    const at = (t: number) => orbit(t).map((v) => Math.round(v * 1e6) / 1e6 + 0);
    expect(at(0)).toEqual([30, 15, 0]);
    expect(at(3.75)).toEqual([0, 15, -30]);
    expect(at(7.5)).toEqual([-30, 15, 0]);
    expect(at(15)).toEqual([30, 15, 0]);
  });
  it('avg_fps = 1000 N / sum dt; p1_low over the worst ceil(1%) frames; p95 by nearest rank', () => {
    const dt = [...Array(198).fill(10), 40, 60]; // N = 200 -> k = 2 worst = 40, 60
    const s = frameStats(dt);
    expect(s.frames).toBe(200);
    expect(s.avg_fps).toBeCloseTo((1000 * 200) / (198 * 10 + 100), 1);
    expect(s.p1_low_fps).toBe(20); // 1000 / mean(40, 60)
    expect(s.frame_ms_p95).toBe(10);
    expect(frameStats([5]).p1_low_fps).toBe(200); // k = max(1, ...) = 1
  });
});
