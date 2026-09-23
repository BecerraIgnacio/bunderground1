// Synthesizes the trailer soundtrack and sound effects from scratch (no samples, no licenses).
// Output: public/audio/music.wav + public/audio/sfx-*.wav
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100;
const OUT = path.resolve('public/audio');
fs.mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ utils
let seed = 1337;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const TAU = Math.PI * 2;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function biquad(type, f, q = 0.707) {
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const set = (freq, qq = q) => {
    const w = (TAU * freq) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * qq), a0 = 1 + a;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = a; b1 = 0; b2 = -a; } // band-pass
    b0 /= a0; b1 /= a0; b2 /= a0; a1 = (-2 * c) / a0; a2 = (1 - a) / a0;
  };
  set(f);
  const fn = x => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
  fn.set = set;
  return fn;
}
// time-varying filter (coefficients updated every 32 samples, state preserved)
function sweepFilter(type, fAt, q = 0.8) {
  const flt = biquad(type, fAt(0), q);
  let n = 0;
  return (x, t) => { if (++n % 32 === 0) flt.set(clamp(fAt(t), 30, 18000)); return flt(x); };
}
const buf = sec => new Float32Array(Math.ceil(sec * SR));

// ------------------------------------------------------------------ instruments (mono buffers)
function celesta(f, dur, v = 1) {
  const b = buf(dur + 1.8);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const a = Math.min(1, t / 0.003);
    b[i] = v * a * (Math.sin(TAU * f * t) * Math.exp(-t * 2.6) + 0.45 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 5.5)
      + 0.18 * Math.sin(TAU * f * 3.01 * t) * Math.exp(-t * 9) + 0.12 * Math.sin(TAU * f * 4.2 * t) * Math.exp(-t * 14));
  }
  return b;
}
function glock(f, dur, v = 1) {
  const b = buf(2.2);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    b[i] = v * Math.min(1, t / 0.001) * (Math.sin(TAU * f * t) * Math.exp(-t * 2.2) + 0.35 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 6)
      + 0.2 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 11));
  }
  return b;
}
function marimba(f, dur, v = 1) {
  const b = buf(0.9);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    b[i] = v * Math.min(1, t / 0.002) * (Math.sin(TAU * f * t) * Math.exp(-t * 6) + 0.35 * Math.sin(TAU * f * 4 * t) * Math.exp(-t * 28)
      + 0.1 * Math.sin(TAU * f * 10 * t) * Math.exp(-t * 60));
  }
  return b;
}
// Karplus-Strong plucked string (pizzicato bass, harp arps)
function pluck(f, dur, v = 1, damp = 0.995, bright = 0.5) {
  const b = buf(dur + 0.6);
  const N = Math.max(2, Math.round(SR / f));
  const ring = new Float32Array(N);
  let last = 0;
  for (let i = 0; i < N; i++) { last = last * (1 - bright) + noise() * bright; ring[i] = last; }
  let p = 0;
  for (let i = 0; i < b.length; i++) {
    const nx = (p + 1) % N;
    const y = ring[p];
    ring[p] = damp * 0.5 * (ring[p] + ring[nx]);
    p = nx;
    const t = i / SR;
    const rel = t > dur ? Math.exp(-(t - dur) * 12) : 1;
    b[i] = y * v * rel;
  }
  return b;
}
function saw(phase) { return 2 * (phase - Math.floor(phase + 0.5)); }
function pad(freqs, dur, v = 1, att = 0.6, rel = 1.0, cutoff = 1800) {
  const b = buf(dur + rel);
  const lp = biquad('lp', cutoff, 0.6), lp2 = biquad('lp', cutoff * 1.4, 0.6);
  const voices = [];
  for (const f of freqs) for (const d of [-0.12, 0, 0.11]) voices.push({ f: f * Math.pow(2, d / 12), ph: rnd() });
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let s = 0;
    for (const vo of voices) { vo.ph += vo.f / SR; s += saw(vo.ph); }
    const e = Math.min(1, t / att) * (t > dur ? Math.exp(-(t - dur) * (4 / rel)) : 1);
    b[i] = lp2(lp(s)) * e * v / voices.length * 2.4;
  }
  return b;
}
function choir(freqs, dur, v = 1, att = 0.8) {
  const b = buf(dur + 1.2);
  const f1 = biquad('bp', 780, 4), f2 = biquad('bp', 1150, 5), f3 = biquad('bp', 2600, 6);
  const voices = [];
  for (const f of freqs) for (const d of [-0.15, 0.02, 0.17]) voices.push({ f: f * Math.pow(2, d / 12), ph: rnd(), vib: rnd() * 6 });
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let s = 0;
    for (const vo of voices) { vo.ph += (vo.f * (1 + 0.004 * Math.sin(TAU * 5 * t + vo.vib))) / SR; s += saw(vo.ph); }
    s /= voices.length;
    const e = Math.min(1, t / att) * (t > dur ? Math.exp(-(t - dur) * 3.5) : 1);
    b[i] = (f1(s) * 1.0 + f2(s) * 0.6 + f3(s) * 0.25) * e * v * 4;
  }
  return b;
}
function brass(f, dur, v = 1) {
  const b = buf(dur + 0.35);
  let p1 = rnd(), p2 = rnd(), p3 = rnd();
  const flt = sweepFilter('lp', t => 900 + 3200 * Math.exp(-t * 5) + 600, 1.1);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const vib = t > 0.25 ? 1 + 0.006 * Math.sin(TAU * 5.4 * t) : 1;
    p1 += (f * vib) / SR; p2 += (f * 1.004 * vib) / SR; p3 += (f * 0.5) / SR;
    const s = saw(p1) + saw(p2) * 0.8 + saw(p3) * 0.35;
    const e = Math.min(1, t / 0.03) * (t > dur ? Math.exp(-(t - dur) * 14) : 0.85 + 0.15 * Math.exp(-t * 4));
    b[i] = flt(s, t) * e * v * 0.5;
  }
  return b;
}
function subBass(f, dur, v = 1) {
  const b = buf(dur + 0.1);
  let ph = 0;
  const lp = biquad('lp', 400, 0.8);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += f / SR;
    const e = Math.min(1, t / 0.005) * (t > dur - 0.03 ? Math.max(0, (dur + 0.07 - t) / 0.1) : 1);
    b[i] = (Math.sin(TAU * ph) + 0.35 * lp(saw(ph))) * e * v;
  }
  return b;
}

