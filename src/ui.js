// DOM user interface: HUD, inspector, build menu, modals, toasts.
import { RESOURCES, ROOMS, ROOM_ORDER, JOBS, JOB_ORDER, TRAITS, COATS, RES_ICON, CLANS } from './data.js';
import {
  G, cap, fmtHour, isKit, isElder, stage, rankOf, esteem, chief, chiefBonus, friendsOf, rel, skillLevel, fullName,
  roomById, rabbitById, totalBeds, adults, kits, builtRooms, countRooms, canAfford, isNight,
} from './game.js';
import { GOALS, fmtCost } from './sim.js';
import { hasBed, releaseRabbit } from './rabbits.js';
import { sfx, isMuted, setMuted } from './audio.js';
import { saveInfo } from './save.js';

const $ = s => document.querySelector(s);
const hex = n => '#' + n.toString(16).padStart(6, '0');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const moodEmoji = m => (m >= 80 ? '😄' : m >= 60 ? '🙂' : m >= 40 ? '😐' : m >= 20 ? '😟' : '😢');
const barColor = v => (v >= 60 ? '#6cc05a' : v >= 30 ? '#ffcf4a' : '#e5605b');

let api = null;
let inspected = null;
let acc = 0;
let logKey = '';
let buildOpen = false;
let modalOnClose = null;

// ---------- helpers ----------
function activity(r) {
  const T = r.task;
  if (!T) return 'Thinking…';
  const go = T.phase === 'go';
  switch (T.kind) {
    case 'eat': return go ? 'Heading to eat' : T.food === 'stew' ? 'Eating stew' : 'Munching a carrot';
    case 'sleep': return go ? 'Going to bed' : T.bed ? 'Sleeping' : 'Sleeping on the floor';
    case 'social': return go ? 'Off to socialize' : 'Chatting with friends';
    case 'play': return go ? 'Running to play' : 'Playing';
    case 'idle': return go ? 'Wandering' : 'Relaxing';
    case 'dig': return go ? 'Going to dig' : 'Digging';
    case 'build': return go ? 'Going to build' : 'Building';
    case 'work': {
      const w = { farmer: 'Farming', cook: 'Cooking stew', engineer: 'Making gears', caretaker: 'Caring for kits' }[T.job];
      return go ? `Going to work (${w})` : w;
    }
  }
  return '…';
}
const avatar = (r, size = 44) => {
  const c = COATS[r.coat] || COATS[0];
  return `<div class="avatar bun" style="width:${size}px;height:${size}px;background:${hex(c.body)}">${G.state.chief === r.id ? '👑' : ''}</div>`;
};
const dot = r => `<span class="dot" style="background:${hex((COATS[r.coat] || COATS[0]).body)}"></span>`;
const bar = (label, key) => `<div class="bar"><span>${label}</span><div class="track"><i data-b="${key}"></i></div><b data-v="${key}"></b></div>`;
const rlink = r => `<a class="link" data-rabbit="${r.id}">${esc(r.name)}</a>`;
const setHTML = (el, html) => { if (el._h !== html) { el.innerHTML = html; el._h = html; } };
const stars = n => '★'.repeat(Math.ceil(n / 2)) || '·';

// ---------- modal ----------
function showModal(html, { wide = false, onClose = null, pause = true } = {}) {
  const box = $('#modalBox');
  box.onclick = null;
  delete box.dataset.locked;
  delete box.dataset.tab;
  box.className = 'modal-box' + (wide ? ' wide' : '');
  box.innerHTML = html;
  $('#modal').classList.remove('hidden');
  if (pause) G.modal = true;
  modalOnClose = onClose;
  box.scrollTop = 0;
  return box;
}
function closeModal() {
  $('#modal').classList.add('hidden');
  G.modal = false;
  const f = modalOnClose;
  modalOnClose = null;
  if (f) f();
}

// ---------- toasts ----------
function toast({ text, kind = 'info', focus }) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  if (focus) el.onclick = () => api.selectRabbit(focus, true);
  const box = $('#toasts');
  box.prepend(el);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 4800);
}

// ---------- top bar ----------
function buildTopbar() {
  $('#resources').innerHTML = RESOURCES.map(r =>
    `<div class="res" id="res-${r.id}" title="${r.name}"><span class="ico">${r.icon}</span><b>0</b><small></small></div>`).join('');
}
function refreshTopbar() {
  const s = G.state;
  const pop = s.rabbits.length;
  for (const r of RESOURCES) {
    const el = document.getElementById('res-' + r.id);
    const v = Math.floor(s.res[r.id]);
    const c = cap(r.id);
    el.querySelector('b').textContent = v;
    el.querySelector('small').textContent = c === Infinity ? '' : `/${c}`;
    el.classList.toggle('full', v >= c);
    if (r.id === 'carrots') el.classList.toggle('low', s.res.carrots + s.res.stew * 2 < pop * 3);
  }
  const avg = pop ? s.rabbits.reduce((a, r) => a + r.mood, 0) / pop : 0;
  const ad = adults().length, beds = totalBeds();
  $('#popChip').innerHTML = `🐰 ${pop} <span title="Adults / beds" style="opacity:.8">· 🛏️ ${ad}/${beds}</span> · <span title="Average mood">${moodEmoji(avg)} ${Math.round(avg)}</span>`;
  $('#popChip').style.borderColor = ad > beds ? 'var(--red)' : '';
  $('#clockChip').textContent = `${isNight(s.time.hour) ? '🌙' : '☀️'} Day ${s.time.day} · ${fmtHour(s.time.hour)}`;
  const sp = G.paused ? 0 : G.speed;
  document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.speed === sp));
}

