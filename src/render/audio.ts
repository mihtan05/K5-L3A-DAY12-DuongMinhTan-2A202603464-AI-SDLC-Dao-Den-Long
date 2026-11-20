// Self-synthesised warm sounds (Web Audio, no external files, no license needed). Render-only.
export type Sfx = 'pickup' | 'deposit' | 'lit' | 'pulse' | 'hit' | 'win' | 'lose';

// Pentatonic (C major pentatonic) frequencies, two octaves.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

let ctx: AudioContext | undefined;
let out: GainNode | undefined;
let pickupStreak = 0;
let lastPickup = 0;

function ac() {
  if (!ctx) {
    ctx = new AudioContext();
    out = ctx.createGain();
    out.gain.value = 0.35;
    // Cheap "reverb": feedback delay keeps the bell tail soft.
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.18;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    out.connect(ctx.destination);
    out.connect(delay).connect(fb).connect(delay);
    fb.connect(ctx.destination);
  }
  return ctx;
}

function bell(freq: number, at = 0, dur = 1.2, vol = 0.3, type: OscillatorType = 'sine') {
  const c = ac();
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function playSfx(name: Sfx) {
  const c = ac();
  if (c.state === 'suspended') void c.resume();
  switch (name) {
    case 'pickup': {
      // Consecutive pickups climb the pentatonic scale.
      pickupStreak = c.currentTime - lastPickup < 1.5 ? Math.min(pickupStreak + 1, PENTA.length - 1) : 0;
      lastPickup = c.currentTime;
      bell(PENTA[pickupStreak], 0, 0.8, 0.22);
      bell(PENTA[pickupStreak] * 2, 0, 0.4, 0.05);
      break;
    }
    case 'deposit':
      [0, 2, 4].forEach((n, i) => bell(PENTA[n], i * 0.09, 1.0, 0.2, 'triangle'));
      break;
    case 'lit':
      [0, 2, 4, 5].forEach((n) => bell(PENTA[n] / 2, 0, 2.5, 0.16));
      bell(PENTA[7], 0.15, 2, 0.08);
      break;
    case 'pulse':
      [0, 3, 5].forEach((n, i) => bell(PENTA[n], i * 0.03, 1.8, 0.18, 'triangle'));
      break;
    case 'hit':
      bell(196, 0, 0.35, 0.3, 'sine'); // soft low "bụp"
      break;
    case 'win':
      [0, 1, 2, 4, 5, 7].forEach((n, i) => bell(PENTA[n], i * 0.16, 1.6, 0.18));
      break;
    case 'lose':
      [4, 2, 1, 0].forEach((n, i) => bell(PENTA[n] / 2, i * 0.3, 1.8, 0.15));
      break;
  }
}