// ------------------------------------------------------------------ drums
function kick(v = 1, len = 0.5) {
  const b = buf(len);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = 45 + 110 * Math.exp(-t * 30);
    ph += f / SR;
    b[i] = v * (Math.sin(TAU * ph) * Math.exp(-t * 7) + (t < 0.004 ? noise() * 0.4 : 0));
  }
  return b;
}
function snare(v = 1) {
  const b = buf(0.35);
  const hp = biquad('hp', 1200), bp = biquad('bp', 3500, 0.8);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const n = noise();
    b[i] = v * (0.8 * (hp(n) + bp(n) * 0.6) * Math.exp(-t * 16) + 0.55 * Math.sin(TAU * 185 * t) * Math.exp(-t * 22));
  }
  return b;
}
function clap(v = 1) {
  const b = buf(0.3);
  const bp = biquad('bp', 1400, 1.2);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const burst = [0, 0.011, 0.022].some(o => t >= o && t < o + 0.008) ? 1 : 0;
    b[i] = v * bp(noise()) * (burst ? 1.4 : Math.exp(-(t - 0.022) * 22) * (t > 0.022 ? 1 : 0)) * 1.6;
  }
  return b;
}
function hat(v = 1, open = false) {
  const b = buf(open ? 0.35 : 0.06);
  const hp = biquad('hp', 7500, 0.9);
  for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = v * hp(noise()) * Math.exp(-t * (open ? 9 : 70)); }
  return b;
}
function shaker(v = 1) {
  const b = buf(0.09);
  const bp = biquad('bp', 6000, 1.5);
  for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = v * bp(noise()) * Math.sin(Math.PI * Math.min(1, t / 0.09)) * 1.5; }
  return b;
}
function crash(v = 1, len = 2.6) {
  const b = buf(len);
  const hp = biquad('hp', 4000, 0.7), bp = biquad('bp', 8000, 0.6);
  for (let i = 0; i < b.length; i++) { const t = i / SR; const n = noise(); b[i] = v * (hp(n) * 0.8 + bp(n) * 0.5) * Math.exp(-t * 2.2) * Math.min(1, t / 0.002); }
  return b;
}
function tom(f, v = 1) {
  const b = buf(0.5);
  let ph = 0;
  for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (f * (1 + 0.6 * Math.exp(-t * 18))) / SR; b[i] = v * (Math.sin(TAU * ph) * Math.exp(-t * 8) + noise() * 0.15 * Math.exp(-t * 40)); }
  return b;
}
function riser(dur, v = 1, f0 = 300, f1 = 6000) {
  const b = buf(dur);
  const flt = sweepFilter('bp', t => f0 * Math.pow(f1 / f0, t / dur), 2.5);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR, k = t / dur;
    ph += (80 * Math.pow(12, k)) / SR;
    b[i] = v * (flt(noise(), t) * 1.6 + Math.sin(TAU * ph) * 0.15) * Math.pow(k, 1.6);
  }
  return b;
}
function boom(v = 1, len = 3.5) {
  const b = buf(len);
  let ph = 0;
  const lp = biquad('lp', 900, 0.7);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (32 + 90 * Math.exp(-t * 9)) / SR;
    b[i] = v * (Math.sin(TAU * ph) * Math.exp(-t * 1.6) * 1.1 + lp(noise()) * Math.exp(-t * 5) * 0.9 + (t < 0.01 ? noise() * 0.6 : 0));
  }
  return b;
}

