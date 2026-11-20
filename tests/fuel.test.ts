// Ticket-03 (Phase 3): lantern fuel, Bóng Mực draining, dawn win, growing capacity, new score.
// Expected numbers are derived from the ticket (fuel in 1/60 units: 6000 = 100, decay 1/tick, drain 5/tick/shade).
import { describe, expect, it } from 'vitest';
import { run } from '../src/headless/cli';
import { FormatError, parseScenario, type Frame } from '../src/headless/parse';
import { zoneActive, type Lantern, type Scenario } from '../src/core/sim';

const QUIET: Scenario = { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [] };
const go = (sc: Scenario, frames: Frame[] = [], ticks = 60, every = 1, night: 1 | 2 | 3 = 1) => {
  const lines = run(1, ticks, every, { ...QUIET, ...sc }, frames, night).map((l) => JSON.parse(l));
  return {
    snaps: lines.filter((l) => l.type === 'snapshot'),
    events: lines.filter((l) => l.type === 'event' && l.name !== 'night_start'),
    end: lines[lines.length - 1],
  };
};
const named = (ev: { name: string }[], n: string) => ev.filter((e) => e.name === n);
const xz = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const L1 = [0, 0, 25];
const AT_L1 = { pos: [0, 0, 23] as [number, number, number] };
const press = (tick: number, k: 'interact' | 'pulse' = 'interact'): Frame[] => [{ tick, [k]: true }, { tick: tick + 1, [k]: false }];

describe('fuel', () => {
  it('a lit lantern burns 1 fuel per second (integer 1/60 units)', () => {
    const r = go({ lanterns: [{ id: 'L1', lit: true }] }, [], 600, 60);
    expect(r.snaps[1].lanterns[0].fuel).toBe(99);
    expect(r.snaps[10].lanterns[0].fuel).toBe(90);
  });
  it('fuel <= 0: lantern_out, unlit, deposited 0, fuel 0, ever_lit stays true', () => {
    const r = go({ lanterns: [{ id: 'L1', lit: true, fuel: 0.5, deposited: 10 }] }, [], 40);
    expect(named(r.events, 'lantern_out')).toEqual([{ type: 'event', tick: 30, name: 'lantern_out', data: { lantern_id: 'L1' } }]);
    expect(r.snaps[29].lanterns[0].lit).toBe(true);
    expect(r.snaps[30].lanterns[0]).toMatchObject({ lit: false, deposited: 0, fuel: 0, ever_lit: true });
  });
  it('refuel: used = min(carried, ceil((100 - fuel)/10)), fuel capped at 100, +5 per mote', () => {
    const r = go({ player: { ...AT_L1, carried: 10 }, lanterns: [{ id: 'L1', lit: true, fuel: 55.5 }] }, press(0));
    // step 2 burns first: 3330 - 1 = 3329 units; ceil((6000 - 3329) / 600) = 5
    expect(named(r.events, 'refuel')).toEqual([{ type: 'event', tick: 1, name: 'refuel', data: { lantern_id: 'L1', amount: 5, fuel: 100 } }]);
    expect(r.snaps[1].player.carried).toBe(5);
    expect(r.end.score).toBe(25);
  });
  it('refuel limited by what May carries', () => {
    const r = go({ player: { ...AT_L1, carried: 2 }, lanterns: [{ id: 'L1', lit: true, fuel: 50 }] }, press(0));
    // 3000 - 1 + 2 x 600 = 4199 units = 69.98 -> 70.0
    expect(named(r.events, 'refuel')[0].data).toEqual({ lantern_id: 'L1', amount: 2, fuel: 70 });
  });
  it('picks the nearest lantern that can take light: a full-ish lit one still takes ceil(0.0167/10) = 1', () => {
    const r = go({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true }, { id: 'L2', pos: [0, 0, -1.5] }] }, press(0));
    expect(named(r.events, 'refuel')[0].data).toEqual({ lantern_id: 'L1', amount: 1, fuel: 100 });
  });
  it('relight costs 5, +40, relight: true, relit_count 1, fuel 100', () => {
    const r = go({ player: { ...AT_L1, carried: 5 }, lanterns: [{ id: 'L1', lit: true, fuel: 0.1 }] }, press(10), 20);
    expect(named(r.events, 'lantern_out')[0].tick).toBe(6);
    expect(r.events.slice(-2).map((e) => [e.name, e.data])).toEqual([
      ['deposit', { lantern_id: 'L1', amount: 5, deposited: 5 }],
      ['lantern_lit', { lantern_id: 'L1', relight: true }],
    ]);
    expect(r.snaps[11].lanterns[0]).toMatchObject({ lit: true, fuel: 100, ever_lit: true, relit_count: 1 });
    expect(r.end.score).toBe(5 * 5 + 40);
  });
  it('a never-lit lantern still needs 10 (first light +100)', () => {
    const r = go({ player: { ...AT_L1, carried: 9 } }, press(0));
    expect(named(r.events, 'lantern_lit')).toHaveLength(0);
    expect(r.snaps[1].lanterns[0]).toMatchObject({ deposited: 9, lit: false });
  });
});

