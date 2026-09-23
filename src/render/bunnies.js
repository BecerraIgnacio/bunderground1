// Rabbit meshes built from primitives + procedural animation.
import * as THREE from 'three';
import { COATS } from '../data.js';
import { G, isKit, isElder } from '../game.js';
import { toon, geoSphere, emojiTexture } from './util.js';

const earGeo = new THREE.CapsuleGeometry(0.036, 0.16, 4, 10);
const innerGeo = new THREE.CapsuleGeometry(0.02, 0.12, 4, 8);
const ringGeo = new THREE.RingGeometry(0.2, 0.26, 28);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
const partnerRingMat = new THREE.MeshBasicMaterial({ color: 0xff8fb1, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });

function part(parent, color, r, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geoSphere(), toon(color));
  m.position.set(x, y, z);
  m.scale.set(r * sx, r * sy, r * sz);
  parent.add(m);
  return m;
}

function createBunny(r) {
  const c = COATS[r.coat] || COATS[0];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  part(body, c.body, 0.17, 0, 0.16, -0.03, 1, 0.92, 1.12);
  part(body, c.belly, 0.12, 0, 0.14, 0.08, 1, 0.95, 0.8);
  const tail = part(body, c.belly, 0.065, 0, 0.19, -0.2);
  // feet
  part(body, c.body, 0.055, -0.08, 0.03, 0.1, 0.8, 0.5, 1.3);
  part(body, c.body, 0.055, 0.08, 0.03, 0.1, 0.8, 0.5, 1.3);
  part(body, c.body, 0.07, -0.1, 0.04, -0.08, 0.8, 0.6, 1.5);
  part(body, c.body, 0.07, 0.1, 0.04, -0.08, 0.8, 0.6, 1.5);

  const head = new THREE.Group();
  head.position.set(0, 0.31, 0.08);
  body.add(head);
  part(head, c.body, 0.135, 0, 0, 0, 1, 0.93, 0.95);
  part(head, c.belly, 0.055, -0.055, -0.045, 0.085);
  part(head, c.belly, 0.055, 0.055, -0.045, 0.085);
  part(head, 0xff9fb4, 0.022, 0, -0.012, 0.13, 1.2, 0.9, 0.8);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = part(head, 0x2a1d1a, 0.027, sx * 0.058, 0.02, 0.105, 1, 1.15, 0.8);
    part(e, 0xffffff, 0.35, 0.3, 0.35, 0.7);
    eyes.push(e);
  }
  // blush
  for (const sx of [-1, 1]) part(head, 0xffb3c1, 0.022, sx * 0.09, -0.025, 0.09, 1, 0.6, 0.4);
  const ears = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(sx * 0.055, 0.09, -0.01);
    eg.rotation.z = -sx * 0.18;
    const ear = new THREE.Mesh(earGeo, toon(c.body));
    ear.position.y = 0.1;
    eg.add(ear);
    const inner = new THREE.Mesh(innerGeo, toon(c.inner));
    inner.position.set(0, 0.1, 0.022);
    eg.add(inner);
    head.add(eg);
    ears.push(eg);
  }
  // elders get tiny spectacles
  let glasses = null;
  if (isElder(r)) {
    glasses = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 14), toon(0x3a2a1c));
    const g2 = glasses.clone();
    glasses.position.set(-0.058, 0.02, 0.125); g2.position.set(0.058, 0.02, 0.125);
    head.add(glasses, g2);
  }
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = false;
  root.add(ring);
  const crown = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture('👑', false), depthWrite: false }));
  crown.scale.set(0.16, 0.16, 1);
  crown.position.set(0, 0.52, 0.06);
  crown.visible = false;
  body.add(crown);

  const emote = new THREE.Sprite(new THREE.SpriteMaterial({ depthWrite: false, transparent: true }));
  emote.scale.set(0.3, 0.3, 1);
  emote.visible = false;
  emote.renderOrder = 5;
  root.add(emote);
  return {
    root, body, head, ears, eyes, tail, ring, emote, crown, emoteKey: null,
    phase: Math.random() * 10, blink: Math.random() * 4, face: 0, elder: isElder(r), coat: r.coat,
  };
}

