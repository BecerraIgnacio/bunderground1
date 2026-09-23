// Rabbit creation, needs and task AI.
import {
  W, H, EX, ROOMS, JOBS, TRAITS, TRAIT_CONFLICTS, COATS, NAMES, CLANS, IDLE_THOUGHTS, MATS, ORES, MAT, ORE, RES_ICON,
} from './data.js';
import { idx, inb, cellX, floorY, DIRS, bfs, cellsWithin } from './world.js';
import {
  G, emit, notify, roomById, rabbitById, builtRooms, addRes, cap, isNight, workHours, isKit, isElder, mult, colonyMood,
  rel, addRel, skillLevel, kits, updateReach,
} from './game.js';

const rnd = Math.random;
export const pick = a => a[Math.floor(rnd() * a.length)];
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

const WORK_THOUGHTS = {
  farmer: 'Grow, little carrots, grow! 🌱',
  cook: 'A pinch of clover, a dash of love... 🍲',
  engineer: 'Clank clank! Gears coming up ⚙️',
  caretaker: 'Who wants a bedtime story? 🧸',
};

export function rollTraits(n = 2, seedTraits = []) {
  const keys = Object.keys(TRAITS);
  const out = [];
  for (const t of seedTraits) if (out.length < n && !out.includes(t)) out.push(t);
  let guard = 0;
  while (out.length < n && guard++ < 100) {
    const t = pick(keys);
    if (out.includes(t)) continue;
    if (TRAIT_CONFLICTS.some(p => p.includes(t) && p.some(o => o !== t && out.includes(o)))) continue;
    out.push(t);
  }
  return out;
}

function pickName() {
  const used = new Set(G.state.rabbits.map(r => r.name));
  const free = NAMES.filter(n => !used.has(n));
  return pick(free.length ? free : NAMES);
}

export function makeRabbit(opt = {}) {
  const s = G.state;
  const r = {
    id: s.nextId++,
    name: opt.name || pickName(),
    clan: opt.clan || pick(CLANS),
    sex: opt.sex || (rnd() < 0.5 ? 'm' : 'f'),
    age: opt.age ?? 8 + rnd() * 18,
    lifespan: 75 + rnd() * 25,
    coat: opt.coat ?? Math.floor(rnd() * COATS.length),
    traits: opt.traits || rollTraits(),
    job: opt.job || 'free',
    skills: { builder: 0, farmer: 0, cook: 0, engineer: 0, caretaker: 0 },
    needs: { hunger: 65 + rnd() * 30, energy: 70 + rnd() * 25, social: 55 + rnd() * 35 },
    mood: 65, low: 0, starving: 0,
    rel: {}, partner: 0, parents: opt.parents || null,
    cx: opt.x ?? EX, cy: opt.y ?? 0,
    bed: null, buffs: [], kit: false, lastBirth: 0,
    thought: opt.thought || 'Hello, warren!',
  };
  for (const t of r.traits) { const sk = TRAITS[t].skill; if (sk) for (const k in sk) r.skills[k] = 12; }
  placeAtCell(r);
  if (opt.fromSurface) { r.wy = 0.15; r.wz = 0; }
  return r;
}

export function placeAtCell(r) {
  r.wx = cellX(r.cx) + (rnd() - 0.5) * 0.4;
  r.wy = floorY(r.cy);
  r.wz = 0.1 + rnd() * 0.25;
  r.task = null; r.path = []; r.face = 0;
}

