import './style.css';
import { inject, track } from '@vercel/analytics';
import { W, EX, SEC_PER_HOUR, ROOMS, MAT } from './data.js';
import { G, on, notify, roomById, rabbitById, isKit } from './game.js';
import { idx, HALL_Y, cellX, floorY } from './world.js';
import { newGame, initDerived, update, markRect, placeRoom, demolish, autoJob } from './sim.js';
import { makeRabbit, releaseRabbit } from './rabbits.js';
import { View } from './render/view.js';
import { setupInput } from './input.js';
import { UI } from './ui.js';
import { saveGame, loadGame, clearSave, exportSave, importSave } from './save.js';
import { sfx, unlockAudio } from './audio.js';

inject(); // Vercel Web Analytics (page views)

const canvas = document.getElementById('c');
const view = new View(canvas);

let tool = 'select';
let buildType = null;
let selected = null; // { type, id }
let inGame = false;
let saveTimer = 0;
let lastDigSfx = 0;

// ---------- selection ----------
function select(sel) {
  selected = sel;
  view.bunnies.selected = sel?.type === 'rabbit' ? sel.id : 0;
  view.rooms.select(sel?.type === 'room' ? roomById(sel.id) : null);
  if (!sel) UI.clearInspector();
  else if (sel.type === 'rabbit') UI.inspectRabbit(sel.id);
  else UI.inspectRoom(sel.id);
}
function selectRabbit(id, focus = false) {
  const r = rabbitById(id);
  if (!r) return;
  if (tool !== 'select') setTool('select');
  select({ type: 'rabbit', id });
  sfx('click');
  // on phones the inspector is a bottom sheet, so keep the rabbit in the upper half
  if (focus) view.focus(r.wx, r.wy + 0.5 - (window.innerWidth <= 820 ? 2.2 : 0), Math.min(view.cam.td, 12));
}

function setTool(t, type = null) {
  if (t === 'build' && tool === 'build' && !type && !buildType) t = 'select';
  tool = t;
  buildType = t === 'build' ? type : null;
  UI.setTool(tool, buildType);
  view.terrain.showGhost(null);
  UI.tooltip(0, 0, null);
}

function setSpeed(n) {
  if (n === 0) G.paused = true;
  else { G.paused = false; G.speed = n; }
}

// ---------- game lifecycle ----------
function enterGame() {
  G.demo = false;
  inGame = true;
  view.reset();
  view.surface.setName(G.state.name);
  view.cam.follow = 0;
  view.focus(0, -2.5, 16);
  UI.hideTitle();
  UI.showHUD(true);
  setTool('select');
  select(null);
  G.paused = false;
  G.speed = 1;
}

function startNew(name) {
  newGame(name);
  track('new_colony');
  enterGame();
  saveGame();
  UI.showWelcome();
}

function continueGame() {
  const s = loadGame();
  if (!s) { UI.toast({ text: 'No saved warren found.', kind: 'bad' }); return; }
  track('continue_colony', { day: s.time.day });
  G.state = s;
  initDerived();
  enterGame();
  notify(`🐰 Welcome back to ${s.name}!`, 'good');
}

function quit(save = true) {
  if (save) saveGame();
  inGame = false;
  UI.showHUD(false);
  UI.clearInspector();
  startDemo();
  UI.showTitle();
}

function startDemo() {
  G.demo = true;
  newGame('Meadowdeep', 12345);
  const s = G.state;
  const g = s.grid;
  // widen the hall and add a few rooms so the title screen looks lived-in
  for (let x = EX - 9; x <= EX + 9; x++) { g.mat[idx(x, HALL_Y)] = 0; if (!g.mat[idx(x, HALL_Y + 1)]) g.mat[idx(x, HALL_Y + 1)] = MAT.TOPSOIL; }
  for (let y = HALL_Y; y <= 7; y++) g.mat[idx(EX + 6, y)] = 0;
  for (let x = EX + 1; x <= EX + 8; x++) g.mat[idx(x, 7)] = 0;
  for (let x = EX + 1; x <= EX + 8; x++) if (!g.mat[idx(x, 8)]) g.mat[idx(x, 8)] = MAT.CLAY;
  const add = (type, x, y) => s.rooms.push({ id: s.nextId++, type, x, y, w: ROOMS[type].w, h: ROOMS[type].h, built: true, prog: 99, crop: 0.5, work: 0 });
  add('kitchen', EX - 9, HALL_Y);
  add('lounge', EX - 3, HALL_Y);
  add('burrow', EX - 7, HALL_Y);
  add('nursery', EX + 1, 7);
  add('pantry', EX + 3, 7);
  s.res.stew = 30;
  for (let k = 0; k < 4; k++) s.rabbits.push(makeRabbit({ x: EX - 6 + k * 3, y: HALL_Y, age: 10 + k * 5 }));
  s.rabbits.push(Object.assign(makeRabbit({ x: EX + 2, y: 7, age: 2 }), { kit: true }));
  for (const r of s.rabbits) if (!isKit(r)) r.job = autoJob();
  initDerived();
  view.reset();
  view.surface.setName('Bunderground');
  view.focus(0, -3.2, 14);
  G.paused = false;
  G.speed = 1;
}

