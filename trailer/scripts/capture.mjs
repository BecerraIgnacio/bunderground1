// Records cinematic gameplay footage from the real game, frame by frame.
// Usage: (game dev server running on :5173)  node scripts/capture.mjs [shotName ...]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

const URL = process.env.GAME_URL || 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FRAMES = path.join(os.tmpdir(), 'bunderground-main-trailer-frames');
const CLIPS = path.resolve('public/clips');
const WIDTH = 1920, HEIGHT = 1080, FPS = 30;
const only = process.argv.slice(2);

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// game-style frontal camera, with optional yaw for parallax
const front = (x, y, d, yaw = 0, pitch = 0.2) => ({
  pos: [x + Math.sin(yaw) * d, y + d * pitch, Math.cos(yaw) * d],
  look: [x, y, 0],
});
const between = (a, b) => t => { const e = ease(t); return { pos: lerp3(a.pos, b.pos, e), look: lerp3(a.look, b.look, e) }; };

// room anchors in the hero colony (bottom-left cell)
const R = {
  kitchen1: [7, 3, 2, 1], lounge1: [9, 3, 3, 1], burrowA: [13, 3, 2, 1], burrowB: [15, 3, 2, 1], farm1: [22, 3, 3, 1],
  pantry: [26, 3, 2, 1], burrowC: [28, 3, 2, 1], nursery: [31, 3, 2, 1],
  factory: [6, 8, 3, 1], council: [10, 8, 3, 2], farm2: [14, 8, 3, 1], clock: [22, 8, 3, 2], kitchen2: [26, 8, 2, 1], lounge2: [29, 8, 3, 1],
};
const center = k => { const [x, y, w, h] = R[k]; return [x - 20 + w / 2, -(y + 1) + h / 2 - 0.1]; };
const roomCam = (k, d = 4.4, yaw0 = -0.12, yaw1 = 0.1) => {
  const [x, y] = center(k);
  return between(front(x, y, d, yaw0, 0.16), front(x + 0.15, y, d * 0.86, yaw1, 0.16));
};