// ---------- modifiers ----------
function tmod(r, key) {
  let m = 1;
  for (const t of r.traits) { const v = TRAITS[t]?.[key]; if (typeof v === 'number') m *= v; }
  return m;
}
function traitMood(r) {
  let m = 0;
  for (const t of r.traits) m += TRAITS[t]?.mood || 0;
  return m;
}
export function workMult(r, job) {
  let m = tmod(r, 'work');
  for (const t of r.traits) { const sk = TRAITS[t]?.skill; if (sk?.[job]) m *= sk[job]; }
  m *= 1 + 0.08 * skillLevel(r.skills[job] || 0);
  m *= 0.6 + 0.8 * r.mood / 100;
  if (isElder(r)) m *= 0.75;
  m *= mult('work');
  const key = { farmer: 'farm', cook: 'cook', engineer: 'factory', builder: 'dig' }[job];
  if (key) m *= mult(key);
  return m;
}
const speed = r => (isKit(r) ? 7 : isElder(r) ? 7.5 : 10);

export function addBuff(r, id, label, v, hours) {
  r.buffs = r.buffs.filter(b => b.id !== id);
  r.buffs.push({ id, label, v, h: hours });
}

export function hasBed(r) {
  if (!r.bed) return false;
  const room = roomById(r.bed.roomId);
  return !!(room && room.built && room.type === 'burrow');
}
export function ensureBed(r) {
  const s = G.state;
  const takenBy = (roomId, i) => s.rabbits.some(o => o !== r && o.bed && o.bed.roomId === roomId && o.bed.i === i);
  if (hasBed(r) && !takenBy(r.bed.roomId, r.bed.i)) return r.bed;
  r.bed = null;
  const burrows = builtRooms('burrow');
  const partner = r.partner && rabbitById(r.partner);
  if (partner?.bed) burrows.sort((a, b) => (b.id === partner.bed.roomId) - (a.id === partner.bed.roomId));
  for (const b of burrows) {
    for (let i = 0; i < ROOMS.burrow.beds.length; i++) {
      if (!takenBy(b.id, i)) { r.bed = { roomId: b.id, i }; return r.bed; }
    }
  }
  return null;
}

export function moodTarget(r) {
  let m = 50 + (r.needs.hunger - 50) * 0.35 + (r.needs.energy - 50) * 0.2 + (r.needs.social - 50) * 0.3;
  m += traitMood(r) + colonyMood();
  for (const b of r.buffs) m += b.v;
  if (!isKit(r) && !hasBed(r)) m -= 8;
  if (r.partner) m += 4;
  let friends = 0;
  for (const k in r.rel) if (r.rel[k] >= 40) friends++;
  m += Math.min(8, friends * 2);
  return m;
}

// ---------- helpers ----------
function roomSpot(room, sx, sz) {
  const col = room.x + Math.max(0, Math.min(room.w - 1, Math.floor(sx)));
  return { x: cellX(room.x) - 0.5 + sx, y: floorY(room.y), z: sz, ci: idx(col, room.y) };
}
function freeSpot(room, kind) {
  const list = ROOMS[room.type][kind];
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const key = `${room.id}:${kind}:${i}`;
    if (!G.spots.has(key)) return { ...list[i], key };
  }
  return null;
}
function findRoom(r, pred) {
  const res = bfs(G.state.grid.mat, idx(r.cx, r.cy), i => {
    const id = G.roomAt[i];
    if (!id) return false;
    const room = roomById(id);
    return !!room && pred(room);
  });
  return res ? roomById(G.roomAt[res.goal]) : null;
}
const nearestRoom = (r, types, filter) =>
  findRoom(r, rm => rm.built && types.includes(rm.type) && (!filter || filter(rm)));

