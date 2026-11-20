// Ticket-04 benchmark scene and soak runner. Pure and deterministic (seeded), shared by the render bench and the soak CLI.
import { makeRng } from './rng';
import { createGame, IDLE, step, TPS, type Game, type Input, type Vec3 } from './sim';
import { mapFor } from './maps';
import { RULES as R, TUNING as T } from './tuning';

/** Night 1 with 200 wandering shades and 100 motes spread uniformly over the island (seeded), L1..L3 lit at fuel 100.
 *  The bench flag turns off damage, pickup, fuel burn and the end of the night; scenario flags turn off spawns. */
export function createBench(seed: number): Game {
  const map = mapFor(1);
  const rng = makeRng(seed);
  // Uniform over the island: rejection-sample the map's bounding square against ground() (assumption D2).
  const B = 45;
  const point = (dy: number): Vec3 => {
    for (;;) {
      const x = rng.range(-B, B), z = rng.range(-B, B), h = map.ground(x, z);
      if (Number.isFinite(h)) return [x, h + dy, z];
    }
  };
  const shades = Array.from({ length: R.bench_shades }, () => ({ pos: point(R.shade_height), state: 'wander' as const }));
  const motes = Array.from({ length: R.bench_motes }, () => point(0));
  const g = createGame(seed, {
    player: { pos: [0, 0, 0] },
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: false,
    motes,
    shades,
    lanterns: Array.from({ length: R.bench_lit }, (_, i) => ({ id: `L${i + 1}`, lit: true, fuel: T.fuel_max })),
  }, 1);
  g.bench = true;
  return g;
}

/** Random input for the soak test: new direction every 30 ticks; per tick 5% jump, 3% dash, 2% pulse, 10% interact. */
export function soakInput(rng: ReturnType<typeof makeRng>, tick: number, prev: Input): Input {
  let move = prev.move;
  if (tick % R.soak_dir_every === 0) {
    const a = rng.next() * 2 * Math.PI;
    move = [Math.cos(a), Math.sin(a)];
  }
  return {
    ...IDLE,
    move,
    jump: rng.next() < R.soak_p_jump,
    dash: rng.next() < R.soak_p_dash,
    pulse: rng.next() < R.soak_p_pulse,
    interact: rng.next() < R.soak_p_interact,
  };
}

/** Night i (1-based) uses seed + i and night ((i - 1) % 3) + 1 (assumption D5). Runs until the night ends. */
export function soakNight(seed: number, i: number, onLoaded: () => void = () => {}): Game {
  const s = seed + i;
  const g = createGame(s, {}, (((i - 1) % 3) + 1) as 1 | 2 | 3);
  onLoaded();
  const rng = makeRng(s ^ 0x5eed); // input stream separate from the game's own rng
  let inp: Input = { ...IDLE };
  const limit = (g.startTimeLeft + 1) * TPS; // safety cap: a night always ends at dawn
  for (let k = 0; g.state === 'playing' && k < limit; k++) step(g, (inp = soakInput(rng, k, inp)));
  return g;
}
