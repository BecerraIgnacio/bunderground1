// Colony-level simulation: time, births, arrivals, elections, events, goals, building.
import { W, H, EX, ROOMS, MAT, COATS, ADULT_AGE, RES_ICON, TRAITS, JOBS } from './data.js';
import { idx, inb, generateGrid, HALL_Y, cellX, floorY } from './world.js';
import {
  G, emit, notify, rebuildRoomAt, updateReach, roomById, rabbitById, builtRooms, countRooms, addRes, canAfford, pay,
  refund, isKit, isElder, adults, kits, totalBeds, esteem, chiefBonus, rel, addRel, fullName,
} from './game.js';
import { makeRabbit, updateRabbit, releaseRabbit, ensureBed, addBuff, rollTraits, pick, placeAtCell } from './rabbits.js';

const rnd = Math.random;

export const GOALS = [
  { text: 'Dig 12 tunnel cells', hint: 'Pick ⛏ Dig and drag across the dirt. Diggers do the rest.', prog: s => [s.stats.dug, 12], reward: { clay: 8 } },
  { text: 'Build a second Cozy Burrow', hint: 'Open 🏗 Build. Rooms need dug cells with solid ground below.', prog: () => [countRooms('burrow'), 2], reward: { carrots: 10 } },
  { text: 'Build a Kitchen', hint: 'Stew fills rabbits up and makes them happy.', prog: () => [countRooms('kitchen'), 1], reward: { stone: 6 } },
  { text: 'Cook 6 bowls of stew', hint: 'Click a rabbit and make it a Cook.', prog: s => [s.stats.stew, 6], reward: { clay: 10 } },
  { text: 'Build a Social Lounge', hint: 'Rabbits make friends — and fall in love — while socializing.', prog: () => [countRooms('lounge'), 1], reward: { carrots: 15 } },
  { text: 'Build a Nursery and welcome a kit', hint: 'Happy partners with spare food have kits at night.', prog: s => [s.stats.born, 1], reward: { stew: 6 } },
  { text: 'Grow the warren to 12 rabbits', hint: 'Free beds attract travelers. Kits count too!', prog: s => [s.rabbits.length, 12], reward: { stone: 10 } },
  { text: 'Mine 8 copper', hint: 'Copper veins (orange nuggets) hide in the clay and stone layers.', prog: s => [s.stats.copper, 8], reward: { clay: 15 } },
  { text: 'Build a Gear Factory and make 10 gears', hint: 'Engineers press copper + stone into gears.', prog: s => [s.stats.gears, 10], reward: { copper: 6 } },
  { text: 'Build the Council Hall and elect a Chief', hint: "The Chief's traits boost the whole colony.", prog: s => [s.chief ? 1 : 0, 1], reward: { stew: 10 } },
  { text: 'Grow the warren to 20 rabbits', hint: 'More burrows, high moods and a busy nursery.', prog: s => [s.rabbits.length, 20], reward: { gears: 5 } },
  { text: 'Collect 10 Moon Crystals', hint: 'Glowing blue crystals lie deep in the rock.', prog: s => [s.stats.crystals, 10], reward: { stone: 15 } },
  { text: 'Build the Moonstone Clock', hint: 'The legendary wonder: 40 🪨, 30 ⚙️ and 10 💎.', prog: () => [countRooms('clock'), 1], reward: {} },
];

export const fmtCost = c => Object.entries(c).map(([k, v]) => `${v} ${RES_ICON[k]}`).join('  ');