function setPath(r, cells, final) {
  const mat = G.state.grid.mat;
  const pts = [];
  let prev = idx(r.cx, r.cy);
  const vertical = (a, b) => Math.abs(a - b) === W;
  // step back to the current cell centre if the first move is a climb
  if (cells.length && vertical(prev, cells[0])) pts.push({ x: cellX(r.cx), y: floorY(r.cy), z: -0.3 });
  for (let k = 0; k < cells.length; k++) {
    const ci = cells[k], next = cells[k + 1];
    const climb = vertical(prev, ci) || (next !== undefined && vertical(ci, next));
    pts.push({
      x: cellX(ci % W) + (climb ? 0 : (rnd() - 0.5) * 0.2),
      y: floorY((ci / W) | 0),
      z: climb ? -0.3 : 0.12 + rnd() * 0.18,
      ci,
    });
    prev = ci;
  }
  if (final) pts.push(final);
  r.path = pts;
  void mat;
}
function goTo(r, target, final) {
  const res = bfs(G.state.grid.mat, idx(r.cx, r.cy), i => i === target);
  if (!res) return false;
  setPath(r, res.path, final);
  return true;
}
function moveAlong(r, dh) {
  let dist = speed(r) * dh;
  r.moving = false; r.climb = false;
  while (dist > 1e-6 && r.path.length) {
    const p = r.path[0];
    const dx = p.x - r.wx, dy = p.y - r.wy, dz = p.z - r.wz;
    const d = Math.hypot(dx, dy, dz);
    r.moving = true;
    if (Math.abs(dy) > 0.05 && Math.abs(dy) > Math.abs(dx)) r.climb = true;
    else if (Math.abs(dx) > 0.02) r.face = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
    const step = r.climb ? dist * 0.7 : dist;
    if (d <= step) {
      r.wx = p.x; r.wy = p.y; r.wz = p.z;
      dist -= r.climb ? d / 0.7 : d;
      if (p.ci !== undefined) { r.cx = p.ci % W; r.cy = (p.ci / W) | 0; }
      r.path.shift();
    } else {
      const k = step / d;
      r.wx += dx * k; r.wy += dy * k; r.wz += dz * k;
      dist = 0;
    }
  }
  return r.path.length === 0;
}

function endTask(r) {
  const T = r.task;
  if (T) {
    if (T.spotKey && G.spots.get(T.spotKey) === r.id) G.spots.delete(T.spotKey);
    if (T.cell != null && G.claims.get(T.cell) === r.id) G.claims.delete(T.cell);
    if (T.kind === 'sleep' && T.phase === 'do' && !T.bed && !isKit(r)) addBuff(r, 'floor', 'Slept on the floor', -8, 12);
  }
  r.task = null; r.path = []; r.sleeping = false; r.emote = null;
}
export const releaseRabbit = endTask;

function related(a, b) {
  return (a.parents && a.parents.includes(b.id)) || (b.parents && b.parents.includes(a.id)) ||
    (a.parents && b.parents && a.parents.some(p => b.parents.includes(p)));
}
export function bond(a, b, v) {
  let m = tmod(a, 'affinity') * tmod(b, 'affinity');
  if (a.clan === b.clan) m *= 1.2;
  const romantic = a.sex !== b.sex && !isKit(a) && !isKit(b);
  if (romantic) m *= tmod(a, 'romance') * tmod(b, 'romance');
  addRel(a, b, v * m);
  if (romantic && !a.partner && !b.partner && rel(a, b) >= 60 && !related(a, b)) {
    a.partner = b.id; b.partner = a.id;
    addBuff(a, 'love', 'Fell in love', 10, 48);
    addBuff(b, 'love', 'Fell in love', 10, 48);
    notify(`💕 ${a.name} and ${b.name} became partners!`, 'love');
    emit('heart', { x: (a.wx + b.wx) / 2, y: a.wy + 0.7, z: a.wz });
  }
}

const hasFood = () => G.state.res.carrots >= 1 || G.state.res.stew >= 1;

// ---------- decisions ----------
function decide(r) {
  const s = G.state, h = s.time.hour, night = isNight(h), kit = isKit(r);
  const eatAt = s.policies.rations === 'lean' ? 15 : s.policies.rations === 'feast' ? 45 : 28;
  if (r.needs.hunger < eatAt) {
    if (startEat(r)) return;
    r.thought = "I'm so hungry... is there any food? 😟";
  }
  if (r.needs.energy < 18 || (night && r.needs.energy < 95)) { startSleep(r); return; }
  if (kit) { if (startPlay(r)) return; startWander(r); return; }
  const [ws, we] = workHours();
  const workTime = h >= ws && h < we;
  if (r.needs.social < 30 && startSocial(r)) return;
  if (workTime && startWork(r)) return;
  if (!workTime && r.needs.social < 85 && rnd() < 0.6 && startSocial(r)) return;
  startWander(r);
}

