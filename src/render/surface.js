// Meadow on top of the diorama, sky, sun/moon, clouds and stars.
import * as THREE from 'three';
import { W, H, EX, DEPTH, FRONT } from '../data.js';
import { cellX } from '../world.js';
import { toon, box, sph, cyl, cone, signTexture } from './util.js';

const SKY = [
  [0, 0x1b2150], [4.5, 0x262a63], [6, 0xf7b39a], [7.5, 0xa9dcff], [17, 0xa9dcff],
  [19, 0xffa987], [20.5, 0x57468a], [22, 0x1b2150], [24, 0x1b2150],
];
const cA = new THREE.Color(), cB = new THREE.Color();
function skyColor(h, out) {
  for (let k = 0; k < SKY.length - 1; k++) {
    const [h0, c0] = SKY[k], [h1, c1] = SKY[k + 1];
    if (h >= h0 && h <= h1) {
      const t = (h - h0) / (h1 - h0);
      return out.copy(cA.set(c0)).lerp(cB.set(c1), t);
    }
  }
  return out.set(SKY[0][1]);
}
export function daylight(h) {
  // 0 at night, 1 at noon-ish
  if (h < 5 || h > 21.5) return 0;
  if (h < 7.5) return (h - 5) / 2.5;
  if (h > 18.5) return 1 - (h - 18.5) / 3;
  return 1;
}

