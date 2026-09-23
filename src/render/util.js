// Shared materials, geometries and canvas textures.
import * as THREE from 'three';

let grad;
export function gradient() {
  if (!grad) {
    grad = new THREE.DataTexture(new Uint8Array([120, 195, 255]), 3, 1, THREE.RedFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter;
    grad.needsUpdate = true;
  }
  return grad;
}

const matCache = new Map();
export function toon(color, o = {}) {
  const key = `${color}|${o.emissive ?? ''}|${o.ei ?? ''}|${o.opacity ?? ''}|${o.map ? o.map.uuid : ''}|${o.side ?? ''}|${o.unique ? Math.random() : ''}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradient() });
    if (o.emissive != null) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
    if (o.opacity != null) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
    if (o.map) m.map = o.map;
    if (o.side) m.side = o.side;
    if (!o.unique) matCache.set(key, m);
  }
  return m;
}

const geoCache = new Map();
function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
export const geoBox = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const geoSphere = () => cached('s', () => new THREE.SphereGeometry(1, 16, 12));
export const geoCyl = (rt, rb, h, seg = 14) => cached(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const geoCone = (r, h, seg = 10) => cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
export const geoTorus = (r, t, arc = Math.PI * 2) => cached(`t${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 8, 20, arc));

// Mesh helpers: add to group g and return mesh
export function box(g, w, h, d, color, x, y, z, o) {
  const m = new THREE.Mesh(geoBox(w, h, d), o?.mat || toon(color, o));
  m.position.set(x, y, z); g.add(m); return m;
}
export function sph(g, r, color, x, y, z, sx = 1, sy = 1, sz = 1, o) {
  const m = new THREE.Mesh(geoSphere(), o?.mat || toon(color, o));
  m.position.set(x, y, z); m.scale.set(r * sx, r * sy, r * sz); g.add(m); return m;
}
export function cyl(g, rt, rb, h, color, x, y, z, o) {
  const m = new THREE.Mesh(geoCyl(rt, rb, h, o?.seg ?? 14), o?.mat || toon(color, o));
  m.position.set(x, y, z); g.add(m); return m;
}
export function cone(g, r, h, color, x, y, z, o) {
  const m = new THREE.Mesh(geoCone(r, h, o?.seg ?? 10), o?.mat || toon(color, o));
  m.position.set(x, y, z); g.add(m); return m;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export function dirtTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#b9b9b9'; g.fillRect(0, 0, 128, 128);
  rr(g, 4, 4, 120, 120, 22); g.fillStyle = '#f4f4f4'; g.fill();
  for (let i = 0; i < 260; i++) {
    const v = 205 + Math.random() * 50;
    g.fillStyle = `rgba(${v},${v},${v},0.9)`;
    g.beginPath(); g.arc(8 + Math.random() * 112, 8 + Math.random() * 112, 1 + Math.random() * 3.5, 0, 7); g.fill();
  }
  for (let i = 0; i < 16; i++) {
    g.fillStyle = 'rgba(150,150,150,0.45)';
    g.beginPath(); g.arc(12 + Math.random() * 104, 12 + Math.random() * 104, 1.5 + Math.random() * 2.5, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3;
  rr(g, 9, 9, 110, 110, 18); g.stroke();
  return tex(c);
}

export function wallTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) {
    const v = 170 + Math.random() * 70;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 4, 0, 7); g.fill();
  }
  // little roots
  g.strokeStyle = 'rgba(120,120,120,0.5)'; g.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    let x = Math.random() * 128, y = Math.random() * 128;
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 30; y += 8 + Math.random() * 10; g.lineTo(x, y); }
    g.stroke();
  }
  return tex(c, [1, 1]);
}

export function stripeTexture() {
  const [c, g] = canvas(64, 64);
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,214,90,0.55)'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(90,60,20,0.45)';
  for (let i = -64; i < 128; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 8, 0); g.lineTo(i + 8 + 64, 64); g.lineTo(i + 64, 64); g.fill();
  }
  g.strokeStyle = 'rgba(255,240,180,0.95)'; g.lineWidth = 4; g.strokeRect(2, 2, 60, 60);
  return tex(c);
}

