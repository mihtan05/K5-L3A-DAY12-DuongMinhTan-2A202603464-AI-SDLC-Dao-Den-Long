// Self-synthesised warm sounds (Web Audio, no external files, no license needed). Render-only.
export type Sfx =
  | 'pickup' | 'deposit' | 'lit' | 'pulse' | 'hit' | 'win' | 'lose'
  | 'jump' | 'dash' | 'shade' | 'tick' | 'wind' | 'charm' | 'steal';

// C major pentatonic, two octaves.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let out: GainNode | undefined;
let volume = 0.7;
let pickupStreak = 0;
let lastPickup = 0;
let musicTimer: ReturnType<typeof setInterval> | undefined;

function ac() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    out = ctx.createGain();
    out.gain.value = 0.35;
    // Cheap "reverb": feedback delay keeps bell tails soft.
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.18;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    out.connect(master);
    out.connect(delay).connect(fb).connect(delay);
    fb.connect(master);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setVolume(v: number) {
  volume = v;
  if (master) master.gain.value = v;
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

function noise(dur: number, vol: number, from: number, to: number) {
  const c = ac();
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(from, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(to, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + dur * 0.3);
  g.gain.linearRampToValueAtTime(0, c.currentTime + dur);
  src.connect(f).connect(g).connect(out!);
  src.start();
}

export function playSfx(name: Sfx) {
  const c = ac();
  switch (name) {
    case 'pickup': {
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
      bell(196, 0, 0.35, 0.3);
      break;
    case 'win':
      [0, 1, 2, 4, 5, 7].forEach((n, i) => bell(PENTA[n], i * 0.16, 1.6, 0.18));
      break;
    case 'lose':
      [4, 2, 1, 0].forEach((n, i) => bell(PENTA[n] / 2, i * 0.3, 1.8, 0.15));
      break;
    case 'jump':
      bell(392, 0, 0.25, 0.12, 'triangle');
      bell(523.25, 0.05, 0.25, 0.08, 'triangle');
      break;
    case 'dash':
      noise(0.25, 0.25, 600, 2400);
      break;
    case 'shade':
      bell(110, 0, 1.2, 0.18, 'triangle');
      bell(116.5, 0.05, 1.2, 0.12, 'triangle'); // slow beating, uneasy but soft
      break;
    case 'tick':
      bell(1046.5, 0, 0.12, 0.12, 'square');
      break;
    case 'wind':
      noise(2, 0.18, 300, 900);
      break;
    case 'charm':
      [5, 7, 9].forEach((n, i) => bell(PENTA[n], i * 0.06, 0.6, 0.12));
      break;
    case 'steal':
      [7, 5, 3].forEach((n, i) => bell(PENTA[n], i * 0.07, 0.4, 0.12, 'triangle'));
      break;
  }
}

/** Night ambience: a low drone plus sparse pentatonic notes. */
export function startMusic() {
  stopMusic();
  const c = ac();
  const drone = c.createOscillator();
  const g = c.createGain();
  drone.frequency.value = 130.81;
  drone.type = 'sine';
  g.gain.value = 0.05;
  drone.connect(g).connect(master!);
  drone.start();
  musicTimer = setInterval(() => {
    if (Math.random() < 0.6) bell(PENTA[Math.floor(Math.random() * 5)] / 2, 0, 2.5, 0.05);
  }, 900);
  stopDrone = () => drone.stop();
}
let stopDrone = () => {};
export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = undefined;
  stopDrone();
  stopDrone = () => {};
}
