import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/core/rng';

describe('makeRng', () => {
  it('same seed gives same sequence', () => {
    const a = makeRng(42), b = makeRng(42);
    const sa = Array.from({ length: 100 }, a.next), sb = Array.from({ length: 100 }, b.next);
    expect(sa).toEqual(sb);
  });
  it('different seeds differ and stay in [0,1)', () => {
    const a = Array.from({ length: 100 }, makeRng(1).next);
    const b = Array.from({ length: 100 }, makeRng(2).next);
    expect(a).not.toEqual(b);
    for (const x of a) expect(x >= 0 && x < 1).toBe(true);
  });
});
