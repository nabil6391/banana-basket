import './style.css';
import { Game, levelConfig, practiceConfig, POWER_DURATION, EXTRA_BANANAS } from './game.js';
import { hadithOfTheDay, dayNumber } from './hadith.js';
import { loadSave, writeSave } from './save.js';
import { sfx, unlockAudio, setMuted } from './audio.js';
import { SKINS } from './models.js';

const $ = (id) => document.getElementById(id);
const save = loadSave();
const hadith = hadithOfTheDay();
const today = dayNumber();
setMuted(save.muted);

const POWERS = {
  shield: { icon: '🛡️', hud: '🛡️', name: 'Bomb Shield', price: 15, key: '1', desc: 'Makes one bomb harmless (boss levels).' },
  magnet: { icon: '🧲', hud: '🧲', name: 'Banana Magnet', price: 20, key: '2', desc: `Pulls bananas to your basket for ${POWER_DURATION.magnet}s.` },
  speed: { icon: '⚡', hud: '⚡', name: 'Speed Basket', price: 10, key: '3', desc: `Move super fast for ${POWER_DURATION.speed}s.` },
  extra: { icon: '🍌✨', hud: '🍌', name: 'Extra Bananas', price: 12, key: '4', desc: `Adds +${EXTRA_BANANAS} bananas to your basket.` },
};
const SKIN_PRICES = {
  classic: null,
  berry: { bananas: 40 },
  ocean: { bananas: 40 },
  golden: { golden: 3 },
};

// ---------------- Game ----------------
const game = new Game($('scene'), {
  onHud: renderHud,
  onEnd: onLevelEnd,
  onPopup: showPopup,
  usePower(type) {
    if ((save.powers[type] || 0) <= 0) return false;
    save.powers[type]--;
    writeSave(save);
    return true;
  },
});
game.setSkin(save.skin);

// ---------------- Screens ----------------
const screens = ['hadith', 'hub', 'practice', 'pause', 'quiz', 'result', 'shop'];
let shopReturn = 'hub';
function show(name) {
  for (const s of screens) $(`screen-${s}`).classList.toggle('hidden', s !== name);
  $('hud').classList.toggle('hidden', !(name === null || name === 'pause'));
  $('topbar').classList.toggle('hidden', name === null || name === 'pause');
}