// ---------- API used by UI and input ----------
const api = {
  tool: () => tool,
  buildType: () => buildType,
  setTool,
  setSpeed,
  togglePause: () => setSpeed(G.paused ? G.speed : 0),
  select: sel => select(sel),
  selectRabbit,
  selectRoom: id => { select({ type: 'room', id }); sfx('click'); },
  follow: id => { view.cam.follow = view.cam.follow === id ? 0 : id; if (view.cam.follow) view.zoom(0.7); },
  followSelected: () => { if (selected?.type === 'rabbit') api.follow(selected.id); },
  tooltip: html => UI.tooltip(lastPointer.x, lastPointer.y, html),
  markRect: (x0, y0, x1, y1, onOff) => {
    const n = markRect(x0, y0, x1, y1, onOff);
    if (n) sfx(onOff ? 'place' : 'click');
    else if (onOff) UI.toast({ text: 'Nothing diggable there (tunnels, bedrock and room floors can’t be dug).', kind: 'info' });
  },
  place: (type, x, y) => {
    const res = placeRoom(type, x, y);
    if (res.ok) {
      sfx('place');
      notify(`${ROOMS[type].icon} ${ROOMS[type].name} is under construction.`);
      if (!canAffordAgain(type)) setTool('build');
    } else { sfx('error'); UI.toast({ text: `❌ ${res.why}`, kind: 'bad' }); }
  },
  demolishAsk: id => { const room = roomById(id); if (room) UI.confirmDemolish(room); },
  demolish: room => { demolish(room); if (selected?.type === 'room' && selected.id === room.id) select(null); sfx('dig'); },
  autoJobs: () => {
    for (const r of G.state.rabbits) if (!isKit(r)) r.job = 'free';
    for (const r of G.state.rabbits) if (!isKit(r)) { r.job = autoJob(); releaseRabbit(r); }
    sfx('good');
  },
  openColony: () => UI.openColony(),
  modalOpen: () => UI.isModalOpen(),
  closeModal: () => UI.closeModal(),
  escape: () => {
    if (tool !== 'select') setTool('select');
    else if (selected) select(null);
    else UI.openMenu();
  },
  inGame: () => inGame,
  onInteract: () => unlockAudio(),
  save: manual => { if (saveGame() && manual) UI.toast({ text: '💾 Warren saved on this device.', kind: 'good' }); },
  exportSave: () => { saveGame(); exportSave(); },
  importSave: text => { importSave(text); continueGame(); },
  newGame: startNew,
  continueGame,
  quit,
};
function canAffordAgain(type) {
  return Object.entries(ROOMS[type].cost).every(([k, v]) => G.state.res[k] >= v);
}

const lastPointer = { x: 0, y: 0 };
window.addEventListener('pointermove', e => { lastPointer.x = e.clientX; lastPointer.y = e.clientY; });

UI.init(api);
const input = setupInput(canvas, view, api);

// ---------- game events ----------
on('toast', t => {
  UI.toast(t);
  if (t.kind === 'love') sfx('love');
  else if (t.kind === 'bad') sfx('bad');
  else if (t.kind === 'good') sfx('good');
});
on('event', ev => { if (!G.demo) UI.showEvent(ev); });
on('election', e => { if (!G.demo) UI.showElection(e); });
on('victory', () => { if (!G.demo) { UI.showVictory(); saveGame(); track('victory', { day: G.state.time.day }); } });
on('goal', g => { if (!G.demo) track('goal_complete', { goal: g.text }); });
on('gameover', () => { if (!G.demo && inGame) { clearSave(); UI.showGameOver(); } });
on('built', () => { if (!G.demo) sfx('built'); });
on('dug', () => {
  const now = performance.now();
  if (!G.demo && now - lastDigSfx > 120) { sfx('dig'); lastDigSfx = now; }
});
on('newday', () => { if (!G.demo) saveGame(); });
on('removed', r => { if (selected?.type === 'rabbit' && selected.id === r.id) select(null); });

window.addEventListener('pagehide', () => { if (inGame) saveGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && inGame) saveGame(); });

// ---------- boot ----------
startDemo();
UI.showTitle();

let last = performance.now();
let demoT = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (G.capture) { requestAnimationFrame(loop); return; } // trailer capture drives frames manually
  if (G.state) {
    if (!G.paused && !G.modal) update((dt * G.speed) / SEC_PER_HOUR);
    if (G.demo) {
      demoT += dt;
      view.cam.tx = Math.sin(demoT * 0.08) * 6;
      view.cam.ty = -3.4 + Math.sin(demoT * 0.05) * 1.2;
    } else {
      input.update(dt);
      saveTimer += dt;
      if (saveTimer > 30) { saveTimer = 0; saveGame(); }
    }
    view.frame(dt);
    UI.tick(dt);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// expose for debugging
window.__bunderground = {
  G, view, update, markRect, placeRoom, initDerived, api, UI, makeRabbit, releaseRabbit,
  // deterministic frame stepping for recording footage
  capture: {
    start() { G.capture = true; },
    stop() { G.capture = false; view.camOverride = null; },
    step(dt, simHours = 0) { if (simHours > 0) update(simHours); view.frame(dt); if (!G.demo) UI.tick(1); },
  },
};
void W; void cellX; void floorY;
