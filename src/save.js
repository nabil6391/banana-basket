const KEY = 'bananaBasket.v1';

const DEFAULTS = {
  level: 1,
  bananas: 0,        // banana currency (wallet)
  golden: 0,         // golden bananas from Hadith challenges
  goldenDay: -1,     // day number the golden banana was last earned
  powers: { shield: 1, magnet: 1, speed: 1, extra: 0 }, // welcome gift
  skins: ['classic'],
  skin: 'classic',
  muted: false,
  best: 1,
};

export function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) return structuredClone(DEFAULTS);
    return { ...structuredClone(DEFAULTS), ...raw, powers: { ...DEFAULTS.powers, ...raw.powers } };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function writeSave(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return structuredClone(DEFAULTS);
}
