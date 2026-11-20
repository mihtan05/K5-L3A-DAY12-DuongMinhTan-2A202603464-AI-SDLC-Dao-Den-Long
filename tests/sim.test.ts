import { describe, expect, it } from 'vitest';
import { run } from '../src/headless/cli';
import { FormatError, parseArgs, parseInputs, parseScenario, UsageError, type Frame } from '../src/headless/parse';
import type { Scenario } from '../src/core/sim';
import { TUNING as T } from '../src/core/tuning';

const QUIET: Scenario = { random_motes: false, random_shades: false, motes: [], shades: [] };
const go = (sc: Scenario, frames: Frame[] = [], ticks = 60, every = 1) => {
  const lines = run(1, ticks, every, { ...QUIET, ...sc }, frames).map((l) => JSON.parse(l));
  return {
    lines,
    snaps: lines.filter((l) => l.type === 'snapshot'),
    events: lines.filter((l) => l.type === 'event'),
    end: lines[lines.length - 1],
  };
};
const L1 = [0, 0, 18];

describe('tick model & output', () => {
  it('snapshot at tick 0 before input, end line last, time_left counts steps', () => {
    const r = go({}, [{ tick: 0, move: [0, 1] }], 30, 10);
    expect(r.snaps.map((s) => s.tick)).toEqual([0, 10, 20, 30]);
    expect(r.snaps[0].player.pos).toEqual([0, 0, 0]);
    expect(r.snaps[0].time_left_s).toBe(300);
    expect(r.snaps[3].time_left_s).toBe(299.5);
    expect(r.snaps[0].lanterns).toHaveLength(5);
    expect(r.end).toEqual({ type: 'end', ticks: 30, state: 'playing', score: 0 });
  });
  it('is deterministic with random spawns, and seeds differ', () => {
    const a = run(7, 3000, 10), b = run(7, 3000, 10), c = run(8, 3000, 10);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe('movement', () => {
  it('moves player_speed m/s along +Z at yaw 0', () => {
    expect(go({}, [{ tick: 0, move: [0, 1] }]).snaps[60].player.pos).toEqual([0, 0, T.player_speed]);
  });
  it('rotates by cam_yaw_deg (90 deg: forward becomes +X)', () => {
    expect(go({}, [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }]).snaps[60].player.pos).toEqual([T.player_speed, 0, 0]);
  });
  it('normalizes diagonal input', () => {
    const [x, , z] = go({}, [{ tick: 0, move: [1, 1] }]).snaps[60].player.pos;
    expect(Math.hypot(x, z)).toBeCloseTo(T.player_speed, 2);
  });
  it('jump leaves the ground and lands', () => {
    const r = go({}, [{ tick: 0, jump: true }], 120);
    expect(r.snaps[10].player.pos[1]).toBeGreaterThan(0);
    expect(r.snaps[120].player.pos[1]).toBe(0);
  });
});

describe('motes & lanterns', () => {
  it('picks a mote within pickup_radius and scores', () => {
    const r = go({ motes: [[0, 0, 3]] }, [{ tick: 0, move: [0, 1] }]);
    expect(r.events[0]).toMatchObject({ name: 'mote_picked', data: { carried: 1 } });
    expect(r.end.score).toBe(T.score.per_mote);
    expect(r.snaps[60].motes_active).toBe(0);
  });
  it('does not pick beyond carry_capacity', () => {
    const r = go({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0]] });
    expect(r.events).toHaveLength(0);
  });
  it('deposits on interact press (edge only) and lights at lantern_cost', () => {
    const r = go({ player: { pos: [0, 0, 16], carried: 7 } }, [{ tick: 0, interact: true }, { tick: 5, interact: true }]);
    expect(r.events.map((e) => e.name)).toEqual(['deposit', 'lantern_lit']);
    expect(r.events[0]).toMatchObject({ tick: 1, data: { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost } });
    expect(r.end.score).toBe(T.score.per_lantern);
    expect(r.snaps[60].player.carried).toBe(7 - T.lantern_cost);
  });
  it('partial deposit does not light; out of interact_radius does nothing', () => {
    expect(go({ player: { pos: [0, 0, 16], carried: 2 } }, [{ tick: 0, interact: true }]).events).toEqual([
      { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 2, deposited: 2 } },
    ]);
    expect(go({ player: { pos: [0, 0, 15], carried: 2 } }, [{ tick: 0, interact: true }]).events).toHaveLength(0);
  });
  it('wins when all lanterns are lit; setup gives no points; win bonus added', () => {
    const lanterns = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
    const r = go({ lanterns: [...lanterns, { id: 'L5', pos: [0, 0, 2] }], player: { carried: 5 } }, [{ tick: 0, interact: true }]);
    expect(r.events.map((e) => e.name)).toEqual(['deposit', 'lantern_lit', 'game_over']);
    expect(r.events[2].data).toEqual({ result: 'won', reason: 'all_lit' });
    const bonus = T.score.per_second_left * Math.floor(300 - 1 / 60) + T.score.per_flame_left * T.flames;
    expect(r.end).toEqual({ type: 'end', ticks: 1, state: 'won', score: T.score.per_lantern + bonus });
  });
});

