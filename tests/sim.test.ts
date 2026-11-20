import { describe, expect, it } from 'vitest';
import { run } from '../src/headless/cli';
import { FormatError, parseArgs, parseInputs, parseScenario, UsageError, type Frame } from '../src/headless/parse';
import { SHADE_STATES, type Scenario } from '../src/core/sim';
import { RULES as R, TUNING as T } from '../src/core/tuning';

const QUIET: Scenario = { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [] };
const go = (sc: Scenario, frames: Frame[] = [], ticks = 60, every = 1, night: 1 | 2 | 3 = 1) => {
  const lines = run(1, ticks, every, { ...QUIET, ...sc }, frames, night).map((l) => JSON.parse(l));
  return {
    lines,
    snaps: lines.filter((l) => l.type === 'snapshot'),
    events: lines.filter((l) => l.type === 'event' && l.name !== 'night_start'),
    end: lines[lines.length - 1],
  };
};
const names = (ev: { name: string }[]) => ev.map((e) => e.name);
const xz = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

describe('tick model & output (v1.2)', () => {
  // Phase 3: night 1 lasts 240 s (was 300) — Ticket-03 §3.
  it('snapshot at tick 0 before input, night_start at tick 0, end line last, time_left counts steps', () => {
    const r = go({}, [{ tick: 0, move: [0, 1] }], 30, 10);
    expect(r.lines[1]).toEqual({ type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
    expect(r.snaps.map((s) => s.tick)).toEqual([0, 10, 20, 30]);
    expect(r.snaps[0].player.pos).toEqual([0, 0, 0]);
    expect(r.snaps[0].time_left_s).toBe(240);
    expect(r.snaps[3].time_left_s).toBe(239.5);
    expect(r.snaps[0].lanterns).toHaveLength(5);
    expect(r.end).toEqual({ type: 'end', ticks: 30, state: 'playing', score: 0 });
  });
  // Phase 3: v1.2 adds player.capacity and lantern fuel / ever_lit / relit_count.
  it('snapshot has every v1.2 field', () => {
    const s = go({ motes: [[0, 0, 5]], lanterns: [{ id: 'L2', lit: true }] }, [], 1, 1, 2).snaps[0];
    expect(Object.keys(s)).toEqual(expect.arrayContaining(['night', 'wind', 'drifters', 'charms', 'motes', 'motes_active', 'sim_tick']));
    expect(s.wind).toEqual({ active: false, dir_deg: 0 });
    expect(s.player).toEqual({
      pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, flames: 3, carried: 0, capacity: 10, invuln: false, dash_cd_s: 0, pulse_cd_s: 0, charm_s: 0,
    });
    expect(s.lanterns[0]).toEqual({ id: 'L1', pos: [0, 0, 20], lit: false, deposited: 0, fuel: 0, ever_lit: false, relit_count: 0 });
    expect(s.lanterns[1]).toMatchObject({ id: 'L2', lit: true, fuel: 100, ever_lit: true, relit_count: 0 });
    expect(s.motes[0]).toEqual({ id: 'M1', pos: [0, 0, 5], kind: 'random', ttl_s: null });
    expect(s.charms).toEqual([{ id: 'C1', pos: [35, 0, 0], available: true, respawn_s: 0 }]);
  });
  it('is deterministic with random spawns on all nights, and seeds differ', () => {
    for (const n of [1, 2, 3] as const) {
      const a = run(7, 3000, 10, {}, [], n), b = run(7, 3000, 10, {}, [], n), c = run(8, 3000, 10, {}, [], n);
      expect(a).toEqual(b);
      expect(a).not.toEqual(c);
    }
  });
  it('shade states only use the v1.1 names', () => {
    for (const n of [1, 2, 3] as const)
      for (const l of run(3, 4000, 20, {}, [{ tick: 0, move: [0.3, 1] }], n).map((x) => JSON.parse(x)))
        if (l.type === 'snapshot') for (const s of l.shades) expect(SHADE_STATES).toContain(s.state);
  });
  // Phase 3: the longest night is now 300 s = 18 000 ticks; the contract cap (21 600) still holds.
  it('a full night (<= 21 600 ticks) runs in under 30 s', () => {
    const t0 = performance.now();
    const lines = run(1, 21600, 10, { random_shades: false }, [], 3);
    expect(JSON.parse(lines.at(-1)!)).toMatchObject({ ticks: 18000, state: 'lost' });
    expect(performance.now() - t0).toBeLessThan(30000);
  });
});

describe('movement, jump, dash', () => {
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
  it('jump 7 m/s with gravity 20: apex ~1.2 m, lands, only from the ground', () => {
    const r = go({}, [{ tick: 0, jump: true }, { tick: 5, jump: false }, { tick: 6, jump: true }], 120);
    const ys = r.snaps.map((s) => s.player.pos[1]);
    expect(Math.max(...ys)).toBeCloseTo((R.jump_speed * R.jump_speed) / (2 * R.gravity), 1);
    expect(r.snaps[120].player).toMatchObject({ grounded: true });
    expect(ys[120]).toBe(0);
    expect(ys.findIndex((y, i) => i > 0 && y === 0)).toBe(42); // airtime 2v/g = 0.7 s
    expect(ys.slice(42).every((y) => y === 0)).toBe(true); // the mid-air press at tick 6 did nothing
  });
  it('dash: 12 ticks at 14 m/s, event, 90-tick cooldown from its start', () => {
    const r = go({}, [{ tick: 0, move: [0, 1], dash: true }, { tick: 1, dash: false }, { tick: 30, dash: true }, { tick: 31, dash: false }, { tick: 90, dash: true }], 100);
    expect(r.snaps[12].player.pos[2]).toBeCloseTo(T.dash_speed * T.dash_duration_s, 3);
    expect(r.snaps[13].player.pos[2]).toBeCloseTo(2.8 + 0.1, 3);
    expect(r.events.filter((e) => e.name === 'dash').map((e) => e.tick)).toEqual([1, 91]);
    expect(r.snaps[1].player.dash_cd_s).toBe(1.5);
  });
  it('dash while standing goes the way May faces (+Z at start)', () => {
    expect(go({}, [{ tick: 0, dash: true }], 12).snaps[12].player.pos).toEqual([0, 0, 2.8]);
  });
  it('air dash keeps the height', () => {
    const r = go({}, [{ tick: 0, jump: true }, { tick: 10, dash: true }], 30);
    expect(r.snaps[22].player.pos[1]).toBe(r.snaps[10].player.pos[1]);
    expect(r.snaps[23].player.pos[1]).not.toBe(r.snaps[10].player.pos[1]);
  });
});

describe('motes & lanterns', () => {
  it('picks a mote (XZ <= 1 and height <= 1.5), no score on pickup', () => {
    const r = go({ motes: [[0, 0, 3], [0, 2, 5]] }, [{ tick: 0, move: [0, 1] }]);
    expect(r.events).toEqual([{ type: 'event', tick: 20, name: 'mote_picked', data: { carried: 1 } }]);
    expect(r.end.score).toBe(0);
  });
  it('does not pick beyond carry_capacity', () => {
    expect(go({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0]] }).events).toHaveLength(0);
  });
  it('20 random motes at distinct points, +1 every 240 ticks into an empty point', () => {
    const r = go({ random_motes: true, motes: undefined }, [], 480, 240);
    const ids = (s: { motes: { pos: number[] }[] }) => new Set(s.motes.map((m) => m.pos.join()));
    expect(r.snaps[0].motes).toHaveLength(20);
    expect(ids(r.snaps[0]).size).toBe(20);
    expect(r.snaps[1].motes).toHaveLength(21);
    expect(ids(r.snaps[2]).size).toBe(22);
  });
  it('deposits min(carried, missing) on interact press, +5 per mote, lights at 10', () => {
    const r = go({ player: { pos: [0, 0, 23], carried: 10 } }, [{ tick: 0, interact: true }, { tick: 5, interact: true }]);
    expect(names(r.events)).toEqual(['deposit', 'lantern_lit']);
    expect(r.events[0]).toMatchObject({ tick: 1, data: { lantern_id: 'L1', amount: 10, deposited: 10 } });
    expect(r.end.score).toBe(10 * T.score.per_mote + T.score.per_lantern);
  });
  it('lantern remembers partial deposits; out of interact_radius does nothing', () => {
    const r = go({ player: { pos: [0, 0, 23], carried: 3 }, lanterns: [{ id: 'L1', deposited: 8 }] }, [{ tick: 0, interact: true }]);
    // Phase 3: lantern_lit carries relight (v1.2).
    expect(r.events.map((e) => e.data)).toEqual([{ lantern_id: 'L1', amount: 2, deposited: 10 }, { lantern_id: 'L1', relight: false }]);
    expect(go({ player: { pos: [0, 0, 22.9], carried: 2 } }, [{ tick: 0, interact: true }]).events).toHaveLength(0);
  });
  it('equal distance: smaller id wins', () => {
    const r = go({ player: { carried: 1 }, lanterns: [{ id: 'L3', pos: [1, 0, 0] }, { id: 'L2', pos: [-1, 0, 0] }] }, [{ tick: 0, interact: true }]);
    expect(r.events[0].data.lantern_id).toBe('L2');
  });
  // Phase 3 REPLACED "wins when all lanterns are lit … bonus = 2 x floor(s left)": Ticket-03 §3 removes the early win
  // (all_lit) and §5 removes the time bonus. Replaced by "no early win" below and the dawn tests in 'fuel & dawn (Phase 3)'.
  it('lighting every lantern does not end the night; setup gives no points', () => {
    const lanterns = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
    const r = go({ lanterns: [...lanterns, { id: 'L5', pos: [0, 0, 2] }], player: { carried: 10 } }, [{ tick: 0, interact: true }], 120);
    expect(names(r.events)).toEqual(['deposit', 'lantern_lit']);
    expect(r.end).toEqual({ type: 'end', ticks: 120, state: 'playing', score: 10 * 5 + 100 });
  });
  it('lighting on the exact dawn tick counts for the dawn check', () => {
    const lanterns = ['L1', 'L2'].map((id) => ({ id, lit: true }));
    const r = go({ time_left_s: 1, lanterns: [...lanterns, { id: 'L5', pos: [0, 0, 2] }], player: { carried: 10 } }, [{ tick: 59, interact: true }], 120);
    expect(r.events.at(-1)).toMatchObject({ tick: 60, data: { result: 'won', reason: 'dawn_survived' } });
  });
});