export class Surface {
  constructor(scene) {
    this.scene = scene;
    const g = this.group = new THREE.Group();
    scene.add(g);
    const grass = 0x96d46b, grassDark = 0x7cc05a, earth = 0x6e4a33;
    const BACKD = 26;

    // earth chunk behind the cut + meadow top
    box(g, W, H, BACKD, earth, 0, -H / 2, -FRONT - 0.03 - BACKD / 2);
    box(g, W, 0.3, BACKD, grass, 0, 0.15, -FRONT - 0.03 - BACKD / 2 + 0.01);
    // front grass lip with entrance gap
    const gapL = cellX(EX) - 0.5, gapR = cellX(EX) + 0.5;
    const lw = gapL + W / 2, rw = W / 2 - gapR;
    box(g, lw, 0.3, DEPTH + 0.02, grass, -W / 2 + lw / 2, 0.15, 0);
    box(g, rw, 0.3, DEPTH + 0.02, grass, gapR + rw / 2, 0.15, 0);
    // grass fringe along the front edge
    const fringeGeo = new THREE.ConeGeometry(0.06, 0.22, 5);
    const fringe = new THREE.InstancedMesh(fringeGeo, toon(grassDark), 260);
    const d = new THREE.Object3D();
    let n = 0;
    for (let k = 0; k < 260; k++) {
      const x = -W / 2 + Math.random() * W;
      if (x > gapL - 0.05 && x < gapR + 0.05) continue;
      d.position.set(x, 0.38, FRONT - Math.random() * DEPTH);
      d.rotation.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
      const s = 0.7 + Math.random() * 0.8; d.scale.set(s, s, s);
      d.updateMatrix(); fringe.setMatrixAt(n++, d.matrix);
    }
    fringe.count = n;
    g.add(fringe);

    // entrance arch
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.16, 8, 18, Math.PI), toon(0x8a5a3a));
    arch.position.set(cellX(EX), 0.3, -FRONT + 0.25);
    g.add(arch);

    // sign
    this.signMat = new THREE.MeshBasicMaterial({ map: signTexture('BUNDERGROUND', 'est. Day 1') });
    const sg = new THREE.Group();
    cyl(sg, 0.05, 0.05, 1.2, 0x8a5a3a, 0, 0.6, 0);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), this.signMat);
    board.position.set(0, 1.15, 0.04);
    sg.add(board);
    box(sg, 1.7, 0.9, 0.06, 0x8a5a3a, 0, 1.15, 0);
    sg.position.set(cellX(EX) + 1.9, 0.3, 0.1);
    sg.rotation.y = -0.1;
    g.add(sg);

    // little carrot patch on the surface
    for (let k = 0; k < 5; k++) {
      const x = cellX(EX) - 2.2 - k * 0.35;
      cone(g, 0.05, 0.16, 0xff8a2a, x, 0.36, -0.2 + (k % 2) * 0.25);
      cone(g, 0.05, 0.2, 0x5fb24a, x, 0.52, -0.2 + (k % 2) * 0.25);
    }

    // trees, bushes, flowers
    const tree = (x, z, s, pine) => {
      const t = new THREE.Group();
      cyl(t, 0.12, 0.18, 1.2, 0x8a5a3a, 0, 0.6, 0);
      if (pine) {
        cone(t, 0.9, 1.3, 0x4f9e5a, 0, 1.5, 0, { seg: 8 });
        cone(t, 0.7, 1.1, 0x5bb366, 0, 2.1, 0, { seg: 8 });
        cone(t, 0.45, 0.8, 0x6cc576, 0, 2.6, 0, { seg: 8 });
      } else {
        const greens = [0x7ccf63, 0x6cbf57, 0x8fdc72];
        sph(t, 0.75, greens[0], 0, 1.7, 0);
        sph(t, 0.55, greens[1], -0.5, 1.45, 0.15);
        sph(t, 0.55, greens[2], 0.5, 1.5, 0.1);
        sph(t, 0.45, greens[2], 0.1, 2.2, 0);
        if (Math.random() < 0.4) for (let k = 0; k < 4; k++) sph(t, 0.07, 0xff6b6b, (Math.random() - 0.5) * 1.2, 1.4 + Math.random() * 0.8, 0.6);
      }
      t.position.set(x, 0.3, z);
      t.scale.setScalar(s);
      t.rotation.y = Math.random() * 6;
      g.add(t);
    };
    for (let k = 0; k < 34; k++) {
      const x = -W / 2 + 1 + Math.random() * (W - 2);
      const z = -2.2 - Math.random() * (BACKD - 4);
      if (Math.abs(x - cellX(EX)) < 3 && z > -5) continue;
      tree(x, z, 0.7 + Math.random() * 0.7, Math.random() < 0.35);
    }
    for (let k = 0; k < 26; k++) {
      const x = -W / 2 + 0.5 + Math.random() * (W - 1), z = -1.2 - Math.random() * 12;
      const s = 0.25 + Math.random() * 0.3;
      sph(g, s, 0x74c35c, x, 0.3 + s * 0.6, z, 1.3, 0.8, 1);
      sph(g, s * 0.8, 0x86d36b, x + s * 0.7, 0.3 + s * 0.5, z + 0.1, 1.2, 0.8, 1);
    }
    const fGeo = new THREE.SphereGeometry(0.07, 8, 6);
    const flowers = new THREE.InstancedMesh(fGeo, toon(0xffffff), 220);
    const fcols = [0xff8fb1, 0xffe066, 0xffffff, 0xc49bff, 0xff9f6b];
    for (let k = 0; k < 220; k++) {
      const front = k < 40;
      d.position.set(-W / 2 + Math.random() * W, 0.38, front ? FRONT - 0.1 - Math.random() * (DEPTH - 0.2) : -1 - Math.random() * 20);
      if (front && Math.abs(d.position.x - cellX(EX)) < 0.8) d.position.x += 2;
      d.scale.setScalar(0.8 + Math.random() * 0.6);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      flowers.setMatrixAt(k, d.matrix);
      flowers.setColorAt(k, cA.set(fcols[k % fcols.length]));
    }
    g.add(flowers);

    // clouds
    this.clouds = [];
    for (let k = 0; k < 9; k++) {
      const c = new THREE.Group();
      const m = toon(0xffffff, { emissive: 0xffffff, ei: 0.25 });
      const parts = 3 + Math.floor(Math.random() * 3);
      for (let p = 0; p < parts; p++) sph(c, 0.9 + Math.random() * 0.7, 0xffffff, p * 1.1 - parts * 0.5, Math.random() * 0.4, Math.random() * 0.4, 1, 0.75, 0.8, { mat: m });
      c.position.set(-45 + Math.random() * 90, 7 + Math.random() * 6, -14 - Math.random() * 22);
      c.userData.v = 0.25 + Math.random() * 0.35;
      g.add(c);
      this.clouds.push(c);
    }

    // sun & moon
    this.sun = sph(g, 2.4, 0xffe27a, 0, 0, -60, 1, 1, 1, { emissive: 0xffd24a, ei: 1 });
    this.moon = sph(g, 1.7, 0xf2f0ff, 0, 0, -60, 1, 1, 1, { emissive: 0xdfe3ff, ei: 0.8 });

    // stars
    const sp = new Float32Array(400 * 3);
    for (let k = 0; k < 400; k++) {
      sp[k * 3] = -90 + Math.random() * 180;
      sp[k * 3 + 1] = 2 + Math.random() * 45;
      sp[k * 3 + 2] = -70 - Math.random() * 10;
    }
    const sg2 = new THREE.BufferGeometry();
    sg2.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg2, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0 }));
    g.add(this.stars);

    this.skyCol = new THREE.Color();
  }

  setName(name, day = 1) {
    this.signMat.map.dispose();
    const short = name.length > 16 ? name.slice(0, 15) + '…' : name;
    this.signMat.map = signTexture(short, `est. Day ${day}`);
    this.signMat.needsUpdate = true;
  }

  update(dt, hour, lights) {
    for (const c of this.clouds) {
      c.position.x += c.userData.v * dt;
      if (c.position.x > 50) c.position.x = -50;
    }
    const a = ((hour - 6) / 15) * Math.PI;
    this.sun.position.set(-Math.cos(a) * 45, Math.sin(a) * 28 - 3, -60);
    const ma = ((hour - 20 + 24) % 24) / 10 * Math.PI;
    this.moon.position.set(-Math.cos(ma) * 40, Math.sin(ma) * 24 - 3, -58);
    const dl = daylight(hour);
    this.stars.material.opacity = Math.max(0, 1 - dl * 2);
    skyColor(hour, this.skyCol);
    this.scene.background = this.skyCol;
    lights.hemi.intensity = 1.2 + dl * 0.9;
    lights.sun.intensity = 0.9 + dl * 1.1;
    lights.sun.color.setHSL(dl > 0.5 ? 0.1 : 0.62, dl > 0.5 ? 0.4 : 0.3, 0.85);
  }
}