export function newGame(name, seed = Math.floor(rnd() * 1e9)) {
  const s = {
    v: 1, name, seed,
    time: { day: 1, hour: 7 }, clock: 7,
    res: { carrots: 30, stew: 4, clay: 14, stone: 6, copper: 0, gears: 0, crystals: 0 },
    grid: generateGrid(seed),
    rooms: [], rabbits: [], nextId: 1,
    stats: { dug: 0, stew: 0, gears: 0, copper: 0, crystals: 0, born: 0, joined: 0, left: 0, built: 0, elections: 0, carrots: 0 },
    goal: 0,
    policies: { hours: 'normal', rations: 'normal' },
    chief: 0, lastElection: null,
    buffs: [], log: [],
    nextEvent: 7 + 28,
    won: false,
  };
  G.state = s;
  s.rooms.push({ id: s.nextId++, type: 'burrow', x: EX - 5, y: HALL_Y, w: 2, h: 1, built: true, prog: 4, crop: 0, work: 0 });
  s.rooms.push({ id: s.nextId++, type: 'farm', x: EX + 2, y: HALL_Y, w: 3, h: 1, built: true, prog: 5, crop: 0.4, work: 0 });
  initDerived();
  const jobs = ['builder', 'builder', 'farmer', 'farmer', 'free'];
  const sexes = ['f', 'm', 'f', 'm', rnd() < 0.5 ? 'f' : 'm'];
  for (let k = 0; k < 5; k++) {
    s.rabbits.push(makeRabbit({ x: EX - 3 + k, y: HALL_Y, job: jobs[k], sex: sexes[k], age: 10 + rnd() * 15, thought: 'Our new home! ✨' }));
  }
  const [a, b] = s.rabbits;
  a.partner = b.id; b.partner = a.id; addRel(a, b, 75);
  for (let i = 0; i < s.rabbits.length; i++) {
    for (let j = i + 1; j < s.rabbits.length; j++) {
      if (i === 0 && j === 1) continue;
      addRel(s.rabbits[i], s.rabbits[j], 10 + rnd() * 25);
    }
  }
  s.log.push({ t: 'Day 1, 07:00', text: `🐰 The ${name} warren was founded!`, kind: 'good' });
  return s;
}

export function initDerived() {
  const s = G.state;
  G.claims.clear();
  G.spots.clear();
  rebuildRoomAt();
  updateReach();
  for (const r of s.rabbits) {
    r.task = null; r.path = []; r.emote = null; r.sleeping = false;
    if (r.wx === undefined) placeAtCell(r);
  }
  G.dirty.terrain = true;
  G.dirty.rooms = true;
}

// ---------- building / digging API ----------
export function isRoomFloor(i) {
  const y = (i / W) | 0;
  return y > 0 && G.roomAt[i - W] !== 0;
}
export function markRect(x0, y0, x1, y1, on) {
  const g = G.state.grid;
  let n = 0;
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (!inb(x, y)) continue;
      const i = idx(x, y);
      if (on) {
        if (g.mat[i] !== MAT.AIR && g.mat[i] !== MAT.BEDROCK && !isRoomFloor(i) && !g.mark[i]) { g.mark[i] = 1; n++; }
      } else if (g.mark[i]) { g.mark[i] = 0; n++; }
    }
  }
  if (n) G.dirty.terrain = true;
  return n;
}

export function canPlace(type, x, y) {
  const def = ROOMS[type], g = G.state.grid;
  let reach = false;
  for (let dx = 0; dx < def.w; dx++) {
    for (let dy = 0; dy < def.h; dy++) {
      const cx = x + dx, cy = y - dy;
      if (!inb(cx, cy)) return { ok: false, why: 'Out of bounds' };
      const i = idx(cx, cy);
      if (g.mat[i] !== MAT.AIR) return { ok: false, why: 'Dig out the space first' };
      if (G.roomAt[i]) return { ok: false, why: 'Another room is in the way' };
      if (cx === EX && cy === 0) return { ok: false, why: 'Keep the entrance clear' };
      if (G.reach[i]) reach = true;
    }
    if (!inb(x + dx, y + 1) || g.mat[idx(x + dx, y + 1)] === MAT.AIR) return { ok: false, why: 'Needs solid ground below' };
  }
  if (!reach) return { ok: false, why: 'Not connected to the warren' };
  if (!canAfford(def.cost)) return { ok: false, why: 'Not enough materials' };
  return { ok: true };
}

export function placeRoom(type, x, y) {
  const s = G.state, def = ROOMS[type];
  const chk = canPlace(type, x, y);
  if (!chk.ok) return chk;
  pay(def.cost);
  for (let dx = 0; dx < def.w; dx++) {
    const b = idx(x + dx, y + 1);
    s.grid.mark[b] = 0;
  }
  s.rooms.push({ id: s.nextId++, type, x, y, w: def.w, h: def.h, built: false, prog: 0, crop: 0, work: 0 });
  rebuildRoomAt();
  G.dirty.rooms = true;
  G.dirty.terrain = true;
  return { ok: true };
}

export function demolish(room) {
  const s = G.state, def = ROOMS[room.type];
  refund(def.cost, room.built ? 0.5 : 1);
  for (const r of s.rabbits) {
    if (r.task && r.task.roomId === room.id) releaseRabbit(r);
    if (r.bed && r.bed.roomId === room.id) r.bed = null;
  }
  s.rooms = s.rooms.filter(r => r !== room);
  for (const k of [...G.spots.keys()]) if (k.startsWith(room.id + ':')) G.spots.delete(k);
  rebuildRoomAt();
  G.dirty.rooms = true;
  G.dirty.terrain = true;
  notify(`${def.icon} ${def.name} was taken down.`);
}