function startEat(r) {
  const s = G.state;
  let food = null, room = null;
  if (s.res.stew >= 1) { room = nearestRoom(r, ['kitchen']); if (room) food = 'stew'; }
  if (!food && s.res.carrots >= 1) { food = 'carrot'; room = nearestRoom(r, ['pantry', 'kitchen', 'farm']); }
  if (!food && s.res.stew >= 1) food = 'stew';
  if (!food) return false;
  r.task = { kind: 'eat', food, roomId: room ? room.id : 0, phase: 'go', t: 0 };
  r.path = [];
  if (room) {
    const sp = roomSpot(room, 0.3 + rnd() * (room.w - 0.6), 0.34 + rnd() * 0.12);
    if (!goTo(r, sp.ci, sp)) r.task.roomId = 0;
  }
  r.thought = food === 'stew' ? 'Stew time! 🍲' : 'Munch munch... 🥕';
  return true;
}

function startSleep(r) {
  let sp = null, roomId = 0, bed = false, key = null;
  if (isKit(r)) {
    const room = nearestRoom(r, ['nursery'], rm => freeSpot(rm, 'cradles'));
    if (room) {
      const f = freeSpot(room, 'cradles');
      key = f.key; sp = roomSpot(room, f.x, f.z); roomId = room.id; bed = true;
    } else {
      const b = nearestRoom(r, ['burrow']);
      if (b) { sp = roomSpot(b, 0.2 + rnd() * 1.6, 0.0); roomId = b.id; bed = true; }
    }
  } else {
    const b = ensureBed(r);
    if (b) {
      const room = roomById(b.roomId), d = ROOMS.burrow.beds[b.i];
      sp = roomSpot(room, d.x, d.z); roomId = room.id; bed = true;
    }
  }
  r.task = { kind: 'sleep', phase: 'go', t: 0, roomId, bed, spotKey: key };
  if (key) G.spots.set(key, r.id);
  r.path = [];
  if (sp && !goTo(r, sp.ci, sp)) { r.task.bed = false; r.task.roomId = 0; }
  r.thought = r.task.bed ? 'Time for a cozy nap... 💤' : 'No bed for me... floor it is. 😢';
  return true;
}

function startSocial(r) {
  const room = nearestRoom(r, ['lounge', 'council'], rm => freeSpot(rm, 'seats'));
  if (!room) return false;
  const f = freeSpot(room, 'seats');
  G.spots.set(f.key, r.id);
  const sp = roomSpot(room, f.x, f.z);
  r.task = { kind: 'social', phase: 'go', t: 0, roomId: room.id, spotKey: f.key, dur: 1.5 + rnd() * 1.2 };
  if (!goTo(r, sp.ci, sp)) { endTask(r); return false; }
  r.thought = pick(["Let's catch up!", 'Tea and gossip time ☕', 'I missed everyone!', 'Did you hear the news?']);
  return true;
}

function startPlay(r) {
  const room = nearestRoom(r, ['nursery', 'lounge']);
  if (!room) return false;
  const sp = roomSpot(room, 0.3 + rnd() * (room.w - 0.6), 0.1 + rnd() * 0.3);
  r.task = { kind: 'play', phase: 'go', t: 0, roomId: room.id, dur: 1 + rnd() * 1.5 };
  if (!goTo(r, sp.ci, sp)) { endTask(r); return false; }
  r.thought = pick(['Wheee! 🎈', 'Tag, you\'re it!', 'Look how high I can hop!']);
  return true;
}