const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export class BunnyRenderer {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.map = new Map();
    this.selected = 0;
  }

  clear() {
    for (const m of this.map.values()) this.group.remove(m.root);
    this.map.clear();
  }

  sync() {
    const s = G.state;
    const alive = new Set();
    for (const r of s.rabbits) {
      alive.add(r.id);
      let m = this.map.get(r.id);
      if (m && m.elder !== isElder(r)) { this.group.remove(m.root); m = null; }
      if (!m) {
        m = createBunny(r);
        this.map.set(r.id, m);
        this.group.add(m.root);
      }
    }
    for (const [id, m] of this.map) if (!alive.has(id)) { this.group.remove(m.root); this.map.delete(id); }
  }

  update(t, dt) {
    this.sync();
    const s = G.state;
    const paused = G.paused || G.modal;
    const sel = s.rabbits.find(r => r.id === this.selected);
    for (const r of s.rabbits) {
      const m = this.map.get(r.id);
      const scale = isKit(r) ? 0.6 + (r.age / 4) * 0.35 : 1.12;
      m.root.scale.setScalar(scale);
      m.root.position.set(r.wx, r.wy, r.wz);
      const T = r.task;
      const moving = r.moving && !paused;
      const sleeping = r.sleeping;
      const working = T && T.phase === 'do' && (T.kind === 'work' || T.kind === 'dig' || T.kind === 'build');
      const eating = T && T.phase === 'do' && T.kind === 'eat';
      let target = r.face || 0;
      if (moving && r.climb) target = Math.PI;
      m.face = lerpAngle(m.face, target, Math.min(1, dt * 10));
      m.root.rotation.y = m.face;
      const speedMul = paused ? 0 : G.speed;

      // reset pose
      m.body.position.y = 0; m.body.scale.set(1, 1, 1); m.body.rotation.set(0, 0, 0);
      m.head.rotation.set(0, 0, 0);
      let earX = 0, earZ = 0, eyeY = 1;

      if (moving) {
        m.phase += dt * speedMul * 11;
        const hop = Math.abs(Math.sin(m.phase));
        if (r.climb) {
          m.body.position.y = hop * 0.04;
          m.body.rotation.x = -0.25;
          earX = -0.2 + Math.sin(m.phase * 2) * 0.1;
        } else {
          m.body.position.y = hop * 0.13;
          m.body.scale.set(1, 0.9 + hop * 0.18, 1.05 - hop * 0.08);
          m.body.rotation.x = -Math.cos(m.phase) * 0.12;
          earX = -0.25 - hop * 0.35;
        }
      } else if (sleeping) {
        m.body.scale.set(1.08, 0.78 + Math.sin(t * 2 + r.id) * 0.03, 1.05);
        m.head.rotation.x = 0.35;
        earX = -1.35; earZ = 0.3;
        eyeY = 0.12;
      } else if (eating) {
        m.head.rotation.x = 0.25 + Math.sin(t * 14 + r.id) * 0.1;
        earX = Math.sin(t * 7) * 0.08;
      } else if (working) {
        const k = T.kind === 'dig' ? 16 : 9;
        m.body.position.y = Math.abs(Math.sin(t * k * Math.max(0.5, speedMul))) * 0.04;
        m.head.rotation.x = (r.digUp && T.kind === 'dig' ? -0.5 : 0.2) + Math.sin(t * k) * 0.18;
        earX = -0.15 + Math.sin(t * k) * 0.12;
      } else if (T && T.kind === 'social' && T.phase === 'do') {
        m.head.rotation.z = Math.sin(t * 2 + r.id) * 0.18;
        m.body.position.y = Math.max(0, Math.sin(t * 3 + r.id * 2)) ** 8 * 0.08;
        earX = Math.sin(t * 3 + r.id) * 0.15;
      } else if (T && T.kind === 'play' && T.phase === 'do') {
        m.phase += dt * speedMul * 9;
        m.body.position.y = Math.abs(Math.sin(m.phase)) * 0.12;
        m.root.rotation.y = m.face + Math.sin(t * 2 + r.id) * 1.2;
      } else {
        m.head.rotation.z = Math.sin(t * 0.7 + r.id) * 0.08;
        earX = Math.sin(t * 1.3 + r.id) * 0.05;
        if (((t + r.id * 1.7) % 5) < 0.12) earX = 0.25;
      }
      m.ears[0].rotation.x = earX; m.ears[1].rotation.x = earX;
      m.ears[0].rotation.z = 0.18 + earZ; m.ears[1].rotation.z = -0.18 - earZ;
      if (!sleeping) {
        m.blink -= dt;
        if (m.blink < 0) { eyeY = 0.1; if (m.blink < -0.12) m.blink = 2 + Math.random() * 4; }
      }
      m.eyes[0].scale.y = m.eyes[1].scale.y = 0.027 * 1.15 * eyeY;
      m.tail.position.y = 0.19 + Math.sin(t * 6 + r.id) * 0.008;

      // emote bubble
      let em = r.emote;
      if (!em && !moving) {
        if (r.needs.hunger < 12) em = '🥕';
        else if (r.mood < 25) em = '🌧️';
        else if (!isKit(r) && T?.kind === 'idle' && r.needs.energy < 20) em = '🥱';
      }
      if (em) {
        if (m.emoteKey !== em) { m.emote.material.map = emojiTexture(em); m.emote.material.needsUpdate = true; m.emoteKey = em; }
        m.emote.visible = true;
        m.emote.position.set(0, (s.chief === r.id ? 0.9 : 0.72) + Math.sin(t * 3 + r.id) * 0.03, 0); // clear the crown
      } else m.emote.visible = false;

      m.crown.visible = s.chief === r.id;
      m.ring.visible = r.id === this.selected || !!(sel && sel.partner === r.id);
      m.ring.material = r.id === this.selected ? ringMat : partnerRingMat;
      if (m.ring.visible) m.ring.rotation.z = t;
    }
  }
}
