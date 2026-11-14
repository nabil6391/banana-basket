# Banana Basket — design pass, November 2026

One round of UI/UX polish on top of `f42bc32`. Core gameplay, level tuning and `src/hadith.js` are untouched.

## Critique and what changed

**Faces broke the house style.** The bomb and the boss Storm Cloud both had white eyeballs with a black pupil (googly whites). They now have small solid bean eyes, slightly tilted so the bomb still reads as grumpy-cute. The boss keeps its `pupil` meshes so it still glances toward the basket.

**No motion opt-out.** Nothing honoured `prefers-reduced-motion`. CSS now collapses every animation/transition (card pop, boss-warning wobble, popup float, timer pulse, button lift), and the 3D scene stops the idle basket bob/spin, drifting clouds, breathing bushes and camera shake when the OS asks for it (live-updates on change).

**Every card looked the same cream rectangle.** Each screen now has a coloured top edge (hadith yellow, hub pink, practice orange, shop blue, quiz purple, result green, pause slate), so a child always knows where they are without reading. The hub's three secondary buttons were all the same blue; they are now practice-orange, shop-blue, hadith-purple, and the same colours follow through to the result and practice screens.

**Shop was a wall of identical white tiles.** Power cards are tinted to match their icon (shield blue, magnet red, speed yellow, extra green), icons sit in coloured discs, "You have" is a pill that turns green once you own one ("None yet" otherwise), the equipped basket tile is washed green, Golden is gold, and both sections have icon headings.

**Small feel fixes.** Keyboard hint uses key-cap chips; buttons lift 2px on hover; clear focus rings for keyboard play; pause card has an icon, a friendlier title and a reassurance line; result title sits on a green pill.

Verified: `npx vite build` passes; no console errors across all eight screens (contact sheet in the scratchpad).

## Content check

All 14 hadith texts, sources, explanations and quiz answers read as accurate paraphrases for children. No corrections needed. (The "Make things easy" hadith is in both Bukhari and Muslim; listing Bukhari alone is fine.)

## Game improvement ideas (not done)

1. **Combo streak** — consecutive catches without a miss build a multiplier shown on the HUD bar; rewards attention, not just reflexes. *M*
2. **Spilled-banana rescue** — after a bomb, the spilled bananas bounce on the ground for 2 s and can be re-caught; turns the harshest moment into a mini-chance. *M*
3. **Monkey helper companion** — a small monkey beside the basket that cheers, winces at bombs and sleeps on the pause screen; gives the game a face. *L*
4. ~~**Golden banana in play** — one rare golden banana per level that is worth 3 and makes the quiz question easier if caught; links the two halves of the game. *S*~~ **Done** in `7a25a02` — `makeGoldenBanana`, spawns once per real level, worth `GOLDEN_VALUE` (3), hides one wrong quiz answer.
5. ~~**Daily streak calendar on the hub** — a 7-day row of moons showing which days the Hadith quiz was done; motivates coming back for the daily hadith. *S*~~ **Done** in `7a25a02` — seven moons on the hub (`save.quizDays`), no streak counting or warnings.
6. **Level theme shifts** — every 5 levels change sky/time of day (sunset, night with stars) so progress is visible in the world, not only the badge. *M*
7. ~~**Hadith read-aloud** — Web Speech API button on the hadith card for pre-readers; the explanation is already short enough. *S*~~ **Done** in `7a25a02` — "Read to me" button (shown only when `speechSynthesis` exists) reads the hadith + explanation.
8. **Hand-drawn menu thumbnails** — render the basket skins and power models with the game's own Three.js models (as sadaqah-well does) instead of emoji, so menus match the art. *M*