// ---------------------------------------------------------------- in-page library
function pageLib() {
  const B = window.__bunderground, G = B.G;
  const Wd = 40;
  const T = (window.__T = {});
  const idx = (x, y) => y * Wd + x;
  const S = () => G.state;
  const room = key => S().rooms.find(r => r.key === key);

  T.hero = () => {
    B.capture.start();
    B.api.newGame('Clover Hollow');
    B.api.closeModal();
    B.UI.showHUD(false);
    document.getElementById('title').classList.add('hidden');
    G.demo = true;
    const s = S(), g = s.grid;
    const dig = (x, y) => { g.mat[idx(x, y)] = 0; g.ore[idx(x, y)] = 0; g.mark[idx(x, y)] = 0; };
    const solid = (x, y, m = 2) => { if (!g.mat[idx(x, y)]) g.mat[idx(x, y)] = m; g.ore[idx(x, y)] = 0; };
    for (let x = 5; x <= 34; x++) { dig(x, 3); solid(x, 4, 1); dig(x, 8); solid(x, 9, 3); }
    for (const x of [10, 11, 12, 22, 23, 24]) dig(x, 7);
    for (let y = 0; y <= 13; y++) dig(20, y);
    for (let y = 3; y <= 8; y++) dig(33, y);
    for (let x = 8; x <= 22; x++) { dig(x, 13); solid(x, 14, 3); }
    // ore-rich digging area to the right of level 3
    for (let y = 12; y <= 14; y++) for (let x = 23; x <= 31; x++) {
      if (!g.mat[idx(x, y)]) g.mat[idx(x, y)] = 3;
      g.ore[idx(x, y)] = (x * 7 + y * 3) % 5 === 0 ? 3 : (x + y) % 4 === 0 ? 2 : 0;
    }
    s.rooms = [];
    const add = (key, type, x, y, w, h) => s.rooms.push({ id: s.nextId++, key, type, x, y, w, h, built: true, prog: 99, crop: 0.85, work: 0 });
    add('kitchen1', 'kitchen', 7, 3, 2, 1); add('lounge1', 'lounge', 9, 3, 3, 1); add('burrowA', 'burrow', 13, 3, 2, 1);
    add('burrowB', 'burrow', 15, 3, 2, 1); add('farm1', 'farm', 22, 3, 3, 1); add('pantry', 'pantry', 26, 3, 2, 1);
    add('burrowC', 'burrow', 28, 3, 2, 1); add('nursery', 'nursery', 31, 3, 2, 1);
    add('factory', 'factory', 6, 8, 3, 1); add('council', 'council', 10, 8, 3, 2); add('farm2', 'farm', 14, 8, 3, 1);
    add('clock', 'clock', 22, 8, 3, 2); add('kitchen2', 'kitchen', 26, 8, 2, 1); add('lounge2', 'lounge', 29, 8, 3, 1);
    add('burrowD', 'burrow', 17, 8, 2, 1);
    s.rabbits = [];
    const coats = [0, 1, 2, 3, 4, 5, 6];
    const spots = [[8, 3], [12, 3], [18, 3], [21, 3], [25, 3], [30, 3], [34, 3], [7, 8], [13, 8], [19, 8], [21, 8], [25, 8], [28, 8], [32, 8], [34, 8], [9, 13], [12, 13], [15, 13], [18, 13], [21, 13], [11, 3], [24, 3], [16, 8], [27, 3]];
    const jobs = ['builder', 'builder', 'builder', 'builder', 'builder', 'builder', 'farmer', 'farmer', 'farmer', 'farmer', 'cook', 'cook', 'engineer', 'engineer', 'caretaker'];
    spots.forEach(([x, y], i) => {
      const r = B.makeRabbit({ x, y, age: 8 + ((i * 7) % 40), coat: coats[i % coats.length], sex: i % 2 ? 'm' : 'f', job: jobs[i] || 'free' });
      r.needs = { hunger: 85, energy: 90, social: 70 };
      r.mood = 80;
      s.rabbits.push(r);
    });
    for (let k = 0; k < 3; k++) { const kit = B.makeRabbit({ x: 31 + (k % 2), y: 3, age: 1 + k, coat: [0, 4, 2][k] }); kit.kit = true; s.rabbits.push(kit); }
    s.rabbits[0].partner = s.rabbits[1].id; s.rabbits[1].partner = s.rabbits[0].id;
    s.chief = s.rabbits[20].id; s.lastElection = 1;
    Object.assign(s.res, { carrots: 90, stew: 30, clay: 90, stone: 90, copper: 60, gears: 60, crystals: 14 });
    s.time.hour = 10; s.time.day = 12;
    B.initDerived();
    for (const r of s.rabbits) r.age = r.kit ? r.age : r.age;
    return s.rabbits.length;
  };

  T.pose = (r, key, kind, sx, sz, extra = {}) => {
    const rm = room(key);
    B.releaseRabbit(r);
    r.cx = rm.x + Math.min(rm.w - 1, Math.floor(sx)); r.cy = rm.y;
    r.wx = rm.x - 20 + sx; r.wy = -(rm.y + 1); r.wz = sz;
    r.path = []; r.moving = false;
    r.task = { kind, phase: 'do', t: kind === 'eat' ? -500 : 0, dur: 9999, roomId: rm.id, ...extra };
    r.face = extra.face ?? 0;
    if (kind === 'sleep') { r.sleeping = true; r.emote = '💤'; r.task.bed = true; r.needs.energy = 5; }
    if (kind === 'social') { r.emote = '💬'; r.needs.social = 0; }
    if (kind === 'eat') r.emote = extra.food === 'carrot' ? '🥕' : '🍲';
    if (kind === 'play') r.emote = '🎈';
    if (kind === 'work') { r.task.sx = sx; r.face = extra.face ?? (sx < rm.w / 2 ? 0.7 : -0.7); }
    T.posed.add(r.id);
    return r;
  };
  T.posed = new Set();
  // freeze everyone who isn't in the shot on the other hall levels, out of frame
  T.park = focusRow => {
    const rows = [3, 8, 13].filter(y => y !== focusRow);
    let k = 0;
    for (const r of S().rabbits) {
      if (T.posed.has(r.id)) continue;
      B.releaseRabbit(r);
      const y = rows[k % rows.length], x = 9 + ((k * 5) % 13);
      k++;
      r.cx = x; r.cy = y; r.wx = x - 20 + 0.5; r.wy = -(y + 1); r.wz = 0.2; r.path = [];
      r.task = { kind: 'idle', phase: 'do', t: 0, dur: 9999, parked: true };
    }
  };
  T.unpark = () => { for (const r of S().rabbits) if (r.task?.parked) B.releaseRabbit(r); T.posed.clear(); };
  const adults = () => S().rabbits.filter(r => !r.kit);
  const kits = () => S().rabbits.filter(r => r.kit);

  T.stage = name => {
    const s = S();
    const a = adults();
    s.res.carrots = 90; s.res.stew = 30; s.res.copper = 60; s.res.stone = 80;
    const set = {
      farm() { T.pose(a[6], 'farm1', 'work', 0.75, 0.32, { job: 'farmer' }); T.pose(a[7], 'farm1', 'work', 2.25, 0.32, { job: 'farmer' }); room('farm1').crop = 0.4; },
      kitchen() {
        T.pose(a[10], 'kitchen2', 'work', 0.42, 0.12, { job: 'cook', face: 0.5 }); T.pose(a[11], 'kitchen2', 'work', 0.95, 0.12, { job: 'cook', face: -0.4 });
        T.pose(a[16], 'kitchen2', 'eat', 1.45, 0.42, { face: 0.3 }); T.pose(a[17], 'kitchen2', 'eat', 1.8, 0.4, { face: -0.4, food: 'carrot' });
        s.res.stew = 5;
      },
      lounge() {
        T.pose(a[0], 'lounge1', 'social', 1.1, 0.32, { face: 0.5 }); T.pose(a[1], 'lounge1', 'social', 1.9, 0.32, { face: -0.5 });
        T.pose(a[18], 'lounge1', 'social', 0.45, 0.1, { face: 0.7 }); T.pose(a[19], 'lounge1', 'social', 2.55, 0.1, { face: -0.7 });
      },
      factory() { T.pose(a[12], 'factory', 'work', 0.55, 0.3, { job: 'engineer' }); T.pose(a[13], 'factory', 'work', 2.3, 0.3, { job: 'engineer' }); },
      nursery() { kits().forEach((k, i) => T.pose(k, 'nursery', 'sleep', [0.35, 1.0, 1.65][i], [-0.25, -0.3, -0.25][i])); T.pose(a[14], 'nursery', 'work', 1.0, 0.3, { job: 'caretaker', face: 0 }); },
      burrow() { [2, 3, 4, 5].forEach((n, i) => T.pose(a[n], 'burrowB', 'sleep', [0.27, 0.75, 1.25, 1.73][i], -0.28, { face: (i - 1.5) * 0.3 })); },
      council() {
        T.pose(a[20], 'council', 'social', 1.5, 0.38, { face: 0 });
        T.pose(a[21], 'council', 'social', 0.6, 0.3, { face: 0.6 }); T.pose(a[22], 'council', 'social', 2.4, 0.3, { face: -0.6 });
      },
      clock() { T.pose(a[23], 'clock', 'idle', 0.8, 0.35, { face: 2.8 }); T.pose(a[15], 'clock', 'idle', 2.2, 0.38, { face: -2.8 }); },
      love() {
        const f = a[16], m = a[17];
        f.partner = 0; m.partner = 0; f.rel[m.id] = 55; m.rel[f.id] = 55;
        T.pose(f, 'lounge2', 'social', 1.1, 0.32, { face: 1.2 }); T.pose(m, 'lounge2', 'social', 1.9, 0.32, { face: -1.2 });
      },
      dig() {
        const g = s.grid;
        for (let y = 12; y <= 14; y++) for (let x = 23; x <= 31; x++) g.mark[idx(x, y)] = 1;
        G.dirty.terrain = true;
        s.time.hour = 8;
        [0, 1, 2, 3, 4, 5].forEach((n, i) => { const r = a[n]; B.releaseRabbit(r); r.cx = 17 + i; r.cy = 13; r.wx = r.cx - 20 + 0.5; r.wy = -14; r.wz = 0.2; r.job = 'builder'; r.needs = { hunger: 100, energy: 100, social: 90 }; });
      },
      build() {
        const g = s.grid;
        for (let i = 0; i < g.mark.length; i++) g.mark[i] = 0;
        s.time.hour = 8;
        const site = (type, x, w, h = 1) => s.rooms.push({ id: s.nextId++, key: 'site' + x, type, x, y: 13, w, h, built: false, prog: 0, crop: 0, work: 0 });
        site('burrow', 9, 2); site('kitchen', 12, 2); site('lounge', 15, 3);
        B.initDerived();
        [0, 1, 2, 3, 4, 5].forEach((n, i) => { const r = a[n]; r.cx = 9 + i * 2; r.cy = 13; r.wx = r.cx - 20 + 0.5; r.wy = -14; r.wz = 0.2; r.job = 'builder'; r.needs = { hunger: 100, energy: 100, social: 90 }; });
      },
      day() { s.time.hour = 10; },
      golden() { s.time.hour = 16.2; },
      night() { s.time.hour = 22.5; },
      noon() { s.time.hour = 12; },
    };
    const ROWS = { farm: 3, kitchen: 8, lounge: 3, factory: 8, nursery: 3, burrow: 3, council: 8, clock: 8, love: 8 };
    if (ROWS[name]) { T.posed.clear(); set[name](); T.park(ROWS[name]); }
    else { if (['dig', 'build'].includes(name) || name === 'unpark') T.unpark(); set[name]?.(); }
    return name;
  };

  // pick a rabbit walking along a hall, to follow with the camera
  T.walker = () => {
    const s = S();
    const r = adults()[8];
    B.releaseRabbit(r);
    r.cx = 22; r.cy = 8; r.wx = 2.5; r.wy = -9; r.wz = 0.25;
    r.task = { kind: 'idle', phase: 'go', t: 0, dur: 1 };
    r.path = [];
    for (let x = 23; x <= 31; x++) r.path.push({ x: x - 20 + 0.5, y: -9, z: 0.25, ci: 8 * Wd + x });
    r.face = Math.PI / 2;
    return r.id;
  };

  T.frame = (cam, dt, sim) => {
    B.view.camOverride = c => { c.position.set(cam.pos[0], cam.pos[1], cam.pos[2]); c.lookAt(cam.look[0], cam.look[1], cam.look[2]); };
    B.capture.step(dt, sim);
  };
  T.grab = (cam, dt, sim, q) => {
    T.frame(cam, dt, sim);
    return B.view.renderer.domElement.toDataURL('image/jpeg', q);
  };
  T.follow = id => {
    const r = S().rabbits.find(o => o.id === id);
    return r ? [r.wx, r.wy, r.wz] : null;
  };
}

