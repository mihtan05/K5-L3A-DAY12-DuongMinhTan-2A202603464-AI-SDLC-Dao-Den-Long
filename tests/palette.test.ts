import { expect, it } from 'vitest';
import { ambientIntensity, css, P } from '../src/render/palette';

it('palette matches the Ticket-02 table exactly', () => {
  const want: Record<keyof typeof P, string> = {
    sky: '#0e1430', fog: '#1b2350', grass: '#2f5d50', sand: '#c9b48a', wood: '#6b4a2f', sea: '#12384a',
    lanternLit: '#ffb347', lanternCore: '#ffe9b0', lanternOff: '#5b5f6e', moteCore: '#fff6c2', moteHalo: '#ffe58a',
    shadeBody: '#120a1a', shadeRim: '#7a3cff', shadeStunned: '#3a3450', mayShirt: '#e8e2d0', mayScarf: '#c8102e',
    gold: '#f2c14e', drifter: '#8fa3b8', uiDanger: '#ff5a5f', uiText: '#f5f1e6',
  };
  for (const k of Object.keys(want) as (keyof typeof P)[]) expect(css(P[k])).toBe(want[k]);
});

it('ambient intensity = 0.15 + 0.55 x lit/total', () => {
  expect(ambientIntensity(0, 5)).toBeCloseTo(0.15);
  expect(ambientIntensity(5, 5)).toBeCloseTo(0.7);
  expect(ambientIntensity(3, 6)).toBeCloseTo(0.425);
});
