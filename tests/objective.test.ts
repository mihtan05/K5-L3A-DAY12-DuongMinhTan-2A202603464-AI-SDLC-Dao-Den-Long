import { describe, expect, it } from 'vitest';
import { createGame, FUEL_MAX, step, IDLE, TPS, type Game } from '../src/core/sim';
import { TUNING } from '../src/core/tuning';
import { objective } from '../src/render/objective';

const FUEL_LOW = TUNING.low_fuel_threshold * TPS; // same definition as sim.ts (not exported there)

// Render-only HUD guidance (objective arrow). State is set by hand so each rule is checked in isolation.
const setup = (carried: number): Game => {
  const g = createGame(1, { random_motes: false, random_shades: false, player: { pos: [0, 0, 0], carried } }, 1);
  g.motes.length = 0;
  for (const l of g.lanterns) Object.assign(l, { lit: false, fuel: 0 });
  return g;
};
const mote = (id: string, x: number, z: number) => ({ id, pos: [x, 0, z] as [number, number, number], kind: 'random' as const, ttl: 0 });

describe('objective arrow (render only)', () => {
  it('empty hands: nearest firefly, even if a lantern is about to go out', () => {
    const g = setup(0);
    g.motes.push(mote('far', 20, 0), mote('near', 0, 5));
    Object.assign(g.lanterns[0], { lit: true, fuel: FUEL_LOW - 1 });
    expect(objective(g)).toMatchObject({ kind: 'mote', id: 'near', dist: 5 });
  });

  it('carrying: a lantern about to go out beats a nearer unlit one', () => {
    const g = setup(2);
    const [a, b] = g.lanterns;
    Object.assign(a, { pos: [3, 0, 0], lit: false });
    Object.assign(b, { pos: [30, 0, 0], lit: true, fuel: FUEL_LOW - 1 });
    expect(objective(g)).toMatchObject({ kind: 'refuel', id: b.id, dist: 30 });
  });

  it('exactly FUEL_LOW is not weak (same rule as weak() in sim): falls through to the nearest unlit lantern', () => {
    const g = setup(1);
    for (const l of g.lanterns) Object.assign(l, { lit: true, fuel: FUEL_MAX });
    const [a, b] = g.lanterns;
    Object.assign(a, { lit: true, fuel: FUEL_LOW });
    Object.assign(b, { pos: [0, 0, 8], lit: false });
    expect(objective(g)).toMatchObject({ kind: 'light', id: b.id, dist: 8 });
  });

  it('falls back to the other group when the first has no target; null when nothing is left', () => {
    const g = setup(0);
    const [a] = g.lanterns;
    for (const l of g.lanterns) Object.assign(l, { lit: true, fuel: FUEL_MAX });
    Object.assign(a, { pos: [0, 0, 4], lit: false });
    expect(objective(g)).toMatchObject({ kind: 'light', id: a.id }); // no fireflies on the island
    g.player.carried = 3;
    a.lit = true;
    a.fuel = FUEL_MAX;
    g.motes.push(mote('m', 6, 8));
    expect(objective(g)).toMatchObject({ kind: 'mote', dist: 10 }); // nothing to deliver to
    g.motes.length = 0;
    expect(objective(g)).toBeNull();
  });

  it('does not change the sim state', () => {
    const g = setup(1);
    g.motes.push(mote('m', 1, 1));
    const before = JSON.stringify(g, (k, v) => (k === 'rng' ? undefined : v));
    objective(g);
    expect(JSON.stringify(g, (k, v) => (k === 'rng' ? undefined : v))).toBe(before);
    step(g, IDLE); // still a valid game afterwards
  });
});