// ---------------------------------------------------------------- shots
const SLOW = 0.006, NORMAL = 1 / 30 / 4;
const shots = [
  {
    name: 'meadow', frames: 165, stage: ['golden'], sim: SLOW,
    cam: between({ pos: [-7, 0.95, 1.8], look: [-4, 1.6, -14] }, { pos: [-1.2, 1.05, 1.8], look: [2, 1.4, -14] }),
  },
  {
    name: 'reveal', frames: 165, stage: ['golden'], sim: SLOW,
    cam: t => {
      const e = ease(t);
      return { pos: lerp3([0.5, 1.6, 2.6], [0.5, 0.2, 24], e), look: lerp3([0.5, 1.0, -12], [0.5, -6.5, 0], Math.min(1, e * 1.15)) };
    },
  },
  { name: 'walk', frames: 100, stage: ['day'], sim: 0.012, follow: true },
  { name: 'farm', frames: 80, stage: ['day', 'farm'], sim: 0.01, cam: roomCam('farm1') },
  { name: 'kitchen', frames: 80, stage: ['day', 'kitchen'], sim: 0.004, cam: roomCam('kitchen2', 3.8) },
  { name: 'lounge', frames: 80, stage: ['day', 'lounge'], sim: 0.004, cam: roomCam('lounge1', 4.4, 0.12, -0.08) },
  { name: 'factory', frames: 80, stage: ['day', 'factory'], sim: 0.004, cam: roomCam('factory') },
  { name: 'nursery', frames: 80, stage: ['day', 'nursery'], sim: 0.004, cam: roomCam('nursery', 3.8, 0.1, -0.1) },
  { name: 'burrow', frames: 80, stage: ['night', 'burrow'], sim: 0.003, cam: roomCam('burrowB', 3.6) },
  { name: 'council', frames: 90, stage: ['day', 'council'], sim: 0.004, cam: roomCam('council', 5.2, -0.1, 0.12) },
  { name: 'clock', frames: 90, stage: ['night', 'clock'], sim: 0.01, cam: roomCam('clock', 5.4, 0.15, -0.05) },
  { name: 'love', frames: 110, stage: ['day', 'love'], sim: 0.03, cam: roomCam('lounge2', 3.3, -0.05, 0.05) },
  { name: 'dig', frames: 165, stage: ['dig'], sim: 0.12, cam: between(front(4.2, -13.2, 9.5, -0.08), front(6.2, -13.4, 8.8, 0.06)) },
  { name: 'build', frames: 165, stage: ['build'], sim: 0.06, cam: between(front(-6.5, -13.2, 9.5, 0.08), front(-6, -13.4, 8.4, -0.05)) },
  {
    name: 'timelapse', frames: 240, stage: ['unpark', 'noon'], sim: 0.11,
    cam: t => {
      const e = ease(t);
      const d = lerp(4, 50, e * e), yaw = lerp(0.05, 0.32, e);
      const x = lerp(3.5, 0, e), y = lerp(-3.6, -9, e);
      return front(x, y, d, yaw, lerp(0.14, 0.24, e));
    },
  },
  {
    name: 'orbit', frames: 200, stage: ['unpark', 'day'], sim: 0.008,
    cam: t => {
      const a = lerp(-0.62, 0.62, ease(t)), rad = 46;
      return { pos: [Math.sin(a) * rad, lerp(9, 6, t), Math.cos(a) * rad - 6], look: [0, -7, -6] };
    },
  },
  { name: 'ui', frames: 120, stage: ['unpark', 'day'], sim: NORMAL, hud: 'inspect', cam: between(front(-6, -3.4, 11), front(-5.3, -3.4, 10.4)) },
  { name: 'uisociety', frames: 75, stage: ['day'], sim: NORMAL, hud: 'society', cam: () => front(-5.3, -3.4, 10.4) },
  { name: 'night', frames: 270, stage: ['unpark', 'night'], sim: 0.004, cam: between(front(0, -4, 30, -0.12, 0.3), front(0, -3, 24, 0.12, 0.3)) },
];

