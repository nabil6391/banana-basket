import * as THREE from 'three';

// ---------- Toon material helpers ----------
const gradientMap = (() => {
  const data = new Uint8Array([90, 160, 225, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

const matCache = new Map();
export function toon(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!extra.noCache && matCache.has(key)) return matCache.get(key);
  const { noCache, ...params } = extra;
  const m = new THREE.MeshToonMaterial({ color, gradientMap, ...params });
  if (!noCache) matCache.set(key, m);
  return m;
}

function shadowed(obj) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return obj;
}

// ---------- Banana ----------
const bananaGeo = (() => {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.75, 0.25, 0),
    new THREE.Vector3(0, -0.45, 0),
    new THREE.Vector3(0.75, 0.25, 0),
  );
  const N = 24, M = 10, R = 0.24;
  const geo = new THREE.TubeGeometry(curve, N, R, M, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    const i = Math.floor(k / (M + 1));
    const t = i / N;
    const p = curve.getPointAt(t);
    const taper = 0.25 + 0.75 * Math.pow(Math.sin(Math.PI * t), 0.55);
    v.fromBufferAttribute(pos, k).sub(p).multiplyScalar(taper).add(p);
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return { geo, curve };
})();

export function makeBanana() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(bananaGeo.geo, toon(0xffd93b));
  g.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.25, 6), toon(0x7a5a1c));
  stem.position.set(0.8, 0.33, 0);
  stem.rotation.z = -0.9;
  g.add(stem);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), toon(0x4a3210));
  tip.position.set(-0.76, 0.26, 0);
  g.add(tip);
  return shadowed(g);
}

export function makeBunch() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const b = makeBanana();
    b.rotation.z = (i - 1) * 0.35;
    b.rotation.y = (i - 1) * 0.4;
    b.position.set((i - 1) * 0.15, (i === 1 ? 0.1 : 0), (i - 1) * 0.12);
    g.add(b);
  }
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.35, 8), toon(0x6b8e23));
  crown.position.set(0.85, 0.45, 0);
  crown.rotation.z = -0.6;
  g.add(crown);
  // little sparkle ring so kids notice it's special
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.05, 6, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff6a0, transparent: true, opacity: 0.8 }),
  );
  ring.name = 'ring';
  g.add(ring);
  return shadowed(g);
}

// ---------- Bomb (cute, not scary) ----------
export function makeBomb() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 16), toon(0x2d2f45));
  g.add(body);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshBasicMaterial({ color: 0x8a90c0 }));
  shine.position.set(-0.28, 0.3, 0.45);
  g.add(shine);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.2, 10), toon(0x676b88));
  cap.position.y = 0.65;
  g.add(cap);
  const fuse = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0.72, 0), new THREE.Vector3(0.05, 1.0, 0), new THREE.Vector3(0.28, 1.08, 0),
    ), 8, 0.045, 5),
    toon(0xc7a26b),
  );
  g.add(fuse);
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
  spark.position.set(0.3, 1.1, 0);
  spark.name = 'spark';
  g.add(spark);
  // grumpy-cute face
  const eyeW = toon(0xffffff), eyeB = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), eyeW);
    e.position.set(0.2 * s, 0.1, 0.55);
    e.scale.z = 0.5;
    g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), eyeB);
    p.position.set(0.2 * s, 0.08, 0.62);
    g.add(p);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), eyeB);
    brow.position.set(0.2 * s, 0.27, 0.56);
    brow.rotation.z = -0.35 * s;
    g.add(brow);
  }
  return shadowed(g);
}

// ---------- Basket ----------
export const SKINS = {
  classic: { name: 'Classic', a: '#c98a3d', b: '#a86a26', rim: 0x8a5520 },
  berry: { name: 'Berry', a: '#e0508a', b: '#b83570', rim: 0x8c1f52 },
  ocean: { name: 'Ocean', a: '#3fa6e0', b: '#2a7fb8', rim: 0x1c5a8a },
  golden: { name: 'Golden', a: '#ffd23f', b: '#e6a817', rim: 0xc98a00 },
};

function weaveTexture(a, b) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = b;
  x.fillRect(0, 0, 128, 128);
  const s = 16;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      x.fillStyle = (i + j) % 2 ? a : b;
      x.beginPath();
      x.roundRect(i * s + 1, j * s + 1, s - 2, s - 2, 4);
      x.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const BASKET = { radiusTop: 1.35, radiusBottom: 1.0, height: 1.1 };

export function makeBasket() {
  const g = new THREE.Group();
  const side = new THREE.Mesh(
    new THREE.CylinderGeometry(BASKET.radiusTop, BASKET.radiusBottom, BASKET.height, 28, 1, true),
    new THREE.MeshToonMaterial({ gradientMap, side: THREE.DoubleSide }),
  );
  side.name = 'side';
  g.add(side);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(BASKET.radiusBottom, 28), toon(0x7a4f1d, { noCache: true }));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = -BASKET.height / 2 + 0.01;
  bottom.name = 'bottom';
  g.add(bottom);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(BASKET.radiusTop, 0.12, 8, 32), toon(0x8a5520, { noCache: true }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = BASKET.height / 2;
  rim.name = 'rim';
  g.add(rim);
  const band = new THREE.Mesh(new THREE.TorusGeometry(BASKET.radiusBottom + 0.02, 0.08, 6, 32), rim.material);
  band.rotation.x = Math.PI / 2;
  band.position.y = -BASKET.height / 2 + 0.05;
  g.add(band);
  // pile of caught bananas that grows with the count
  const pile = new THREE.Group();
  pile.name = 'pile';
  for (let i = 0; i < 12; i++) {
    const b = makeBanana();
    const ang = i * 2.4;
    const layer = Math.floor(i / 5);
    const r = layer === 2 ? 0.1 : 0.55 - layer * 0.15;
    b.position.set(Math.cos(ang) * r, -0.25 + layer * 0.28, Math.sin(ang) * r);
    b.rotation.set(0.3 * Math.sin(i), ang, 0.4 * Math.cos(i * 1.7));
    b.scale.setScalar(0.62);
    b.visible = false;
    pile.add(b);
  }
  g.add(pile);
  shadowed(g);
  applySkin(g, 'classic');
  return g;
}