function startWander(r) {
  const s = G.state, mat = s.grid.mat;
  const cells = cellsWithin(mat, idx(r.cx, r.cy), 5);
  const floored = cells.filter(i => {
    const y = (i / W) | 0;
    return y + 1 < H && mat[i + W] !== MAT.AIR && !(i % W === EX && y === 0);
  });
  const target = pick(floored.length ? floored : cells);
  const tx = target % W, ty = (target / W) | 0;
  const final = { x: cellX(tx) + (rnd() - 0.5) * 0.6, y: floorY(ty), z: 0.05 + rnd() * 0.35 };
  r.task = { kind: 'idle', phase: 'go', t: 0, dur: 0.6 + rnd() * 1.2 };
  if (!goTo(r, target, final)) r.path = [];
  if (rnd() < 0.35) r.thought = pick(IDLE_THOUGHTS);
  return true;
}

function startWork(r) {
  const job = r.job;
  if (job === 'builder') { if (startBuild(r) || startDig(r)) return true; }
  else if (job !== 'free') { if (startRoomWork(r, job)) return true; }
  return freeWork(r, job !== 'free');
}
function freeWork(r, fallback) {
  const s = G.state;
  const foodLow = s.res.carrots + s.res.stew * 2 < s.rabbits.length * 4;
  if (foodLow && startRoomWork(r, 'farmer')) return true;
  if (startBuild(r) || startDig(r)) return true;
  if (startRoomWork(r, 'farmer')) return true;
  if (s.res.carrots >= 10 && s.res.stew < 10 && startRoomWork(r, 'cook')) return true;
  if (fallback) r.thought = `No ${JOBS[r.job].name.toLowerCase()} work right now...`;
  return false;
}

function startRoomWork(r, job) {
  const s = G.state, type = JOBS[job].room;
  if (job === 'cook' && (s.res.carrots < 2 || s.res.stew >= cap('stew'))) return false;
  if (job === 'engineer' && (s.res.copper < 1 || s.res.stone < 1 || s.res.gears >= cap('gears'))) return false;
  if (job === 'caretaker' && !kits().length) return false;
  if (job === 'farmer' && s.res.carrots >= cap('carrots')) return false;
  const room = nearestRoom(r, [type], rm => freeSpot(rm, 'spots'));
  if (!room) return false;
  const f = freeSpot(room, 'spots');
  G.spots.set(f.key, r.id);
  const sp = roomSpot(room, f.x, f.z);
  r.task = { kind: 'work', job, phase: 'go', t: 0, roomId: room.id, spotKey: f.key, dur: 3, sx: f.x };
  if (!goTo(r, sp.ci, sp)) { endTask(r); return false; }
  r.thought = WORK_THOUGHTS[job];
  return true;
}

const buildersOn = rm => G.state.rabbits.filter(o => o.task && o.task.kind === 'build' && o.task.roomId === rm.id).length;
function startBuild(r) {
  const room = findRoom(r, rm => !rm.built && buildersOn(rm) < 3);
  if (!room) return false;
  const sp = roomSpot(room, 0.3 + rnd() * (room.w - 0.6), 0.3);
  r.task = { kind: 'build', phase: 'go', t: 0, roomId: room.id, dur: 3 };
  if (!goTo(r, sp.ci, sp)) { endTask(r); return false; }
  r.thought = 'Building something wonderful! 🔨';
  return true;
}