// ---------------------------------------------------------------- run
fs.mkdirSync(FRAMES, { recursive: true });
fs.mkdirSync(CLIPS, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  userDataDir: path.join(os.tmpdir(), 'bunderground-main-trailer-profile-' + Date.now()),
  args: [`--window-size=${WIDTH},${HEIGHT}`, '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('[page]', e.message));
page.goto(URL, { timeout: 120000 }).catch(() => {});
await page.waitForFunction(() => window.__bunderground, { timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(pageLib);
const n = await page.evaluate(() => window.__T.hero());
console.log('hero colony ready with', n, 'rabbits');
// warm up so everybody is mid-routine
await page.evaluate(() => { for (let i = 0; i < 40; i++) window.__T.frame({ pos: [0, 0, 20], look: [0, -4, 0] }, 1 / 30, 0.05); });

for (const shot of shots) {
  if (only.length && !only.includes(shot.name)) continue;
  const dir = path.join(FRAMES, shot.name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  console.log('… capturing', shot.name);
  for (const st of shot.stage) await page.evaluate(n => window.__T.stage(n), st);
  let followId = null, fcam = null;
  if (shot.follow) followId = await page.evaluate(() => window.__T.walker());
  if (shot.hud) {
    await page.evaluate(mode => {
      const B = window.__bunderground;
      B.G.demo = false;
      B.UI.showHUD(true);
      if (mode === 'inspect') B.api.selectRabbit(B.G.state.rabbits[20].id);
      if (mode === 'society') { B.api.openColony(); document.querySelector('[data-tab="society"]').click(); B.G.modal = false; }
    }, shot.hud);
  }
  // settle one frame so rebuilt meshes exist
  await page.evaluate(() => window.__T.frame({ pos: [0, 0, 20], look: [0, -4, 0] }, 1 / 30, 0));
  for (let f = 0; f < shot.frames; f++) {
    const t = f / (shot.frames - 1);
    let cam;
    if (shot.follow) {
      const p = await page.evaluate(id => window.__T.follow(id), followId);
      const target = { pos: [p[0] - 1.1, p[1] + 0.85, p[2] + 3.0], look: [p[0] + 0.25, p[1] + 0.35, p[2]] };
      fcam = fcam ? { pos: lerp3(fcam.pos, target.pos, 0.15), look: lerp3(fcam.look, target.look, 0.2) } : target;
      cam = fcam;
    } else cam = shot.cam(t);
    const file = path.join(dir, String(f).padStart(4, '0') + '.jpg');
    if (shot.hud) {
      await page.evaluate((c, sim) => window.__T.frame(c, 1 / 30, sim), cam, shot.sim);
      await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
    } else {
      const data = await page.evaluate((c, sim) => window.__T.grab(c, 1 / 30, sim, 0.93), cam, shot.sim);
      fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    }
  }
  if (shot.hud) {
    await page.evaluate(() => { const B = window.__bunderground; B.api.closeModal(); B.api.select(null); B.UI.showHUD(false); B.G.demo = true; });
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  // encode clip
  const out = path.join(CLIPS, shot.name + '.mp4');
  const q = s => '"' + s + '"';
  execSync(['npx remotion ffmpeg -y -loglevel error -framerate', FPS, '-i', q(path.join(dir, '%04d.jpg')),
    '-c:v libx264 -preset medium -crf 15 -pix_fmt yuv420p -movflags +faststart', q(out)].join(' '), { stdio: 'inherit' });
  console.log(`✓ ${shot.name}: ${shot.frames} frames in ${secs}s → ${out}`);
}
await browser.close();
