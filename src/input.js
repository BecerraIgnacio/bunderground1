// Mouse, touch and keyboard input.
import { W, H, ROOMS, MATS, ORES, MAT } from './data.js';
import { G, roomById } from './game.js';
import { idx, inb } from './world.js';
import { canPlace, isRoomFloor } from './sim.js';

export function setupInput(canvas, view, api) {
  const pointers = new Map();
  let drag = null;      // { mode: 'pan'|'rect', sx, sy, lx, ly, moved, cell }
  let pinch = null;
  let hoverCell = null;
  const keys = new Set();

  const cellAt = (px, py) => view.pick(px, py);

  function updateHover(px, py) {
    const c = cellAt(px, py);
    hoverCell = c;
    const tool = api.tool();
    if (!c) { view.terrain.showHover(null); api.tooltip(null); return; }
    if (tool === 'build') {
      const type = api.buildType();
      if (type) {
        const def = ROOMS[type];
        const ax = c.x - Math.floor((def.w - 1) / 2), ay = c.y;
        const chk = canPlace(type, ax, ay);
        view.terrain.showGhost(ax, ay - def.h + 1, ax + def.w - 1, ay, chk.ok);
        view.terrain.showHover(null);
        api.tooltip(chk.ok ? `${def.icon} ${def.name} — click to place` : `❌ ${chk.why}`);
        return;
      }
    }
    if (drag?.mode === 'rect') {
      view.terrain.showGhost(drag.cell.x, drag.cell.y, c.x, c.y, true, tool === 'dig' ? 0xffd65a : 0xff8a80);
    } else view.terrain.showGhost(null);
    view.terrain.showHover(c.x, c.y);
    // tooltip
    if (!inb(c.x, c.y)) { api.tooltip(null); return; }
    const i = idx(c.x, c.y), g = G.state.grid;
    const r = tool === 'select' ? view.pickRabbit(px, py) : null;
    if (r) { api.tooltip(`🐰 <b>${r.name}</b>`); return; }
    const roomId = G.roomAt[i];
    if (roomId) {
      const room = roomById(roomId);
      api.tooltip(`${ROOMS[room.type].icon} ${ROOMS[room.type].name}${room.built ? '' : ' (building)'}`);
      return;
    }
    const m = g.mat[i];
    if (m === MAT.AIR) { api.tooltip(G.reach[i] ? null : '🕳️ Hidden cave (not connected)'); return; }
    const ore = g.ore[i] ? ` · ${ORES[g.ore[i]].name}` : '';
    const note = m === MAT.BEDROCK ? ' · too hard to dig' : isRoomFloor(i) ? ' · room floor' : g.mark[i] ? ' · marked for digging' : '';
    api.tooltip(`${MATS[m].name}${ore}${note}`);
  }

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    api.onInteract();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      drag = null;
      view.terrain.showGhost(null);
      return;
    }
    const tool = api.tool();
    const c = cellAt(e.clientX, e.clientY);
    const panBtn = e.button === 1 || e.button === 2;
    if (panBtn && e.button === 2 && tool !== 'select') {
      api.setTool('select');
      drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: true };
      return;
    }
    const rectMode = !panBtn && (tool === 'dig' || tool === 'undig') && c && inb(c.x, c.y);
    drag = {
      mode: rectMode ? 'rect' : 'pan',
      sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY,
      moved: false, cell: c, button: e.button, type: e.pointerType,
    };
    if (rectMode) view.terrain.showGhost(c.x, c.y, c.x, c.y, true, tool === 'dig' ? 0xffd65a : 0xff8a80);
  });

  canvas.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      view.zoom(pinch.d / Math.max(10, d));
      const wpp = view.worldPerPixel();
      view.pan(-(cx - pinch.cx) * wpp, (cy - pinch.cy) * wpp);
      pinch = { d, cx, cy };
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
      drag.lx = e.clientX; drag.ly = e.clientY;
      if (drag.mode === 'pan' && drag.moved) {
        const wpp = view.worldPerPixel();
        view.pan(-dx * wpp, dy * wpp);
        api.tooltip(null);
        return;
      }
    }
    if (e.pointerType === 'mouse' || drag) updateHover(e.clientX, e.clientY);
  });

  const end = e => {
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; drag = null; return; }
    if (!drag) return;
    const d = drag;
    drag = null;
    const tool = api.tool();
    if (d.mode === 'rect') {
      const c = cellAt(e.clientX, e.clientY) || d.cell;
      view.terrain.showGhost(null);
      api.markRect(d.cell.x, d.cell.y, c.x, c.y, tool === 'dig');
      if (e.pointerType !== 'mouse') view.terrain.showHover(null);
      return;
    }
    if (d.moved || d.button === 2 || d.button === 1) return;
    // click / tap
    const px = e.clientX, py = e.clientY;
    const c = cellAt(px, py);
    if (tool === 'build') {
      const type = api.buildType();
      if (type && c) {
        const def = ROOMS[type];
        api.place(type, c.x - Math.floor((def.w - 1) / 2), c.y);
        if (e.pointerType !== 'mouse') updateHover(px, py);
      }
      return;
    }
    if (tool === 'demolish') {
      if (c && inb(c.x, c.y) && G.roomAt[idx(c.x, c.y)]) api.demolishAsk(G.roomAt[idx(c.x, c.y)]);
      return;
    }
    const r = view.pickRabbit(px, py);
    if (r) { api.selectRabbit(r.id); return; }
    if (c && inb(c.x, c.y) && G.roomAt[idx(c.x, c.y)]) { api.selectRoom(G.roomAt[idx(c.x, c.y)]); return; }
    api.select(null);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); drag = null; pinch = null; view.terrain.showGhost(null); });
  canvas.addEventListener('pointerleave', e => {
    if (e.pointerType === 'mouse' && !drag) { view.terrain.showHover(null); api.tooltip(null); if (api.tool() !== 'build') view.terrain.showGhost(null); }
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const before = cellAt(e.clientX, e.clientY);
    view.zoom(Math.exp(e.deltaY * 0.0012));
    // zoom toward cursor
    if (before) {
      const k = 0.18;
      view.pan((before.wx - view.cam.tx) * k * Math.sign(-e.deltaY), (before.wy - view.cam.ty) * k * Math.sign(-e.deltaY));
    }
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (!api.inGame()) return;
    const k = e.key.toLowerCase();
    if (api.modalOpen()) { if (k === 'escape') api.closeModal(); return; }
    keys.add(k);
    if (k === ' ') { e.preventDefault(); api.togglePause(); }
    else if (k === '1') api.setSpeed(1);
    else if (k === '2') api.setSpeed(2);
    else if (k === '3') api.setSpeed(4);
    else if (k === 'x') api.setTool('dig');
    else if (k === 'c') api.setTool('undig');
    else if (k === 'b') api.setTool('build');
    else if (k === 'f') api.followSelected();
    else if (k === 'tab') { e.preventDefault(); api.openColony(); }
    else if (k === '+' || k === '=') view.zoom(0.85);
    else if (k === '-' || k === '_') view.zoom(1.18);
    else if (k === 'escape') api.escape();
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  return {
    update(dt) {
      const sp = view.cam.d * 0.9 * dt;
      let dx = 0, dy = 0;
      if (keys.has('a') || keys.has('arrowleft')) dx -= sp;
      if (keys.has('d') || keys.has('arrowright')) dx += sp;
      if (keys.has('w') || keys.has('arrowup')) dy += sp;
      if (keys.has('s') || keys.has('arrowdown')) dy -= sp;
      if (dx || dy) view.pan(dx, dy);
    },
    refreshHover() {
      if (hoverCell) view.terrain.showHover(hoverCell.x, hoverCell.y);
    },
    clearGhost() { view.terrain.showGhost(null); },
  };
}

export { W, H };