function refreshWallet(bump) {
  $('wallet').textContent = save.bananas;
  $('golden').textContent = save.golden;
  if (bump) {
    const el = $(bump === 'golden' ? 'golden' : 'wallet').parentElement;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
}

document.addEventListener('click', (e) => {
  unlockAudio();
  if (e.target.closest('button')) sfx.click();
}, true);

// ---------------- Hadith of the Day ----------------
$('hadithText').textContent = hadith.text;
$('hadithSource').textContent = hadith.source;
$('hadithExplain').textContent = hadith.explain;
$('hadithPlay').onclick = () => { stopReading(); showHub(); };
$('hubHadith').onclick = () => show('hadith');

// Read-aloud for pre-readers (Web Speech API; the button only appears when the browser can speak).
const speech = window.speechSynthesis;
let reading = false;
function setReading(on) {
  reading = on;
  $('readBtn').classList.toggle('on', on);
  $('readBtn').setAttribute('aria-pressed', String(on));
  $('readBtn').querySelector('.ico').textContent = on ? '⏹' : '🔊';
  $('readBtn').querySelector('.lbl').textContent = on ? 'Stop' : 'Read to me';
}
function stopReading() { if (speech && reading) speech.cancel(); setReading(false); }
function readHadith() {
  if (!speech) return;
  if (reading) return stopReading();
  speech.cancel();
  const u = new SpeechSynthesisUtterance(`${hadith.text}. What does it mean? ${hadith.explain}`);
  u.lang = 'en-US';
  u.rate = 0.9;
  u.pitch = 1.05;
  u.onend = () => setReading(false);
  u.onerror = () => setReading(false);
  setReading(true);
  speech.speak(u);
}
if (speech && 'SpeechSynthesisUtterance' in window) {
  $('readBtn').classList.remove('hidden');
  $('readBtn').onclick = readHadith;
  window.addEventListener('pagehide', () => speech.cancel());
}

// ---------------- Hub ----------------
function showHub() {
  const cfg = levelConfig(save.level);
  $('hubLevel').textContent = `Level ${save.level}`;
  $('hubBoss').classList.toggle('hidden', !cfg.boss);
  $('hubGoal').innerHTML = `Catch <b>${cfg.target} bananas</b> in <b>${cfg.time} seconds</b>!`;
  const path = $('levelPath');
  path.innerHTML = '';
  const startLvl = Math.max(1, save.level - 3);
  for (let n = startLvl; n < startLvl + 7; n++) {
    const d = document.createElement('div');
    const boss = n % 5 === 0;
    d.className = `dot${n < save.level ? ' done' : ''}${n === save.level ? ' current' : ''}${boss ? ' boss' : ''}`;
    d.textContent = boss ? '💣' : n;
    d.title = boss ? `Boss level ${n}` : `Level ${n}`;
    path.appendChild(d);
  }
  renderWeek();
  refreshWallet();
  show('hub');
}

// Seven moons for the last seven days: filled on days the Hadith Challenge was answered.
// Just a picture of the week — no streaks, no warnings.
function renderWeek() {
  const row = $('weekMoons');
  row.innerHTML = '';
  const days = new Set(save.quizDays || []);
  const names = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  for (let i = 6; i >= 0; i--) {
    const day = today - i;
    const date = new Date(); date.setDate(date.getDate() - i);
    const done = days.has(day);
    const d = document.createElement('div');
    d.className = `moon${done ? ' done' : ''}${i === 0 ? ' today' : ''}`;
    d.innerHTML = `<span class="m">${done ? '🌙' : '·'}</span><small>${i === 0 ? 'Today' : names[date.getDay()]}</small>`;
    d.title = done ? 'Hadith Challenge done' : '';
    row.appendChild(d);
  }
}
function markQuizDay() {
  if (!save.quizDays.includes(today)) {
    save.quizDays = [...save.quizDays.filter((d) => d > today - 60), today];   // keep two months
  }
}
$('hubPlay').onclick = () => startLevel();
$('hubPractice').onclick = () => show('practice');
$('practiceEasy').onclick = () => startLevel(practiceConfig(false));
$('practiceBombs').onclick = () => startLevel(practiceConfig(true));
$('practiceBack').onclick = () => showHub();

$('hubShop').onclick = () => openShop('hub');

function startLevel(cfg = levelConfig(save.level)) {
  show(null);
  buildPowerBar(cfg);
  $('hudLevel').textContent = cfg.practice ? '🎯 Practice' : cfg.boss ? `💣 Boss ${save.level}` : `Level ${save.level}`;
  $('hudLevel').classList.toggle('boss', cfg.boss);
  $('hud').classList.toggle('practice', !!cfg.practice);
  $('quitBtn').textContent = cfg.practice ? 'End Practice' : 'Leave Level';
  game.start(cfg, save.powers);
  const intro = cfg.practice ? (cfg.bombInterval < Infinity ? 'Practice! Catch bananas, dodge bombs 💣' : 'Practice time! No clock, no pressure 😊')
    : cfg.boss ? 'Boss Level! Dodge the bombs! 💣' : `Catch ${cfg.target} bananas!`;
  showPopup(intro, innerWidth / 2, innerHeight * 0.4, 'big');
}

// ---------------- HUD ----------------
function buildPowerBar(cfg) {
  const bar = $('powerBar');
  bar.innerHTML = '';
  for (const [type, p] of Object.entries(POWERS)) {
    const b = document.createElement('button');
    b.className = 'power-btn';
    b.dataset.type = type;
    b.title = `${p.name} (${p.key})`;
    b.innerHTML = `${p.hud}<span class="qty"></span><span class="key">${p.key}</span>`;
    b.onclick = () => game.activate(type);
    b.onpointerdown = (e) => e.stopPropagation();
    bar.appendChild(b);
  }
  bar.dataset.boss = cfg.boss ? '1' : '';
}

function renderHud(h) {
  $('hudCount').textContent = h.count;
  const practice = h.target === Infinity;
  $('hudTarget').textContent = practice ? '' : `/${h.target}`;
  $('hudBar').style.width = practice ? '0%' : `${Math.min(100, (h.count / h.target) * 100)}%`;
  $('hudTimer').textContent = practice ? '∞' : h.time;
  $('hudTimer').classList.toggle('low', !practice && h.time <= 5);
  for (const b of $('powerBar').children) {
    const type = b.dataset.type;
    const qty = save.powers[type] || 0;
    b.querySelector('.qty').textContent = qty;
    const timeLeft = type === 'magnet' ? h.magnet : type === 'speed' ? h.speed : 0;
    const active = timeLeft > 0 || (type === 'shield' && h.shield);
    b.classList.toggle('active', active);
    let left = b.querySelector('.left');
    if (timeLeft > 0) {
      if (!left) { left = document.createElement('span'); left.className = 'left'; b.appendChild(left); }
      left.textContent = timeLeft;
    } else if (type === 'shield' && h.shield) {
      if (!left) { left = document.createElement('span'); left.className = 'left'; b.appendChild(left); }
      left.textContent = 'ON';
    } else left?.remove();
    b.disabled = qty <= 0 || active || (type === 'shield' && !h.boss);
  }
}

function showPopup(text, x, y, kind) {
  const el = document.createElement('div');
  el.className = `popup ${kind || ''}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  $('popups').appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// ---------------- Pause ----------------
function pause() {
  if (game.state !== 'playing' || game.paused) return;
  game.setPaused(true);
  show('pause');
}
function resume() {
  game.setPaused(false);
  show(null);
}
$('pauseBtn').onclick = pause;
$('resumeBtn').onclick = resume;
$('quitBtn').onclick = () => {
  const practice = game.cfg?.practice;
  const caught = game.totalCaught;
  game.stop();
  showHub();
  if (practice) showPopup(`Nice practice! You caught ${caught} 🍌`, innerWidth / 2, innerHeight * 0.2, 'green');
};
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (game.paused) resume(); else pause();
    return;
  }
  const type = Object.keys(POWERS).find((k) => POWERS[k].key === e.key);
  if (type) game.activate(type);
});

// ---------------- Level end ----------------
let lastResult = null;
function onLevelEnd(r) {
  lastResult = r;
  const earned = r.count + r.bonus;
  save.bananas += earned;
  r.earned = earned;
  if (r.success) {
    save.level = r.level + 1;
    save.best = Math.max(save.best, save.level);
  }
  writeSave(save);
  refreshWallet('bananas');
  if (r.success) showQuiz(); else showResult();
}

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function showQuiz() {
  $('quizHadith').textContent = hadith.text;
  $('quizQuestion').textContent = hadith.question;
  $('quizFeedback').classList.add('hidden');
  $('quizNext').classList.add('hidden');
  const box = $('quizOptions');
  box.innerHTML = '';
  const correct = hadith.options[0];
  // the golden banana caught in play hides one wrong answer
  const hint = !!lastResult?.golden && hadith.options.length > 2;
  $('quizHint').classList.toggle('hidden', !hint);
  const wrong = shuffle(hadith.options.slice(1));
  const shown = hint ? [correct, wrong[0]] : hadith.options;
  for (const opt of shuffle(shown)) {
    const b = document.createElement('button');
    b.className = 'option';
    b.textContent = opt;
    b.onclick = () => answer(b, opt === correct);
    box.appendChild(b);
  }
  show('quiz');
}

function answer(btn, right) {
  const fb = $('quizFeedback');
  for (const b of $('quizOptions').children) {
    b.disabled = true;
    if (b.textContent === hadith.options[0]) b.classList.add('right');
  }
  markQuizDay();
  writeSave(save);
  if (right) {
    if (save.goldenDay !== today) {
      save.golden++;
      save.goldenDay = today;
      lastResult.reward = 'golden';
      fb.innerHTML = '<span class="golden">🍌⭐</span>MashaAllah! You earned a <b>Golden Banana</b>!';
      sfx.golden();
      refreshWallet('golden');
    } else {
      save.bananas += 5;
      lastResult.reward = 'bonus';
      fb.innerHTML = 'MashaAllah! Correct! <b>+5 bananas</b> 🍌<br><small>(You already got today\'s Golden Banana — come back tomorrow for a new Hadith!)</small>';
      sfx.win();
      refreshWallet('bananas');
    }
    writeSave(save);
  } else {
    btn.classList.add('wrong');
    lastResult.reward = null;
    fb.innerHTML = `Good try! 💚 The answer is: <b>${hadith.options[0]}</b>.<br><small>${hadith.explain}</small>`;
    sfx.wrong();
  }
  fb.classList.remove('hidden');
  $('quizNext').classList.remove('hidden');
}
$('quizNext').onclick = () => showResult();

function showResult() {
  const r = lastResult;
  const stars = !r.success ? 0 : r.bonus >= 5 ? 3 : r.bonus >= 2 ? 2 : 1;
  $('resStars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? '' : 'off'}" style="animation-delay:${i * 0.15}s">⭐</span>`).join('');
  if (r.success) {
    $('resTitle').textContent = r.level % 5 === 0 ? 'Boss Defeated! 🎉' : 'Great job! 🎉';
    $('resText').textContent = `You caught ${r.count} bananas on level ${r.level}!`;
    const lines = [`🍌 Caught: <b>+${r.count}</b>`];
    if (r.golden) lines.push('✨ Golden banana caught!');
    if (r.bonus) lines.push(`⏱️ Speed bonus: <b>+${r.bonus}</b>`);
    if (r.reward === 'golden') lines.push('🍌⭐ Golden Banana: <b>+1</b>');
    if (r.reward === 'bonus') lines.push('🌙 Hadith bonus: <b>+5</b>');
    $('resEarn').innerHTML = lines.join('<br>');
    $('resNext').textContent = levelConfig(save.level).boss ? `Boss Level ${save.level} 💣` : `Level ${save.level} ▶`;
  } else {
    $('resTitle').textContent = 'So close! 💪';
    $('resText').textContent = `You caught ${r.count} of ${r.target} bananas. You can do it — try again!`;
    $('resEarn').innerHTML = `🍌 You still keep <b>+${r.count}</b> bananas!${save.bananas >= 10 ? '<br><small>Tip: grab a power-up in the shop!</small>' : ''}`;
    $('resNext').textContent = 'Try Again 🔁';
  }
  refreshWallet();
  show('result');
}
$('resNext').onclick = () => startLevel();
$('resShop').onclick = () => openShop('result');
$('resMenu').onclick = () => showHub();

