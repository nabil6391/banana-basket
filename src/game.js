import * as THREE from 'three';
import {
  makeBanana, makeBunch, makeBomb, makeGoldenBanana, makeBasket, applySkin, setPile, BASKET,
  makeShieldBubble, makeMagnet, makeCloud, makeBossCloud, makePalm, makeBush, toon,
} from './models.js';
import { sfx } from './audio.js';
import { streakTier, streakBonusFor, streakTierUp, RESCUE, canRescue, THEMES, themeFor } from './rules.js';

export const POWER_DURATION = { magnet: 10, speed: 10 };
export const EXTRA_BANANAS = 5;
export const GOLDEN_VALUE = 3;   // the one golden banana per level counts for this many

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
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true });
    this.ready = this.renderer.init();
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
    // Honour the OS "reduce motion" setting: no idle bobbing, drifting clouds or camera shake.
    const rm = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.reduceMotion = !!rm?.matches;
    rm?.addEventListener?.('change', (e) => { this.reduceMotion = e.matches; });

    this.buildWorld();
    this.bindInput(canvas);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.ready.then(() => this.renderer.setAnimationLoop(() => this.frame()));
  }

  // ---------------- World ----------------
  buildWorld() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x88cc77, 1.4);
    s.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-8, 20, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -5, near: 1, far: 60 });
    s.add(sun);
    this.sun = sun;

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
    this.sunDisc = sunDisc;
    this.sunGlow = glow;
    // moon craters only show on the night theme (the disc itself turns pale)
    this.craters = new THREE.Group();
    for (const [x, y, r] of [[-1.2, 0.9, 0.7], [1.1, -0.4, 0.55], [-0.3, -1.6, 0.45], [1.6, 1.4, 0.35]]) {
      const c = new THREE.Mesh(new THREE.CircleGeometry(r, 16), new THREE.MeshBasicMaterial({ color: 0xd8d2c0, transparent: true, opacity: 0, fog: false }));
      c.position.set(x, y, 0.05);
      this.craters.add(c);
    }
    sunDisc.add(this.craters);
    // stars: one instanced mesh, faded in by the theme
    const starGeo = new THREE.SphereGeometry(0.22, 6, 5);
    this.starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.InstancedMesh(starGeo, this.starMat, 90);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 90; i++) {
      const sc = 0.6 + Math.random() * 0.9;
      m4.makeScale(sc, sc, sc).setPosition(-75 + Math.random() * 150, 10 + Math.random() * 34, -62 - Math.random() * 10);
      this.stars.setMatrixAt(i, m4);
    }
    this.stars.instanceMatrix.needsUpdate = true;
    this.stars.visible = false;
    s.add(this.stars);

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

    this.setTheme(THEMES[0], true);
  }

  setSkin(id) { applySkin(this.basket, id); }

  // ---------------- Level themes ----------------
  // Sky (CSS gradient behind the transparent canvas), fog, lights, sun/moon and stars all blend
  // from the current look to the new theme over ~1.5 s (instantly under reduced motion).
  setTheme(theme, instant = false) {
    if (!theme || theme === this.themeTo) return;
    const snap = (t) => ({
      sky: t.sky.map((c) => new THREE.Color(c)),
      fog: new THREE.Color(t.fog),
      hemiSky: new THREE.Color(t.hemi.sky), hemiGround: new THREE.Color(t.hemi.ground), hemiI: t.hemi.intensity,
      sunC: new THREE.Color(t.sun.color), sunI: t.sun.intensity,
      disc: new THREE.Color(t.disc.color), glow: new THREE.Color(t.disc.glow), discY: t.disc.y,
      stars: t.stars, moon: t.moon,
    });
    this.themeFrom = this.themeCur || snap(theme);
    this.themeTo = theme;
    this.themeTarget = snap(theme);
    this.themeBlend = instant || this.reduceMotion ? 1 : 0;
    this.applyThemeBlend();
  }

  applyThemeBlend() {
    const a = this.themeFrom, b = this.themeTarget;
    const k = THREE.MathUtils.smoothstep(this.themeBlend, 0, 1);
    const lerp = (x, y) => x + (y - x) * k;
    const col = (x, y, out) => out.copy(x).lerp(y, k);
    const cur = this.themeCur ||= {
      sky: [0, 0, 0, 0].map(() => new THREE.Color()), fog: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(),
      sunC: new THREE.Color(), disc: new THREE.Color(), glow: new THREE.Color(),
    };
    for (let i = 0; i < 4; i++) col(a.sky[i], b.sky[i], cur.sky[i]);
    col(a.fog, b.fog, cur.fog); col(a.hemiSky, b.hemiSky, cur.hemiSky); col(a.hemiGround, b.hemiGround, cur.hemiGround);
    col(a.sunC, b.sunC, cur.sunC); col(a.disc, b.disc, cur.disc); col(a.glow, b.glow, cur.glow);
    cur.hemiI = lerp(a.hemiI, b.hemiI); cur.sunI = lerp(a.sunI, b.sunI); cur.discY = lerp(a.discY, b.discY);
    cur.stars = lerp(a.stars, b.stars); cur.moon = lerp(a.moon, b.moon);

    this.scene.fog.color.copy(cur.fog);
    this.hemi.color.copy(cur.hemiSky); this.hemi.groundColor.copy(cur.hemiGround); this.hemi.intensity = cur.hemiI;
    this.sun.color.copy(cur.sunC); this.sun.intensity = cur.sunI;
    this.sunDisc.material.color.copy(cur.disc); this.sunGlow.material.color.copy(cur.glow);
    this.sunDisc.position.y = cur.discY; this.sunGlow.position.y = cur.discY;
    for (const c of this.craters.children) c.material.opacity = cur.moon * 0.8;
    this.starMat.opacity = cur.stars;
    this.stars.visible = cur.stars > 0.01;
    const root = document.documentElement.style;
    cur.sky.forEach((c, i) => root.setProperty(`--sky${i + 1}`, `#${c.getHexString()}`));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `#${cur.sky[0].getHexString()}`);
  }

  /** Theme for whichever level the hub or HUD is showing. */
  setThemeForLevel(level) { this.setTheme(themeFor(level)); }

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
    // one golden banana per real level, somewhere in the first 20–65% of the clock
    this.goldenCaught = false;
    this.goldenAt = cfg.practice ? Infinity : cfg.time * (0.2 + Math.random() * 0.45);
    // combo streak: wallet bonus (never in practice) and the best run of the level
    this.streakBonus = 0;
    this.bestCombo = 0;
    this.rescued = 0;
    this.rescueHintT = 0;
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
    this.endResult = {
      success, count: this.count, target: this.cfg.target, bonus, level: this.cfg.level, golden: this.goldenCaught,
      streakBonus: this.streakBonus, bestCombo: this.bestCombo, rescued: this.rescued,
    };
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
    else if (type === 'golden') mesh = makeGoldenBanana();
    else mesh = makeBanana();
    mesh.scale.setScalar(type === 'bomb' ? 1 : 0.9);
    mesh.position.set(x, y, 0);
    mesh.rotation.z = type === 'golden' ? 0 : Math.random() * Math.PI * 2;
    this.scene.add(mesh);
    // the golden one drifts down slowly so every kid gets a fair look at it
    const speed = this.cfg.fallSpeed * (0.85 + Math.random() * 0.3) * (type === 'bunch' ? 0.85 : type === 'golden' ? 0.6 : 1);
    this.items.push({
      type, mesh, x, y, vy: -speed, vx: 0,
      spin: type === 'golden' ? 0.6 : (Math.random() - 0.5) * 3,
      sway: Math.random() * Math.PI * 2,
      value: type === 'bunch' ? 3 : type === 'golden' ? GOLDEN_VALUE : 1,
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

  // Spilled bananas fly out of the basket, bounce along the path for RESCUE.life seconds and can be
  // scooped back up (see rescueDebris). They stay on the play plane so the basket can reach them.
  spillBananas(n) {
    for (let i = 0; i < n; i++) {
      const m = makeBanana();
      m.scale.setScalar(0.7);
      m.position.set(this.bx, BASKET_Y + 0.6, 0.3);
      this.scene.add(m);
      const a = Math.PI * (0.15 + 0.7 * Math.random());
      const sp = 7 + Math.random() * 5;
      this.debris.push({
        mesh: m, x: this.bx, y: BASKET_Y + 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 0.4 + Math.random() * 0.6,
        spin: (Math.random() - 0.5) * 12, life: RESCUE.life, age: 0, rescuable: true,
      });
    }
    if (n > 0) this.rescueHintT = 0.55;
  }

  rescueDebris() {
    const rimY = BASKET_Y + BASKET.height / 2;
    let got = 0;
    const pos = new THREE.Vector3(this.bx, BASKET_Y + 1, 0);
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      if (!d.rescuable || !canRescue(d, this.bx, rimY, BASKET.radiusTop)) continue;
      this.scene.remove(d.mesh);
      this.debris.splice(i, 1);
      got++;
    }
    if (!got) return;
    this.rescued += got;
    sfx.catch(got);
    this.burst(pos, 0xffe04a, 5 + got * 2, 4);
    this.popup(got > 1 ? `Rescued ${got}! 🍌` : 'Rescued! 🍌', pos, 'green');
    this.addBananas(got);
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
      boss: this.cfg.boss, level: this.cfg.level, combo: this.combo, tier: streakTier(this.combo), streakBonus: this.streakBonus,
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

    // ambient scenery (still under reduced motion)
    const calm = this.reduceMotion;
    if (!calm) {
      for (const c of this.clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 50) c.position.x = -50;
      }
      this.bushes.forEach((b, i) => { b.scale.y = b.scale.x * (1 + Math.sin(t * 2 + i) * 0.03); });
    }

    if (this.themeBlend < 1) {
      this.themeBlend = Math.min(1, this.themeBlend + dt / 1.5);
      this.applyThemeBlend();
    }
    if (this.stars.visible && !calm) this.starMat.opacity = this.themeCur.stars * (0.85 + Math.sin(t * 2.2) * 0.15);

    if (this.state === 'playing' && !this.paused) this.update(dt);
    else if (this.state === 'ending') this.updateEnding(dt);
    else if (this.state === 'menu') {
      this.bx += ((calm ? 0 : Math.sin(t * 0.8) * 2) - this.bx) * dt * 2;
    }
    if (!this.paused) this.updateFx(dt);

    // basket transform
    const idle = this.state === 'menu' && !calm;
    this.basket.position.x = this.bx;
    this.basket.position.y = BASKET_Y + (idle ? Math.sin(t * 3) * 0.15 : 0);
    this.basket.rotation.z = THREE.MathUtils.clamp(-this.bvx * 0.012, -0.25, 0.25);
    this.basket.rotation.y = idle ? t * 0.3 : this.basket.rotation.y * 0.9;
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
    if (this.shake > 0 && !calm) {
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
    if (this.goldenAt < Infinity && cfg.time - this.timeLeft >= this.goldenAt) {
      this.goldenAt = Infinity;
      this.spawn('golden', (Math.random() * 1.4 - 0.7) * lim, this.bounds.top + 1);
      this.popup('✨ Golden banana! ✨', new THREE.Vector3(0, this.bounds.top * 0.6, 0), 'gold');
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
      } else if (it.type === 'golden') {
        it.mesh.rotation.z = Math.sin(it.sway) * 0.35;                 // gentle rock instead of a tumble
        const ring = it.mesh.getObjectByName('ring');
        ring.rotation.z = this.reduceMotion ? 0 : this.time * 1.5;
        it.mesh.getObjectByName('glow').scale.setScalar(1 + Math.sin(this.time * 4) * 0.08);
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

    // --- spilled-banana rescue ---
    if (this.rescueHintT > 0) {
      this.rescueHintT -= dt;
      if (this.rescueHintT <= 0 && this.debris.length) this.popup('Quick, scoop them up! 🧺', new THREE.Vector3(this.bx, BASKET_Y + 3.4, 0), 'green');
    }
    if (this.debris.length) {
      this.rescueDebris();
      if (this.state !== 'playing') return;
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
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (!this.cfg.practice) {
      this.streakBonus += streakBonusFor(this.combo, this.streakBonus);   // paid out with the level result
    }
    if (streakTierUp(this.combo)) {
      sfx.power();
      this.popup(`Streak ×${streakTier(this.combo)}! 🔥`, new THREE.Vector3(this.bx, BASKET_Y + 3.6, 0), 'fire');
      this.burst(new THREE.Vector3(this.bx, BASKET_Y + 2.2, 0), 0xff8c2a, 14, 5);
    }
    if (it.type === 'golden') {
      this.goldenCaught = true;
      sfx.golden();
      this.burst(pos, 0xfff6c0, 28, 6);
      this.popup(`+${it.value} ✨ Golden!`, pos, 'gold');
      this.popup('Quiz hint unlocked 🌙', new THREE.Vector3(this.bx, BASKET_Y + 3.2, 0), 'green');
    } else {
      if (it.type === 'bunch') sfx.bunch(); else sfx.catch(this.combo);
      this.burst(pos, it.type === 'bunch' ? 0xfff27a : 0xffe04a, it.type === 'bunch' ? 16 : 7, 4);
      this.popup(`+${it.value}`, pos, it.type === 'bunch' ? 'gold' : '');
    }
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
    const lim = this.bounds.play + 1.5;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      d.age += dt;
      d.vy -= 18 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < -lim || d.x > lim) { d.x = THREE.MathUtils.clamp(d.x, -lim, lim); d.vx *= -0.5; }
      if (d.y < 0.2) { d.y = 0.2; d.vy = Math.abs(d.vy) > 1.5 ? -d.vy * RESCUE.bounce : 0; d.vx *= 0.7; }
      d.mesh.position.set(d.x, d.y, Math.min(0.9, d.mesh.position.z + d.vz * dt));
      d.mesh.rotation.z += d.spin * dt * (d.vy === 0 ? 0.2 : 1);
      // shrink away in the last half second so the chance visibly closes
      if (d.life < 0.5) d.mesh.scale.setScalar(0.7 * Math.max(0, d.life / 0.5));
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        this.debris.splice(i, 1);
      }
    }
  }
}
