// 3D furniture for each room type + construction sites.
import * as THREE from 'three';
import { W, DEPTH, FRONT, ROOMS } from '../data.js';
import { G, cap } from '../game.js';
import { floorY } from '../world.js';
import { toon, box, sph, cyl, cone, geoTorus, patternTexture, emojiTexture, textTexture } from './util.js';

const BACK = -FRONT + 0.03;
const WOOD = 0x9c6a3e, WOOD_L = 0xc8935c, WOOD_D = 0x6e4a2c;

const STYLE = {
  burrow: { kind: 'dots', c1: '#f6d3b3', c2: '#efbf98', floor: 0xd9a86c },
  farm: { kind: 'stripes', c1: '#dcebb5', c2: '#cfe2a0', floor: 0x8a6243 },
  kitchen: { kind: 'tiles', c1: '#e8f4f7', c2: '#b7dbe6', floor: 0xcaa27a },
  pantry: { kind: 'planks', c1: '#e2c795', c2: '#c9a974', floor: 0xb58858 },
  lounge: { kind: 'hearts', c1: '#f8d3df', c2: '#f3b8cb', floor: 0xc99466 },
  nursery: { kind: 'stars', c1: '#fbe6f1', c2: '#ffffff', floor: 0xe8c9a8 },
  factory: { kind: 'bricks', c1: '#b9bcc8', c2: '#9da1ae', floor: 0x77798a },
  council: { kind: 'bricks', c1: '#efe3c7', c2: '#dccca5', floor: 0xb98a5a },
  clock: { kind: 'stars', c1: '#2e3470', c2: '#8f98ff', floor: 0x4a4f8a },
};

function shell(g, room) {
  const st = STYLE[room.type], w = room.w, h = room.h;
  const tex = patternTexture(st.kind, st.c1, st.c2, w, h);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.02, h - 0.02), toon(0xffffff, { map: tex }));
  wall.position.set(w / 2, h / 2, -FRONT + 0.015);
  g.add(wall);
  box(g, w, 0.03, DEPTH, st.floor, w / 2, 0.015, 0);
  box(g, 0.09, h, 0.09, WOOD, 0.045, h / 2, BACK + 0.05);
  box(g, 0.09, h, 0.09, WOOD, w - 0.045, h / 2, BACK + 0.05);
  box(g, w, 0.08, 0.12, WOOD, w / 2, h - 0.04, BACK + 0.06);
  // ceiling beams (front to back)
  for (let x = 0.5; x < w; x += 1) box(g, 0.07, 0.06, DEPTH - 0.1, WOOD_D, x, h - 0.03, 0);
}
function lamp(g, x, y, z, color = 0xffe39a) {
  cyl(g, 0.006, 0.006, 0.16, 0x4a3526, x, y + 0.08, z);
  cone(g, 0.08, 0.06, WOOD_D, x, y + 0.01, z);
  sph(g, 0.055, color, x, y - 0.04, z, 1, 1, 1, { emissive: 0xffc860, ei: 1 });
}
function frame(g, x, y, emoji) {
  box(g, 0.28, 0.24, 0.02, WOOD_L, x, y, BACK + 0.01);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.18), new THREE.MeshBasicMaterial({ map: emojiTexture(emoji, false) }));
  p.position.set(x, y, BACK + 0.025);
  g.add(p);
}
function plant(g, x, z, s = 1) {
  cyl(g, 0.07 * s, 0.05 * s, 0.1 * s, 0xd9764f, x, 0.08 * s, z);
  sph(g, 0.09 * s, 0x6cc05a, x, 0.2 * s, z, 1, 1.1, 1);
  sph(g, 0.06 * s, 0x86d36b, x + 0.05 * s, 0.26 * s, z);
}