const patCache = new Map();
export function patternTexture(kind, c1, c2, rw, rh) {
  const key = `${kind}|${c1}|${c2}|${rw}|${rh}`;
  if (patCache.has(key)) return patCache.get(key);
  const [c, g] = canvas(128, 128);
  g.fillStyle = c1; g.fillRect(0, 0, 128, 128);
  g.fillStyle = c2; g.strokeStyle = c2;
  if (kind === 'dots') {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.beginPath(); g.arc(16 + x * 32 + (y % 2) * 16, 16 + y * 32, 6, 0, 7); g.fill();
    }
  } else if (kind === 'stripes') {
    for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 14, 128);
  } else if (kind === 'tiles') {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2 === 0) g.fillRect(x * 32 + 2, y * 32 + 2, 28, 28);
  } else if (kind === 'bricks') {
    g.lineWidth = 4;
    for (let y = 0; y < 8; y++) {
      g.beginPath(); g.moveTo(0, y * 16); g.lineTo(128, y * 16); g.stroke();
      for (let x = (y % 2) * 16; x < 128; x += 32) { g.beginPath(); g.moveTo(x, y * 16); g.lineTo(x, y * 16 + 16); g.stroke(); }
    }
  } else if (kind === 'planks') {
    g.lineWidth = 3;
    for (let y = 0; y < 128; y += 21) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 3, 0, 7); g.fill(); }
  } else if (kind === 'stars') {
    for (let i = 0; i < 9; i++) {
      const x = 10 + ((i * 47) % 108), y = 10 + ((i * 71) % 108);
      g.save(); g.translate(x, y); g.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 3 : 8, a = (k * Math.PI) / 5 - Math.PI / 2;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath(); g.fill(); g.restore();
    }
  } else if (kind === 'hearts') {
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const cx = 22 + x * 42 + (y % 2) * 21, cy = 22 + y * 42;
      g.beginPath(); g.moveTo(cx, cy + 8);
      g.bezierCurveTo(cx - 14, cy - 2, cx - 6, cy - 12, cx, cy - 4);
      g.bezierCurveTo(cx + 6, cy - 12, cx + 14, cy - 2, cx, cy + 8); g.fill();
    }
  }
  const t = tex(c, [rw, rh]);
  patCache.set(key, t);
  return t;
}

const emojiCache = new Map();
export function emojiTexture(emoji, bubble = true) {
  const key = emoji + bubble;
  if (emojiCache.has(key)) return emojiCache.get(key);
  const [c, g] = canvas(128, 128);
  if (bubble) {
    g.fillStyle = 'rgba(255,250,240,0.96)';
    g.strokeStyle = 'rgba(122,85,54,0.9)'; g.lineWidth = 6;
    g.beginPath(); g.arc(64, 58, 48, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(52, 102); g.lineTo(64, 124); g.lineTo(76, 102); g.fill();
  }
  g.font = `${bubble ? 56 : 90}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, 64, bubble ? 62 : 68);
  const t = tex(c);
  emojiCache.set(key, t);
  return t;
}

export function textTexture(text, { size = 44, color = '#fff', stroke = '#5a3a22', w = 512, h = 96, font = 'Fredoka' } = {}) {
  const [c, g] = canvas(w, h);
  g.font = `600 ${size}px "${font}","Segoe UI Emoji",sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = stroke; g.lineJoin = 'round';
  g.strokeText(text, w / 2, h / 2);
  g.fillStyle = color; g.fillText(text, w / 2, h / 2);
  return tex(c);
}

export function signTexture(line1, line2) {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#c98f55'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < 256; y += 42) g.fillRect(0, y, 512, 4);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fff3dc';
  g.font = '700 78px "Fredoka",sans-serif';
  g.fillText(line1, 256, 100);
  g.font = '600 46px "Fredoka",sans-serif';
  g.fillStyle = '#5a3a22';
  g.fillText(line2, 256, 190);
  return tex(c);
}
