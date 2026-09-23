// Local-device persistence (localStorage). No server, no DB.
import { G } from './game.js';

const KEY = 'bunderground.save.v1';
const TRANSIENT = ['task', 'path', 'moving', 'climb', 'sleeping', 'emote', 'digUp'];

export function saveGame() {
  if (!G.state || G.demo) return false;
  try {
    const s = G.state;
    const data = {
      ...s,
      savedAt: Date.now(),
      rabbits: s.rabbits.map(r => {
        const o = { ...r };
        for (const k of TRANSIENT) delete o[k];
        return o;
      }),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.v !== 1 || !s.grid || !Array.isArray(s.rabbits)) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveInfo() {
  const s = loadGame();
  if (!s) return null;
  return { name: s.name, day: s.time.day, pop: s.rabbits.length, savedAt: s.savedAt };
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function exportSave() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return;
  const blob = new Blob([raw], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bunderground-${(G.state?.name || 'warren').replace(/\W+/g, '-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function importSave(text) {
  const s = JSON.parse(text);
  if (s.v !== 1 || !s.grid || !Array.isArray(s.rabbits)) throw new Error('Not a Bunderground save');
  localStorage.setItem(KEY, text);
  return s;
}

export const prefs = {
  get(k, d) { try { const v = localStorage.getItem('bunderground.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('bunderground.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};
