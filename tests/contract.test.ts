import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { TUNING } from '../src/core/tuning';

it('game.contract.json tuning matches src/core/tuning.ts', () => {
  const c = JSON.parse(readFileSync('game.contract.json', 'utf8'));
  expect(c.contract_version).toBe('1.2');
  expect(c.tuning).toEqual(TUNING);
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) expect(typeof c[k]).toBe('string');
});
