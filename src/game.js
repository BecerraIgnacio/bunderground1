// Shared runtime state + helpers used by sim, render and UI.
import { W, H, EX, BASE_CAP, PANTRY_CAP, RESOURCES, ROOMS, TRAITS, ADULT_AGE, ELDER_AGE } from './data.js';
import { idx, reachFrom } from './world.js';

export const G = {
  state: null,
  roomAt: new Int32Array(W * H),     // room id per cell (0 = none)
  reach: new Uint8Array(W * H),      // cells reachable from the entrance
  claims: new Map(),                 // dig cell -> rabbit id
  spots: new Map(),                  // "room:kind:i" -> rabbit id
  dirty: { terrain: true, rooms: true },
  paused: false,
  modal: false,
  speed: 1,
  demo: false,                       // background colony on title screen
};

const listeners = {};
export const on = (e, f) => (listeners[e] ||= []).push(f);
export const emit = (e, d) => (listeners[e] || []).forEach(f => f(d));

export function fmtHour(h) {
  const hh = Math.floor(h), mm = Math.floor(((h - hh) * 60) / 10) * 10;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function notify(text, kind = 'info', focus = null) {
  const s = G.state;
  if (!s || G.demo) return;
  s.log.unshift({ t: `Day ${s.time.day}, ${fmtHour(s.time.hour)}`, text, kind });
  if (s.log.length > 60) s.log.length = 60;
  emit('toast', { text, kind, focus });
}

export function rebuildRoomAt() {
  G.roomAt.fill(0);
  for (const r of G.state.rooms) {
    for (let dx = 0; dx < r.w; dx++) for (let dy = 0; dy < r.h; dy++) G.roomAt[idx(r.x + dx, r.y - dy)] = r.id;
  }
}
export function updateReach() { G.reach = reachFrom(G.state.grid.mat, idx(EX, 0)); }

export const roomById = id => G.state.rooms.find(r => r.id === id);
export const rabbitById = id => G.state.rabbits.find(r => r.id === id);
export const builtRooms = type => G.state.rooms.filter(r => r.built && (!type || r.type === type));
export const countRooms = type => builtRooms(type).length;

export function cap(res) {
  if (RESOURCES.find(r => r.id === res)?.nocap) return Infinity;
  return BASE_CAP + countRooms('pantry') * PANTRY_CAP;
}
export function addRes(res, n) {
  const s = G.state, before = s.res[res];
  s.res[res] = Math.max(0, Math.min(Math.max(cap(res), before), before + n));
  return s.res[res] - before;
}
export const canAfford = cost => Object.entries(cost).every(([k, v]) => G.state.res[k] >= v);
export function pay(cost) { for (const [k, v] of Object.entries(cost)) G.state.res[k] -= v; }
export function refund(cost, f) { for (const [k, v] of Object.entries(cost)) addRes(k, Math.floor(v * f)); }

export const isNight = h => h >= 21.5 || h < 6;
export function workHours() {
  const p = G.state.policies.hours;
  return p === 'short' ? [8, 18] : p === 'long' ? [6, 21] : [7, 19.5];
}
export const isKit = r => r.age < ADULT_AGE;
export const isElder = r => r.age >= ELDER_AGE;
export const adults = () => G.state.rabbits.filter(r => !isKit(r));
export const kits = () => G.state.rabbits.filter(isKit);
export const totalBeds = () => builtRooms('burrow').length * ROOMS.burrow.beds.length;

export function stage(r) { return isKit(r) ? 'Kit' : isElder(r) ? 'Elder' : 'Adult'; }

export function chief() { return G.state.chief ? rabbitById(G.state.chief) : null; }
export function chiefBonus(r = chief()) {
  if (!r) return null;
  for (const t of r.traits) if (TRAITS[t]?.chief) return { trait: t, ...TRAITS[t].chief };
  return { trait: null, mood: 3, desc: '+3 mood for everyone' };
}

// multiplicative colony modifier from chief + colony buffs
export function mult(key) {
  let m = 1;
  const cb = chiefBonus();
  if (cb && typeof cb[key] === 'number' && key !== 'mood') m *= cb[key];
  for (const b of G.state.buffs) if (b.mods[key]) m *= b.mods[key];
  return m;
}
export function colonyMood() {
  const s = G.state;
  let m = 0;
  const cb = chiefBonus();
  if (cb?.mood) m += cb.mood;
  for (const b of s.buffs) if (b.mods.mood) m += b.mods.mood;
  if (s.policies.hours === 'short') m += 5;
  if (s.policies.hours === 'long') m -= 8;
  if (s.policies.rations === 'lean') m -= 6;
  if (s.policies.rations === 'feast') m += 6;
  return m;
}

export function rel(a, b) { return a.rel[b.id] || 0; }
export function addRel(a, b, v) {
  a.rel[b.id] = Math.max(-100, Math.min(100, (a.rel[b.id] || 0) + v));
  b.rel[a.id] = Math.max(-100, Math.min(100, (b.rel[a.id] || 0) + v));
}
export function friendsOf(r) {
  return G.state.rabbits.filter(o => o !== r && rel(r, o) >= 40);
}
export const skillLevel = xp => Math.min(10, Math.floor(Math.sqrt(xp / 3)));

export function esteem(r) {
  let e = 0;
  for (const v of Object.values(r.skills)) e += skillLevel(v) * 2;
  e += friendsOf(r).length * 3;
  if (r.partner) e += 4;
  e += Math.min(15, r.age / 3);
  if (r.traits.includes('cheerful')) e += 3;
  if (r.traits.includes('grumpy')) e -= 3;
  return Math.round(e);
}
export function rankOf(r) {
  if (G.state.chief === r.id) return '👑 Chief';
  if (isKit(r)) return 'Kit';
  const e = esteem(r);
  if (isElder(r) && e >= 20) return 'Elder Sage';
  return e < 10 ? 'Burrower' : e < 20 ? 'Warren Hand' : e < 32 ? 'Artisan' : e < 45 ? 'Respected' : 'Notable';
}
export const fullName = r => `${r.name} ${r.clan}`;
