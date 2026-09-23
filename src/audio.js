// Tiny synthesized sound effects (WebAudio, no assets).
import { prefs } from './save.js';

let ctx = null;
let muted = prefs.get('muted', false);

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.12, slide = 0, delay = 0) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.08) {
  const c = ac();
  if (!c || muted) return;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 900;
  g.gain.value = vol;
  s.buffer = buf;
  s.connect(f).connect(g).connect(c.destination);
  s.start();
}

const SFX = {
  click: () => tone(660, 0.06, 'triangle', 0.08),
  tool: () => tone(520, 0.08, 'triangle', 0.08, 120),
  dig: () => { noise(0.18, 0.1); tone(180, 0.12, 'sine', 0.06, -60); },
  place: () => { tone(400, 0.08, 'square', 0.05); tone(600, 0.1, 'triangle', 0.08, 0, 0.06); },
  built: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.09, 0, i * 0.08)),
  good: () => { tone(784, 0.12, 'triangle', 0.08); tone(1046, 0.18, 'triangle', 0.08, 0, 0.09); },
  love: () => { tone(880, 0.15, 'sine', 0.08); tone(1174, 0.25, 'sine', 0.08, 0, 0.12); },
  bad: () => { tone(330, 0.2, 'triangle', 0.08, -80); tone(247, 0.3, 'triangle', 0.08, -40, 0.15); },
  event: () => [392, 523, 659].forEach((f, i) => tone(f, 0.16, 'sine', 0.09, 0, i * 0.1)),
  error: () => tone(160, 0.15, 'square', 0.05),
  win: () => [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.25, 'triangle', 0.09, 0, i * 0.12)),
};

export function sfx(name) { try { SFX[name]?.(); } catch { /* ignore */ } }
export function isMuted() { return muted; }
export function setMuted(v) { muted = v; prefs.set('muted', v); }
export function unlockAudio() { ac(); }
