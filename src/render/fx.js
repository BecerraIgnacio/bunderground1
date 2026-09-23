// Particles, floating text, hearts, sparkles.
import * as THREE from 'three';
import { W } from '../data.js';
import { cellX, floorY } from '../world.js';
import { toon, geoBox, emojiTexture, textTexture } from './util.js';

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.bits = [];
    this.sprites = [];
    this.pool = [];
  }

  bit(x, y, z, color, vx, vy, vz, life = 0.8, size = 0.07) {
    let m = this.pool.pop();
    if (!m) m = new THREE.Mesh(geoBox(1, 1, 1), toon(color));
    m.material = toon(color);
    m.position.set(x, y, z);
    m.scale.setScalar(size);
    m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    m.userData = { vx, vy, vz, life, max: life, size };
    this.scene.add(m);
    this.bits.push(m);
  }

  dust({ x, y, z, color }) {
    for (let k = 0; k < 3; k++) this.bit(x, y, z, color, (Math.random() - 0.5) * 1.6, 1 + Math.random() * 1.5, Math.random() * 0.8, 0.6);
  }

  dug({ i, mat, ore }, color) {
    const x = cellX(i % W), y = floorY((i / W) | 0) + 0.5;
    for (let k = 0; k < 14; k++) {
      this.bit(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, 0.4, color,
        (Math.random() - 0.5) * 3, 1 + Math.random() * 3, 0.5 + Math.random() * 1.5, 0.9, 0.06 + Math.random() * 0.08);
    }
    if (ore === 3) this.sparkle(x, y, 0.6, 0x9ff0ff);
    void mat;
  }

  sparkle(x, y, z, color = 0xffe066, n = 18) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      this.bit(x, y, z, color, Math.cos(a) * 2, Math.sin(a) * 2 + 1, (Math.random() - 0.2), 1.1, 0.05);
    }
  }

  sprite(map, x, y, z, scale, life, vy, fade = true) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: false }));
    s.position.set(x, y, z);
    s.scale.set(scale[0], scale[1], 1);
    s.renderOrder = 10;
    s.userData = { life, max: life, vy, fade };
    this.scene.add(s);
    this.sprites.push(s);
    return s;
  }

  float({ x, y, z, text }) {
    const t = textTexture(text, { size: 56 });
    const s = this.sprite(t, x, y, z, [2.2, 0.41], 1.8, 0.6);
    s.userData.own = t;
  }

  heart({ x, y, z }) {
    for (let k = 0; k < 3; k++) {
      const s = this.sprite(emojiTexture('💖', false), x + (k - 1) * 0.2, y + k * 0.1, z + 0.2, [0.3, 0.3], 1.8 + k * 0.2, 0.5);
      s.userData.wob = Math.random() * 6;
    }
  }

  update(dt) {
    for (let k = this.bits.length - 1; k >= 0; k--) {
      const m = this.bits[k], u = m.userData;
      u.life -= dt;
      if (u.life <= 0) {
        this.scene.remove(m); this.bits.splice(k, 1); this.pool.push(m);
        continue;
      }
      u.vy -= 7 * dt;
      m.position.x += u.vx * dt; m.position.y += u.vy * dt; m.position.z += u.vz * dt;
      m.rotation.x += dt * 5;
      m.scale.setScalar(u.size * Math.min(1, u.life / u.max * 2));
    }
    for (let k = this.sprites.length - 1; k >= 0; k--) {
      const s = this.sprites[k], u = s.userData;
      u.life -= dt;
      if (u.life <= 0) {
        this.scene.remove(s); s.material.dispose(); if (u.own) u.own.dispose();
        this.sprites.splice(k, 1);
        continue;
      }
      s.position.y += u.vy * dt;
      if (u.wob !== undefined) s.position.x += Math.sin(u.life * 6 + u.wob) * dt * 0.3;
      s.material.opacity = Math.min(1, (u.life / u.max) * 2.5);
    }
  }

  clear() {
    for (const m of this.bits) this.scene.remove(m);
    for (const s of this.sprites) this.scene.remove(s);
    this.bits = []; this.sprites = [];
  }
}