describe('capacity', () => {
  it('10 + 2 x successful_lights, max 20; scenario-lit lanterns do not count', () => {
    expect(go({ player: { successful_lights: 4 } }, [], 0).snaps[0].player.capacity).toBe(18);
    expect(go({ player: { successful_lights: 7 } }, [], 0).snaps[0].player.capacity).toBe(20);
    expect(go({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }] }, [], 0).snaps[0].player.capacity).toBe(10);
  });
  it('lighting (and relighting) raises capacity; pickup stops at capacity', () => {
    const r = go({ player: { ...AT_L1, carried: 10 } }, press(0), 2);
    expect(r.snaps[1].player.capacity).toBe(12);
    const full = go({ player: { carried: 11, successful_lights: 1 }, motes: [[0, 0, 0], [0, 0, 0.5]] }, [], 2);
    expect(full.snaps[1].player.carried).toBe(12);
  });
});

describe('shades drain weak lanterns', () => {
  it('zone exists at exactly 30, not below', () => {
    const l = (fuel: number) => ({ lit: true, fuel }) as Lantern;
    expect(zoneActive(l(1800))).toBe(true);
    expect(zoneActive(l(1799))).toBe(false);
    // 1801 units -> 1800 after the tick-1 burn: zone still up, the shade inside is pushed out
    const inside = (fuel: number) => go({ player: { pos: [0, 0, -30] }, lanterns: [{ id: 'L1', lit: true, fuel }], shades: [{ pos: [0, 1, 22] }] }, [], 1);
    expect(xz(inside(1801 / 60).snaps[1].shades[0].pos, L1)).toBeGreaterThan(3);
    expect(xz(inside(30).snaps[1].shades[0].pos, L1)).toBeLessThan(3); // 1800 -> 1799: weak, it walks in
  });
  it('a wandering shade walks to the weak lantern, drains it (fuel_drain every 60 ticks) until it goes out, then wanders', () => {
    const r = go({ player: { pos: [0, 0, -30] }, lanterns: [{ id: 'L1', lit: true, fuel: 29.9 }], shades: [{ id: 'S1', pos: [0, 1, 15] }] }, [], 700, 1);
    const start = r.snaps.findIndex((s) => s.shades[0].state === 'drain');
    expect(start).toBeGreaterThan(230); // 8 m at 2 m/s
    expect(start).toBeLessThan(250);
    expect(xz(r.snaps[start].shades[0].pos, L1)).toBeLessThanOrEqual(2 + 1e-6);
    const fd = named(r.events, 'fuel_drain');
    expect(fd[0]).toMatchObject({ tick: start + 60, data: { lantern_id: 'L1', shade_id: 'S1' } });
    expect(fd[1].tick - fd[0].tick).toBe(60);
    // while draining: 6 units per tick = 6 fuel per second
    expect(r.snaps[start + 61].lanterns[0].fuel).toBeCloseTo(r.snaps[start + 1].lanterns[0].fuel - 6, 1);
    const out = named(r.events, 'lantern_out')[0].tick;
    expect(r.snaps[out].shades[0].state).toBe('wander');
  });
  it('drains stack: two shades take 11 units per tick with the burn', () => {
    const sh = (id: string, x: number) => ({ id, pos: [x, 1, 25] as [number, number, number], state: 'drain' as const, target_lantern_id: 'L1' });
    const r = go({ player: { pos: [0, 0, -30] }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [sh('S1', 1), sh('S2', -1)] }, [], 60);
    expect(r.snaps[60].lanterns[0].fuel).toBe(9); // (1200 - 60 x 11) / 60
    expect(named(r.events, 'fuel_drain').map((e) => [e.tick, e.data.shade_id])).toEqual([[60, 'S1'], [60, 'S2']]);
  });
  it('drain -> chase when May comes within 6 m', () => {
    const r = go({ player: { pos: [0, 0, 20] }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ pos: [0, 1, 24], state: 'drain', target_lantern_id: 'L1' }] }, [], 1);
    expect(r.snaps[1].shades[0].state).toBe('chase');
  });
  it('drain -> stunned by pulse, scores 15 instead of 5', () => {
    const r = go({ player: { pos: [0, 0, 21], carried: 3 }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ pos: [0, 1, 24], state: 'drain', target_lantern_id: 'L1' }, { pos: [3, 1, 21] }] }, press(0, 'pulse'), 1);
    expect(r.snaps[1].shades.map((s: { state: string }) => s.state)).toEqual(['stunned', 'stunned']);
    expect(r.end.score).toBe(15 + 5);
  });
  it('stun ends in wander', () => {
    const r = go({ player: { pos: [0, 0, -30] }, shades: [{ pos: [0, 1, -10], state: 'stunned', state_ticks_left: 1 }] }, [], 1);
    expect(r.snaps[1].shades[0].state).toBe('wander');
  });
  it('drain -> wander when the lantern goes out', () => {
    const r = go({ player: { pos: [0, 0, -30] }, lanterns: [{ id: 'L1', lit: true, fuel: 0.1 }], shades: [{ pos: [0, 1, 24], state: 'drain', target_lantern_id: 'L1' }] }, [], 1);
    expect(named(r.events, 'lantern_out')[0].tick).toBe(1); // 6 - 1 - 5 = 0
    expect(r.snaps[1].shades[0].state).toBe('wander');
  });
  it('refuel back to >= 30 pushes draining shades out within 30 ticks; no hit meanwhile', () => {
    const r = go(
      { player: { ...AT_L1, carried: 10 }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ pos: [0, 1, 26.5], state: 'drain', target_lantern_id: 'L1' }] },
      press(0),
      40,
    );
    expect(named(r.events, 'refuel')[0].data).toEqual({ lantern_id: 'L1', amount: 9, fuel: 100 }); // ceil((6000 - 1194) / 600) = 9
    expect(r.snaps[1].shades[0].state).toBe('wander');
    expect(xz(r.snaps[30].shades[0].pos, L1)).toBeCloseTo(6, 3);
    expect(named(r.events, 'player_hit')).toHaveLength(0);
  });
});

