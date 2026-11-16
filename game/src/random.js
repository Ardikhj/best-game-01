// Seeded random numbers (mulberry32) — one tiny generator the whole game
// shares, so a screenshot scene or a replayed run is exactly repeatable
// from its seed. Nothing else in the game rolls dice.
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Roll a number in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Pick one entry from an array.
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

// A fresh shuffled copy of an array (Fisher–Yates).
export function shuffle(rng, items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