describe('shades, pulse, safe zones', () => {
  it('pulse: 3D radius 5 from foot+0.8, stun 120 ticks, push 4 m over 15 ticks, +5 each', () => {
    const r = go({ player: { carried: 4 }, shades: [{ id: 'A', pos: [3, 1, 0] }, { id: 'B', pos: [0, 1, -5] }, { pos: [20, 1, 0] }] }, [{ tick: 0, pulse: true }], 130);
    expect(r.events[0]).toMatchObject({ name: 'pulse', data: { stunned_ids: ['A'] } });
    expect(r.snaps[1].shades[0].pos[0]).toBeCloseTo(3 + 4 / 15, 3);
    expect(r.snaps[15].shades[0]).toEqual({ id: 'A', pos: [7, 1, 0], state: 'stunned' });
    expect(r.snaps[16].shades[0].pos).toEqual([7, 1, 0]);
    expect(r.snaps[120].shades[0].state).toBe('stunned');
    expect(r.snaps[121].shades[0].state).toBe('chase');
    expect(r.snaps[1].player).toMatchObject({ carried: 1, pulse_cd_s: 3 });
    expect(r.end.score).toBe(T.score.per_stun);
  });
  it('push stops at the island edge', () => {
    const r = go({ player: { pos: [38, 0, 0], carried: 3 }, shades: [{ pos: [39.5, 1, 0] }] }, [{ tick: 0, pulse: true }], 20);
    expect(r.snaps[20].shades[0].pos[0]).toBeLessThanOrEqual(40);
  });
  it('no pulse without 3 motes or during cooldown', () => {
    expect(go({ player: { carried: 2 } }, [{ tick: 0, pulse: true }]).events).toHaveLength(0);
    const r = go({ player: { carried: 10 } }, [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }]);
    expect(r.events.filter((e) => e.name === 'pulse')).toHaveLength(1);
  });
  it('hit: -1 flame, floor(carried/2) dropped motes on a 1.5-2.5 m ring (TTL 480), 90 invuln ticks, shade recoils', () => {
    const r = go({ player: { carried: 5 }, shades: [{ pos: [0.5, 1, 0] }] }, [], 500);
    const hits = r.events.filter((e) => e.name === 'player_hit');
    expect(hits[0]).toEqual({ type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } });
    expect(hits[1].tick).toBe(91);
    const dropped = r.snaps[1].motes.filter((m: { kind: string }) => m.kind === 'dropped');
    expect(dropped).toHaveLength(2);
    for (const m of dropped) expect(xz(m.pos, [0, 0, 0])).toBeGreaterThanOrEqual(1.5 - 1e-3), expect(m.ttl_s).toBe(8);
    expect(r.snaps[2].shades[0].state).toBe('recoil');
    expect(r.snaps[1].player.invuln).toBe(true);
  });
  it('dropped motes expire after 480 ticks', () => {
    const r = go({ player: { carried: 2, flames: 10 }, shades: [{ pos: [0.5, 1, 0], state: 'chase' }] }, [], 482);
    const n = (s: { motes: { kind: string }[] }) => s.motes.filter((m) => m.kind === 'dropped').length;
    expect(n(r.snaps[480])).toBe(1);
    expect(n(r.snaps[481])).toBe(0);
  });
  it('loses with no_flames', () => {
    const r = go({ player: { flames: 1 }, shades: [{ pos: [0, 1, 0] }] });
    expect(r.events.at(-1).data).toEqual({ result: 'lost', reason: 'no_flames' });
    expect(r.end).toMatchObject({ ticks: 1, state: 'lost' });
  });
  it('shades never enter the 6 m zone of a lit lantern', () => {
    const r = go({ player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [0, 1, 15] }] }, [], 300);
    for (const s of r.snaps) expect(xz(s.shades[0].pos, [0, 0, 25])).toBeGreaterThanOrEqual(T.safe_radius - 1e-3);
    expect(r.events).toHaveLength(0);
  });
  it('a shade inside when the lantern lights is pushed to the edge within 30 ticks and cannot hit', () => {
    const r = go(
      { player: { pos: [0, 0, 24], carried: 1 }, lanterns: [{ id: 'L1', deposited: 9 }], shades: [{ pos: [0, 1, 24.5] }] },
      [{ tick: 0, interact: true }],
      60,
    );
    expect(r.events.filter((e) => e.name === 'player_hit')).toHaveLength(0);
    expect(xz(r.snaps[30].shades[0].pos, [0, 0, 25])).toBeCloseTo(6, 3);
  });
  it('detect at 12 m, give up past 18 m', () => {
    expect(go({ shades: [{ pos: [11, 1, 0] }] }, [], 1).snaps[1].shades[0].state).toBe('chase');
    expect(go({ shades: [{ pos: [13, 1, 0] }] }, [], 1).snaps[1].shades[0].state).toBe('wander');
    expect(go({ shades: [{ pos: [17, 1, 0], state: 'chase' }] }, [], 1).snaps[1].shades[0].state).toBe('chase');
    expect(go({ shades: [{ pos: [19, 1, 0], state: 'chase' }] }, [], 1).snaps[1].shades[0].state).toBe('wander');
  });
  it('schedule: 2 shades at tick 300, then 1 every 480, >= 15 m from May, spawning first', () => {
    const r = go({ random_shades: true, shades: undefined }, [], 800, 100);
    const sp = r.events.filter((e) => e.name === 'shade_spawned');
    expect(sp.map((e) => [e.tick, e.data.id])).toEqual([[300, 'S1'], [300, 'S2'], [780, 'S3']]);
    for (const s of r.snaps[3].shades) expect(xz(s.pos, [0, 0, 0])).toBeGreaterThanOrEqual(15);
    expect(r.snaps[3].shades[0].state).toBe('spawning');
  });
  it('night 3 shades are faster (4.5 m/s)', () => {
    const r = go({ player: { pos: [0, 0, -25] }, shades: [{ pos: [10, 1, -25], state: 'chase' }] }, [], 60, 60, 3);
    expect(r.snaps[1].shades[0].pos[0]).toBeCloseTo(5.5, 3);
  });
});