// ---------- rabbits coming and going ----------
export function removeRabbit(r, msg, kind = 'bad') {
  const s = G.state;
  releaseRabbit(r);
  const i = s.rabbits.indexOf(r);
  if (i >= 0) s.rabbits.splice(i, 1);
  for (const o of s.rabbits) {
    delete o.rel[r.id];
    if (o.partner === r.id) o.partner = 0;
  }
  s.stats.left++;
  if (s.chief === r.id) {
    s.chief = 0;
    if (countRooms('council')) s.lastElection = -99;
  }
  if (msg) notify(msg, kind);
  emit('removed', r);
}

export function autoJob() {
  const s = G.state, count = j => s.rabbits.filter(r => !isKit(r) && r.job === j).length;
  const pop = s.rabbits.length;
  if (count('builder') < 2) return 'builder';
  if (count('farmer') < Math.ceil(pop / 5)) return 'farmer';
  if (countRooms('kitchen') && count('cook') < 1) return 'cook';
  if (countRooms('factory') && count('engineer') < 1) return 'engineer';
  return 'free';
}

export function arrival(opts = {}) {
  const s = G.state;
  const r = makeRabbit({ fromSurface: true, ...opts });
  if (!isKit(r)) r.job = autoJob();
  s.rabbits.push(r);
  s.stats.joined++;
  return r;
}

const avgMood = () => {
  const s = G.state;
  return s.rabbits.length ? s.rabbits.reduce((a, r) => a + r.mood, 0) / s.rabbits.length : 0;
};

function immigration() {
  const s = G.state;
  const free = totalBeds() - adults().length;
  if (free <= 0) return;
  if (s.rabbits.length >= 3 && (avgMood() < 50 || rnd() > 0.6)) return;
  const r = arrival();
  notify(`🧳 ${fullName(r)} wandered in and joined the warren!`, 'good', r.id);
}

function births() {
  const s = G.state;
  const nurseries = builtRooms('nursery');
  if (!nurseries.length) return;
  let space = nurseries.length * 3 - kits().length;
  const food = s.res.carrots + s.res.stew * 2;
  if (food < s.rabbits.length * 2) return;
  for (const f of [...s.rabbits]) {
    if (space <= 0) break;
    if (f.sex !== 'f' || isKit(f) || isElder(f) || !f.partner) continue;
    const m = rabbitById(f.partner);
    if (!m || isKit(m)) continue;
    if (f.mood < 50 || m.mood < 50) continue;
    if (f.lastBirth && s.time.day - f.lastBirth < 3) continue;
    const cb = chiefBonus();
    if (rnd() > 0.4 * (cb?.birth || 1)) continue;
    const n = Math.min(space, rnd() < 0.4 ? 2 : 1);
    const names = [];
    for (let k = 0; k < n; k++) {
      const room = pick(nurseries);
      const coat = rnd() < 0.15 ? Math.floor(rnd() * COATS.length) : pick([f.coat, m.coat]);
      const inherited = pick([...f.traits, ...m.traits]);
      const kit = makeRabbit({
        age: 0, clan: pick([f.clan, m.clan]), coat, parents: [f.id, m.id],
        x: room.x + Math.floor(rnd() * room.w), y: room.y, traits: rollTraits(2, [inherited]), thought: 'Hello world! ✨',
      });
      kit.kit = true;
      kit.needs.hunger = 90; kit.needs.energy = 60;
      addRel(kit, f, 60); addRel(kit, m, 60);
      s.rabbits.push(kit);
      names.push(kit.name);
      space--;
      s.stats.born++;
      emit('heart', { x: kit.wx, y: kit.wy + 0.5, z: kit.wz });
    }
    f.lastBirth = s.time.day;
    notify(`🍼 ${f.name} & ${m.name} welcomed little ${names.join(' and ')}!`, 'love');
  }
}