function refreshGoal() {
  const s = G.state;
  const el = $('#goalCard');
  if (s.goal >= GOALS.length) {
    el.innerHTML = `<div class="goal-top"><span>🏆 Legendary Warren</span></div><div class="goal-text">All goals complete!</div><div class="goal-hint">Keep growing your warren — can you reach 40 rabbits?</div>`;
    return;
  }
  const g = GOALS[s.goal];
  const [v, t] = g.prog(s);
  el.innerHTML = `<div class="goal-top"><span>🎯 Goal ${s.goal + 1}/${GOALS.length}</span><span>${Math.min(v, t)}/${t}</span></div>
    <div class="goal-text">${esc(g.text)}</div><div class="goal-hint">${esc(g.hint)}</div>
    <div class="pbar"><i style="width:${Math.min(100, (v / t) * 100)}%"></i></div>`;
}

function refreshLog() {
  const s = G.state;
  const key = s.log.length + (s.log[0]?.text || '');
  if (key === logKey) return;
  logKey = key;
  $('#log').innerHTML = s.log.slice(0, 8).map(l => `<li class="${l.kind}">${esc(l.text)}</li>`).join('');
}

// ---------- inspector ----------
function rabbitPanel(r) {
  return `
  <div class="insp-head">${avatar(r)}
    <div><div class="insp-name">${esc(r.name)} <small>${esc(r.clan)}</small></div><div class="insp-sub" data-f="sub"></div></div>
    <button class="x" data-act="close" title="Close">✕</button>
  </div>
  <div class="thought" data-f="thought"></div>
  <div class="bars">${bar('😊 Mood', 'mood')}${bar('🥕 Hunger', 'hunger')}${bar('⚡ Energy', 'energy')}${bar('💬 Social', 'social')}</div>
  <label class="row" data-f="jobrow">Job
    <select data-f="job">${JOB_ORDER.map(j => `<option value="${j}">${JOBS[j].icon} ${JOBS[j].name}</option>`).join('')}</select>
  </label>
  <div class="section-title">Personality</div>
  <div class="tags">${r.traits.map(t => TRAITS[t]).filter(Boolean).map(t => `<span class="tag" title="${esc(t.desc)}">${t.icon} ${t.name}</span>`).join('')}</div>
  <div class="section-title">Skills</div><div class="skills" data-f="skills"></div>
  <div class="section-title">Relationships</div><div class="rels" data-f="rels"></div>
  <div class="section-title">Feelings</div><div class="tags" data-f="buffs"></div>
  <div class="btns"><button class="btn alt" data-act="follow">📷 Follow</button></div>`;
}
function refreshRabbitPanel(r) {
  const el = $('#inspector');
  const f = k => el.querySelector(`[data-f="${k}"]`);
  const sex = r.sex === 'f' ? '♀ Doe' : '♂ Buck';
  setHTML(f('sub'), `${sex} · ${stage(r)} · ${Math.floor(r.age)} days · <b>${rankOf(r)}</b><br>${activity(r)}`);
  f('thought').textContent = r.thought || '…';
  const vals = { mood: r.mood, hunger: r.needs.hunger, energy: r.needs.energy, social: r.needs.social };
  for (const [k, v] of Object.entries(vals)) {
    const b = el.querySelector(`[data-b="${k}"]`);
    b.style.width = `${v}%`; b.style.background = barColor(v);
    el.querySelector(`[data-v="${k}"]`).textContent = Math.round(v);
  }
  const sel = f('job');
  if (document.activeElement !== sel) sel.value = r.job;
  sel.disabled = isKit(r);
  f('jobrow').title = isKit(r) ? 'Kits are too young to work' : '';
  setHTML(f('skills'), ['builder', 'farmer', 'cook', 'engineer', 'caretaker']
    .map(k => `<span>${JOBS[k].icon} ${JOBS[k].name} <b>${stars(skillLevel(r.skills[k]))}</b></span>`).join(''));
  const s = G.state;
  const lines = [];
  if (r.partner) { const p = rabbitById(r.partner); if (p) lines.push(`💕 Partner: ${rlink(p)}`); }
  if (r.parents) {
    const ps = r.parents.map(rabbitById).filter(Boolean);
    if (ps.length) lines.push(`👪 Parents: ${ps.map(rlink).join(' & ')}`);
  }
  const children = s.rabbits.filter(o => o.parents && o.parents.includes(r.id));
  if (children.length) lines.push(`🍼 Kits: ${children.map(rlink).join(', ')}`);
  const others = s.rabbits.filter(o => o !== r && o.id !== r.partner).map(o => ({ o, v: rel(r, o) })).sort((a, b) => b.v - a.v);
  const friends = others.filter(x => x.v >= 40).slice(0, 4);
  if (friends.length) lines.push(`😊 Friends: ${friends.map(x => `${rlink(x.o)} <small>(${Math.round(x.v)})</small>`).join(', ')}`);
  const rivals = others.filter(x => x.v <= -20).slice(-3);
  if (rivals.length) lines.push(`😤 Rivals: ${rivals.map(x => rlink(x.o)).join(', ')}`);
  if (!lines.length) lines.push('<span class="muted">Still getting to know everyone.</span>');
  setHTML(f('rels'), lines.map(l => `<div>${l}</div>`).join(''));
  const feel = [];
  if (!isKit(r) && !hasBed(r)) feel.push('<span class="tag bad">No bed −8</span>');
  if (r.partner) feel.push('<span class="tag love">Has a partner +4</span>');
  for (const b of r.buffs) feel.push(`<span class="tag ${b.v >= 0 ? 'good' : 'bad'}">${esc(b.label)} ${b.v >= 0 ? '+' : ''}${b.v}</span>`);
  for (const t of r.traits) if (TRAITS[t]?.mood) feel.push(`<span class="tag ${TRAITS[t].mood > 0 ? 'good' : 'bad'}">${TRAITS[t].name} ${TRAITS[t].mood > 0 ? '+' : ''}${TRAITS[t].mood}</span>`);
  if (r.low > 6) feel.push('<span class="tag bad">Thinking of leaving…</span>');
  setHTML(f('buffs'), feel.join('') || '<span class="muted">Feeling ordinary.</span>');
}

