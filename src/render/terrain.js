// Instanced dirt blocks, ores, ladders and dig marks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { W, H, EX, DEPTH, FRONT, MAT, MATS, ORE } from '../data.js';
import { G } from '../game.js';
import { cellX } from '../world.js';
import { toon, dirtTexture, wallTexture, stripeTexture, gradient } from './util.js';

const hash = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const cy = y => -(y + 0.5);
const dummy = new THREE.Object3D();
const col = new THREE.Color();

export class Terrain {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const N = W * H;

    const blockMat = new THREE.MeshToonMaterial({ map: dirtTexture(), gradientMap: gradient() });
    this.blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, DEPTH), blockMat, N);
    for (let i = 0; i < N; i++) this.blocks.setColorAt(i, col.set(0xffffff));
    this.group.add(this.blocks);

    const wt = wallTexture();
    wt.repeat.set(W / 2, H / 2);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), toon(0x7a5238, { map: wt }));
    wall.position.set(0, -H / 2, -FRONT + 0.005);
    this.group.add(wall);

    const oreGeo = {
      [ORE.PEBBLES]: new THREE.DodecahedronGeometry(0.09),
      [ORE.COPPER]: new THREE.IcosahedronGeometry(0.1, 0),
      [ORE.CRYSTAL]: new THREE.OctahedronGeometry(0.15),
    };
    const oreMat = {
      [ORE.PEBBLES]: toon(0xdcd6cc),
      [ORE.COPPER]: toon(0xf08a3a, { emissive: 0x7a3000, ei: 0.35 }),
      [ORE.CRYSTAL]: toon(0x9ff0ff, { emissive: 0x3aa8ff, ei: 0.9 }),
    };
    this.ores = {};
    for (const k of [ORE.PEBBLES, ORE.COPPER, ORE.CRYSTAL]) {
      const m = new THREE.InstancedMesh(oreGeo[k], oreMat[k], N * 3);
      m.count = 0;
      this.ores[k] = m;
      this.group.add(m);
    }

    const rail = new THREE.BoxGeometry(0.05, 1, 0.05);
    const parts = [rail.clone().translate(-0.15, 0, 0), rail.clone().translate(0.15, 0, 0)];
    for (let k = 0; k < 4; k++) parts.push(new THREE.BoxGeometry(0.3, 0.04, 0.04).translate(0, -0.375 + k * 0.25, 0));
    this.ladders = new THREE.InstancedMesh(mergeGeometries(parts), toon(0xc28a52), N);
    this.ladders.count = 0;
    this.group.add(this.ladders);

    this.marks = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.98, 0.98),
      new THREE.MeshBasicMaterial({ map: stripeTexture(), transparent: true, depthWrite: false }),
      N,
    );
    this.marks.count = 0;
    this.marks.renderOrder = 2;
    this.group.add(this.marks);

    // hover / selection helpers
    this.hover = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, DEPTH + 0.02)),
      new THREE.LineBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.9 }),
    );
    this.hover.visible = false;
    this.group.add(this.hover);
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, DEPTH + 0.04), new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghost.visible = false;
    this.ghost.renderOrder = 3;
    this.group.add(this.ghost);
    this.working = new Set();
  }

  blockMatrix(i, prog, t = 0) {
    const x = i % W, y = (i / W) | 0;
    const s = 1 - 0.3 * Math.min(1, prog);
    const shake = prog > 0 ? Math.sin(t * 40 + i) * 0.02 : 0;
    dummy.position.set(cellX(x) + shake, cy(y), 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(s, s, 1);
    dummy.updateMatrix();
    return dummy.matrix;
  }

  rebuild() {
    const g = G.state.grid;
    const N = W * H;
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    const oreCount = { 1: 0, 2: 0, 3: 0 };
    let ladders = 0, marks = 0;
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      const m = g.mat[i];
      if (m === MAT.AIR) {
        this.blocks.setMatrixAt(i, hide);
        const above = y === 0 ? x === EX : g.mat[i - W] === MAT.AIR;
        if (above && !G.roomAt[i] && !(y > 0 && G.roomAt[i - W])) {
          dummy.position.set(cellX(x), cy(y), -FRONT + 0.1);
          dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
          this.ladders.setMatrixAt(ladders++, dummy.matrix);
        }
        continue;
      }
      this.blocks.setMatrixAt(i, this.blockMatrix(i, g.prog[i]));
      col.set(MATS[m].color);
      const v = 0.93 + hash(i, 9) * 0.12 - y * 0.004;
      col.multiplyScalar(v);
      this.blocks.setColorAt(i, col);
      const o = g.ore[i];
      if (o) {
        const n = o === ORE.CRYSTAL ? 3 : o === ORE.COPPER ? 3 : 2;
        for (let k = 0; k < n; k++) {
          dummy.position.set(cellX(x) + (hash(i, k) - 0.5) * 0.6, cy(y) + (hash(i, k + 5) - 0.5) * 0.6, FRONT + 0.01);
          dummy.rotation.set(hash(i, k + 2) * 3, hash(i, k + 3) * 3, hash(i, k + 4) * 3);
          const sc = 0.7 + hash(i, k + 7) * 0.6;
          dummy.scale.set(sc, sc, sc);
          dummy.updateMatrix();
          this.ores[o].setMatrixAt(oreCount[o]++, dummy.matrix);
        }
      }
      if (g.mark[i]) {
        dummy.position.set(cellX(x), cy(y), FRONT + 0.03);
        dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        this.marks.setMatrixAt(marks++, dummy.matrix);
      }
    }
    for (const k in this.ores) { this.ores[k].count = oreCount[k]; this.ores[k].instanceMatrix.needsUpdate = true; }
    this.ladders.count = ladders; this.ladders.instanceMatrix.needsUpdate = true;
    this.marks.count = marks; this.marks.instanceMatrix.needsUpdate = true;
    this.blocks.instanceMatrix.needsUpdate = true;
    this.blocks.instanceColor.needsUpdate = true;
  }

  // animate cells currently being dug
  update(t) {
    const g = G.state.grid;
    let dirty = false;
    for (const i of this.working) {
      if (!G.claims.has(i) && g.mat[i] !== MAT.AIR) { this.blocks.setMatrixAt(i, this.blockMatrix(i, g.prog[i])); dirty = true; }
    }
    this.working.clear();
    for (const i of G.claims.keys()) {
      if (g.mat[i] === MAT.AIR) continue;
      this.blocks.setMatrixAt(i, this.blockMatrix(i, g.prog[i], t));
      this.working.add(i);
      dirty = true;
    }
    if (dirty) this.blocks.instanceMatrix.needsUpdate = true;
  }

  showHover(x, y) {
    if (x == null || y < 0 || x < 0 || x >= W || y >= H) { this.hover.visible = false; return; }
    this.hover.visible = true;
    this.hover.position.set(cellX(x), cy(y), 0);
  }

  showGhost(x0, y0, x1, y1, ok, color) {
    if (x0 == null) { this.ghost.visible = false; return; }
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    this.ghost.visible = true;
    this.ghost.scale.set(maxX - minX + 1, maxY - minY + 1, 1);
    this.ghost.position.set(cellX(minX) + (maxX - minX) / 2, -(minY + (maxY - minY + 1) / 2), 0);
    this.ghost.material.color.set(color ?? (ok ? 0x7dff9a : 0xff6b6b));
  }
}