export function holdElection() {
  const s = G.state;
  const pool = adults();
  if (!pool.length) return;
  const cands = pool.map(r => ({ r, e: esteem(r) })).sort((a, b) => b.e - a.e).slice(0, 3);
  const votes = new Map(cands.map(c => [c.r.id, 0]));
  for (const v of pool) {
    let best = cands[0], bs = -Infinity;
    for (const c of cands) {
      const sc = (c.r === v ? 30 : rel(v, c.r)) + c.e * 0.8 + rnd() * 12;
      if (sc > bs) { bs = sc; best = c; }
    }
    votes.set(best.r.id, votes.get(best.r.id) + 1);
  }
  const results = cands
    .map(c => ({ id: c.r.id, name: fullName(c.r), votes: votes.get(c.r.id), esteem: c.e, bonus: chiefBonus(c.r) }))
    .sort((a, b) => b.votes - a.votes || b.esteem - a.esteem);
  const prev = s.chief;
  s.chief = results[0].id;
  s.lastElection = s.time.day;
  s.stats.elections++;
  const winner = rabbitById(s.chief);
  addBuff(winner, 'chief', 'Elected Chief!', 12, 48);
  notify(`🗳️ ${results[0].name} was elected Chief!`, 'good', winner.id);
  emit('election', { results, prev, total: pool.length });
}

// ---------- random events ----------
const allAdults = () => adults();
const colonyBuff = (id, name, icon, hours, mods) => {
  const s = G.state;
  s.buffs = s.buffs.filter(b => b.id !== id);
  s.buffs.push({ id, name, icon, h: hours, mods });
};