function roomPanel(room) {
  const def = ROOMS[room.type];
  return `<div class="insp-head"><div class="avatar" style="background:#fff4d6">${def.icon}</div>
    <div><div class="insp-name">${def.name}</div><div class="insp-sub">${def.w}×${def.h} room</div></div>
    <button class="x" data-act="close">✕</button></div>
    <p class="muted" style="margin:10px 0">${esc(def.desc)}</p>
    <div data-f="status"></div>
    <div class="btns"><button class="btn red" data-act="demolish">💥 Remove room</button></div>`;
}
function refreshRoomPanel(room) {
  const s = G.state, def = ROOMS[room.type];
  const el = $('#inspector').querySelector('[data-f="status"]');
  const here = s.rabbits.filter(r => r.task && r.task.roomId === room.id && r.task.phase === 'do');
  const names = list => list.length ? list.map(rlink).join(', ') : '<span class="muted">nobody</span>';
  let html = '';
  if (!room.built) {
    const p = Math.min(100, (room.prog / def.work) * 100);
    const builders = s.rabbits.filter(r => r.task && r.task.kind === 'build' && r.task.roomId === room.id);
    html = `<b>🏗️ Under construction</b><div class="pbar"><i style="width:${p}%"></i></div>
      <p class="muted">Builders: ${names(builders)}${builders.length ? '' : ' — assign ⛏️ Diggers or Free Buns'}</p>`;
  } else {
    switch (room.type) {
      case 'burrow': {
        const owners = s.rabbits.filter(r => r.bed && r.bed.roomId === room.id);
        html = `<b>🛏️ Beds: ${owners.length}/${def.beds.length}</b><p>${names(owners)}</p><p class="muted">Sleeping now: ${here.length}</p>`;
        break;
      }
      case 'farm':
        html = `<b>🌱 Crop growth</b><div class="pbar"><i style="width:${Math.round((room.crop || 0) * 100)}%"></i></div><p>Farmers: ${names(here.filter(r => r.task.kind === 'work'))}</p>`;
        break;
      case 'kitchen':
        html = `<p>👩‍🍳 Cooks: ${names(here.filter(r => r.task.kind === 'work'))}</p><p>Diners: ${names(here.filter(r => r.task.kind === 'eat'))}</p><p class="muted">2 🥕 → 1 🍲</p>`;
        break;
      case 'factory':
        html = `<p>🔧 Engineers: ${names(here)}</p><p class="muted">1 🟠 + 1 🪨 → 1 ⚙️</p>`;
        break;
      case 'lounge':
        html = `<p>💬 Chatting: ${names(here)}</p>`;
        break;
      case 'nursery':
        html = `<p>🍼 Kits in the colony: ${kits().length}/${countRooms('nursery') * 3}</p><p>Caretakers: ${names(here.filter(r => r.task.kind === 'work'))}</p><p>Sleeping/playing: ${names(here.filter(r => r.task.kind !== 'work'))}</p>`;
        break;
      case 'pantry':
        html = `<p>📦 Storage per resource: <b>${cap('carrots')}</b></p><p>Snacking: ${names(here)}</p>`;
        break;
      case 'council': {
        const c = chief();
        const next = s.lastElection === null ? 'at noon' : `on day ${Math.max(s.time.day, s.lastElection + 7)}`;
        html = `<p>👑 Chief: ${c ? rlink(c) : '<span class="muted">none yet</span>'}</p>${c ? `<p class="muted">Bonus: ${esc(chiefBonus(c).desc)}</p>` : ''}<p class="muted">Next election ${next}.</p><p>In session: ${names(here)}</p>`;
        break;
      }
      case 'clock':
        html = '<p>🌙 The Moonstone Clock hums softly. Rabbits from every warren will speak of this.</p>';
        break;
    }
  }
  setHTML(el, html);
}

