import * as THREE from 'three';
import {
  makeBanana, makeBunch, makeBomb, makeBasket, applySkin, setPile, BASKET,
  makeShieldBubble, makeMagnet, makeCloud, makeBossCloud, makePalm, makeBush, toon,
} from './models.js';
import { sfx } from './audio.js';

export const POWER_DURATION = { magnet: 10, speed: 10 };
export const EXTRA_BANANAS = 5;

// Level design: every 5th level is a boss level with bombs.
export function levelConfig(n) {
  const boss = n % 5 === 0;
  const bossIndex = Math.floor(n / 5);
  const target = boss ? Math.min(10 + 5 * (n - 2), 60) : Math.min(10 + 5 * (n - 1), 70);
  const time = boss ? 40 : 90;
  const fallSpeed = Math.min(3.6 + 0.35 * (n - 1), 10);
  // Normal levels keep a lively 30-second banana pace; the long clock just gives kids room to miss.
  const paceWindow = boss ? time : 30;
  const spawnInterval = paceWindow / (target * 1.75 + 6);
  return {
    level: n,
    boss,
    bossIndex,
    target,
    time,
    fallSpeed,
    spawnInterval,
    bunchChance: 0.08,
    bombInterval: boss ? Math.max(0.7, 2.1 - 0.3 * (bossIndex - 1)) : Infinity,
    bossSpeed: 0.6 + 0.15 * bossIndex,
  };
}

// Practice: no timer, no target, gentle speed; optionally an occasional bomb to learn dodging.
export function practiceConfig(bombs) {
  return {
    level: 0,
    practice: true,
    boss: false,
    target: Infinity,
    time: Infinity,
    fallSpeed: 3.6,
    spawnInterval: 0.9,
    bunchChance: 0.08,
    bombInterval: bombs ? 4 : Infinity,
  };
}

const BASE_SPEED = 13;
const BASKET_Y = 0.75;

export class Game {
  constructor(canvas, hooks) {
    this.hooks = hooks; // { onHud, onEnd, onPopup, usePower }
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbfe9ff, 40, 90);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

    this.clock = new THREE.Clock();
    this.time = 0;
    this.items = [];
    this.particles = [];
    this.debris = [];
    this.state = 'menu';
    this.paused = false;
    this.bounds = { halfW: 8, top: 13, play: 7 };
    this.input = { left: false, right: false, pointerX: null };