function startDig(r) {
  const { mat, mark } = G.state.grid;
  let target = -1;
  const res = bfs(mat, idx(r.cx, r.cy), i => {
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const n = idx(nx, ny);
      if (mark[n] && mat[n] !== MAT.AIR && mat[n] !== MAT.BEDROCK && !G.claims.has(n)) { target = n; return true; }
    }
    return false;
  });
  if (!res) return false;
  G.claims.set(target, r.id);
  const tx = target % W, gx = res.goal % W, gy = (res.goal / W) | 0;
  const final = { x: cellX(gx) + (tx - gx) * 0.28, y: floorY(gy), z: tx === gx ? -0.1 : 0.15 };
  r.task = { kind: 'dig', phase: 'go', t: 0, cell: target, dur: 4 };
  setPath(r, res.path, final);
  r.thought = 'Dig dig dig! ⛏️';
  return true;
}

export function completeRoom(room) {
  const def = ROOMS[room.type];
  room.built = true;
  G.dirty.rooms = true;
  G.state.stats.built++;
  notify(`🏗️ ${def.name} finished!`, 'good');
  emit('built', room);
}

export function digCell(i) {
  const s = G.state, g = s.grid;
  const m = g.mat[i], o = g.ore[i];
  const drops = { ...(MATS[m].drop || {}) };
  if (o && ORES[o]) for (const [k, v] of Object.entries(ORES[o].drop)) drops[k] = (drops[k] || 0) + v;
  g.mat[i] = MAT.AIR; g.ore[i] = 0; g.mark[i] = 0; g.prog[i] = 0;
  G.claims.delete(i);
  const parts = [];
  for (const [k, v] of Object.entries(drops)) {
    const got = addRes(k, v);
    if (got > 0) parts.push(`+${got}${RES_ICON[k]}`);
    if (k === 'copper') s.stats.copper += v;
    if (k === 'crystals') s.stats.crystals += v;
  }
  s.stats.dug++;
  G.dirty.terrain = true;
  updateReach();
  emit('dug', { i, mat: m, ore: o });
  if (parts.length) emit('float', { x: cellX(i % W), y: floorY((i / W) | 0) + 0.7, z: 0.7, text: parts.join(' ') });
  if (o === ORE.CRYSTAL) notify('💎 A glowing Moon Crystal was unearthed!', 'good');
}

// ---------- per-tick ----------
function arrive(r) {
  const T = r.task, s = G.state;
  if (T.kind === 'eat') {
    const eatStew = () => {
      s.res.stew--; r.needs.hunger = clamp(r.needs.hunger + 80);
      addBuff(r, 'stew', 'Ate a hearty stew', 8, 10); r.emote = '🍲';
    };
    if (T.food === 'stew' && s.res.stew >= 1) eatStew();
    else if (s.res.carrots >= 1) { s.res.carrots--; r.needs.hunger = clamp(r.needs.hunger + 35); r.emote = '🥕'; }
    else if (s.res.stew >= 1) eatStew();
    else { r.thought = 'The food is all gone! 😟'; endTask(r); return; }
    if (s.policies.rations === 'feast') r.needs.hunger = clamp(r.needs.hunger + 10);
    if (T.roomId) r.needs.social = clamp(r.needs.social + 6); // mealtime chatter
    r.face = (rnd() - 0.5) * 0.6;
  } else if (T.kind === 'sleep') {
    r.sleeping = true; r.emote = '💤'; r.face = (rnd() - 0.5) * 0.8;
  } else if (T.kind === 'social') {
    r.emote = '💬'; r.face = 0;
  } else if (T.kind === 'play') {
    r.emote = '🎈'; r.face = (rnd() - 0.5);
  } else if (T.kind === 'idle') {
    r.face = (rnd() - 0.5) * 0.9;
  } else if (T.kind === 'work') {
    r.face = T.sx < 1 ? 2.4 : -2.4;
    if (T.job === 'caretaker') r.face = 0;
  } else if (T.kind === 'build') {
    r.face = Math.PI + (rnd() - 0.5);
  }
}

