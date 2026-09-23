// Tiny WebAudio synth — no audio files needed.
let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() { ensure(); }

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}

function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.5, cutoff = 900 } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export const sfx = {
  click: () => tone(660, 0.08, { type: 'triangle', vol: 0.2 }),
  catch: (combo = 0) => {
    const base = 520 * 2 ** (Math.min(combo, 12) / 12);
    tone(base, 0.12, { type: 'triangle', vol: 0.25, slide: 200 });
  },
  bunch: () => {
    [0, 0.07, 0.14].forEach((d, i) => tone(600 + i * 180, 0.12, { type: 'triangle', vol: 0.22, delay: d }));
  },
  boom: () => { noise(0.8, { vol: 0.9, cutoff: 700 }); tone(120, 0.5, { type: 'sine', vol: 0.5, slide: -80 }); },
  shield: () => { tone(900, 0.3, { type: 'sine', vol: 0.25, slide: -500 }); tone(1300, 0.25, { type: 'sine', vol: 0.15, delay: 0.05 }); },
  power: () => [0, 0.06, 0.12, 0.18].forEach((d, i) => tone(500 + i * 150, 0.1, { type: 'square', vol: 0.08, delay: d })),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.25, delay: i * 0.12 })),
  lose: () => [440, 392, 330].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.22, delay: i * 0.18 })),
  golden: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, { type: 'sine', vol: 0.22, delay: i * 0.09 })),
  wrong: () => tone(260, 0.25, { type: 'triangle', vol: 0.2, slide: -60 }),
  tick: () => tone(1000, 0.05, { type: 'square', vol: 0.06 }),
  buy: () => { tone(880, 0.08, { type: 'square', vol: 0.1 }); tone(1320, 0.12, { type: 'square', vol: 0.1, delay: 0.08 }); },
};
