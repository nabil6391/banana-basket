// Pure game rules shared by the game and its unit tests. No three.js or DOM in here.

// ---------- Combo streak ----------
// Consecutive catches (no miss, no bomb) build a streak. From tiers[0] in a row every banana also
// drops ONE bonus banana straight into the wallet (×2); from tiers[1] it drops two (×3).
// The level count itself is untouched, so levels don't get shorter and nothing is lost on a miss —
// the streak only rewards attention with extra pocket money, capped per level.
export const STREAK = { tiers: [5, 10], maxBonus: 20 };

/** 1 = no multiplier yet, 2 = ×2, 3 = ×3. */
export function streakTier(combo) {
  if (combo >= STREAK.tiers[1]) return 3;
  if (combo >= STREAK.tiers[0]) return 2;
  return 1;
}

/** Wallet bonus for one catch made at `combo` (already incremented), given the bonus earned so far this level. */
export function streakBonusFor(combo, soFar) {
  const extra = streakTier(combo) - 1;
  return Math.max(0, Math.min(extra, STREAK.maxBonus - soFar));
}

/** True when this catch just crossed a tier (worth a little cheer). */
export function streakTierUp(combo) {
  return STREAK.tiers.includes(combo);
}

// ---------- Spilled-banana rescue ----------
// After a bomb the spilled bananas bounce on the path for a couple of seconds and can be scooped back
// up by moving the basket under them. A short grace keeps the burst from landing straight back in.
export const RESCUE = { life: 2.4, grace: 0.45, bounce: 0.45, reach: 0.4 };

/**
 * Can a spilled banana be scooped?  `d` = { age, x, y, vy }; `bx` basket x; `rimY` basket rim height;
 * `halfW` basket half-width.  Scooped when it has had its grace, is falling or resting, is at/below the
 * rim and within reach of the basket.
 */
export function canRescue(d, bx, rimY, halfW) {
  if (d.age < RESCUE.grace || d.vy > 0.5) return false;
  if (d.y > rimY + RESCUE.reach) return false;
  return Math.abs(d.x - bx) < halfW + RESCUE.reach;
}

// ---------- Level themes ----------
// Every five levels the sky changes so progress shows in the world, not only on the badge.
// `sky` is the CSS gradient (top → ground), the rest lights the 3D scene.
export const THEMES = [
  {
    id: 'day', name: 'Sunny day', icon: '☀️',
    sky: ['#5cc8ff', '#9fe0ff', '#d9f5ff', '#eafbe0'], fog: 0xbfe9ff,
    hemi: { sky: 0xffffff, ground: 0x88cc77, intensity: 1.4 }, sun: { color: 0xffffff, intensity: 1.8 },
    disc: { color: 0xfff2a8, glow: 0xfff7cf, y: 26 }, stars: 0, moon: 0,
  },
  {
    id: 'sunset', name: 'Sunset skies', icon: '🌅',
    sky: ['#6a63c9', '#f28ba6', '#ffb86b', '#ffe3a3'], fog: 0xf7b58a,
    hemi: { sky: 0xffd9b0, ground: 0x9a7a60, intensity: 1.25 }, sun: { color: 0xffc27a, intensity: 1.7 },
    disc: { color: 0xffb04a, glow: 0xffd9a0, y: 14 }, stars: 0.15, moon: 0,
  },
  {
    id: 'night', name: 'Starry night', icon: '🌙',
    sky: ['#0d1b4a', '#22397a', '#3c5fa6', '#2f5a48'], fog: 0x3b5a9c,
    hemi: { sky: 0xb8c8ff, ground: 0x2f4a3a, intensity: 1.0 }, sun: { color: 0xcfd8ff, intensity: 1.0 },
    disc: { color: 0xfff6d6, glow: 0xdfe8ff, y: 27 }, stars: 1, moon: 1,
  },
  {
    id: 'dawn', name: 'Morning glow', icon: '🌄',
    sky: ['#7fa6e8', '#c9b6f2', '#ffd3c2', '#f3f7d8'], fog: 0xe3d2ef,
    hemi: { sky: 0xfff0ff, ground: 0x8fa86a, intensity: 1.3 }, sun: { color: 0xffe9c8, intensity: 1.6 },
    disc: { color: 0xffe08a, glow: 0xfff0d0, y: 12 }, stars: 0.35, moon: 0,
  },
];

/** Theme for a level: 1–5 day, 6–10 sunset, 11–15 night, 16–20 dawn, then round again. */
export function themeFor(level) {
  const n = Math.max(1, Math.floor(level || 1));
  return THEMES[Math.floor((n - 1) / 5) % THEMES.length];
}

/** True when clearing `level` moves the player into a new theme (shown on the result card). */
export function themeChangesAfter(level) {
  return themeFor(level) !== themeFor(level + 1);
}