describe('falling off the island', () => {
  it('Y < -10: -1 flame, lose all motes, wait 60 ticks, respawn at start with 90 invuln ticks', () => {
    const r = go({ player: { pos: [39.5, 0, 0], carried: 4, invuln_ticks: 200 } }, [{ tick: 0, move: [1, 0] }], 200);
    const hit = r.events.find((e) => e.name === 'player_hit');
    expect(hit.data).toEqual({ by: 'fall', flames: 2, dropped: 0, lost: 4 });
    const t = hit.tick;
    expect(r.snaps[t + 59].player.pos[1]).toBeLessThanOrEqual(-10);
    expect(r.snaps[t + 60].player).toMatchObject({ pos: [0, 0, 0], vel: [0, 0, 0], invuln: true, carried: 0 });
    expect(r.events.filter((e) => e.name === 'player_hit')).toHaveLength(1);
  });
  it('falling with the last flame loses at once', () => {
    const r = go({ player: { pos: [39.9, 0, 0], flames: 1 } }, [{ tick: 0, move: [1, 0] }], 200);
    expect(names(r.events)).toEqual(['player_hit', 'game_over']);
    expect(r.events[1].data).toEqual({ result: 'lost', reason: 'no_flames' });
  });
});

describe('night 2 & 3 maps', () => {
  it('night 2 jump pad launches toward the other island and lands there (~1.4 s)', () => {
    const r = go({ player: { pos: [20, 0, 18] } }, [], 120, 1, 2);
    const land = r.snaps.findIndex((s, i) => i > 2 && s.player.grounded);
    expect(land).toBeGreaterThan(80);
    expect(land).toBeLessThan(90);
    expect(xz(r.snaps[land].player.pos, [70, 0, 0])).toBeLessThan(28);
  });
  it('night 2 bridge holds, sea beside it does not', () => {
    expect(go({ player: { pos: [30, 0, 0] } }, [], 30, 1, 2).snaps[30].player.pos[1]).toBe(0);
    expect(go({ player: { pos: [30, 0, 3] } }, [], 30, 1, 2).snaps[30].player.pos[1]).toBeLessThan(0);
  });
  it('night 3 pad lands on tier 2 (Y = 6)', () => {
    const r = go({ player: { pos: [0, 3, 13] } }, [], 90, 1, 3);
    expect(r.snaps[90].player).toMatchObject({ grounded: true });
    expect(r.snaps[90].player.pos[1]).toBe(6);
  });
  it('night 3: tier walls block, ramp climbs to tier 1, tower blocks', () => {
    const wall = go({ player: { pos: [0, 0, 30] } }, [{ tick: 0, move: [0, -1] }], 120, 60, 3).snaps[2].player.pos;
    expect(wall[2]).toBeGreaterThan(24);
    const a = Math.PI / 6;
    const ramp = go({ player: { pos: [31 * Math.cos(a), 0, 31 * Math.sin(a)] } }, [{ tick: 0, move: [-Math.cos(a), -Math.sin(a)] }], 120, 60, 3).snaps[2].player.pos;
    expect(ramp[1]).toBe(3);
    const tower = go({ player: { pos: [0, 6, 5] } }, [{ tick: 0, move: [0, -1] }], 120, 60, 3).snaps[2].player.pos;
    expect(tower[2]).toBeGreaterThanOrEqual(2);
  });
  it('night start positions, lantern counts, durations', () => {
    expect(go({}, [], 0, 1, 2).snaps[0]).toMatchObject({ night: 2, time_left_s: 270 }) // Phase 3: 270 s (was 330);
    expect(go({}, [], 0, 1, 2).snaps[0].lanterns).toHaveLength(6);
    const s3 = go({}, [], 0, 1, 3).snaps[0];
    expect(s3).toMatchObject({ night: 3, time_left_s: 300, player: { pos: [0, 0, -25] } });
    expect(s3.lanterns).toHaveLength(7);
    expect(s3.charms.map((c: { id: string }) => c.id)).toEqual(['C1', 'C2']);
  });
  it('night 3 wind: every 30 s for 5 s, pushes 2 m/s', () => {
    const r = go({}, [], 2110, 1, 3);
    expect(r.snaps[1799].wind.active).toBe(false);
    expect(r.snaps[1800].wind.active).toBe(true);
    expect(r.snaps[2099].wind.active).toBe(true);
    expect(r.snaps[2100].wind.active).toBe(false);
    const moved = xz(r.snaps[2100].player.pos, r.snaps[1799].player.pos);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(R.wind_speed * 5 + 1e-3);
    expect(go({ wind_enabled: false }, [], 1900, 1900, 3).snaps[1].player.pos).toEqual([0, 0, -25]);
  });
});

