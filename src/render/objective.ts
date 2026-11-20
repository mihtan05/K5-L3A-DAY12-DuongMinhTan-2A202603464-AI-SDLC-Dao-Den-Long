// Render-only guidance: which target the HUD edge arrow points at. Reads the sim state, never changes it.
import { weak, type Game } from '../core/sim';

export type ObjectiveKind = 'mote' | 'refuel' | 'light';
export type Objective = { kind: ObjectiveKind; id: string; pos: readonly number[]; dist: number };

const distXZ = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/**
 * Empty hands: nearest firefly (nothing else can be done without one).
 * Carrying: nearest lantern about to go out (weak), else nearest unlit lantern.
 * Falls back to the other group when the first has no target. Ties keep list order (smaller id first).
 */
export function objective(g: Game): Objective | null {
  const p = g.player.pos;
  const pick = (kind: ObjectiveKind, list: { id: string; pos: readonly number[] }[]): Objective | null => {
    let best: Objective | null = null;
    for (const o of list) {
      const d = distXZ(o.pos, p);
      if (!best || d < best.dist) best = { kind, id: o.id, pos: o.pos, dist: d };
    }
    return best;
  };
  const motes = () => pick('mote', g.motes);
  const lanterns = () => pick('refuel', g.lanterns.filter(weak)) ?? pick('light', g.lanterns.filter((l) => !l.lit));
  return g.player.carried > 0 ? lanterns() ?? motes() : motes() ?? lanterns();
}
