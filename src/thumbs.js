import * as THREE from 'three';
import {
  makeBanana, makeBunch, makeBomb, makeBasket, applySkin, setPile, makeShieldBubble, makeMagnet,
} from './models.js';

// Small pictures for the menus (basket skins, powers, practice modes) rendered from the game's own
// 3D models, so the shop matches the art instead of showing emoji. One shared off-screen renderer,
// results cached as PNG data URLs. Everything is async (the WebGPU renderer needs init()) and
// resolves to '' when no GPU is available, so callers keep their emoji fallback.
let renderer = null, scene = null, camera = null, ready = null;
const cache = new Map();

function setup() {
  if (ready) return ready;
  ready = (async () => {
    try {
      const canvas = document.createElement('canvas');
      renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true });
      await renderer.init();
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0xffe0b0, 1.6));
      const sun = new THREE.DirectionalLight(0xffffff, 1.6);
      sun.position.set(-3, 8, 6);
      scene.add(sun);
      camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      return true;
    } catch {
      renderer = null;
      return false;
    }
  })();
  return ready;
}

function render(obj, size, { pitch = 0.45, pad = 1.0, yBias = 0, yaw = 0 } = {}) {
  renderer.setSize(size, size, false);
  scene.add(obj);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  center.y += yBias;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const dist = (sphere.radius * pad) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
  const h = dist * Math.cos(pitch);
  camera.position.set(center.x + Math.sin(yaw) * h, center.y + dist * Math.sin(pitch), center.z + Math.cos(yaw) * h);
  camera.lookAt(center);
  renderer.render(scene, camera);
  // read the canvas in the same task as the render, before the browser composites and clears it
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(obj);
  return url;
}

function cached(key, make) {
  if (cache.has(key)) return cache.get(key);
  const p = setup().then((ok) => {
    if (!ok) return '';
    try { return make(); } catch { return ''; }
  });
  cache.set(key, p);
  return p;
}

function basketWith(skin, bananas = 7) {
  const b = makeBasket();
  applySkin(b, skin);
  setPile(b, bananas);
  return b;
}

/** A basket wearing one of the shop skins, half full of bananas. */
export function skinThumb(id, size = 160) {
  return cached(`skin:${id}:${size}`, () => render(basketWith(id), size, { pitch: 0.55, pad: 0.78, yaw: 0.3 }));
}

/** One vignette per power-up: shield bubble, magnet pulling bananas, speedy basket, a heap of extras. */
export function powerThumb(type, skin = 'classic', size = 160) {
  return cached(`power:${type}:${skin}:${size}`, () => {
    const g = new THREE.Group();
    let opts = { pitch: 0.4, pad: 1.0 };
    switch (type) {
      case 'shield': {
        g.add(basketWith(skin, 4));
        const bubble = makeShieldBubble();
        bubble.position.y = 0.3;
        bubble.scale.setScalar(0.8);
        bubble.material.opacity = 0.35;
        g.add(bubble);
        opts = { pitch: 0.35, pad: 0.8 };
        break;
      }
      case 'magnet': {
        const m = makeMagnet();
        m.scale.setScalar(1.6);
        m.rotation.z = Math.PI;
        m.position.y = 1.4;
        g.add(m);
        for (const [x, y, rz] of [[-0.9, -0.1, 0.4], [0.9, -0.2, -0.5], [0, -0.6, 0.1]]) {
          const b = makeBanana(); b.scale.setScalar(0.7); b.position.set(x, y, 0.2); b.rotation.z = rz; g.add(b);
        }
        opts = { pitch: 0.2, pad: 0.85 };
        break;
      }
      case 'speed': {
        const b = basketWith(skin, 5);
        b.rotation.z = -0.22;
        g.add(b);
        for (let i = 0; i < 4; i++) {
          const t = new THREE.Mesh(new THREE.BoxGeometry(1.6 - i * 0.2, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 - i * 0.18 }));
          t.position.set(-2.1 - i * 0.35, -0.35 + i * 0.3, 0.2);
          g.add(t);
        }
        opts = { pitch: 0.3, pad: 0.85, yaw: 0.25 };
        break;
      }
      default: { // extra bananas
        g.add(makeBunch());
        for (const [x, y, rz] of [[-1.3, -0.5, 0.9], [1.3, -0.4, -0.8]]) {
          const b = makeBanana(); b.scale.setScalar(0.8); b.position.set(x, y, 0.1); b.rotation.z = rz; g.add(b);
        }
        opts = { pitch: 0.25, pad: 0.85 };
      }
    }
    return render(g, size, opts);
  });
}

/** Practice chooser pictures: a friendly banana, or a banana beside a bomb. */
export function practiceThumb(mode, size = 160) {
  return cached(`practice:${mode}:${size}`, () => {
    const g = new THREE.Group();
    if (mode === 'bombs') {
      const bomb = makeBomb(); bomb.position.set(0.55, 0, 0); g.add(bomb);
      const b = makeBanana(); b.position.set(-0.8, -0.1, 0.3); b.rotation.z = 0.5; b.scale.setScalar(0.85); g.add(b);
      return render(g, size, { pitch: 0.2, pad: 0.85, yaw: -0.2 });
    }
    const a = makeBanana(); a.rotation.z = 0.4; g.add(a);
    const b = makeBanana(); b.position.set(0.35, -0.45, 0.3); b.rotation.z = -0.3; b.scale.setScalar(0.8); g.add(b);
    return render(g, size, { pitch: 0.2, pad: 0.85 });
  });
}

/**
 * Point an <img> at a thumbnail once it is ready. The emoji fallback next to it stays until then
 * (and for good when no picture could be made).
 */
export function applyThumb(img, promise) {
  if (!img) return;
  promise.then((url) => {
    if (!url || !img.isConnected) return;
    img.src = url;
    img.classList.remove('hidden');
    img.parentElement?.classList.add('has-thumb');
  });
}