describe('charm', () => {
  it('pick C1 on night 2: 600 ticks, 7.2 m/s, respawns after 2700 ticks', () => {
    const r = go({ player: { pos: [33, 0, 0] } }, [{ tick: 0, move: [1, 0] }, { tick: 10, move: [0, 1] }, { tick: 70, move: [0, 0] }], 2720, 1, 2);
    const pick = r.events.find((e) => e.name === 'charm_picked');
    expect(pick).toMatchObject({ tick: 10, data: { charm_id: 'C1', charm_ticks: 600 } });
    expect(r.snaps[10].charms[0]).toMatchObject({ available: false, respawn_s: 45 });
    expect(r.snaps[10].player.charm_s).toBe(10);
    expect(r.snaps[70].player.pos[2] - r.snaps[10].player.pos[2]).toBeCloseTo(R.charm_speed, 2);
    expect(r.snaps[2710].charms[0].available).toBe(true);
  });
  it('dash has no cooldown with the charm, but needs a new press and ignores presses mid-dash', () => {
    const f: Frame[] = [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 20, dash: true }];
    const r = go({ player: { charm_ticks: 600 } }, f, 30);
    expect(r.events.filter((e) => e.name === 'dash').map((e) => e.tick)).toEqual([1, 21]);
  });
});

