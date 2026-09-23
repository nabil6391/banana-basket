# 🍌 Banana Basket

A kid-friendly Three.js web game: read the **Hadith of the Day**, then catch falling bananas in your basket.

```bash
npm install
npm run dev      # play at http://localhost:5173
npm run build    # static build in dist/ (deploy anywhere)
```

## How to play
- Move the basket: **← / →**, **A / D**, mouse, or drag with a finger.
- Powers: **1** Bomb Shield · **2** Banana Magnet · **3** Speed Basket · **4** Extra Bananas (or tap the buttons).
- **P** / **Esc** pauses.

## Game design
| Piece | Where |
|---|---|
| Level targets, speed, boss tuning (`levelConfig`) | `src/game.js` |
| Hadith list, explanations, quiz questions | `src/hadith.js` (first option is the correct answer) |
| Power-up prices, basket skin prices | `src/main.js` (`POWERS`, `SKIN_PRICES`) |
| Cartoon 3D models (banana, bomb, basket, storm cloud, palms) | `src/models.js` |
| Synthesized sound effects | `src/audio.js` |
| Save data (localStorage `bananaBasket.v1`) | `src/save.js` |

- Levels 1–4: targets 10 / 15 / 20 / 25, 90 seconds each; items fall faster every level.
- Every 5th level is a **Boss Level** (40 seconds): a grumpy Storm Cloud drops bombs. Catching a bomb spills every banana in the basket (unless a Bomb Shield is on).
- Reaching the target ends the level early; the share of the clock left over becomes a speed bonus (up to +10).
- Bananas caught are always kept as currency (even on a failed try).
- After each cleared level comes the **Hadith Challenge**: the first correct answer each day earns a **Golden Banana 🍌⭐**; later ones give +5 bananas. Golden Bananas unlock the Golden Basket.
- The Hadith rotates daily (by local date).