function runTask(r, dh) {
  const T = r.task, s = G.state;
  if (T.roomId && !roomById(T.roomId)) { endTask(r); return; }
  if (T.phase === 'go') {
    if (moveAlong(r, dh)) { T.phase = 'do'; T.t = 0; arrive(r); }
    return;
  }
  r.moving = false; r.climb = false;
  T.t += dh;
  switch (T.kind) {
    case 'eat':
      if (T.t >= 0.6) endTask(r);
      break;
    case 'sleep': {
      r.needs.energy = clamp(r.needs.energy + (T.bed ? 13 : 8) * dh);
      if (isKit(r) || T.roomId) r.needs.social = clamp(r.needs.social + 2 * dh); // cuddled up with the family
      const h = s.time.hour;
      if ((!isNight(h) && r.needs.energy >= 65) || (r.needs.hunger < 8 && hasFood())) endTask(r);
      break;
    }
    case 'social': {
      r.needs.social = clamp(r.needs.social + 22 * tmod(r, 'socialGain') * mult('social') * dh);
      let lover = false;
      for (const o of s.rabbits) {
        if (o === r || !o.task || o.task.kind !== 'social' || o.task.phase !== 'do' || o.task.roomId !== T.roomId) continue;
        bond(r, o, 5 * dh);
        if (o.id === r.partner || rel(r, o) >= 65) lover = true;
      }
      r.emote = lover && Math.floor(s.clock * 3 + r.id) % 3 === 0 ? '❤️' : '💬';
      if (T.t >= T.dur || r.needs.social >= 100) endTask(r);
      break;
    }
    case 'play': {
      r.needs.social = clamp(r.needs.social + 14 * dh);
      for (const o of s.rabbits) {
        if (o !== r && o.task && o.task.roomId === T.roomId && o.task.phase === 'do') bond(r, o, 1.5 * dh);
      }
      if (T.t >= T.dur) endTask(r);
      break;
    }
    case 'idle': {
      for (const o of s.rabbits) {
        if (o === r || Math.abs(o.wx - r.wx) > 1.1 || Math.abs(o.wy - r.wy) > 0.4) continue;
        r.needs.social = clamp(r.needs.social + 5 * dh);
        bond(r, o, 1.5 * dh);
      }
      if (T.t >= T.dur) endTask(r);
      break;
    }
    case 'work': workTick(r, T, dh); break;
    case 'build': {
      const room = roomById(T.roomId);
      if (room.built) { endTask(r); break; }
      room.prog += workMult(r, 'builder') * dh;
      r.skills.builder += dh;
      room.active = s.clock;
      if (rnd() < dh * 4) emit('dust', { x: r.wx + (rnd() - 0.5) * 0.4, y: r.wy + 0.2, z: r.wz - 0.2, color: 0xc8a070 });
      if (room.prog >= ROOMS[room.type].work) { completeRoom(room); endTask(r); }
      else if (T.t >= T.dur) endTask(r);
      break;
    }
    case 'dig': {
      const g = s.grid;
      if (!g.mark[T.cell] || g.mat[T.cell] === MAT.AIR) { endTask(r); break; }
      const tx = T.cell % W, ty = (T.cell / W) | 0;
      r.face = tx > r.cx ? Math.PI / 2 : tx < r.cx ? -Math.PI / 2 : Math.PI;
      r.digUp = ty < r.cy;
      g.prog[T.cell] += workMult(r, 'builder') * dh / MATS[g.mat[T.cell]].hard;
      r.skills.builder += dh;
      if (rnd() < dh * 8) emit('dust', { x: cellX(tx) - (tx - r.cx) * 0.45, y: floorY(ty) + 0.5 - (ty - r.cy) * 0.45, z: 0.3, color: MATS[g.mat[T.cell]].color });
      if (g.prog[T.cell] >= 1) { digCell(T.cell); endTask(r); }
      else if (T.t >= T.dur) endTask(r);
      break;
    }
  }
}