const BUILD = {
  burrow(g, room) {
    const blankets = [0x9ad0ff, 0xffb3c7, 0xc8f0a0, 0xffe08a];
    ROOMS.burrow.beds.forEach((b, i) => {
      const nest = new THREE.Mesh(geoTorus(0.17, 0.065), toon(0xe8c170));
      nest.rotation.x = Math.PI / 2; nest.position.set(b.x, 0.07, b.z);
      g.add(nest);
      sph(g, 0.16, 0xf0d69a, b.x, 0.05, b.z, 1, 0.3, 1);
      sph(g, 0.12, blankets[i], b.x + 0.03, 0.09, b.z + 0.04, 1.1, 0.35, 0.9);
      sph(g, 0.06, 0xffffff, b.x - 0.08, 0.11, b.z - 0.08, 1.2, 0.6, 0.9);
    });
    frame(g, 0.55, 0.62, '🥕');
    frame(g, 1.45, 0.66, '🌙');
    box(g, 0.5, 0.03, 0.14, WOOD_L, 1.0, 0.5, BACK + 0.07);
    cyl(g, 0.03, 0.03, 0.08, 0xfff2d8, 0.9, 0.555, BACK + 0.07);
    sph(g, 0.02, 0xffd36a, 0.9, 0.61, BACK + 0.07, 1, 1.4, 1, { emissive: 0xffa640, ei: 1 });
    lamp(g, 1, 0.82, -0.05);
  },
  farm(g, room) {
    const plants = [];
    box(g, room.w - 0.2, 0.14, 0.62, 0x6b4a33, room.w / 2, 0.07, -0.3);
    box(g, room.w - 0.26, 0.02, 0.56, 0x4a3222, room.w / 2, 0.145, -0.3);
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 8; k++) {
        const p = new THREE.Group();
        const x = 0.25 + k * ((room.w - 0.5) / 7), z = -0.45 + row * 0.28;
        cone(p, 0.045, 0.14, 0xff8a2a, 0, 0.0, 0).rotation.x = Math.PI;
        cone(p, 0.03, 0.2, 0x5fb24a, 0, 0.14, 0);
        cone(p, 0.03, 0.17, 0x6cc55a, 0.04, 0.12, 0).rotation.z = -0.5;
        cone(p, 0.03, 0.17, 0x6cc55a, -0.04, 0.12, 0).rotation.z = 0.5;
        p.position.set(x, 0.16, z);
        p.userData.off = Math.random();
        g.add(p);
        plants.push(p);
      }
    }
    for (let k = 0; k < 3; k++) {
      const x = 0.5 + k * 1.0;
      cyl(g, 0.006, 0.006, 0.12, 0x4a3526, x, 0.9, -0.3);
      box(g, 0.34, 0.03, 0.12, 0x5a5f6a, x, 0.83, -0.3);
      box(g, 0.3, 0.012, 0.09, 0xfff0b0, x, 0.812, -0.3, { emissive: 0xffe070, ei: 1 });
    }
    // watering can
    cyl(g, 0.06, 0.07, 0.12, 0x7fb6d9, room.w - 0.18, 0.09, 0.4);
    const sp = cyl(g, 0.012, 0.012, 0.14, 0x7fb6d9, room.w - 0.28, 0.13, 0.4); sp.rotation.z = 1.0;
    g.userData.tick = (t, rm) => {
      const s = 0.35 + 0.75 * Math.min(1, rm.crop || 0);
      for (const p of plants) {
        p.scale.setScalar(s * (0.9 + p.userData.off * 0.2));
        p.rotation.z = Math.sin(t * 1.5 + p.userData.off * 6) * 0.06;
      }
    };
  },
  kitchen(g, room) {
    box(g, 0.5, 0.42, 0.44, 0xc0504d, 0.42, 0.21, -0.38);
    box(g, 0.52, 0.03, 0.46, 0x3a3a44, 0.42, 0.43, -0.38);
    box(g, 0.2, 0.12, 0.02, 0x2b2b33, 0.42, 0.2, -0.155);
    sph(g, 0.03, 0xffa640, 0.42, 0.2, -0.14, 1, 1, 0.4, { emissive: 0xff7a1a, ei: 1 });
    const pot = cyl(g, 0.13, 0.11, 0.16, 0x8a8f9c, 0.42, 0.53, -0.38);
    const lid = sph(g, 0.13, 0x9aa0ad, 0.42, 0.61, -0.38, 1, 0.3, 1);
    box(g, 0.8, 0.34, 0.4, WOOD_L, 1.4, 0.17, -0.4);
    box(g, 0.84, 0.03, 0.44, 0xf2e8d8, 1.4, 0.35, -0.4);
    for (let k = 0; k < 3; k++) sph(g, 0.06, [0xffffff, 0xffd0a0, 0xbfe3f0][k], 1.15 + k * 0.25, 0.39, -0.35, 1, 0.45, 1);
    cone(g, 0.04, 0.12, 0xff8a2a, 1.62, 0.39, -0.45).rotation.z = Math.PI / 2;
    box(g, 0.9, 0.03, 0.14, WOOD, 1.35, 0.68, BACK + 0.07);
    for (let k = 0; k < 4; k++) cyl(g, 0.04, 0.04, 0.1, [0xffc0cb, 0xb5e7a0, 0xffe08a, 0xa0d8ff][k], 1.02 + k * 0.22, 0.745, BACK + 0.07);
    // dining table
    cyl(g, 0.2, 0.2, 0.03, WOOD_L, 1.5, 0.2, 0.2);
    cyl(g, 0.03, 0.05, 0.19, WOOD, 1.5, 0.1, 0.2);
    sph(g, 0.05, 0xffffff, 1.45, 0.23, 0.18, 1, 0.4, 1);
    lamp(g, 1.0, 0.82, 0.0);
    const steam = [];
    for (let k = 0; k < 4; k++) {
      const m = sph(g, 0.05, 0xffffff, 0.42, 0.65, -0.38, 1, 1, 1, { opacity: 0.7 });
      m.userData.o = k / 4; steam.push(m);
    }
    g.userData.tick = (t, rm) => {
      const active = G.state.clock - (rm.active || -9) < 0.25;
      lid.position.y = 0.61 + (active ? Math.abs(Math.sin(t * 12)) * 0.02 : 0);
      for (const m of steam) {
        const p = (t * 0.6 + m.userData.o) % 1;
        m.visible = active;
        m.position.set(0.42 + Math.sin(p * 6 + m.userData.o * 5) * 0.05, 0.66 + p * 0.3, -0.38);
        m.scale.setScalar(0.04 + p * 0.06);
      }
      void pot;
    };
  },
  pantry(g, room) {
    const crate = (x, y, z, s = 0.26) => {
      box(g, s, s, s, WOOD_L, x, y + s / 2, z);
      box(g, s + 0.01, 0.03, s + 0.01, WOOD_D, x, y + s * 0.3, z);
      box(g, s + 0.01, 0.03, s + 0.01, WOOD_D, x, y + s * 0.75, z);
    };
    crate(0.25, 0, -0.4); crate(0.52, 0, -0.42); crate(0.36, 0.26, -0.42, 0.22);
    const barrel = (x, z) => {
      cyl(g, 0.13, 0.13, 0.34, 0xa8703f, x, 0.17, z);
      cyl(g, 0.135, 0.135, 0.03, 0x5a5f6a, x, 0.08, z);
      cyl(g, 0.135, 0.135, 0.03, 0x5a5f6a, x, 0.26, z);
    };
    barrel(1.7, -0.4); barrel(1.45, -0.45);
    sph(g, 0.14, 0xe8d3a8, 0.9, 0.12, -0.35, 1, 0.9, 1);
    sph(g, 0.12, 0xdcc394, 1.1, 0.1, -0.3, 1, 0.9, 1);
    box(g, 1.6, 0.03, 0.16, WOOD, 1.0, 0.62, BACK + 0.08);
    for (let k = 0; k < 5; k++) cyl(g, 0.05, 0.05, 0.12, [0xc0504d, 0x7fb6d9, 0xffe08a, 0xb5e7a0, 0xffc0cb][k], 0.4 + k * 0.3, 0.7, BACK + 0.08);
    const pile = new THREE.Group();
    for (let k = 0; k < 14; k++) {
      const c = cone(pile, 0.04, 0.16, 0xff8a2a, (Math.random() - 0.5) * 0.36, Math.random() * 0.12, (Math.random() - 0.5) * 0.2);
      c.rotation.set(Math.random() * 3, Math.random() * 3, Math.PI / 2);
    }
    pile.position.set(1.05, 0.05, -0.05);
    g.add(pile);
    g.userData.tick = () => {
      const f = Math.min(1, G.state.res.carrots / cap('carrots'));
      pile.visible = f > 0.02;
      pile.scale.set(0.6 + f * 0.6, 0.3 + f, 0.6 + f * 0.6);
    };
  },
  lounge(g, room) {
    const rug = cyl(g, 0.7, 0.7, 0.012, 0xf08fae, 1.5, 0.035, 0.05);
    rug.scale.set(1.4, 1, 0.55);
    cyl(g, 0.26, 0.26, 0.04, WOOD_L, 1.5, 0.18, -0.1);
    cyl(g, 0.04, 0.06, 0.15, WOOD, 1.5, 0.09, -0.1);
    sph(g, 0.07, 0xffffff, 1.5, 0.25, -0.12, 1, 0.9, 1);
    cyl(g, 0.012, 0.018, 0.08, 0xffffff, 1.58, 0.26, -0.12).rotation.z = -1;
    for (let k = 0; k < 3; k++) sph(g, 0.03, 0xffffff, 1.35 + k * 0.1, 0.21, 0.02, 1, 0.5, 1);
    ROOMS.lounge.seats.forEach((s, i) => sph(g, 0.13, [0xffd36a, 0x9ad0ff, 0xc8f0a0, 0xd6b0ff][i], s.x, 0.06, s.z - 0.03, 1, 0.4, 1));
    // bookshelf
    box(g, 0.44, 0.7, 0.2, WOOD, 0.3, 0.35, BACK + 0.1);
    for (let sh = 0; sh < 3; sh++) {
      box(g, 0.4, 0.02, 0.18, WOOD_D, 0.3, 0.12 + sh * 0.22, BACK + 0.12);
      for (let b = 0; b < 4; b++) box(g, 0.06, 0.15, 0.14, [0xc0504d, 0x7fb6d9, 0xffe08a, 0x7ccf63][(b + sh) % 4], 0.16 + b * 0.09, 0.2 + sh * 0.22, BACK + 0.13);
    }
    plant(g, 2.75, -0.4, 1.4);
    frame(g, 1.5, 0.62, '🌻');
    // string lights
    const bulbs = [];
    const cols = [0xff8fb1, 0xffe066, 0x8fd3ff, 0xb5f08f, 0xd6a0ff];
    for (let k = 0; k < 11; k++) {
      const x = 0.15 + k * ((room.w - 0.3) / 10);
      const y = 0.86 - Math.sin((k / 10) * Math.PI) * 0.1;
      const m = sph(g, 0.03, cols[k % 5], x, y, BACK + 0.12, 1, 1, 1, { emissive: cols[k % 5], ei: 1, unique: true });
      bulbs.push(m);
    }
    g.userData.tick = t => {
      bulbs.forEach((b, i) => { b.material.emissiveIntensity = 0.5 + 0.5 * Math.sin(t * 2.5 + i * 1.3); });
    };
  },
  nursery(g, room) {
    ROOMS.nursery.cradles.forEach((c, i) => {
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon([0xffc9dc, 0xc9e6ff, 0xfff0b0][i], { side: THREE.DoubleSide }));
      bowl.position.set(c.x, 0.18, c.z);
      g.add(bowl);
      sph(g, 0.14, 0xffffff, c.x, 0.1, c.z, 1, 0.3, 1);
      cyl(g, 0.01, 0.01, 0.12, WOOD, c.x - 0.12, 0.05, c.z);
      cyl(g, 0.01, 0.01, 0.12, WOOD, c.x + 0.12, 0.05, c.z);
    });
    const blocks = [0xff8fb1, 0x8fd3ff, 0xffe066, 0xb5f08f];
    blocks.forEach((c, i) => box(g, 0.09, 0.09, 0.09, c, 1.55 + (i % 2) * 0.1, 0.045 + Math.floor(i / 2) * 0.09, 0.3).rotation.y = i * 0.4);
    sph(g, 0.07, 0xff6b6b, 0.3, 0.07, 0.35);
    const mobile = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      cyl(mobile, 0.004, 0.004, 0.12, 0xffffff, Math.cos(a) * 0.15, -0.06, Math.sin(a) * 0.15);
      sph(mobile, 0.035, [0xffe066, 0xff8fb1, 0x8fd3ff, 0xb5f08f][k], Math.cos(a) * 0.15, -0.13, Math.sin(a) * 0.15);
    }
    box(mobile, 0.34, 0.01, 0.01, WOOD, 0, 0, 0);
    mobile.position.set(1.0, 0.85, -0.1);
    g.add(mobile);
    lamp(g, 0.5, 0.84, 0.1, 0xffd6ea);
    g.userData.tick = t => { mobile.rotation.y = t * 0.6; };
  },
  factory(g, room) {
    box(g, 0.9, 0.62, 0.5, 0x7d8494, 1.5, 0.31, -0.38);
    box(g, 0.94, 0.06, 0.54, 0x5a606e, 1.5, 0.64, -0.38);
    for (let k = 0; k < 3; k++) sph(g, 0.03, [0x7cff8a, 0xffd36a, 0xff6b6b][k], 1.2 + k * 0.1, 0.52, -0.12, 1, 1, 0.5, { emissive: [0x2aff4a, 0xffb000, 0xff2020][k], ei: 0.9 });
    const gear = new THREE.Group();
    cyl(gear, 0.17, 0.17, 0.05, 0xd9a441, 0, 0, 0, { seg: 16 });
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      box(gear, 0.06, 0.05, 0.06, 0xd9a441, Math.cos(a) * 0.19, 0, Math.sin(a) * 0.19).rotation.y = -a;
    }
    cyl(gear, 0.05, 0.05, 0.07, 0x5a606e, 0, 0, 0);
    gear.rotation.x = Math.PI / 2;
    gear.position.set(1.72, 0.34, -0.1);
    g.add(gear);
    const gear2 = gear.clone();
    gear2.scale.setScalar(0.6);
    gear2.position.set(1.42, 0.24, -0.11);
    g.add(gear2);
    // conveyor
    box(g, 1.0, 0.1, 0.3, 0x3a3d48, 0.55, 0.18, -0.35);
    for (let k = 0; k < 4; k++) cyl(g, 0.05, 0.05, 0.32, 0x5a606e, 0.1 + k * 0.3, 0.13, -0.35).rotation.x = Math.PI / 2;
    const items = [];
    for (let k = 0; k < 3; k++) items.push(box(g, 0.1, 0.08, 0.1, 0xd9a441, 0, 0.27, -0.35));
    // pipes + chimney
    cyl(g, 0.04, 0.04, room.w - 0.2, 0xb0b6c4, room.w / 2, 0.85, BACK + 0.12).rotation.z = Math.PI / 2;
    cyl(g, 0.07, 0.07, 0.3, 0x5a606e, 1.8, 0.8, -0.38);
    box(g, 0.2, 0.3, 0.2, 0x5a606e, 2.6, 0.15, -0.4);
    sph(g, 0.06, 0xffe08a, 2.6, 0.34, -0.3, 1, 1, 0.3, { emissive: 0xffb000, ei: 0.8 });
    lamp(g, 0.6, 0.82, 0.05);
    const puffs = [];
    for (let k = 0; k < 3; k++) { const m = sph(g, 0.05, 0xdddddd, 1.8, 0.95, -0.38, 1, 1, 1, { opacity: 0.6 }); m.userData.o = k / 3; puffs.push(m); }
    g.userData.tick = (t, rm) => {
      const active = G.state.clock - (rm.active || -9) < 0.25;
      if (active) { gear.rotation.y += 0.05; gear2.rotation.y -= 0.08; }
      items.forEach((it, k) => {
        const p = active ? (t * 0.35 + k / 3) % 1 : k / 3;
        it.position.x = 0.1 + p * 0.9;
      });
      for (const m of puffs) {
        const p = (t * 0.5 + m.userData.o) % 1;
        m.visible = active;
        m.position.y = 0.93 + p * 0.05;
        m.position.x = 1.8 + p * 0.2;
        m.scale.setScalar(0.04 + p * 0.05);
      }
    };
  },
  council(g, room) {
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), new THREE.MeshBasicMaterial({ map: textTexture('🥕', { size: 150, w: 256, h: 256, stroke: '#9c2f2f', color: '#fff' }), transparent: true }));
    const bannerBg = box(g, 0.7, 0.9, 0.01, 0xc0504d, 1.5, 1.35, BACK + 0.02);
    banner.position.set(1.5, 1.35, BACK + 0.03);
    g.add(banner);
    box(g, 0.8, 0.04, 0.04, 0xd9a441, 1.5, 1.82, BACK + 0.04);
    for (const x of [0.3, 2.7]) {
      cyl(g, 0.1, 0.12, 1.9, 0xf5ecd8, x, 0.95, BACK + 0.14);
      box(g, 0.28, 0.08, 0.28, 0xdccca5, x, 1.9, BACK + 0.14);
      box(g, 0.28, 0.08, 0.28, 0xdccca5, x, 0.04, BACK + 0.14);
    }
    box(g, 0.5, 0.4, 0.3, WOOD, 1.5, 0.2, -0.35);
    box(g, 0.56, 0.04, 0.34, WOOD_L, 1.5, 0.42, -0.35);
    sph(g, 0.05, 0xd9a441, 1.5, 0.47, -0.35);
    for (const x of [0.75, 2.25]) {
      box(g, 0.55, 0.05, 0.18, WOOD_L, x, 0.14, 0.05);
      box(g, 0.05, 0.14, 0.14, WOOD, x - 0.22, 0.07, 0.05);
      box(g, 0.05, 0.14, 0.14, WOOD, x + 0.22, 0.07, 0.05);
    }
    // round window
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), toon(0xbfe6ff, { emissive: 0x9fd8ff, ei: 0.5 }));
    win.position.set(0.9, 1.45, BACK + 0.02);
    g.add(win);
    const ring = new THREE.Mesh(geoTorus(0.3, 0.03), toon(WOOD));
    ring.position.set(0.9, 1.45, BACK + 0.03);
    g.add(ring);
    plant(g, 2.2, -0.4, 1.6);
    lamp(g, 1.5, 1.82, 0.15);
    g.userData.tick = t => { bannerBg.rotation.y = Math.sin(t) * 0.03; banner.rotation.y = bannerBg.rotation.y; };
  },
  clock(g, room) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.72, 40), toon(0x1f2350, { emissive: 0x1a1f5a, ei: 0.4 }));
    face.position.set(1.5, 1.05, -0.38);
    g.add(face);
    const rim = new THREE.Mesh(geoTorus(0.74, 0.06), toon(0xe7c35a, { emissive: 0x8a6a10, ei: 0.3 }));
    rim.position.set(1.5, 1.05, -0.37);
    g.add(rim);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      sph(g, k % 3 === 0 ? 0.05 : 0.03, 0xfff3c0, 1.5 + Math.sin(a) * 0.6, 1.05 + Math.cos(a) * 0.6, -0.35, 1, 1, 0.4, { emissive: 0xffe08a, ei: 0.8 });
    }
    const mkHand = (len, wid, color) => {
      const p = new THREE.Group();
      box(p, wid, len, 0.02, color, 0, len / 2, 0, { emissive: color, ei: 0.3 });
      p.position.set(1.5, 1.05, -0.33);
      g.add(p);
      return p;
    };
    const hourH = mkHand(0.38, 0.06, 0xe7c35a), minH = mkHand(0.55, 0.04, 0xfff3c0);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), toon(0x9ff0ff, { emissive: 0x3aa8ff, ei: 1, unique: true }));
    crystal.position.set(1.5, 1.05, -0.28);
    crystal.scale.set(0.6, 1, 0.6);
    g.add(crystal);
    for (const x of [0.35, 2.65]) {
      cyl(g, 0.1, 0.14, 1.9, 0x4a4f8a, x, 0.95, -0.4);
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), toon(0x9ff0ff, { emissive: 0x3aa8ff, ei: 0.8 }));
      c.position.set(x, 2.0 - 0.14, -0.4);
      g.add(c);
    }
    box(g, 1.8, 0.12, 0.6, 0x4a4f8a, 1.5, 0.06, -0.38);
    g.userData.tick = t => {
      const h = G.state.time.hour;
      hourH.rotation.z = -((h % 12) / 12) * Math.PI * 2;
      minH.rotation.z = -(h % 1) * Math.PI * 2;
      crystal.rotation.y = t;
      crystal.material.emissiveIntensity = 0.7 + Math.sin(t * 2) * 0.3;
    };
  },
};