const skinTextures = {};
export function applySkin(basket, skinId) {
  const skin = SKINS[skinId] || SKINS.classic;
  skinTextures[skinId] ||= weaveTexture(skin.a, skin.b);
  const side = basket.getObjectByName('side');
  side.material.map = skinTextures[skinId];
  side.material.needsUpdate = true;
  basket.getObjectByName('rim').material.color.setHex(skin.rim);
  basket.getObjectByName('bottom').material.color.set(skin.b).multiplyScalar(0.6);
}

export function setPile(basket, count) {
  const pile = basket.getObjectByName('pile');
  const show = Math.min(pile.children.length, Math.ceil(count / 2));
  pile.children.forEach((b, i) => { b.visible = i < show; });
}

// ---------- Power-up visuals ----------
export function makeShieldBubble() {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 32, 20),
    new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.25, depthWrite: false }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.1, 0.05, 6, 48),
    new THREE.MeshBasicMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.7 }),
  );
  m.add(ring);
  return m;
}

export function makeMagnet() {
  const g = new THREE.Group();
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.2, 10, 20, Math.PI), toon(0xe63946));
  g.add(arc);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 10), toon(0xe63946));
    leg.position.set(0.5 * s, -0.2, 0);
    g.add(leg);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.22, 10), toon(0xeeeeee));
    tip.position.set(0.5 * s, -0.5, 0);
    g.add(tip);
  }
  return shadowed(g);
}

// ---------- Scenery ----------
export function makeCloud(scale = 1, color = 0xffffff) {
  const g = new THREE.Group();
  const mat = toon(color);
  const puffs = [[0, 0, 1], [0.9, -0.1, 0.75], [-0.9, -0.1, 0.8], [0.4, 0.45, 0.7], [-0.4, 0.4, 0.65]];
  for (const [x, y, r] of puffs) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
    s.position.set(x, y, 0);
    g.add(s);
  }
  g.scale.setScalar(scale);
  return g;
}

// The boss: a mischievous storm cloud that drops bombs.
export function makeBossCloud() {
  const g = makeCloud(1.6, 0x6d6f8f);
  const eyeW = toon(0xffffff), black = new THREE.MeshBasicMaterial({ color: 0x151520 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), eyeW);
    e.position.set(0.38 * s, 0.1, 0.85);
    e.scale.z = 0.5;
    g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), black);
    p.position.set(0.38 * s, 0.05, 0.98);
    p.name = 'pupil';
    g.add(p);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.05), black);
    brow.position.set(0.38 * s, 0.42, 0.9);
    brow.rotation.z = -0.4 * s;
    g.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 12, Math.PI), black);
  mouth.position.set(0, -0.3, 0.95);
  g.add(mouth);
  return g;
}

export function makePalm(height = 6) {
  const g = new THREE.Group();
  const trunkMat = toon(0x9c6b3a);
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.28 - i * 0.015, 0.34 - i * 0.015, height / segs + 0.05, 8), trunkMat);
    seg.position.set(Math.sin(i * 0.35) * 0.35, (i + 0.5) * (height / segs), 0);
    seg.rotation.z = -0.06;
    g.add(seg);
  }
  const top = new THREE.Vector3(Math.sin(segs * 0.35) * 0.35, height, 0);
  const leafMat = toon(0x3fae49, { side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), leafMat);
    leaf.scale.set(2.2, 0.35, 0.55);
    leaf.position.copy(top);
    leaf.rotation.y = (i / 7) * Math.PI * 2;
    leaf.rotation.z = -0.45;
    leaf.translateX(1.4);
    g.add(leaf);
  }
  // bananas hanging on the palm tree (well, banana palm!)
  for (let i = 0; i < 3; i++) {
    const b = makeBanana();
    b.scale.setScalar(0.45);
    b.position.set(top.x + (i - 1) * 0.3, height - 0.5, 0.35);
    b.rotation.z = Math.PI / 2 + (i - 1) * 0.3;
    g.add(b);
  }
  return shadowed(g);
}

export function makeBush(scale = 1) {
  const g = new THREE.Group();
  const mat = toon(0x4cc35a);
  for (const [x, y, r] of [[0, 0.5, 0.8], [0.8, 0.35, 0.6], [-0.75, 0.35, 0.65]]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat);
    s.position.set(x, y, 0);
    g.add(s);
  }
  // flowers
  const colors = [0xff6fa8, 0xffe04a, 0xffffff];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), toon(colors[i % 3]));
    f.position.set(-0.8 + i * 0.5, 0.55 + (i % 2) * 0.35, 0.6);
    g.add(f);
  }
  g.scale.setScalar(scale);
  return shadowed(g);
}