function workTick(r, T, dh) {
  const s = G.state;
  const room = roomById(T.roomId);
  const rate = workMult(r, T.job) * dh;
  r.skills[T.job] += dh;
  room.active = s.clock;
  switch (T.job) {
    case 'farmer':
      room.crop = (room.crop || 0) + rate / 3;
      if (room.crop >= 1) {
        room.crop -= 1;
        const got = addRes('carrots', 4);
        s.stats.carrots += got;
        emit('float', { x: cellX(room.x) - 0.5 + room.w / 2, y: floorY(room.y) + 0.8, z: 0.5, text: `+${got} 🥕` });
        emit('harvest', room);
      }
      if (s.res.carrots >= cap('carrots')) endTask(r);
      break;
    case 'cook':
      room.work = (room.work || 0) + rate;
      if (room.work >= 1.5) {
        room.work -= 1.5;
        if (s.res.carrots >= 2) {
          s.res.carrots -= 2; addRes('stew', 1); s.stats.stew++;
          emit('float', { x: cellX(room.x) - 0.5 + room.w / 2, y: floorY(room.y) + 0.8, z: 0.5, text: '+1 🍲' });
        }
      }
      if (s.res.carrots < 2 || s.res.stew >= cap('stew')) { endTask(r); return; }
      break;
    case 'engineer':
      room.work = (room.work || 0) + rate;
      if (room.work >= 2) {
        room.work -= 2;
        if (s.res.copper >= 1 && s.res.stone >= 1) {
          s.res.copper--; s.res.stone--; addRes('gears', 1); s.stats.gears++;
          emit('float', { x: cellX(room.x) - 0.5 + room.w / 2, y: floorY(room.y) + 0.8, z: 0.5, text: '+1 ⚙️' });
        }
      }
      if (s.res.copper < 1 || s.res.stone < 1 || s.res.gears >= cap('gears')) { endTask(r); return; }
      break;
    case 'caretaker': {
      const ks = kits();
      if (!ks.length) { endTask(r); return; }
      for (const k of ks) { k.age += rate * 0.5 / 24; k.needs.social = clamp(k.needs.social + 6 * dh); }
      break;
    }
  }
  // chatting with co-workers
  for (const o of s.rabbits) {
    if (o !== r && o.task && o.task.kind === 'work' && o.task.roomId === T.roomId && o.task.phase === 'do') {
      r.needs.social = clamp(r.needs.social + 3 * dh);
      bond(r, o, 0.8 * dh);
    }
  }
  if (T.t >= T.dur) endTask(r);
}

export function updateRabbit(r, dh) {
  const T = r.task;
  const sleeping = T && T.kind === 'sleep' && T.phase === 'do';
  const busy = T && (T.kind === 'work' || T.kind === 'dig' || T.kind === 'build') && T.phase === 'do';
  r.age += dh / 24;
  r.needs.hunger = clamp(r.needs.hunger - 4 * tmod(r, 'hunger') * (sleeping ? 0.5 : 1) * (isKit(r) ? 0.8 : 1) * dh);
  if (!sleeping) {
    r.needs.energy = clamp(r.needs.energy - 5 * tmod(r, 'energy') * mult('energy') * (busy ? 1.2 : 1) * dh);
    r.needs.social = clamp(r.needs.social - 3 * tmod(r, 'socialDecay') * dh);
  }
  for (const b of r.buffs) b.h -= dh;
  if (r.buffs.some(b => b.h <= 0)) r.buffs = r.buffs.filter(b => b.h > 0);
  r.mood += (clamp(moodTarget(r)) - r.mood) * Math.min(1, dh * 0.4);
  r.low = r.mood < 15 ? r.low + dh : Math.max(0, r.low - dh * 2);
  r.starving = r.needs.hunger <= 0 ? r.starving + dh : 0;
  if (!r.task) decide(r);
  if (r.task) runTask(r, dh);
}

export function traitList(r) { return r.traits.map(t => TRAITS[t]).filter(Boolean); }
export function coatOf(r) { return COATS[r.coat] || COATS[0]; }