function buildSite(g, room) {
  const w = room.w, h = room.h;
  const bp = box(g, w - 0.12, h - 0.12, DEPTH * 0.7, 0x8fc4ff, w / 2, h / 2, -0.1, { opacity: 0.22 });
  bp.renderOrder = 1;
  for (const x of [0.08, w - 0.08]) for (const z of [-0.55, 0.5]) box(g, 0.06, h, 0.06, WOOD_L, x, h / 2, z);
  for (let y = 0.35; y < h; y += 0.45) {
    box(g, w - 0.1, 0.04, 0.05, WOOD, w / 2, y, 0.5);
    box(g, w - 0.1, 0.04, 0.05, WOOD, w / 2, y, -0.55);
  }
  box(g, 0.25, 0.2, 0.25, WOOD_L, w - 0.3, 0.1, 0.1);
  sph(g, 0.2, 0x9b6a43, 0.35, 0.02, 0.0, 1, 0.5, 1);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(ROOMS[room.type].icon), depthWrite: false }));
  icon.scale.set(0.4, 0.4, 1);
  icon.position.set(w / 2, h - 0.35, 0.3);
  g.add(icon);
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 0.07), new THREE.MeshBasicMaterial({ color: 0x3a2a1c }));
  bg.position.set(w / 2, 0.14, FRONT - 0.02);
  g.add(bg);
  const fgGeo = new THREE.PlaneGeometry(1, 0.05);
  fgGeo.translate(0.5, 0, 0);
  const fg = new THREE.Mesh(fgGeo, new THREE.MeshBasicMaterial({ color: 0x7dff9a }));
  fg.position.set(w / 2 - w * 0.34, 0.14, FRONT - 0.015);
  g.add(fg);
  g.userData.tick = (t, rm) => {
    fg.scale.x = Math.max(0.001, Math.min(1, rm.prog / ROOMS[rm.type].work) * w * 0.68);
    icon.position.y = h - 0.35 + Math.sin(t * 3) * 0.04;
  };
}

export class RoomRenderer {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.map = new Map();
    this.selBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, DEPTH + 0.04)),
      new THREE.LineBasicMaterial({ color: 0xffe066 }),
    );
    this.selBox.visible = false;
    scene.add(this.selBox);
  }

  rebuild() {
    for (const g of this.map.values()) this.group.remove(g);
    this.map.clear();
    for (const room of G.state.rooms) {
      const g = new THREE.Group();
      if (room.built) { shell(g, room); BUILD[room.type](g, room); }
      else buildSite(g, room);
      g.position.set(room.x - W / 2, floorY(room.y), 0);
      this.group.add(g);
      this.map.set(room.id, g);
    }
  }

  update(t) {
    for (const room of G.state.rooms) {
      const g = this.map.get(room.id);
      if (g?.userData.tick) g.userData.tick(t, room);
    }
  }

  select(room) {
    if (!room) { this.selBox.visible = false; return; }
    this.selBox.visible = true;
    this.selBox.scale.set(room.w + 0.04, room.h + 0.04, 1);
    this.selBox.position.set(room.x - W / 2 + room.w / 2, floorY(room.y) + room.h / 2, 0);
  }
}