const EVENTS = [
  {
    id: 'merchant', weight: 3,
    make() {
      const s = G.state;
      const offers = [
        { give: { carrots: 20 }, get: { copper: 5 } },
        { give: { carrots: 15 }, get: { stone: 10 } },
        { give: { clay: 15 }, get: { carrots: 20 } },
        { give: { stew: 6 }, get: { gears: 3 } },
        { give: { clay: 12 }, get: { copper: 4 } },
      ].filter(o => Object.entries(o.give).every(([k, v]) => s.res[k] >= v));
      if (!offers.length) return null;
      const o = pick(offers);
      return {
        icon: '🐇', title: 'A Traveling Hare',
        text: `A lanky hare with a patched satchel offers a trade: ${fmtCost(o.give)} for ${fmtCost(o.get)}.`,
        choices: [
          { label: 'Deal!', cost: o.give, run() { pay(o.give); for (const [k, v] of Object.entries(o.get)) addRes(k, v); return 'The hare tips its hat. "Pleasure doing business!"'; } },
          { label: 'No, thank you', run: () => 'The hare hops away, humming a tune.' },
        ],
      };
    },
  },
  {
    id: 'lostkit', weight: 2,
    make() {
      return {
        icon: '🥺', title: 'A Lost Kit',
        text: "A tiny kit tumbled into the tunnels, sniffling. It can't find its way home.",
        choices: [
          { label: 'Adopt the kit', run() { const k = arrival({ age: 1 + rnd() * 2 }); k.kit = true; return `${k.name} has a new family! Everyone coos.`; } },
          { label: 'Guide it home', run() { for (const r of G.state.rabbits) addBuff(r, 'kind', 'Helped a lost kit', 4, 12); return 'The kit is reunited with its family. Everyone feels warm and fuzzy.'; } },
        ],
      };
    },
  },
  {
    id: 'festival', weight: 2, when: s => s.rabbits.length >= 5,
    make() {
      return {
        icon: '🌕', title: 'Full Moon Festival',
        text: 'The full moon is rising! The rabbits want to dance and feast in the tunnels.',
        choices: [
          { label: 'Stew feast!', cost: { stew: 10 }, run() { colonyBuff('festival', 'Moon Festival', '🌕', 36, { mood: 10 }); return 'What a night! Everyone danced until dawn.'; } },
          { label: 'Carrot party', cost: { carrots: 20 }, run() { colonyBuff('festival', 'Moon Festival', '🌕', 24, { mood: 6 }); return 'Crunchy carrots and silly dances. Lovely.'; } },
          { label: 'Not tonight', run() { colonyBuff('nofest', 'No festival', '😔', 12, { mood: -3 }); return 'A few ears droop in disappointment.'; } },
        ],
      };
    },
  },
  {
    id: 'dispute', weight: 3, when: () => allAdults().length >= 3,
    make() {
      const pool = allAdults();
      const a = pick(pool);
      const b = pick(pool.filter(r => r !== a));
      const topic = pick(['who dug the straighter tunnel', 'the last carrot', 'whose ears are floppier', 'the proper way to brew clover tea', 'snoring in the burrow']);
      return {
        icon: '😤', title: 'A Squabble',
        text: `${a.name} and ${b.name} are thumping loudly, arguing about ${topic}.`,
        choices: [
          { label: 'Mediate', run() { addRel(a, b, 15); return 'After a long talk, they grudgingly shake paws.'; } },
          {
            label: 'Let them sort it out', run() {
              if (rnd() < 0.5) {
                addRel(a, b, -35); addBuff(a, 'fight', 'Had a fight', -6, 24); addBuff(b, 'fight', 'Had a fight', -6, 24);
                return 'They stomp off in opposite directions. Not great.';
              }
              addRel(a, b, 30);
              return 'Somehow they ended up laughing. Friends now!';
            },
          },
        ],
      };
    },
  },
  {
    id: 'seeds', weight: 2, when: () => countRooms('farm') > 0,
    make: () => ({
      icon: '🌱', title: 'Giant Carrot Seeds',
      text: 'A farmer from the Northern Warren gifts you a pouch of giant carrot seeds.',
      choices: [{ label: 'Plant them!', run() { colonyBuff('seeds', 'Giant carrots', '🌱', 48, { farm: 1.5 }); return 'Farms will grow 50% faster for two days.'; } }],
    }),
  },
  {
    id: 'storm', weight: 2,
    make: () => ({
      icon: '⛈️', title: 'Thunderstorm',
      text: 'Thunder booms above the warren. The kits are hiding under their blankets.',
      choices: [
        {
          label: 'Tell stories together', need: () => countRooms('lounge') > 0, why: 'Needs a Social Lounge',
          run() { for (const r of G.state.rabbits) { r.needs.social = Math.min(100, r.needs.social + 30); addBuff(r, 'stories', 'Storm stories', 5, 12); } return 'Tales of the Great Burrow calm everyone down.'; },
        },
        { label: 'Ride it out', run() { colonyBuff('storm', 'Scary storm', '⛈️', 12, { mood: -4 }); return 'Everyone waits nervously for the storm to pass.'; } },
      ],
    }),
  },
  {
    id: 'traveler', weight: 3,
    make() {
      const traits = rollTraits();
      const name = pick(['Rowan', 'Sable', 'Nimbus', 'Tinder', 'Fable', 'Briar', 'Cobble', 'Mallow']);
      const job = pick(['builder', 'farmer', 'cook', 'engineer']);
      return {
        icon: '🧳', title: 'A Traveler Knocks',
        text: `${name}, a ${traits.map(t => TRAITS[t].name.toLowerCase()).join(' and ')} rabbit with ${JOBS[job].name.toLowerCase()} experience, asks to join your warren.`,
        choices: [
          { label: 'Welcome!', run() { const r = arrival({ name, traits }); r.job = job; r.skills[job] += 20; return `${name} unpacks a tiny suitcase. Welcome home!`; } },
          { label: "Sorry, we're full", run: () => `${name} waves and hops on down the road.` },
        ],
      };
    },
  },
  {
    id: 'cavein', weight: 2, when: s => s.stats.dug >= 20,
    make: () => ({
      icon: '💥', title: 'A Rumble Below',
      text: 'A tunnel wall settled with a rumble, revealing a glittering mineral pocket!',
      choices: [{ label: 'Collect it', run() { addRes('copper', 4); addRes('stone', 6); if (rnd() < 0.4) addRes('crystals', 1); return 'Treasure! The diggers are very proud.'; } }],
    }),
  },
  {
    id: 'wedding', weight: 2,
    when: s => s.rabbits.some(r => r.partner && !isKit(r)),
    make() {
      const s = G.state;
      const a = pick(s.rabbits.filter(r => r.partner && !isKit(r)));
      const b = rabbitById(a.partner);
      if (!b) return null;
      return {
        icon: '💒', title: 'A Burrow Wedding',
        text: `${a.name} and ${b.name} want to celebrate their bond with the whole warren!`,
        choices: [
          { label: 'Throw a party', cost: { stew: 8 }, run() { colonyBuff('wedding', 'Wedding party', '💒', 24, { mood: 8 }); addBuff(a, 'wed', 'Just married!', 15, 72); addBuff(b, 'wed', 'Just married!', 15, 72); emit('heart', { x: a.wx, y: a.wy + 0.7, z: a.wz }); return 'Flower crowns, clover cake and happy thumping!'; } },
          { label: 'A small ceremony', run() { addBuff(a, 'wed', 'Just married!', 8, 48); addBuff(b, 'wed', 'Just married!', 8, 48); return 'A sweet, quiet ceremony by lantern light.'; } },
        ],
      };
    },
  },
  {
    id: 'fox', weight: 2,
    make: () => ({
      icon: '🦊', title: 'Fox at the Entrance!',
      text: 'A fox is sniffing around the entrance. The rabbits are thumping nervously.',
      choices: [
        { label: 'Barricade the entrance', cost: { clay: 6 }, run: () => 'The fox gives up and trots away. Phew!' },
        {
          label: 'Stay very quiet', run() {
            if (rnd() < 0.5) {
              const lost = Math.min(G.state.res.carrots, 12);
              G.state.res.carrots -= lost;
              colonyBuff('fox', 'Fox scare', '🦊', 12, { mood: -5 });
              return `The fox raided the surface stash! Lost ${lost} 🥕.`;
            }
            return 'The fox got bored and left. Everyone exhales.';
          },
        },
      ],
    }),
  },
];

