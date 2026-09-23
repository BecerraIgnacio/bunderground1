// Grid generation and pathfinding.
import { W, H, EX, MAT, ORE } from './data.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const idx = (x, y) => y * W + x;
export const inb = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
export const cellX = x => x - W / 2 + 0.5;   // world x of cell center
export const floorY = y => -(y + 1);          // world y of cell floor
export const DIRS = [[1, 0], [-1, 0], [0, -1], [0, 1]];
export const HALL_Y = 3;

export function generateGrid(seed) {
  const R = mulberry32(seed);
  const n = W * H;
  const mat = new Array(n).fill(0);
  const ore = new Array(n).fill(0);
  const mark = new Array(n).fill(0);
  const prog = new Array(n).fill(0);
  const p1 = R() * 6, p2 = R() * 6, p3 = R() * 6;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const b1 = 6 + Math.sin(x * 0.35 + p1) * 1.2 + Math.sin(x * 0.13 + p2) * 0.8;
      const b2 = 12.5 + Math.sin(x * 0.27 + p2) * 1.5 + Math.sin(x * 0.09 + p3);
      const b3 = 19.5 + Math.sin(x * 0.31 + p3) * 1.4;
      let m = y < b1 ? MAT.TOPSOIL : y < b2 ? MAT.CLAY : y < b3 ? MAT.STONE : MAT.DEEP;
      if (x === 0 || x === W - 1 || y === H - 1) m = MAT.BEDROCK;
      mat[idx(x, y)] = m;
    }
  }

  const blob = (type, count, y0, y1, size) => {
    for (let k = 0; k < count; k++) {
      let x = 2 + Math.floor(R() * (W - 4));
      let y = y0 + Math.floor(R() * (y1 - y0));
      for (let s = 0; s < size; s++) {
        if (inb(x, y)) {
          const i = idx(x, y);
          if (mat[i] !== MAT.BEDROCK && mat[i] !== MAT.AIR) ore[i] = type;
        }
        const d = DIRS[Math.floor(R() * 4)];
        x += d[0]; y += d[1];
      }
    }
  };
  blob(ORE.PEBBLES, 9, 1, 11, 3);
  blob(ORE.COPPER, 12, 9, 25, 5);
  blob(ORE.CRYSTAL, 7, 19, 26, 3);
  blob(ORE.CRYSTAL, 2, 15, 19, 2);

  // small hidden caves in the deep
  for (let k = 0; k < 3; k++) {
    const cx = 5 + Math.floor(R() * (W - 10));
    const cy = 18 + Math.floor(R() * 6);
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        const dx = (x - cx) / 2.3, dy = (y - cy) / 1.2;
        if (dx * dx + dy * dy < 1 && inb(x, y) && mat[idx(x, y)] !== MAT.BEDROCK) {
          mat[idx(x, y)] = MAT.AIR; ore[idx(x, y)] = 0;
        }
      }
    }
  }

  // starting entrance shaft + hall
  for (let y = 0; y <= HALL_Y; y++) { mat[idx(EX, y)] = MAT.AIR; ore[idx(EX, y)] = 0; }
  for (let x = EX - 5; x <= EX + 5; x++) {
    mat[idx(x, HALL_Y)] = MAT.AIR; ore[idx(x, HALL_Y)] = 0;
    if (mat[idx(x, HALL_Y + 1)] === MAT.AIR) mat[idx(x, HALL_Y + 1)] = MAT.TOPSOIL;
  }
  return { mat, ore, mark, prog };
}

const prevBuf = new Int32Array(W * H);
const distBuf = new Int32Array(W * H);
const queue = new Int32Array(W * H);

// BFS over dug cells. goal(i) -> bool. Returns { goal, path } where path excludes start.
export function bfs(mat, start, goal, maxDist = 1e9) {
  prevBuf.fill(-2);
  let h = 0, t = 0;
  queue[t++] = start; prevBuf[start] = -1; distBuf[start] = 0;
  while (h < t) {
    const c = queue[h++];
    if (goal(c)) {
      const path = [];
      for (let p = c; p !== start && p >= 0; p = prevBuf[p]) path.push(p);
      path.reverse();
      return { goal: c, path };
    }
    if (distBuf[c] >= maxDist) continue;
    const cx = c % W, cy = (c / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inb(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (prevBuf[ni] !== -2 || mat[ni] !== MAT.AIR) continue;
      prevBuf[ni] = c; distBuf[ni] = distBuf[c] + 1;
      queue[t++] = ni;
    }
  }
  return null;
}

export function cellsWithin(mat, start, maxDist) {
  const out = [];
  bfs(mat, start, i => { out.push(i); return false; }, maxDist);
  return out;
}

export function reachFrom(mat, start) {
  const r = new Uint8Array(W * H);
  bfs(mat, start, i => { r[i] = 1; return false; });
  return r;
}