// ---------------- Shop ----------------
function openShop(from) {
  shopReturn = from;
  renderShop();
  show('shop');
}
$('shopClose').onclick = () => (shopReturn === 'result' ? show('result') : showHub());

function renderShop() {
  const grid = $('shopPowers');
  grid.innerHTML = '';
  for (const [type, p] of Object.entries(POWERS)) {
    const item = document.createElement('div');
    const have = save.powers[type] || 0;
    item.className = `shop-item p-${type}`;
    item.innerHTML = `<div class="ico">${p.icon}</div><div class="name">${p.name}</div>
      <div class="desc">${p.desc}</div><div class="own${have ? ' has' : ''}">${have ? `You have ×${have}` : 'None yet'}</div>`;
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = `Buy · ${p.price} 🍌`;
    b.disabled = save.bananas < p.price;
    b.onclick = () => {
      if (save.bananas < p.price) return;
      save.bananas -= p.price;
      save.powers[type] = (save.powers[type] || 0) + 1;
      writeSave(save);
      sfx.buy();
      refreshWallet('bananas');
      renderShop();
    };
    item.appendChild(b);
    grid.appendChild(item);
  }

  const skins = $('shopSkins');
  skins.innerHTML = '';
  for (const [id, s] of Object.entries(SKINS)) {
    const owned = save.skins.includes(id);
    const price = SKIN_PRICES[id];
    const item = document.createElement('div');
    item.className = `shop-item skin${save.skin === id ? ' equipped' : ''}${id === 'golden' ? ' gold' : ''}`;
    const weave = `repeating-linear-gradient(90deg, ${s.a} 0 8px, ${s.b} 8px 16px)`;
    item.innerHTML = `<div class="swatch" style="background:${weave};border-color:#${s.rim.toString(16).padStart(6, '0')}"></div><div class="name">${s.name}</div>`;
    const b = document.createElement('button');
    b.className = 'btn';
    if (save.skin === id) { b.textContent = 'Using ✔'; b.disabled = true; }
    else if (owned) { b.textContent = 'Use'; b.className = 'btn alt'; }
    else if (price.golden) { b.textContent = `${price.golden} 🍌⭐`; b.disabled = save.golden < price.golden; }
    else { b.textContent = `${price.bananas} 🍌`; b.disabled = save.bananas < price.bananas; }
    b.onclick = () => {
      if (!owned) {
        if (price.golden) save.golden -= price.golden; else save.bananas -= price.bananas;
        save.skins.push(id);
        sfx.buy();
      }
      save.skin = id;
      game.setSkin(id);
      writeSave(save);
      refreshWallet();
      renderShop();
    };
    item.appendChild(b);
    skins.appendChild(item);
  }
}

// ---------------- Sound toggle ----------------
function renderMute() { $('muteBtn').textContent = save.muted ? '🔇' : '🔊'; }
$('muteBtn').onclick = () => {
  save.muted = !save.muted;
  setMuted(save.muted);
  writeSave(save);
  renderMute();
};
renderMute();

// Every time the game opens: Hadith of the Day first.
refreshWallet();
show('hadith');

// expose for debugging in the console
window.bananaBasket = { game, save };
