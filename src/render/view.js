// Renderer, camera and the render-side subsystems.
import * as THREE from 'three';
import { W, H, FRONT, MATS } from '../data.js';
import { G, on } from '../game.js';
import { Terrain } from './terrain.js';
import { Surface } from './surface.js';
import { RoomRenderer } from './rooms.js';
import { BunnyRenderer } from './bunnies.js';
import { FX } from './fx.js';

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa9dcff);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
    this.hemi = new THREE.HemisphereLight(0xfff6e5, 0x8a6a54, 2.0);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 1.8);
    this.sun.position.set(6, 14, 18);
    this.scene.add(this.hemi, this.sun);

    this.terrain = new Terrain(this.scene);
    this.surface = new Surface(this.scene);
    this.rooms = new RoomRenderer(this.scene);
    this.bunnies = new BunnyRenderer(this.scene);
    this.fx = new FX(this.scene);

    this.cam = { x: 0, y: -2.5, d: 19, tx: 0, ty: -2.5, td: 19, follow: 0 };
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -FRONT);
    this.v = new THREE.Vector3();
    this.t = 0;

    on('dust', e => this.fx.dust(e));
    on('dug', e => this.fx.dug(e, MATS[e.mat]?.color ?? 0x9b6a43));
    on('float', e => this.fx.float(e));
    on('heart', e => this.fx.heart(e));
    on('built', room => this.fx.sparkle(room.x - W / 2 + room.w / 2, -(room.y + 1) + 0.5, 0.6, 0xffe066, 30));

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  reset() {
    this.bunnies.clear();
    this.fx.clear();
    G.dirty.terrain = G.dirty.rooms = true;
  }

  pan(dx, dy) {
    this.cam.follow = 0;
    this.cam.tx = Math.max(-W / 2 + 1, Math.min(W / 2 - 1, this.cam.tx + dx));
    this.cam.ty = Math.max(-H + 1, Math.min(6, this.cam.ty + dy));
  }
  zoom(f) { this.cam.td = Math.max(5, Math.min(42, this.cam.td * f)); }
  focus(x, y, d) {
    this.cam.tx = Math.max(-W / 2 + 1, Math.min(W / 2 - 1, x));
    this.cam.ty = Math.max(-H + 1, Math.min(6, y));
    if (d) this.cam.td = d;
  }
  worldPerPixel() {
    return (2 * this.cam.d * Math.tan((this.camera.fov * Math.PI) / 360)) / window.innerHeight;
  }

  // screen -> grid cell on the front face
  pick(px, py) {
    const ndc = new THREE.Vector2((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, p)) return null;
    return { x: Math.floor(p.x + W / 2), y: Math.floor(-p.y), wx: p.x, wy: p.y };
  }
  project(x, y, z) {
    this.v.set(x, y, z).project(this.camera);
    return { x: (this.v.x * 0.5 + 0.5) * window.innerWidth, y: (-this.v.y * 0.5 + 0.5) * window.innerHeight, z: this.v.z };
  }
  pickRabbit(px, py) {
    let best = null, bd = Math.max(18, 34 * (19 / this.cam.d));
    for (const r of G.state.rabbits) {
      const p = this.project(r.wx, r.wy + 0.25, r.wz);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bd) { best = r; bd = d; }
    }
    return best;
  }

  frame(dt) {
    this.t += dt;
    const s = G.state;
    if (G.dirty.terrain) { this.terrain.rebuild(); G.dirty.terrain = false; }
    if (G.dirty.rooms) { this.rooms.rebuild(); G.dirty.rooms = false; }
    if (this.cam.follow) {
      const r = s.rabbits.find(o => o.id === this.cam.follow);
      if (r) { this.cam.tx = r.wx; this.cam.ty = r.wy + 0.5 - (window.innerWidth <= 820 ? 2.2 : 0); } else this.cam.follow = 0;
    }
    const k = Math.min(1, dt * 8);
    this.cam.x += (this.cam.tx - this.cam.x) * k;
    this.cam.y += (this.cam.ty - this.cam.y) * k;
    this.cam.d += (this.cam.td - this.cam.d) * k;
    if (this.camOverride) this.camOverride(this.camera, this.t);
    else {
      this.camera.position.set(this.cam.x, this.cam.y + this.cam.d * 0.2, this.cam.d);
      this.camera.lookAt(this.cam.x, this.cam.y, 0);
    }

    this.surface.update(dt, s.time.hour, this);
    this.terrain.update(this.t);
    this.rooms.update(this.t);
    this.bunnies.update(this.t, dt);
    this.fx.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