function rollEvent() {
  const s = G.state;
  const pool = EVENTS.filter(e => !e.when || e.when(s));
  let total = pool.reduce((a, e) => a + e.weight, 0);
  let x = rnd() * total;
  for (const e of pool) {
    x -= e.weight;
    if (x <= 0) {
      const ev = e.make();
      if (ev) {
        for (const c of ev.choices) {
          c.disabled = (c.cost && !canAfford(c.cost)) || (c.need && !c.need());
          if (c.cost) c.label += ` (−${fmtCost(c.cost)})`;
          if (c.disabled && !c.why) c.why = 'Not enough resources';
        }
        emit('event', ev);
      }
      return;
    }
  }
}

// ---------- goals ----------
export function checkGoals() {
  const s = G.state;
  while (s.goal < GOALS.length) {
    const g = GOALS[s.goal];
    const [v, t] = g.prog(s);
    if (v < t) break;
    for (const [k, n] of Object.entries(g.reward)) addRes(k, n);
    const rw = Object.keys(g.reward).length ? ` Reward: ${fmtCost(g.reward)}` : '';
    notify(`🎯 Goal complete: ${g.text}!${rw}`, 'good');
    emit('goal', g);
    s.goal++;
    if (s.goal >= GOALS.length && !s.won) { s.won = true; emit('victory'); }
  }
}

// ---------- time ----------
function onHour(h) {
  const s = G.state;
  for (const r of [...s.rabbits]) {
    if (!isKit(r)) ensureBed(r);
    if (r.kit && r.age >= ADULT_AGE) {
      r.kit = false;
      r.job = autoJob();
      r.thought = "I'm all grown up! 🎓";
      notify(`🎓 ${r.name} grew up and became a ${JOBS[r.job].name}!`, 'good', r.id);
    }
    if (r.age >= r.lifespan) { removeRabbit(r, `🌼 ${fullName(r)} retired to the Sunny Meadow after a long, happy life.`, 'info'); continue; }
    if (r.low >= 36) { removeRabbit(r, `💔 ${fullName(r)} was too unhappy and left the warren.`); continue; }
    if (r.starving >= 36) { removeRabbit(r, `🥕 ${fullName(r)} left to search for food elsewhere.`); continue; }
  }
  if (h === 10) immigration();
  if (h === 22) births();
  if (h === 12 && countRooms('council') && (s.lastElection === null || s.time.day - s.lastElection >= 7)) holdElection();
  if (s.clock >= s.nextEvent && h >= 9 && h <= 18 && !G.modal && s.rabbits.length >= 3) {
    s.nextEvent = s.clock + 30 + rnd() * 26;
    rollEvent();
  }
  checkGoals();
  if (!s.rabbits.length) emit('gameover');
}

export function update(dh) {
  const s = G.state;
  while (dh > 0) {
    const step = Math.min(dh, 0.1);
    dh -= step;
    const prev = Math.floor(s.clock);
    s.clock += step;
    s.time.hour += step;
    if (s.time.hour >= 24) { s.time.hour -= 24; s.time.day++; emit('newday', s.time.day); }
    for (const b of s.buffs) b.h -= step;
    if (s.buffs.some(b => b.h <= 0)) s.buffs = s.buffs.filter(b => b.h > 0);
    for (const r of [...s.rabbits]) updateRabbit(r, step);
    if (Math.floor(s.clock) !== prev) onHour(Math.floor(s.time.hour));
  }
}

export { cellX, floorY };