function refreshInspector() {
  if (!inspected) return;
  if (inspected.type === 'rabbit') {
    const r = rabbitById(inspected.id);
    if (!r) return UI.clearInspector();
    refreshRabbitPanel(r);
  } else {
    const room = roomById(inspected.id);
    if (!room) return UI.clearInspector();
    refreshRoomPanel(room);
  }
}

// ---------- build menu ----------
function renderBuildMenu() {
  const s = G.state;
  $('#buildMenu').innerHTML = ROOM_ORDER.map(type => {
    const d = ROOMS[type];
    const cost = Object.entries(d.cost).map(([k, v]) => `<span class="${s.res[k] >= v ? '' : 'no'}">${v}${RES_ICON[k]}</span>`).join(' ');
    return `<button class="bcard ${canAfford(d.cost) ? '' : 'poor'} ${api.buildType() === type ? 'sel' : ''}" data-build="${type}">
      <div class="bname"><span>${d.icon}</span>${d.name}</div>
      <div class="bsize">${d.w}×${d.h} cells</div>
      <div class="bcost">${cost}</div>
      <div class="bdesc">${esc(d.desc)}</div></button>`;
  }).join('');
}
// update affordability in place so clicks never land on a replaced node
function refreshBuildMenu() {
  const s = G.state;
  document.querySelectorAll('#buildMenu [data-build]').forEach(card => {
    const d = ROOMS[card.dataset.build];
    card.classList.toggle('poor', !canAfford(d.cost));
    const spans = card.querySelectorAll('.bcost span');
    Object.entries(d.cost).forEach(([k, v], i) => spans[i]?.classList.toggle('no', s.res[k] < v));
  });
}