    this.buildWorld();
    this.bindInput(canvas);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------------- World ----------------
  buildWorld() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xffffff, 0x88cc77, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-8, 20, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -5, near: 1, far: 60 });
    s.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), toon(0x7ed957));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -40;
    ground.receiveShadow = true;
    s.add(ground);
    // path strip under the basket
    const path = new THREE.Mesh(new THREE.PlaneGeometry(200, 3.2), toon(0xf2d48f));
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.01, 0);
    path.receiveShadow = true;
    s.add(path);

    // rolling hills
    const hillColors = [0x5fc26b, 0x4fb35e, 0x69cc70];
    for (let i = 0; i < 9; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), toon(hillColors[i % 3]));
      const r = 10 + (i % 3) * 4;
      hill.scale.set(r * 1.6, r * 0.55, r);
      hill.position.set(-60 + i * 15, -1, -45 - (i % 2) * 8);
      s.add(hill);
    }
    // sun in the sky
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshBasicMaterial({ color: 0xfff2a8, fog: false }));
    sunDisc.position.set(-22, 26, -60);
    s.add(sunDisc);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(6.5, 32), new THREE.MeshBasicMaterial({ color: 0xfff7cf, transparent: true, opacity: 0.4, fog: false }));
    glow.position.set(-22, 26, -60.1);
    s.add(glow);

    // palms & bushes
    this.palms = [];
    const palmSpots = [[-1, -5, 7], [1, -6, 6.5], [-1.6, -14, 8], [1.7, -15, 8.5], [-2.6, -24, 9], [2.4, -26, 9]];
    for (const [side, z, h] of palmSpots) {
      const p = makePalm(h);
      p.userData.side = side;
      p.position.z = z;
      p.rotation.y = side > 0 ? Math.PI : 0;
      s.add(p);
      this.palms.push(p);
    }
    this.bushes = [];
    for (let i = 0; i < 8; i++) {
      const b = makeBush(0.9 + (i % 3) * 0.25);
      b.position.set((i - 3.5) * 5.5, 0, -3.5 - (i % 2) * 2);
      s.add(b);
      this.bushes.push(b);
    }

    // clouds
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const c = makeCloud(0.9 + Math.random() * 1.2);
      c.position.set(-40 + i * 13, 16 + Math.random() * 8, -25 - Math.random() * 15);
      c.userData.speed = 0.5 + Math.random() * 0.8;
      s.add(c);
      this.clouds.push(c);
    }

    // basket + power visuals
    this.basket = makeBasket();
    this.basket.position.set(0, BASKET_Y, 0);
    s.add(this.basket);
    this.bx = 0;
    this.bvx = 0;
    this.shieldMesh = makeShieldBubble();
    this.shieldMesh.visible = false;
    s.add(this.shieldMesh);
    this.magnetMesh = makeMagnet();
    this.magnetMesh.visible = false;
    s.add(this.magnetMesh);
    this.speedTrail = [];
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
      t.visible = false;
      s.add(t);
      this.speedTrail.push(t);
    }

    this.bossCloud = makeBossCloud();
    this.bossCloud.visible = false;
    s.add(this.bossCloud);
  }

  setSkin(id) { applySkin(this.basket, id); }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // pull the camera back on narrow (portrait) screens so the field stays playable
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const wantHalfW = 6.5;
    const dist = Math.max(17, wantHalfW / (tan * aspect));
    const halfH = dist * tan;
    const cy = halfH - 1.6;
    this.camera.position.set(0, cy + 1.2, dist);
    this.camera.lookAt(0, cy, 0);
    this.camera.updateProjectionMatrix();
    this.baseCam = this.camera.position.clone();
    const halfW = halfH * aspect;
    this.bounds = {
      halfW,
      top: cy + halfH,
      play: Math.min(halfW - BASKET.radiusTop - 0.3, 11),
    };
    for (const p of this.palms) {
      const depth = -p.position.z;
      p.position.x = Math.sign(p.userData.side) * (this.bounds.play + 2.5 + depth * 0.5 + (Math.abs(p.userData.side) - 1) * 2);
    }
    this.bx = THREE.MathUtils.clamp(this.bx, -this.bounds.play, this.bounds.play);
  }

  // ---------------- Input ----------------
  bindInput(canvas) {
    const keys = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    window.addEventListener('keydown', (e) => {
      if (keys[e.code]) { this.input[keys[e.code]] = true; this.input.pointerX = null; e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => { if (keys[e.code]) this.input[keys[e.code]] = false; });

    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const toWorldX = (e) => {
      ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
      if (ray.ray.intersectPlane(plane, hit)) this.input.pointerX = hit.x;
    };
    canvas.addEventListener('pointerdown', (e) => { toWorldX(e); });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) toWorldX(e);
    });
    canvas.style.touchAction = 'none';
  }

  // ---------------- Level flow ----------------
  start(cfg, powers) {
    this.clearItems();
    this.cfg = cfg;
    this.state = 'playing';
    this.paused = false;
    this.count = 0;
    this.totalCaught = 0;
    this.combo = 0;
    this.timeLeft = cfg.time;
    this.spawnTimer = 0.4;
    this.bombTimer = 2.5;
    this.invuln = 0;
    this.shield = false;
    this.magnetT = 0;
    this.speedT = 0;
    this.powers = powers;
    this.bx = 0;
    this.basket.rotation.y = 0;
    this.input.pointerX = null;
    this.bossCloud.visible = cfg.boss;
    this.bossCloud.position.set(0, this.bounds.top + 4, 0);
    this.bossX = 0;
    setPile(this.basket, 0);
    this.lastHud = '';
    this.emitHud(true);
  }

  stop() {
    this.state = 'menu';
    this.clearItems();
    this.bossCloud.visible = false;
    this.shield = false;
    this.magnetT = this.speedT = 0;
    setPile(this.basket, 0);
  }

  clearItems() {
    for (const it of this.items) this.scene.remove(it.mesh);
    for (const p of this.particles) this.scene.remove(p.mesh);
    for (const d of this.debris) this.scene.remove(d.mesh);
    this.items = [];
    this.particles = [];
    this.debris = [];
  }

  setPaused(p) {
    if (this.state !== 'playing') return;
    this.paused = p;
  }

  activate(type) {
    if (this.state !== 'playing' || this.paused || this.cfg.practice) return false;
    if (type === 'shield' && (this.shield || !this.cfg.boss)) return false;
    if (!this.hooks.usePower(type)) return false;
    sfx.power();
    if (type === 'shield') { this.shield = true; this.popup('Shield ON!', this.basket.position, 'blue'); }
    if (type === 'magnet') { this.magnetT = POWER_DURATION.magnet; this.popup('Magnet!', this.basket.position, 'red'); }
    if (type === 'speed') { this.speedT = POWER_DURATION.speed; this.popup('Zoom!', this.basket.position, 'green'); }
    if (type === 'extra') {
      this.addBananas(EXTRA_BANANAS);
      this.popup(`+${EXTRA_BANANAS} 🍌`, this.basket.position, 'gold');
      this.burst(this.basket.position, 0xffe04a, 18);
    }
    this.emitHud(true);
    return true;
  }

  addBananas(n) {
    this.count += n;
    this.totalCaught += n;
    setPile(this.basket, this.count);
    this.squash = 1;
    if (this.count >= this.cfg.target && this.state === 'playing') this.finish(true);
  }

  finish(success) {
    this.state = 'ending';
    // up to 10 bonus bananas, based on the share of the clock left over
    const bonus = success ? Math.floor((this.timeLeft / this.cfg.time) * 10) : 0;
    this.endTimer = success ? 1.4 : 1.0;
    this.endResult = { success, count: this.count, target: this.cfg.target, bonus, level: this.cfg.level };
    if (success) {
      sfx.win();
      this.popup('Level Complete!', new THREE.Vector3(0, this.bounds.top * 0.55, 0), 'big');
      for (let i = 0; i < 5; i++) this.burst(new THREE.Vector3((i - 2) * 3, this.bounds.top * 0.5, 0), [0xffe04a, 0xff6fa8, 0x6fd3ff][i % 3], 16);
    } else {
      sfx.lose();
      this.popup("Time's up!", new THREE.Vector3(0, this.bounds.top * 0.55, 0), 'big');
    }
    this.emitHud(true);
  }

  // ---------------- Spawning ----------------
  spawn(type, x, y) {
    let mesh;
    if (type === 'bomb') mesh = makeBomb();
    else if (type === 'bunch') mesh = makeBunch();
    else mesh = makeBanana();
    mesh.scale.setScalar(type === 'bomb' ? 1 : 0.9);
    mesh.position.set(x, y, 0);
    mesh.rotation.z = Math.random() * Math.PI * 2;
    this.scene.add(mesh);
    const speed = this.cfg.fallSpeed * (0.85 + Math.random() * 0.3) * (type === 'bunch' ? 0.85 : 1);
    this.items.push({
      type, mesh, x, y, vy: -speed, vx: 0,
      spin: (Math.random() - 0.5) * 3,
      sway: Math.random() * Math.PI * 2,
      value: type === 'bunch' ? 3 : 1,
    });
  }

  // ---------------- Effects ----------------
  burst(pos, color, n = 10, power = 5) {
    const geo = this._pgeo ||= new THREE.SphereGeometry(0.12, 6, 6);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(pos);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2;
      const sp = power * (0.4 + Math.random() * 0.8);
      this.particles.push({ mesh: m, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 2, vz: (Math.random() - 0.5) * 3, life: 0.6 + Math.random() * 0.4, max: 1, grow: 0 });
    }
  }

  explosion(pos, small = false) {
    const colors = [0xffd23f, 0xff8c2a, 0xff4d3d, 0xffffff];
    const geo = this._egeo ||= new THREE.SphereGeometry(1, 12, 10);
    const n = small ? 5 : 12;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }));
      m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, Math.random()));
      m.scale.setScalar(0.2);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2;
      const sp = (small ? 1.5 : 4) * Math.random();
      this.particles.push({ mesh: m, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 1, vz: 0, life: 0.5 + Math.random() * 0.3, max: 0.8, grow: (small ? 1.2 : 2.6) * (0.6 + Math.random() * 0.6), noGravity: true });
    }
    if (!small) this.burst(pos, 0x444444, 12, 7);
  }

  spillBananas(n) {
    for (let i = 0; i < n; i++) {
      const m = makeBanana();
      m.scale.setScalar(0.7);
      m.position.set(this.bx, BASKET_Y + 0.6, 0.5);
      this.scene.add(m);
      const a = Math.PI * (0.15 + 0.7 * Math.random());
      const sp = 7 + Math.random() * 5;
      this.debris.push({ mesh: m, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 1 + Math.random() * 2, spin: (Math.random() - 0.5) * 12, life: 2.2 });
    }
  }

  popup(text, worldPos, kind = '') {
    const v = worldPos.clone().project(this.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    this.hooks.onPopup(text, x, y, kind);
  }

  emitHud(force = false) {
    const snap = {
      count: this.count, target: this.cfg.target, time: Math.ceil(Math.max(0, this.timeLeft)),
      shield: this.shield, magnet: Math.ceil(this.magnetT), speed: Math.ceil(this.speedT),
      boss: this.cfg.boss, level: this.cfg.level, combo: this.combo,
    };
    const key = JSON.stringify(snap);
    if (force || key !== this.lastHud) {
      this.lastHud = key;
      this.hooks.onHud(snap);
    }
  }

  // ---------------- Main loop ----------------
  frame() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    this.time += dt;
    const t = this.time;

    // ambient scenery
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 50) c.position.x = -50;
    }
    this.bushes.forEach((b, i) => { b.scale.y = b.scale.x * (1 + Math.sin(t * 2 + i) * 0.03); });

    if (this.state === 'playing' && !this.paused) this.update(dt);
    else if (this.state === 'ending') this.updateEnding(dt);
    else if (this.state === 'menu') {
      this.bx += (Math.sin(t * 0.8) * 2 - this.bx) * dt * 2;
    }
    if (!this.paused) this.updateFx(dt);

    // basket transform
    this.basket.position.x = this.bx;
    this.basket.position.y = BASKET_Y + (this.state === 'menu' ? Math.sin(t * 3) * 0.15 : 0);
    this.basket.rotation.z = THREE.MathUtils.clamp(-this.bvx * 0.012, -0.25, 0.25);
    this.basket.rotation.y = this.state === 'menu' ? t * 0.3 : this.basket.rotation.y * 0.9;
    this.squash = Math.max(0, (this.squash || 0) - dt * 5);
    const sq = Math.sin(this.squash * Math.PI) * 0.15;
    this.basket.scale.set(1 + sq, 1 - sq, 1 + sq);

    this.shieldMesh.visible = this.state !== 'menu' && this.shield;
    this.shieldMesh.position.set(this.bx, BASKET_Y + 0.5, 0);
    this.shieldMesh.rotation.y = t;
    this.shieldMesh.scale.setScalar(1 + Math.sin(t * 4) * 0.04);

    this.magnetMesh.visible = this.magnetT > 0 && this.state !== 'menu';
    this.magnetMesh.position.set(this.bx, BASKET_Y + 2.4 + Math.sin(t * 5) * 0.1, 0.3);
    this.magnetMesh.rotation.z = Math.PI; // poles pointing up to the sky
    if (this.magnetT > 0 && this.magnetT < 2) this.magnetMesh.visible = Math.floor(t * 8) % 2 === 0;

    const speedOn = this.speedT > 0 && this.state === 'playing';
    this.speedTrail.forEach((m, i) => {
      m.visible = speedOn && Math.abs(this.bvx) > 3;
      m.position.set(this.bx - Math.sign(this.bvx) * (1.9 + i * 0.35), BASKET_Y - 0.3 + i * 0.3, 0.2);
      m.material.opacity = 0.7 - i * 0.15;
    });

    // camera shake
    this.shake = Math.max(0, (this.shake || 0) - dt * 2);
    this.camera.position.copy(this.baseCam);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
    }

    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    const cfg = this.cfg;
    this.timeLeft -= dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.magnetT = Math.max(0, this.magnetT - dt);
    this.speedT = Math.max(0, this.speedT - dt);
    if (this.timeLeft <= 5 && Math.ceil(this.timeLeft) !== this._lastTick) {
      this._lastTick = Math.ceil(this.timeLeft);
      if (this.timeLeft > 0) sfx.tick();
    }

    // --- basket movement ---
    const maxSpeed = BASE_SPEED * (this.speedT > 0 ? 1.8 : 1);
    const prevX = this.bx;
    const lim = this.bounds.play;
    if (this.input.left || this.input.right) {
      const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      this.bx += dir * maxSpeed * dt;
    } else if (this.input.pointerX !== null) {
      const target = THREE.MathUtils.clamp(this.input.pointerX, -lim, lim);
      const dx = target - this.bx;
      this.bx += THREE.MathUtils.clamp(dx * 12 * dt, -maxSpeed * dt, maxSpeed * dt);
    }
    this.bx = THREE.MathUtils.clamp(this.bx, -lim, lim);
    this.bvx = this.bvx * 0.7 + ((this.bx - prevX) / dt) * 0.3;

    // --- spawning ---
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = cfg.spawnInterval * (0.7 + Math.random() * 0.6);
      const type = Math.random() < cfg.bunchChance ? 'bunch' : 'banana';
      this.spawn(type, (Math.random() * 2 - 1) * lim, this.bounds.top + 1);
    }
    if (cfg.practice && cfg.bombInterval < Infinity) {
      this.bombTimer -= dt;
      if (this.bombTimer <= 0) {
        this.bombTimer = cfg.bombInterval * (0.75 + Math.random() * 0.5);
        this.spawn('bomb', (Math.random() * 2 - 1) * lim, this.bounds.top + 1);
      }
    }
    if (cfg.boss) {
      this.bossX = Math.sin(this.time * cfg.bossSpeed) * lim * 0.85 + Math.sin(this.time * 2.3) * 1.2;
      const bc = this.bossCloud;
      const targetY = this.bounds.top - 1.6;
      bc.position.y += (targetY - bc.position.y) * dt * 2;
      bc.position.x = this.bossX;
      bc.position.z = -0.5;
      bc.rotation.z = Math.sin(this.time * 3) * 0.06;
      bc.children.filter((c) => c.name === 'pupil').forEach((p, i) => {
        p.position.x = (i ? 0.38 : -0.38) + THREE.MathUtils.clamp((this.bx - this.bossX) * 0.02, -0.08, 0.08);
      });
      this.bombTimer -= dt;
      if (this.bombTimer <= 0) {
        this.bombTimer = cfg.bombInterval * (0.75 + Math.random() * 0.5);
        this.spawn('bomb', this.bossX, bc.position.y - 1.2);
        this.bossCloud.scale.setScalar(1.15);
      }
      this.bossCloud.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 5);
    }

    // --- items ---
    const rimY = BASKET_Y + BASKET.height / 2;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      const prevY = it.y;
      if (this.magnetT > 0 && it.type !== 'bomb' && it.y < this.bounds.top - 1) {
        const dx = this.bx - it.x;
        if (Math.abs(dx) < 9 && it.y > rimY - 0.2) it.x += dx * Math.min(1, dt * 3.2);
      }
      it.sway += dt * 2;
      it.x += Math.sin(it.sway) * 0.3 * dt;
      it.y += it.vy * dt;
      it.mesh.position.set(it.x, it.y, 0);
      it.mesh.rotation.z += it.spin * dt;
      if (it.type === 'bomb') {
        it.mesh.rotation.z = Math.sin(it.sway * 2) * 0.3;
        const spark = it.mesh.getObjectByName('spark');
        spark.scale.setScalar(0.8 + Math.random() * 0.8);
      } else if (it.type === 'bunch') {
        const ring = it.mesh.getObjectByName('ring');
        ring.rotation.z = -it.mesh.rotation.z;
        ring.scale.setScalar(1 + Math.sin(this.time * 8) * 0.1);
      }

      const catchY = rimY + 0.1;
      const halfCatch = it.type === 'bomb' ? BASKET.radiusTop - 0.2 : BASKET.radiusTop + 0.35;
      if (prevY >= catchY && it.y < catchY && Math.abs(it.x - this.bx) < halfCatch) {
        this.onCatch(it);
        this.scene.remove(it.mesh);
        this.items.splice(i, 1);
        if (this.state !== 'playing') return;
        continue;
      }
      if (it.y < -0.2) {
        if (it.type === 'bomb') this.explosion(new THREE.Vector3(it.x, 0.3, 0), true);
        else this.combo = 0;
        this.scene.remove(it.mesh);
        this.items.splice(i, 1);
      }
    }

    if (this.timeLeft <= 0) this.finish(this.count >= cfg.target);
    this.emitHud();
  }

  onCatch(it) {
    const pos = new THREE.Vector3(it.x, BASKET_Y + 1, 0);
    if (it.type === 'bomb') {
      if (this.invuln > 0) return;
      if (this.shield) {
        this.shield = false;
        sfx.shield();
        this.burst(pos, 0x7fd8ff, 24, 6);
        this.popup('Blocked! 🛡️', pos, 'blue');
        this.invuln = 0.6;
        return;
      }
      sfx.boom();
      this.explosion(pos);
      this.shake = 1.2;
      this.popup('BOOM! 💥', pos, 'boom');
      this.spillBananas(Math.min(this.count, 14));
      this.count = 0;
      this.combo = 0;
      this.invuln = 1;
      setPile(this.basket, 0);
      this.hooks.onBoom?.();
      return;
    }
    this.combo++;
    if (it.type === 'bunch') sfx.bunch(); else sfx.catch(this.combo);
    this.burst(pos, it.type === 'bunch' ? 0xfff27a : 0xffe04a, it.type === 'bunch' ? 16 : 7, 4);
    this.popup(`+${it.value}`, pos, it.type === 'bunch' ? 'gold' : '');
    if (this.combo > 0 && this.combo % 10 === 0) this.popup(`${this.combo} in a row! 🌟`, new THREE.Vector3(this.bx, BASKET_Y + 3, 0), 'green');
    this.addBananas(it.value);
  }

  updateEnding(dt) {
    // let everything in the air fall away while the banner shows
    for (const it of this.items) {
      it.y += it.vy * dt * 1.5;
      it.mesh.position.y = it.y;
    }
    if (this.cfg.boss && this.endResult.success) {
      this.bossCloud.position.y += dt * 8;
    }
    this.endTimer -= dt;
    if (this.endTimer <= 0) {
      const r = this.endResult;
      this.stop();
      this.hooks.onEnd(r);
    }
  }

  updateFx(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (!p.noGravity) p.vy -= 12 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.grow) p.mesh.scale.setScalar(Math.min(p.grow, p.mesh.scale.x + p.grow * dt * 6));
      p.mesh.material.opacity = Math.max(0, p.life / p.max);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      d.vy -= 18 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.mesh.rotation.z += d.spin * dt;
      if (d.mesh.position.y < 0.2) { d.mesh.position.y = 0.2; d.vy *= -0.3; d.vx *= 0.6; }
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        this.debris.splice(i, 1);
      }
    }
  }
}