describe('shades & pulse', () => {
  it('pulse stuns and pushes shades in radius, costs light', () => {
    const r = go({ player: { carried: 3 }, shades: [{ id: 'A', pos: [3, 1, 0] }, { pos: [20, 1, 0] }] }, [{ tick: 0, pulse: true }], 1);
    expect(r.events[0]).toMatchObject({ name: 'pulse', data: { stunned_ids: ['A'] } });
    expect(r.snaps[1].shades[0]).toEqual({ id: 'A', pos: [3 + T.pulse_push_m, 1, 0], state: 'stunned' });
    expect(r.snaps[1].shades[1].id).toBe('S1');
    expect(r.snaps[1].player.carried).toBe(3 - T.pulse_cost);
    expect(r.end.score).toBe(T.score.per_stun);
  });
  it('stun wears off after pulse_stun_s', () => {
    const r = go({ player: { carried: 2 }, shades: [{ pos: [5, 1, 0] }] }, [{ tick: 0, pulse: true }], T.pulse_stun_s * 60 + 2);
    expect(r.snaps[T.pulse_stun_s * 60 - 1].shades[0].state).toBe('stunned');
    expect(r.snaps[T.pulse_stun_s * 60 + 1].shades[0].state).toBe('chase');
  });
  it('no pulse without enough light or during cooldown', () => {
    expect(go({ player: { carried: T.pulse_cost - 1 } }, [{ tick: 0, pulse: true }]).events).toHaveLength(0);
    const r = go({ player: { carried: 10 } }, [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }]);
    expect(r.events.filter((e) => e.name === 'pulse')).toHaveLength(1);
  });
  it('shade hit costs a flame, drops motes, then invulnerability', () => {
    const r = go({ player: { carried: 5 }, shades: [{ pos: [0.5, 1, 0] }] }, [], T.invuln_s * 60 + 1);
    const hits = r.events.filter((e) => e.name === 'player_hit');
    expect(hits[0]).toEqual({ type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: T.flames - 1, dropped: 2 } });
    expect(hits[1].tick).toBe(1 + T.invuln_s * 60);
  });
  it('loses with no_flames', () => {
    const r = go({ player: { flames: 1 }, shades: [{ pos: [0, 1, 0] }] });
    expect(r.events.at(-1).data).toEqual({ result: 'lost', reason: 'no_flames' });
    expect(r.end).toMatchObject({ ticks: 1, state: 'lost' });
  });
  it('shades never enter safe_radius of a lit lantern', () => {
    const r = go({ player: { pos: [0, 0, 18] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [0, 1, 10] }] }, [], 300);
    for (const s of r.snaps) expect(Math.hypot(s.shades[0].pos[0] - L1[0], s.shades[0].pos[2] - L1[2])).toBeGreaterThanOrEqual(T.safe_radius - 1e-3);
    expect(r.events).toHaveLength(0);
  });
  it('spawns shades with shade_spawned events when random_shades is on', () => {
    const r = go({ random_shades: true, shades: [] }, [], 40 * 60, 600);
    expect(r.events[0]).toEqual({ type: 'event', tick: 2400, name: 'shade_spawned', data: { id: 'S1' } });
  });
});

describe('dawn', () => {
  it('loses at dawn when time runs out', () => {
    const r = go({ time_left_s: 1 }, [], 600);
    expect(r.events.at(-1)).toEqual({ type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
    expect(r.end).toMatchObject({ ticks: 60, state: 'lost' });
  });
});

describe('parsing (trust boundary)', () => {
  it('rejects malformed inputs with FormatError', () => {
    expect(() => parseInputs('{')).toThrow(FormatError);
    expect(() => parseInputs('{"frames":[{"tick":5},{"tick":5}]}')).toThrow(FormatError);
    expect(() => parseInputs('{"frames":[{"tick":0,"move":[2,0]}]}')).toThrow(FormatError);
    expect(() => parseInputs('{"frames":[{"tick":0,"jump":1}]}')).toThrow(FormatError);
    expect(() => parseScenario('{"lanterns":[{"id":"L9"}]}')).toThrow(FormatError);
    expect(() => parseScenario('{"motes":[[0,0]]}')).toThrow(FormatError);
  });
  it('keeps omitted fields', () => {
    expect(parseInputs('{"frames":[{"tick":0,"move":[0,1]},{"tick":3,"pulse":true}]}')).toEqual([
      { tick: 0, move: [0, 1] },
      { tick: 3, pulse: true },
    ]);
  });
  it('validates args', () => {
    expect(parseArgs(['--seed', '1', '--night', '1', '--ticks', '10', '--out', 'x'])).toMatchObject({ every: 10 });
    expect(() => parseArgs(['--seed', '1', '--night', '2', '--ticks', '10', '--out', 'x'])).toThrow(UsageError);
    expect(() => parseArgs(['--seed', '1', '--night', '1', '--out', 'x'])).toThrow(UsageError);
  });
});