// ---------- colony overview ----------
function colonyTab(tab) {
  const s = G.state;
  if (tab === 'rabbits') {
    const rows = [...s.rabbits].sort((a, b) => JOB_ORDER.indexOf(a.job) - JOB_ORDER.indexOf(b.job) || a.name.localeCompare(b.name));
    return `<table class="roster"><tr><th>Rabbit</th><th>Age</th><th>Job</th><th>Mood</th><th>Doing</th></tr>
      ${rows.map(r => `<tr>
        <td>${dot(r)}<a class="link" data-rabbit="${r.id}">${esc(r.name)}</a>${s.chief === r.id ? ' 👑' : ''}${r.partner ? ' 💕' : ''}</td>
        <td>${stage(r)}</td>
        <td>${isKit(r) ? '<span class="muted">too young</span>' : `<select data-job="${r.id}">${JOB_ORDER.map(j => `<option value="${j}" ${r.job === j ? 'selected' : ''}>${JOBS[j].icon} ${JOBS[j].name}</option>`).join('')}</select>`}</td>
        <td><span class="minibar"><i style="width:${r.mood}%;background:${barColor(r.mood)}"></i></span> ${moodEmoji(r.mood)}</td>
        <td class="muted">${activity(r)}</td></tr>`).join('')}</table>
      <div class="btns"><button class="btn alt" data-act="autojobs">✨ Auto-assign jobs</button></div>`;
  }
  if (tab === 'society') {
    const c = chief();
    const council = countRooms('council');
    const eldest = [...adults()].sort((a, b) => b.age - a.age)[0];
    const pairs = [];
    const R = s.rabbits;
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) pairs.push({ a: R[i], b: R[j], v: rel(R[i], R[j]) });
    const couples = R.filter(r => r.partner && r.partner > r.id).map(r => [r, rabbitById(r.partner)]).filter(p => p[1]);
    const best = pairs.filter(p => p.v >= 40 && p.a.partner !== p.b.id).sort((a, b) => b.v - a.v).slice(0, 6);
    const rivals = pairs.filter(p => p.v <= -20).sort((a, b) => a.v - b.v).slice(0, 4);
    const clans = CLANS.map(cl => ({ cl, n: R.filter(r => r.clan === cl).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
    const popular = [...R].sort((a, b) => friendsOf(b).length - friendsOf(a).length)[0];
    const ranking = [...adults()].sort((a, b) => esteem(b) - esteem(a)).slice(0, 5);
    return `<div class="grid2">
      <div class="panel"><h3>👑 Leadership</h3>${council
        ? (c ? `<p><b>${rlink(c)}</b> is Chief.<br><span class="muted">${esc(chiefBonus(c).desc)}</span></p><p class="muted">Next election on day ${s.lastElection + 7}.</p>` : '<p>An election will be held at noon.</p>')
        : `<p class="muted">No Council Hall yet. ${eldest ? `The eldest, ${rlink(eldest)}, keeps order informally.` : ''} Build a Council Hall to elect a Chief and set policies.</p>`}</div>
      <div class="panel"><h3>💕 Couples (${couples.length})</h3>${couples.length ? couples.map(([a, b]) => `<div>${rlink(a)} 💕 ${rlink(b)}</div>`).join('') : '<p class="muted">No couples yet. Rabbits fall in love while socializing.</p>'}</div>
      <div class="panel"><h3>🤝 Closest friendships</h3>${best.length ? best.map(p => `<div>${rlink(p.a)} & ${rlink(p.b)} <span class="muted">(${Math.round(p.v)})</span></div>`).join('') : '<p class="muted">Friendships grow at work, in the lounge and while wandering.</p>'}
        ${rivals.length ? `<h3 style="margin-top:8px">😤 Rivalries</h3>${rivals.map(p => `<div>${rlink(p.a)} vs ${rlink(p.b)}</div>`).join('')}` : ''}</div>
      <div class="panel"><h3>🏅 Most esteemed</h3>${ranking.map(r => `<div>${rlink(r)} — ${rankOf(r)} <span class="muted">(${esteem(r)})</span></div>`).join('')}
        ${popular ? `<p class="muted">Most popular: ${rlink(popular)} with ${friendsOf(popular).length} friends.</p>` : ''}</div>
      <div class="panel"><h3>🏡 Clans</h3>${clans.map(x => `<div>${x.cl} <span class="minibar"><i style="width:${(x.n / R.length) * 100}%;background:var(--brown-l)"></i></span> ${x.n}</div>`).join('')}</div>
      <div class="panel"><h3>🧺 Warren life</h3><div>Adults: ${adults().length} · Kits: ${kits().length} · Elders: ${R.filter(isElder).length}</div><div>Beds: ${totalBeds()} · Nurseries: ${countRooms('nursery')}</div>
        ${s.buffs.length ? `<div class="tags" style="margin-top:6px">${s.buffs.map(b => `<span class="tag">${b.icon} ${esc(b.name)} (${Math.ceil(b.h)}h)</span>`).join('')}</div>` : ''}</div>
    </div>`;
  }
  if (tab === 'policies') {
    if (!countRooms('council')) return '<div class="panel"><h3>🔒 Policies locked</h3><p>Build a <b>Council Hall</b> to let your rabbits vote on work hours and rations.</p></div>';
    const p = s.policies;
    const opt = (key, val, label, sub) => `<button class="${p[key] === val ? 'on' : ''}" data-policy="${key}:${val}">${label}<small>${sub}</small></button>`;
    return `<div class="panel"><h3>⏰ Work hours</h3><div class="opt">
      ${opt('hours', 'short', '🌤️ Short days', '8:00–18:00 · +5 mood')}
      ${opt('hours', 'normal', '☀️ Normal', '7:00–19:30')}
      ${opt('hours', 'long', '🔥 Long days', '6:00–21:00 · −8 mood')}</div></div>
      <div class="panel" style="margin-top:10px"><h3>🥕 Rations</h3><div class="opt">
      ${opt('rations', 'lean', '🥢 Lean', 'eat only when starving · −6 mood')}
      ${opt('rations', 'normal', '🍽️ Normal', 'balanced meals')}
      ${opt('rations', 'feast', '🎉 Feast', 'eat often & more · +6 mood')}</div></div>`;
  }
  if (tab === 'stats') {
    const st = s.stats;
    const cards = [
      ['🐰', s.rabbits.length, 'Rabbits'], ['🏠', s.rooms.filter(r => r.built).length, 'Rooms built'], ['⛏️', st.dug, 'Cells dug'],
      ['🥕', st.carrots, 'Carrots harvested'], ['🍲', st.stew, 'Stew cooked'], ['⚙️', st.gears, 'Gears made'],
      ['🟠', st.copper, 'Copper mined'], ['💎', st.crystals, 'Crystals found'], ['🍼', st.born, 'Kits born'],
      ['🧳', st.joined, 'Newcomers'], ['👋', st.left, 'Departures'], ['🗳️', st.elections, 'Elections'], ['📅', s.time.day, 'Days'],
    ];
    return `<div class="statgrid">${cards.map(c => `<div class="stat"><b>${c[0]} ${c[1]}</b><span>${c[2]}</span></div>`).join('')}</div>`;
  }
  return helpHTML();
}

function helpHTML() {
  return `<ul class="help-list">
    <li><b>Move the camera:</b> drag with the mouse (or one finger), right-drag, or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>. Zoom with the wheel, pinch, or <kbd>+</kbd><kbd>−</kbd>.</li>
    <li><b>⛏️ Dig:</b> drag over dirt to mark it. Diggers (and Free Buns) dig it out and collect 🧱 clay, 🪨 stone, 🟠 copper and 💎 crystals.</li>
    <li><b>🏗️ Build:</b> rooms need dug-out space with <b>solid ground below</b>, connected to the warren. Builders finish construction.</li>
    <li><b>Rabbits</b> eat, sleep, socialize and work on their own. Click one to see its needs, friends and thoughts, and to change its job.</li>
    <li><b>Beds:</b> every grown rabbit wants a bed. Free beds attract travelers.</li>
    <li><b>Love & kits:</b> rabbits bond while socializing. Couples with a Nursery, good mood and spare food have kits.</li>
    <li><b>Stew</b> (Kitchen) is more filling than raw carrots and cheers rabbits up.</li>
    <li><b>Society:</b> build a Council Hall to elect a Chief — their personality gives the whole colony a bonus — and to set policies.</li>
    <li>Unhappy or starving rabbits will eventually leave. Keep an eye on 😊 mood and 🥕 food!</li>
    <li>Keys: <kbd>Space</kbd> pause · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> speed · <kbd>X</kbd> dig · <kbd>C</kbd> cancel dig · <kbd>B</kbd> build · <kbd>Tab</kbd> colony · <kbd>Esc</kbd> back</li>
  </ul>`;
}

function openColony(tab = 'rabbits') {
  const tabs = [['rabbits', '🐰 Rabbits'], ['society', '🤝 Society'], ['policies', '📜 Policies'], ['stats', '📊 Stats'], ['help', '❓ Help']];
  const box = showModal(`<h2>🐰 ${esc(G.state.name)} Warren <button class="x" data-close>✕</button></h2>
    <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="tabBody">${colonyTab(tab)}</div>`, { wide: true, pause: false });
  box.dataset.tab = tab;
}

// ---------- public API ----------
export const UI = {
  init(a) {
    api = a;
    buildTopbar();
    document.querySelectorAll('#speed button').forEach(b => b.onclick = () => { sfx('click'); api.setSpeed(+b.dataset.speed); });
    $('#menuBtn').onclick = () => { sfx('click'); UI.openMenu(); };
    document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { sfx('tool'); api.setTool(b.dataset.tool); });
    $('#colonyBtn').onclick = () => { sfx('click'); openColony(); };
    $('#buildMenu').onclick = e => {
      const c = e.target.closest('[data-build]');
      if (c) { sfx('click'); api.setTool('build', c.dataset.build); }
    };

    const inspector = $('#inspector');
    inspector.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      const rl = e.target.closest('[data-rabbit]');
      if (rl) { api.selectRabbit(+rl.dataset.rabbit, true); return; }
      if (act === 'close') api.select(null);
      if (act === 'follow' && inspected) api.follow(inspected.id);
      if (act === 'demolish' && inspected) {
        const room = roomById(inspected.id);
        if (room) UI.confirmDemolish(room);
      }
    });
    inspector.addEventListener('change', e => {
      if (e.target.dataset.f === 'job' && inspected) {
        const r = rabbitById(inspected.id);
        if (r) { r.job = e.target.value; releaseRabbit(r); r.thought = `New job: ${JOBS[r.job].name}! ${JOBS[r.job].icon}`; sfx('click'); }
      }
    });

    const modal = $('#modal');
    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.closest('[data-close]')) { if (!$('#modalBox').dataset.locked) closeModal(); return; }
      const box = $('#modalBox');
      const tab = e.target.closest('[data-tab]');
      if (tab) {
        box.dataset.tab = tab.dataset.tab;
        box.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b === tab));
        $('#tabBody').innerHTML = colonyTab(tab.dataset.tab);
        sfx('click');
        return;
      }
      const rl = e.target.closest('[data-rabbit]');
      if (rl) { closeModal(); api.selectRabbit(+rl.dataset.rabbit, true); return; }
      const pol = e.target.closest('[data-policy]');
      if (pol) {
        const [k, v] = pol.dataset.policy.split(':');
        G.state.policies[k] = v;
        sfx('click');
        $('#tabBody').innerHTML = colonyTab('policies');
        return;
      }
      if (e.target.closest('[data-act="autojobs"]')) { api.autoJobs(); $('#tabBody').innerHTML = colonyTab('rabbits'); }
    });
    modal.addEventListener('change', e => {
      const id = e.target.dataset.job;
      if (id) {
        const r = rabbitById(+id);
        if (r) { r.job = e.target.value; releaseRabbit(r); sfx('click'); }
      }
    });
  },

  tick(dt) {
    acc += dt;
    if (acc < 0.25 || !G.state || G.demo) return;
    acc = 0;
    refreshTopbar();
    refreshGoal();
    refreshLog();
    refreshInspector();
    if (buildOpen) refreshBuildMenu();
  },

  showHUD(on) { $('#hud').classList.toggle('hidden', !on); logKey = ''; },

  toast,
  closeModal,
  isModalOpen: () => !$('#modal').classList.contains('hidden'),

  setTool(tool, type) {
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    buildOpen = tool === 'build' && !type;
    $('#buildMenu').classList.toggle('hidden', !buildOpen);
    if (buildOpen) renderBuildMenu();
    const hints = {
      dig: '⛏️ Drag over dirt to mark it for digging · right-click or Esc to stop',
      undig: '🚫 Drag over marked cells to cancel digging',
      build: type ? `${ROOMS[type].icon} Place ${ROOMS[type].name} (${fmtCost(ROOMS[type].cost)}) · needs dug space + solid ground below · Esc to cancel` : '',
      demolish: '💥 Click a room to remove it (50% refund)',
    };
    UI.hint(hints[tool] || null);
  },
  hint(text) {
    const h = $('#hint');
    h.classList.toggle('hidden', !text);
    if (text) h.textContent = text;
  },
  tooltip(px, py, html) {
    const t = $('#tooltip');
    if (!html) { t.classList.add('hidden'); return; }
    t.innerHTML = html;
    t.classList.remove('hidden');
    const w = t.offsetWidth;
    t.style.left = `${Math.min(window.innerWidth - w - 8, px + 16)}px`;
    t.style.top = `${py + 18}px`;
  },

  inspectRabbit(id) {
    const r = rabbitById(id);
    if (!r) return;
    inspected = { type: 'rabbit', id };
    const el = $('#inspector');
    el.innerHTML = rabbitPanel(r);
    el.classList.remove('hidden');
    document.body.classList.add('insp-open');
    refreshRabbitPanel(r);
  },
  inspectRoom(id) {
    const room = roomById(id);
    if (!room) return;
    inspected = { type: 'room', id };
    const el = $('#inspector');
    el.innerHTML = roomPanel(room);
    el.classList.remove('hidden');
    document.body.classList.add('insp-open');
    refreshRoomPanel(room);
  },
  clearInspector() {
    inspected = null;
    $('#inspector').classList.add('hidden');
    document.body.classList.remove('insp-open');
  },

  confirmDemolish(room) {
    const def = ROOMS[room.type];
    const box = showModal(`<h2><span class="big">💥</span>Remove ${def.name}?</h2>
      <p>You'll get back ${room.built ? 'half' : 'all'} of its materials: ${fmtCost(Object.fromEntries(Object.entries(def.cost).map(([k, v]) => [k, Math.floor(v * (room.built ? 0.5 : 1))])))}.</p>
      <div class="btns"><button class="btn red" data-ok>Remove it</button><button class="btn alt" data-close>Keep it</button></div>`);
    box.querySelector('[data-ok]').onclick = () => { closeModal(); api.demolish(room); };
  },

  openColony,

  openMenu() {
    const box = showModal(`<h2>☰ Menu <button class="x" data-close>✕</button></h2>
      <div class="choices">
        <button class="btn green" data-close>▶ Resume</button>
        <button class="btn alt" data-m="save">💾 Save now</button>
        <button class="btn alt" data-m="export">📤 Export save file</button>
        <button class="btn alt" data-m="sound">${isMuted() ? '🔇 Sound: off' : '🔊 Sound: on'}</button>
        <button class="btn alt" data-m="help">❓ How to play</button>
        <button class="btn alt" data-m="quit">🏠 Save & quit to title</button>
      </div>`);
    box.onclick = e => {
      const m = e.target.closest('[data-m]')?.dataset.m;
      if (!m) return;
      sfx('click');
      if (m === 'save') { api.save(true); closeModal(); }
      if (m === 'export') api.exportSave();
      if (m === 'sound') { setMuted(!isMuted()); e.target.textContent = isMuted() ? '🔇 Sound: off' : '🔊 Sound: on'; }
      if (m === 'help') { closeModal(); openColony('help'); }
      if (m === 'quit') { closeModal(); api.quit(); }
    };
  },

  showEvent(ev) {
    sfx('event');
    const box = showModal(`<h2><span class="big">${ev.icon}</span>${esc(ev.title)}</h2><p>${esc(ev.text)}</p>
      <div class="choices">${ev.choices.map((c, i) => `<button class="btn ${i === 0 ? '' : 'alt'}" data-c="${i}" ${c.disabled ? 'disabled' : ''}>${esc(c.label)}${c.disabled ? `<div class="why">${esc(c.why)}</div>` : ''}</button>`).join('')}</div>`);
    box.dataset.locked = '1';
    box.onclick = e => {
      const b = e.target.closest('[data-c]');
      if (!b || b.disabled) return;
      const c = ev.choices[+b.dataset.c];
      const result = c.run() || '';
      sfx('good');
      box.onclick = null;
      box.innerHTML = `<h2><span class="big">${ev.icon}</span>${esc(ev.title)}</h2><p>${esc(result)}</p><div class="btns"><button class="btn green" data-ok>OK</button></div>`;
      box.querySelector('[data-ok]').onclick = () => { delete box.dataset.locked; closeModal(); };
    };
  },

  showElection({ results, prev, total }) {
    sfx('win');
    const box = showModal(`<h2><span class="big">🗳️</span>Election Day!</h2>
      <p>${total} rabbits cast their votes in the Council Hall.</p>
      ${results.map((c, i) => `<div class="cand ${i === 0 ? 'win' : ''}">${i === 0 ? '👑' : '🐰'} <div><b>${esc(c.name)}</b><div class="muted">${esc(c.bonus.desc)}</div></div><span class="votes">${c.votes} votes</span></div>`).join('')}
      <p>${prev && prev === results[0].id ? 'The Chief was re-elected!' : `${esc(results[0].name)} is the new Chief!`}</p>
      <div class="btns"><button class="btn green" data-close>Hooray!</button></div>`);
    void box;
  },

  showVictory() {
    sfx('win');
    const s = G.state;
    showModal(`<h2><span class="big">🌙</span>The Moonstone Clock chimes!</h2>
      <p>After ${s.time.day} days, the <b>${esc(s.name)}</b> warren has built a wonder that rabbits will sing about for generations.</p>
      <p>${s.rabbits.length} rabbits live here. ${s.stats.born} kits were born, ${s.stats.dug} tunnels were dug and ${s.stats.stew} bowls of stew were shared.</p>
      <p><b>You win!</b> Your warren lives on — keep playing as long as you like.</p>
      <div class="btns"><button class="btn green" data-close>Keep playing</button></div>`);
  },

  showGameOver() {
    sfx('bad');
    const box = showModal(`<h2><span class="big">🍂</span>The warren is empty</h2>
      <p>The last rabbit has hopped away. The tunnels of <b>${esc(G.state.name)}</b> fall quiet… for now.</p>
      <div class="btns"><button class="btn green" data-ok>Found a new colony</button><button class="btn alt" data-q>Back to title</button></div>`);
    box.dataset.locked = '1';
    box.querySelector('[data-ok]').onclick = () => { delete box.dataset.locked; closeModal(); UI.newColonyDialog(); };
    box.querySelector('[data-q]').onclick = () => { delete box.dataset.locked; closeModal(); api.quit(false); };
  },

  showTitle() {
    $('#title').classList.remove('hidden');
    const info = saveInfo();
    const b = $('#titleButtons');
    b.innerHTML = `${info ? `<button class="btn green" data-t="continue">▶ Continue<small>${esc(info.name)} · Day ${info.day} · 🐰 ${info.pop}</small></button>` : ''}
      <button class="btn ${info ? 'alt' : 'green'}" data-t="new">🌱 New colony</button>
      <button class="btn alt" data-t="import">📥 Import save file</button>
      <button class="btn alt" data-t="help">❓ How to play</button>
      <input type="file" accept=".json,application/json" id="importFile" hidden />`;
    b.onclick = e => {
      const t = e.target.closest('[data-t]')?.dataset.t;
      if (!t) return;
      sfx('click');
      if (t === 'continue') api.continueGame();
      if (t === 'new') {
        if (info) {
          const box = showModal(`<h2>🌱 Start over?</h2><p>This will replace your current warren <b>${esc(info.name)}</b> (day ${info.day}). Export it first from the in-game menu if you want to keep it.</p>
            <div class="btns"><button class="btn red" data-ok>Start a new colony</button><button class="btn alt" data-close>Cancel</button></div>`, { pause: false });
          box.querySelector('[data-ok]').onclick = () => { closeModal(); UI.newColonyDialog(); };
        } else UI.newColonyDialog();
      }
      if (t === 'import') $('#importFile').click();
      if (t === 'help') showModal(`<h2>❓ How to play <button class="x" data-close>✕</button></h2>${helpHTML()}`, { pause: false });
    };
    $('#importFile').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try { api.importSave(await f.text()); } catch (err) { toast({ text: `Could not import: ${err.message}`, kind: 'bad' }); }
    };
  },
  hideTitle() { $('#title').classList.add('hidden'); },

  newColonyDialog() {
    const first = ['Clover', 'Moss', 'Thistle', 'Burrow', 'Carrot', 'Hazel', 'Dew', 'Fern', 'Bramble', 'Acorn'];
    const second = ['Hollow', 'Deep', 'Warren', 'Hill', 'Nook', 'Dell', 'Burrows', 'Glen', 'Bottom', 'Hearth'];
    const suggest = () => `${first[Math.floor(Math.random() * first.length)]} ${second[Math.floor(Math.random() * second.length)]}`;
    const box = showModal(`<h2>🌱 Found a new warren</h2>
      <p>Five brave rabbits have found a cozy spot under a meadow. What will you call their home?</p>
      <input class="name" id="colName" maxlength="24" value="${suggest()}" />
      <div class="btns"><button class="btn green" data-ok>Dig in! 🐰</button><button class="btn alt" data-rnd>🎲 Random name</button></div>`, { pause: false });
    const input = box.querySelector('#colName');
    input.focus(); input.select();
    const go = () => { const n = input.value.trim() || suggest(); closeModal(); api.newGame(n); };
    box.querySelector('[data-ok]').onclick = go;
    box.querySelector('[data-rnd]').onclick = () => { input.value = suggest(); };
    input.onkeydown = e => { if (e.key === 'Enter') go(); e.stopPropagation(); };
  },

  showWelcome() {
    showModal(`<h2><span class="big">🐰</span>Welcome to ${esc(G.state.name)}!</h2>
      <p>Five rabbits have moved in. They already have a <b>Cozy Burrow</b> and a <b>Carrot Farm</b>. Rabbits live their own lives — you guide the warren.</p>
      ${helpHTML()}
      <div class="btns"><button class="btn green" data-close>Let's dig! ⛏️</button></div>`);
  },
};
