import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STREAK, streakTier, streakBonusFor, streakTierUp,
  RESCUE, canRescue,
  THEMES, themeFor, themeChangesAfter,
} from '../src/rules.js';

test('streak tiers: ×1 below 5, ×2 from 5, ×3 from 10', () => {
  assert.equal(streakTier(0), 1);
  assert.equal(streakTier(4), 1);
  assert.equal(streakTier(5), 2);
  assert.equal(streakTier(9), 2);
  assert.equal(streakTier(10), 3);
  assert.equal(streakTier(99), 3);
});

test('streak bonus only rewards the wallet and is capped per level', () => {
  assert.equal(streakBonusFor(1, 0), 0);
  assert.equal(streakBonusFor(5, 0), 1);
  assert.equal(streakBonusFor(12, 0), 2);
  assert.equal(streakBonusFor(12, STREAK.maxBonus - 1), 1);   // last banana of the cap
  assert.equal(streakBonusFor(12, STREAK.maxBonus), 0);       // cap reached
  // a whole level of perfect catches never exceeds the cap
  let combo = 0, bonus = 0;
  for (let i = 0; i < 70; i++) { combo++; bonus += streakBonusFor(combo, bonus); }
  assert.equal(bonus, STREAK.maxBonus);
});

test('tier-up cheers fire exactly at the tier thresholds', () => {
  assert.equal(streakTierUp(4), false);
  assert.equal(streakTierUp(5), true);
  assert.equal(streakTierUp(6), false);
  assert.equal(streakTierUp(10), true);
  assert.equal(streakTierUp(20), false);
});

test('spilled bananas need their grace and must be falling or resting near the basket', () => {
  const rimY = 1.3, halfW = 1.7;
  const resting = { age: 1, x: 0.5, y: 0.2, vy: 0 };
  assert.equal(canRescue(resting, 0, rimY, halfW), true);
  assert.equal(canRescue({ ...resting, age: RESCUE.grace - 0.1 }, 0, rimY, halfW), false, 'too soon after the bang');
  assert.equal(canRescue({ ...resting, vy: 6 }, 0, rimY, halfW), false, 'still flying upward');
  assert.equal(canRescue({ ...resting, y: rimY + RESCUE.reach + 0.1 }, 0, rimY, halfW), false, 'above the basket');
  assert.equal(canRescue({ ...resting, x: 5 }, 0, rimY, halfW), false, 'too far away');
  assert.equal(canRescue({ ...resting, x: -(halfW + RESCUE.reach) + 0.05 }, 0, rimY, halfW), true, 'just inside reach');
  assert.equal(canRescue({ age: 0.8, x: 0.2, y: 1.0, vy: -4 }, 0, rimY, halfW), true, 'falling into the basket');
});

test('themes rotate every five levels and start on a sunny day', () => {
  assert.equal(themeFor(1).id, 'day');
  assert.equal(themeFor(5).id, 'day');
  assert.equal(themeFor(6).id, 'sunset');
  assert.equal(themeFor(10).id, 'sunset');
  assert.equal(themeFor(11).id, 'night');
  assert.equal(themeFor(16).id, 'dawn');
  assert.equal(themeFor(21).id, 'day');
  assert.equal(themeFor(0).id, 'day', 'practice (level 0) and bad input fall back to day');
  assert.equal(themeFor(undefined).id, 'day');
  for (const t of THEMES) assert.equal(t.sky.length, 4, `${t.id} has a four-stop sky`);
});

test('theme change is announced after the last level of a block', () => {
  assert.equal(themeChangesAfter(4), false);
  assert.equal(themeChangesAfter(5), true);
  assert.equal(themeChangesAfter(6), false);
  assert.equal(themeChangesAfter(10), true);
});