describe('drifters (Gió Lạc)', () => {
  const D = (o: object): Scenario => ({ random_drifters: false, drifters: [{ id: 'D1', pos: [3, 1.5, 0], ...o }] });
  it('chases when May carries >= 5 within 15 m, steals min(3, carried) once, flees 240 ticks then removed', () => {
    const r = go({ ...D({}), player: { carried: 6, invuln_ticks: 300 } }, [], 400, 1, 2);
    expect(r.snaps[1].drifters[0].state).toBe('chase');
    const steal = r.events.filter((e) => e.name === 'drifter_steal');
    expect(steal).toHaveLength(1);
    expect(steal[0].data).toEqual({ drifter_id: 'D1', amount: 3, carried: 3 });
    const t = steal[0].tick;
    expect(r.snaps[t].drifters[0]).toMatchObject({ state: 'flee', stolen: 3 });
    expect(r.snaps[t + 239].drifters[0].state).toBe('flee');
    expect(r.snaps[t + 240].drifters[0].state).toBe('removed');
    expect(r.snaps[400].player.flames).toBe(3);
  });
  it('stays idle when May carries < 5', () => {
    expect(go({ ...D({ pos: [10, 1.5, 0] }), player: { carried: 4 } }, [], 5, 1, 2).snaps[5].drifters[0].state).toBe('idle');
  });
  it('pulse on a chasing drifter: flee without stealing', () => {
    const r = go({ ...D({ pos: [4, 1.5, 0], state: 'chase' }), player: { carried: 8 } }, [{ tick: 0, pulse: true }], 60, 1, 2);
    expect(r.snaps[1].drifters[0]).toMatchObject({ state: 'flee', stolen: 0 });
    expect(r.events.filter((e) => e.name === 'drifter_steal')).toHaveLength(0);
  });
  it('pulse on a fleeing drifter with loot: drops it as dropped motes, removed after 120 ticks', () => {
    const r = go({ ...D({ state: 'flee', stolen: 3 }), player: { carried: 3 } }, [{ tick: 0, pulse: true }], 130, 1, 2);
    expect(r.events.find((e) => e.name === 'drifter_drop').data).toEqual({ drifter_id: 'D1', amount: 3 });
    expect(r.snaps[1].motes.filter((m: { kind: string }) => m.kind === 'dropped')).toHaveLength(3);
    expect(r.snaps[120].drifters[0].state).toBe('flee');
    expect(r.snaps[121].drifters[0].state).toBe('removed');
  });
  it('safe zones do not stop drifters', () => {
    const r = go({ ...D({ pos: [0, 1.5, 22] }), player: { pos: [0, 0, 20], carried: 6 }, lanterns: [{ id: 'L1', lit: true }] }, [], 30, 1, 2);
    expect(r.events.filter((e) => e.name === 'drifter_steal')).toHaveLength(1);
  });
  it('spawn at tick 1200, 2400 (max 2) on nights 2 and 3 only', () => {
    const r2 = go({ random_drifters: true, drifters: undefined }, [], 3600, 1200, 2);
    expect(r2.snaps.map((s) => s.drifters.length)).toEqual([0, 1, 2, 2]);
    expect(r2.snaps[1].drifters[0]).toMatchObject({ id: 'D1', state: 'idle' });
    expect(go({ random_drifters: true }, [], 1200, 1200, 1).snaps[1].drifters).toHaveLength(0);
  });
});

