// Ticket-04 benchmark: camera path and frame statistics (pure, unit tested).
export const BENCH_CAM = { radius: 30, height: 15, period_s: 15, warmup_s: 3 };

/** Camera on a circle around (0,0,0), starting at (30,15,0), counter-clockwise seen from above (+Y), 15 s per lap.
 *  Seen from above with +X to the right, -Z is up on the screen, so counter-clockwise goes +X -> -Z. */
export function orbit(t: number): [number, number, number] {
  const a = (2 * Math.PI * t) / BENCH_CAM.period_s;
  return [BENCH_CAM.radius * Math.cos(a), BENCH_CAM.height, -BENCH_CAM.radius * Math.sin(a)];
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Ticket-04 definitions over frame times dt (ms). */
export function frameStats(dt: number[]) {
  const n = dt.length;
  const sum = dt.reduce((a, b) => a + b, 0);
  const sorted = [...dt].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(n - k);
  // p95: nearest-rank method (assumption D3)
  const p95 = sorted[Math.max(0, Math.ceil(0.95 * n) - 1)];
  return {
    avg_fps: r1((1000 * n) / sum),
    p1_low_fps: r1(1000 / (worst.reduce((a, b) => a + b, 0) / k)),
    frame_ms_p95: r1(p95),
    frames: n,
  };
}