describe('dawn', () => {
  const lit = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `L${i + 1}`, lit: true }));
  it('night 1: 3/5 lit at dawn wins dawn_survived; bonus 50 + floor(fuel) per lit lantern + 50 per flame', () => {
    const r = go({ time_left_s: 1, lanterns: lit(3) }, [], 120);
    expect(r.events.at(-1)).toEqual({ type: 'event', tick: 60, name: 'game_over', data: { result: 'won', reason: 'dawn_survived' } });
    expect(r.end).toEqual({ type: 'end', ticks: 60, state: 'won', score: 3 * (50 + 99) + 3 * 50 });
  });
  it('night 1: 2/5 lit at dawn loses dawn, no bonus', () => {
    const r = go({ time_left_s: 1, lanterns: lit(2) }, [], 120);
    expect(r.events.at(-1).data).toEqual({ result: 'lost', reason: 'dawn' });
    expect(r.end.score).toBe(0);
  });
  it('thresholds: night 2 needs 4/6, night 3 needs 5/7', () => {
    const res = (n: number, night: 2 | 3) => go({ time_left_s: 1, lanterns: lit(n), wind_enabled: false }, [], 60, 60, night).end.state;
    expect([res(3, 2), res(4, 2), res(4, 3), res(5, 3)]).toEqual(['lost', 'won', 'lost', 'won']);
  });
  it('losing the last flame on the dawn tick is no_flames, even with enough lanterns', () => {
    const r = go({ time_left_s: 1 / 60, player: { flames: 1 }, lanterns: lit(5), shades: [{ pos: [0, 1, 0] }] }, [], 5);
    expect(r.events.at(-1).data).toEqual({ result: 'lost', reason: 'no_flames' });
  });
  it('a lantern going out on the dawn tick does not count', () => {
    const r = go({ time_left_s: 1, lanterns: [...lit(2), { id: 'L3', lit: true, fuel: 1 }] }, [], 60);
    expect(named(r.events, 'lantern_out')[0].tick).toBe(60);
    expect(r.end.state).toBe('lost');
  });
});

describe('v1.2 scenario parsing', () => {
  it('accepts lantern fuel/ever_lit, successful_lights, target_lantern_id; rejects bad values', () => {
    const sc = parseScenario('{"player":{"successful_lights":2},"lanterns":[{"id":"L1","lit":true,"fuel":12.5,"ever_lit":true}],"shades":[{"pos":[0,1,0],"state":"drain","target_lantern_id":"L1"}]}', 1);
    expect(sc.lanterns).toEqual([{ id: 'L1', lit: true, fuel: 12.5, ever_lit: true }]);
    expect(sc.shades![0]).toMatchObject({ state: 'drain', target_lantern_id: 'L1' });
    expect(() => parseScenario('{"lanterns":[{"id":"L1","fuel":101}]}')).toThrow(FormatError);
    expect(() => parseScenario('{"shades":[{"pos":[0,1,0],"target_lantern_id":"L9"}]}')).toThrow(FormatError);
    expect(() => parseScenario('{"player":{"successful_lights":-1}}')).toThrow(FormatError);
  });
});