describe('pause', () => {
  it('pauses on press: tick runs, sim_tick/time/cooldowns freeze; resume continues', () => {
    const f: Frame[] = [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 20, pause: true }];
    const r = go({ player: { pulse_cd_ticks: 100 } }, f, 30);
    expect(r.events.map((e) => [e.tick, e.name])).toEqual([[11, 'paused'], [21, 'resumed']]);
    expect(r.snaps[15]).toMatchObject({ state: 'paused', tick: 15, sim_tick: 10 });
    expect(r.snaps[15].player.pos).toEqual(r.snaps[10].player.pos);
    expect(r.snaps[15].player.pulse_cd_s).toBe(r.snaps[10].player.pulse_cd_s);
    expect(r.snaps[21]).toMatchObject({ state: 'playing', sim_tick: 11 });
    expect(r.snaps[30].time_left_s).toBe(r3(240 - 20 / 60));
  });
});
const r3 = (x: number) => Math.round(x * 1000) / 1000;

describe('parsing (trust boundary)', () => {
  it('rejects malformed inputs with FormatError', () => {
    expect(() => parseInputs('{')).toThrow(FormatError);
    expect(() => parseInputs('{"frames":[{"tick":5},{"tick":5}]}')).toThrow(FormatError);
    expect(() => parseInputs('{"frames":[{"tick":0,"move":[2,0]}]}')).toThrow(FormatError);
    expect(() => parseInputs('{"frames":[{"tick":0,"dash":1}]}')).toThrow(FormatError);
    expect(() => parseScenario('{"lanterns":[{"id":"L9"}]}')).toThrow(FormatError);
    expect(() => parseScenario('{"lanterns":[{"id":"L6"}]}', 1)).toThrow(FormatError);
    expect(parseScenario('{"lanterns":[{"id":"L6"}]}', 2).lanterns).toEqual([{ id: 'L6' }]);
    expect(() => parseScenario('{"motes":[[0,0]]}')).toThrow(FormatError);
    expect(() => parseScenario('{"shades":[{"pos":[0,0,0],"state":"angry"}]}')).toThrow(FormatError);
    expect(() => parseScenario('{"player":{"invuln_ticks":-1}}')).toThrow(FormatError);
    expect(() => parseScenario('{"wind_enabled":"yes"}')).toThrow(FormatError);
  });
  it('accepts v1.1 scenario fields', () => {
    const sc = parseScenario(
      '{"player":{"charm_ticks":5,"dash_cd_ticks":3},"shades":[{"id":"A","pos":[1,1,1],"state":"stunned","state_ticks_left":7}],' +
        '"drifters":[{"pos":[0,1,0],"state":"flee","stolen":2}],"charms":[{"id":"C1","available":false,"respawn_ticks":9}],"random_drifters":false,"wind_enabled":true}',
      3,
    );
    expect(sc).toMatchObject({ player: { charm_ticks: 5, dash_cd_ticks: 3 }, random_drifters: false, wind_enabled: true });
    expect(sc.shades![0]).toEqual({ id: 'A', pos: [1, 1, 1], state: 'stunned', state_ticks_left: 7 });
  });
  it('keeps omitted fields', () => {
    expect(parseInputs('{"frames":[{"tick":0,"move":[0,1]},{"tick":3,"pause":true}]}')).toEqual([
      { tick: 0, move: [0, 1] },
      { tick: 3, pause: true },
    ]);
  });
  it('validates args: --night 1..3', () => {
    expect(parseArgs(['--seed', '1', '--night', '3', '--ticks', '10', '--out', 'x'])).toMatchObject({ every: 10, night: 3 });
    expect(() => parseArgs(['--seed', '1', '--night', '4', '--ticks', '10', '--out', 'x'])).toThrow(UsageError);
    expect(() => parseArgs(['--seed', '1', '--night', '1', '--out', 'x'])).toThrow(UsageError);
  });
});