// ------------------------------------------------------------------ mixer with reverb send
function makeMix(sec) {
  const n = Math.ceil(sec * SR);
  return { L: new Float32Array(n), R: new Float32Array(n), SL: new Float32Array(n), SR: new Float32Array(n), n };
}
function place(mix, b, t0, { pan = 0, gain = 1, send = 0.2 } = {}) {
  const i0 = Math.round(t0 * SR);
  const gl = Math.cos(((pan + 1) * Math.PI) / 4) * gain * 1.41, gr = Math.sin(((pan + 1) * Math.PI) / 4) * gain * 1.41;
  for (let i = 0; i < b.length; i++) {
    const j = i0 + i;
    if (j < 0 || j >= mix.n) continue;
    const x = b[i];
    mix.L[j] += x * gl; mix.R[j] += x * gr;
    mix.SL[j] += x * gl * send; mix.SR[j] += x * gr * send;
  }
}
function freeverb(inp, room = 0.86, damp = 0.25, spread = 0) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(d => ({ b: new Float32Array(d + spread), p: 0, f: 0 }));
  const aps = [556, 441, 341, 225].map(d => ({ b: new Float32Array(d + spread), p: 0 }));
  const out = new Float32Array(inp.length);
  for (let i = 0; i < inp.length; i++) {
    const x = inp[i] * 0.015;
    let y = 0;
    for (const c of combs) {
      const o = c.b[c.p];
      c.f = o * (1 - damp) + c.f * damp;
      c.b[c.p] = x + c.f * room;
      c.p = (c.p + 1) % c.b.length;
      y += o;
    }
    for (const a of aps) {
      const o = a.b[a.p];
      a.b[a.p] = y + o * 0.5;
      a.p = (a.p + 1) % a.b.length;
      y = o - y;
    }
    out[i] = y;
  }
  return out;
}
function master(mix, { wet = 0.33, drive = 1.25, target = 0.93 } = {}) {
  const wl = freeverb(mix.SL, 0.86, 0.25, 0), wr = freeverb(mix.SR, 0.86, 0.25, 23);
  const L = new Float32Array(mix.n), R = new Float32Array(mix.n);
  for (let i = 0; i < mix.n; i++) {
    L[i] = Math.tanh((mix.L[i] + wl[i] * wet * 3) * drive);
    R[i] = Math.tanh((mix.R[i] + wr[i] * wet * 3) * drive);
  }
  let peak = 0;
  for (let i = 0; i < mix.n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = target / (peak || 1);
  for (let i = 0; i < mix.n; i++) { L[i] *= g; R[i] *= g; }
  // tiny fade out at the end
  const fo = Math.min(mix.n, SR * 0.05);
  for (let i = 0; i < fo; i++) { const k = i / fo; L[mix.n - 1 - i] *= k; R[mix.n - 1 - i] *= k; }
  return [L, R];
}
function writeWav(file, [L, R]) {
  const n = L.length, data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(clamp(L[i], -1, 1) * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(clamp(R[i], -1, 1) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, data);
  console.log('wrote', path.basename(file), (n / SR).toFixed(2) + 's');
}

// ------------------------------------------------------------------ the score
const BPM = 100, BEAT = 60 / BPM, BAR = BEAT * 4;
const TOTAL = 32 * BAR + 3.5;
const M = makeMix(TOTAL);
const at = (bar, beat = 0) => bar * BAR + beat * BEAT;
const hum = () => (rnd() - 0.5) * 0.008;

const PCS = { F: [5, 9, 0], Dm: [2, 5, 9], Am: [9, 0, 4], Bb: [10, 2, 5], C: [0, 4, 7], Gm: [7, 10, 2], Csus: [0, 5, 7], Fadd: [5, 9, 0, 7] };
const ROOT = { F: 41, Dm: 38, Am: 45, Bb: 46, C: 36, Gm: 43, Csus: 36, Fadd: 41 };
const voice = (ch, lo, hi) => { const out = []; for (let m = lo; m <= hi; m++) if (PCS[ch].includes(((m % 12) + 12) % 12)) out.push(m); return out; };

// melodies: [midi, beat, lengthInBeats] per bar
const THEME = [
  [[72, 0, 1], [69, 1, 0.5], [72, 1.5, 0.5], [77, 2, 1], [76, 3, 0.5], [74, 3.5, 0.5]],
  [[72, 0, 1], [69, 1, 0.5], [65, 1.5, 0.5], [69, 2, 1.5], [67, 3.5, 0.5]],
  [[70, 0, 0.5], [74, 0.5, 0.5], [77, 1, 1], [76, 2, 0.5], [74, 2.5, 0.5], [72, 3, 1]],
  [[74, 0, 0.5], [72, 0.5, 0.5], [70, 1, 0.5], [69, 1.5, 0.5], [67, 2, 2]],
];
const THEME_END = [[67, 0, 0.5], [69, 0.5, 0.5], [70, 1, 0.5], [72, 1.5, 0.5], [77, 2, 2]];
const CHORUS = [
  [[77, 0, 1.5], [76, 1.5, 0.5], [74, 2, 1], [72, 3, 1]],
  [[72, 0, 1.5], [74, 1.5, 0.5], [76, 2, 1], [79, 3, 1]],
  [[81, 0, 1.5], [79, 1.5, 0.5], [76, 2, 1], [72, 3, 1]],
  [[74, 0, 3], [72, 3, 0.5], [74, 3.5, 0.5]],
  [[77, 0, 1.5], [76, 1.5, 0.5], [74, 2, 1], [77, 3, 1]],
  [[79, 0, 1.5], [81, 1.5, 0.5], [79, 2, 1], [76, 3, 1]],
  [[77, 0, 4]],
  [[77, 0, 0.5], [81, 0.5, 0.5], [84, 1, 3]],
];
const melody = (bar, notes, inst, { gain = 0.3, pan = 0, send = 0.3, oct = 0 } = {}) => {
  for (const [m, b, l] of notes) place(M, inst(mtof(m + oct), l * BEAT, 1), at(bar, b) + hum(), { gain, pan, send });
};

// ---- INTRO (bars 0-3): music box + warm pad
const introCh = ['F', 'Dm', 'Bb', 'C'];
introCh.forEach((ch, i) => {
  place(M, pad(voice(ch, 53, 69).map(mtof), BAR, 1, i === 0 ? 1.6 : 0.5, 1.2, 1100), at(i), { gain: 0.07, send: 0.5 });
  melody(i, THEME[i], celesta, { gain: 0.2, send: 0.55, pan: 0.1 });
  // soft broken-chord harp
  voice(ch, 60, 77).slice(0, 4).forEach((m, k) => place(M, pluck(mtof(m), 1.2, 0.5, 0.997, 0.35), at(i, k * 0.5 + 2) + hum(), { gain: 0.09, pan: -0.3, send: 0.5 }));
});
place(M, glock(mtof(84), 1), at(0, 0), { gain: 0.1, send: 0.7, pan: 0.4 });
place(M, riser(BAR * 0.75, 0.6, 400, 5000), at(3, 1), { gain: 0.1, send: 0.4 });

// ---- VERSE (bars 4-11): pizzicato groove
const verseCh = ['F', 'Am', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C'];
verseCh.forEach((ch, i) => {
  const bar = 4 + i;
  const r = ROOT[ch];
  place(M, pad(voice(ch, 53, 69).map(mtof), BAR, 1, 0.4, 0.9, 1100), at(bar), { gain: 0.1, send: 0.45 });
  // pizz bass: root, (fifth), root, fifth
  [[0, r, 1], [1.5, r + 7, 0.5], [2, r, 1], [3, r + 7, 0.5], [3.5, r + 12, 0.5]].forEach(([b, m, l]) =>
    place(M, pluck(mtof(m), l * BEAT, 1, 0.992, 0.7), at(bar, b) + hum(), { gain: 0.34, send: 0.12 }));
  // marimba off-beat chords
  for (const b of [0.5, 1.5, 2.5, 3.5]) voice(ch, 62, 74).slice(0, 3).forEach(m => place(M, marimba(mtof(m), 0.3, 1), at(bar, b) + hum(), { gain: 0.07, pan: 0.35, send: 0.25 }));
  // drums
  for (const b of [0, 2]) place(M, kick(1, 0.4), at(bar, b), { gain: 0.42, send: 0.02 });
  if (i >= 1) for (const b of [1, 3]) place(M, clap(0.8), at(bar, b) + hum(), { gain: 0.16, send: 0.3 });
  for (let b = 0; b < 4; b += 0.5) place(M, shaker(b % 1 ? 1 : 0.6), at(bar, b) + hum(), { gain: 0.09, pan: -0.4, send: 0.1 });
  // melody: glockenspiel + celesta double
  const line = i < 4 ? THEME[i] : i < 7 ? THEME[i - 4] : THEME_END;
  melody(bar, line, glock, { gain: 0.22, send: 0.35, pan: 0.15 });
  melody(bar, line, celesta, { gain: 0.14, send: 0.35, pan: -0.15, oct: -12 });
});

// ---- BREAK (bar 12): everything stops ("But every warren needs a leader…" → "YOU.")
place(M, pad(voice('Csus', 53, 72).map(mtof), BAR * 0.5, 1, 0.3, 0.6, 900), at(12, 0.25), { gain: 0.1, send: 0.7 });
place(M, celesta(mtof(84), 1), at(12, 0.5), { gain: 0.2, send: 0.8 });
place(M, celesta(mtof(79), 1), at(12, 1.25), { gain: 0.16, send: 0.8 });
// YOU hit on beat 2, then tom fill + riser into the chorus
place(M, crash(1, 2.2), at(12, 2), { gain: 0.25, send: 0.4 });
place(M, kick(1.2, 0.8), at(12, 2), { gain: 0.6, send: 0.2 });
[[3, 55], [3.25, 50], [3.5, 45], [3.75, 40]].forEach(([b, f]) => place(M, tom(f * 2, 1), at(12, b), { gain: 0.35, send: 0.25, pan: (b - 3.4) * 1.5 }));
place(M, riser(BEAT * 2, 1, 500, 9000), at(12, 2), { gain: 0.12, send: 0.3 });

// ---- CHORUS (bars 13-20): full band
const chorusCh = ['Bb', 'C', 'Am', 'Dm', 'Bb', 'C', 'F', 'F'];
chorusCh.forEach((ch, i) => {
  const bar = 13 + i;
  const r = ROOT[ch];
  place(M, pad(voice(ch, 53, 72).map(mtof), BAR, 1, 0.15, 0.6, 2400), at(bar), { gain: 0.13, send: 0.4 });
  if (i >= 4) place(M, choir(voice(ch, 60, 72).map(mtof), BAR, 1, 0.5), at(bar), { gain: 0.16, send: 0.6 });
  // bass: 8ths
  for (let b = 0; b < 4; b += 0.5) place(M, subBass(mtof(r + (b % 2 === 1.5 ? 12 : 0)), BEAT * 0.45, 1), at(bar, b), { gain: 0.3, send: 0.02 });
  // harp arpeggio 16ths
  const arp = voice(ch, 65, 84);
  for (let s = 0; s < 16; s++) {
    const idx = s % (arp.length * 2 - 2);
    const m = arp[idx < arp.length ? idx : arp.length * 2 - 2 - idx];
    place(M, pluck(mtof(m), BEAT * 0.3, 0.6, 0.996, 0.45), at(bar, s * 0.25) + hum(), { gain: 0.08, pan: Math.sin(s) * 0.5, send: 0.3 });
  }
  // drums
  for (const b of [0, 1.5, 2]) place(M, kick(1, 0.45), at(bar, b), { gain: 0.55, send: 0.02 });
  for (const b of [1, 3]) { place(M, snare(1), at(bar, b), { gain: 0.3, send: 0.25 }); place(M, clap(1), at(bar, b), { gain: 0.12, send: 0.3 }); }
  for (let b = 0; b < 4; b += 0.5) place(M, hat(b % 1 ? 1 : 0.6, b === 3.5), at(bar, b) + hum(), { gain: 0.1, pan: 0.35, send: 0.05 });
  if (i === 0 || i === 4) place(M, crash(1), at(bar), { gain: 0.24, send: 0.35 });
  // lead
  melody(bar, CHORUS[i], brass, { gain: 0.2, send: 0.3 });
  melody(bar, CHORUS[i], glock, { gain: 0.1, send: 0.4, oct: 12, pan: 0.3 });
});
// fill into bar 21
[[3, 55], [3.25, 50], [3.5, 45], [3.75, 40]].forEach(([b, f]) => place(M, tom(f * 2, 1), at(20, b), { gain: 0.3, send: 0.2, pan: (b - 3.4) * 1.5 }));

// ---- WONDER + BUILD (bars 21-24)
const wonderCh = ['Bb', 'C', 'Dm', 'C'];
wonderCh.forEach((ch, i) => {
  const bar = 21 + i;
  const r = ROOT[ch];
  place(M, pad(voice(ch, 53, 76).map(mtof), BAR, 1, 0.3, 0.8, 2800), at(bar), { gain: 0.15, send: 0.55 });
  place(M, choir(voice(ch, 57, 76).map(mtof), BAR, 1, 0.4), at(bar), { gain: 0.2, send: 0.65 });
  place(M, subBass(mtof(r), BAR * 0.95, 1), at(bar), { gain: 0.28, send: 0.02 });
  const arp = voice(ch, 67 + i * 2, 88);
  for (let s = 0; s < 16; s++) place(M, pluck(mtof(arp[s % arp.length]), BEAT * 0.3, 0.6, 0.996, 0.5), at(bar, s * 0.25), { gain: 0.08 + i * 0.015, pan: Math.cos(s) * 0.5, send: 0.35 });
  if (i < 2) {
    place(M, kick(1.1, 0.7), at(bar, 0), { gain: 0.55, send: 0.1 });
    place(M, snare(1), at(bar, 2), { gain: 0.3, send: 0.45 });
    melody(bar, i === 0 ? [[77, 0, 2], [81, 2, 2]] : [[79, 0, 2], [84, 2, 2]], glock, { gain: 0.2, send: 0.6 });
  } else {
    for (let b = 0; b < 4; b++) place(M, kick(1, 0.4), at(bar, b), { gain: 0.5, send: 0.02 });
    const step = i === 2 ? 0.5 : 0.25;
    for (let b = 0; b < (i === 3 ? 3.5 : 4); b += step) place(M, snare(0.5 + (b / 4) * 0.5 + (i - 2) * 0.3), at(bar, b), { gain: 0.22, send: 0.3 });
  }
});
place(M, riser(BAR * 2 - BEAT * 0.5, 1, 200, 12000), at(23), { gain: 0.2, send: 0.3 });
place(M, crash(1, 1.5), at(21), { gain: 0.26, send: 0.4 });

// ---- TITLE (bars 25-28): the theme, big
const titleCh = ['F', 'C', 'Dm', 'Bb'];
titleCh.forEach((ch, i) => {
  const bar = 25 + i;
  const r = ROOT[ch];
  place(M, pad(voice(ch, 53, 76).map(mtof), BAR, 1, 0.08, 0.9, 3000), at(bar), { gain: 0.16, send: 0.45 });
  place(M, choir(voice(ch, 60, 76).map(mtof), BAR, 1, 0.2), at(bar), { gain: 0.2, send: 0.6 });
  for (let b = 0; b < 4; b += 0.5) place(M, subBass(mtof(r + (b === 1.5 || b === 3.5 ? 12 : 0)), BEAT * 0.45, 1), at(bar, b), { gain: 0.32, send: 0.02 });
  for (const b of [0, 1.5, 2, 2.75]) place(M, kick(1, 0.45), at(bar, b), { gain: 0.56, send: 0.02 });
  for (const b of [1, 3]) { place(M, snare(1), at(bar, b), { gain: 0.32, send: 0.3 }); place(M, clap(1), at(bar, b), { gain: 0.14, send: 0.3 }); }
  for (let b = 0; b < 4; b += 0.5) place(M, hat(b % 1 ? 1 : 0.6), at(bar, b) + hum(), { gain: 0.11, pan: 0.35, send: 0.05 });
  melody(bar, THEME[i], brass, { gain: 0.22, send: 0.35, oct: 12 });
  melody(bar, THEME[i], celesta, { gain: 0.16, send: 0.45, oct: 12, pan: -0.3 });
  const arp = voice(ch, 65, 86);
  for (let s = 0; s < 16; s++) place(M, pluck(mtof(arp[(s * 3) % arp.length]), BEAT * 0.3, 0.6, 0.996, 0.5), at(bar, s * 0.25), { gain: 0.07, pan: Math.sin(s * 1.7) * 0.6, send: 0.3 });
});
place(M, crash(1, 3), at(25), { gain: 0.3, send: 0.5 });

// ---- OUTRO (bars 29-31): back to the music box
['F', 'Bb', 'F'].forEach((ch, i) => {
  const bar = 29 + i;
  place(M, pad(voice(ch, 53, 72).map(mtof), i === 2 ? BAR + 2 : BAR, 1, 0.3, 2.5, 1400), at(bar), { gain: 0.14, send: 0.6 });
  if (i === 0) melody(bar, THEME[0], celesta, { gain: 0.3, send: 0.6 });
  if (i === 1) melody(bar, THEME_END, celesta, { gain: 0.3, send: 0.6 });
  if (i === 2) {
    place(M, subBass(mtof(41), BAR * 1.2, 1), at(bar), { gain: 0.2 });
    [65, 69, 72, 77, 81, 84, 89].forEach((m, k) => place(M, celesta(mtof(m), 2, 1), at(bar, k * 0.2), { gain: 0.16, send: 0.7, pan: (k - 3) * 0.12 }));
  }
});
place(M, crash(0.6, 3), at(29), { gain: 0.15, send: 0.6 });

writeWav(path.join(OUT, 'music.wav'), master(M, { wet: 0.3 }));

// ------------------------------------------------------------------ sound effects
function sfx(name, sec, draw, opts) {
  const m = makeMix(sec);
  draw(m);
  writeWav(path.join(OUT, `sfx-${name}.wav`), master(m, { wet: 0.25, drive: 1.1, target: 0.9, ...opts }));
}
sfx('whoosh', 1.2, m => {
  const b = buf(1.0);
  const flt = sweepFilter('bp', t => 300 * Math.pow(20, Math.sin(Math.PI * Math.min(1, t / 0.9)) ), 1.8);
  for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = flt(noise(), t) * Math.sin(Math.PI * Math.min(1, t / 0.9)) ** 2 * 2; }
  place(m, b, 0, { gain: 1, send: 0.2 });
});
sfx('impact', 4.5, m => {
  place(m, boom(1, 4), 0, { gain: 1, send: 0.35 });
  place(m, crash(1, 3), 0, { gain: 0.5, send: 0.5 });
  place(m, kick(1.4, 0.8), 0, { gain: 0.8, send: 0.1 });
}, { wet: 0.4 });
sfx('pop', 0.4, m => {
  const b = buf(0.25);
  let ph = 0;
  for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (500 + 1400 * Math.min(1, t / 0.05)) / SR; b[i] = Math.sin(TAU * ph) * Math.exp(-t * 22); }
  place(m, b, 0, { gain: 0.8, send: 0.15 });
});
sfx('boing', 0.9, m => {
  const b = buf(0.8);
  let ph = 0;
  for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (220 + 180 * Math.exp(-t * 4) + 70 * Math.sin(TAU * 18 * t) * Math.exp(-t * 3)) / SR; b[i] = (Math.sin(TAU * ph) + 0.3 * Math.sin(TAU * ph * 2)) * Math.exp(-t * 4.5); }
  place(m, b, 0, { gain: 0.7, send: 0.15 });
});
sfx('thump', 0.6, m => { place(m, kick(1, 0.4), 0, { gain: 1, send: 0.05 }); place(m, kick(0.6, 0.3), 0.14, { gain: 0.7, send: 0.05 }); });
sfx('sparkle', 1.8, m => { [84, 88, 91, 96, 100].forEach((n, k) => place(m, glock(mtof(n), 0.5), k * 0.06, { gain: 0.35, send: 0.5, pan: (k - 2) * 0.3 })); }, { wet: 0.4 });
sfx('love', 1.6, m => { [[76, 0], [81, 0.12], [88, 0.24]].forEach(([n, t]) => place(m, celesta(mtof(n), 0.4), t, { gain: 0.5, send: 0.5 })); });
sfx('dig', 0.6, m => {
  for (let k = 0; k < 3; k++) {
    const b = buf(0.12), lp = biquad('lp', 1200 + k * 400);
    for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = lp(noise()) * Math.exp(-t * 35) * 2; }
    place(m, b, k * 0.11, { gain: 0.8, send: 0.1, pan: (k - 1) * 0.3 });
  }
});
sfx('scratch', 0.7, m => {
  const b = buf(0.55);
  const flt = sweepFilter('bp', t => 900 + 1400 * Math.sin(TAU * 7 * t), 3);
  for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = flt(noise(), t) * 3 * Math.exp(-t * 3) * (0.6 + 0.4 * Math.sin(TAU * 14 * t)); }
  place(m, b, 0, { gain: 0.8, send: 0.1 });
});
sfx('click', 0.2, m => { place(m, marimba(mtof(96), 0.05), 0, { gain: 0.5, send: 0.05 }); });
sfx('build', 1.8, m => {
  for (let k = 0; k < 4; k++) place(m, tom(180 + k * 20, 0.8), k * 0.1, { gain: 0.5, send: 0.1 });
  [72, 76, 79, 84].forEach((n, k) => place(m, glock(mtof(n), 0.4), 0.45 + k * 0.08, { gain: 0.35, send: 0.4 }));
});
sfx('boop', 1.2, m => {
  const b = buf(0.5);
  let ph = 0;
  for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (330 + 330 * Math.exp(-t * 18)) / SR; b[i] = Math.sin(TAU * ph) * Math.exp(-t * 7); }
  place(m, b, 0, { gain: 0.8, send: 0.3 });
  place(m, glock(mtof(96), 0.4), 0.12, { gain: 0.2, send: 0.5 });
});
sfx('riser', 3.2, m => { place(m, riser(3, 1, 200, 12000), 0, { gain: 1, send: 0.3 }); });
