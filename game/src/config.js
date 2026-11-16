// Emberwarden — tuning constants. One place for every number the game
// balances on, so a play-tester can retune the feel without touching logic.
export const VIEW = { width: 1280, height: 720 };

export const ARENA = {
  // The playfield is the whole canvas; the lantern glow fades at the edges.
  width: 1280,
  height: 720,
  // A soft border the player cannot cross.
  margin: 26,
};

// Fixed simulation step (seconds) — the loop always steps in these slices,
// so a slow frame never changes how the game plays.
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 15,
  speed: 250,
  maxHp: 100,
  // How long the lantern's light reaches: bolts die past this range.
  boltRange: 430,
  boltSpeed: 640,
  boltRadius: 5,
  fireInterval: 0.34,
  boltDamage: 16,
  dashSpeed: 780,
  dashTime: 0.16,
  dashCooldown: 2.2,
  // Brief invulnerability after taking a hit, so one touch is not two.
  // Short enough that a crowd can still wear the lantern down.
  hurtGrace: 0.6,
  // The lantern's warm glow radius; boons can widen it.
  lightRadius: 210,
};

export const ENEMY = {
  wisp:   { radius: 13, hp: 22,  speed: 96,  damage: 10, score: 50,  touch: 0.55 },
  spitter:{ radius: 15, hp: 34,  speed: 62,  damage: 7,  score: 90,  touch: 0.6 },
  brute:  { radius: 26, hp: 150, speed: 42,  damage: 20, score: 200, touch: 0.8 },
  mote:   { radius: 8,  hp: 10,  speed: 160, damage: 5,  score: 25,  touch: 0.4 },
  // Splitter: a fat wisp that bursts into two motes when it dies.
  splitter:{ radius: 20, hp: 55, speed: 72,  damage: 11, score: 120, touch: 0.65 },
};

// Waves: how many of each kind, and how fast they trickle in.
// Early waves stay learnable; from wave 6 the horde grows denser, tougher
// and faster than the player's boons can keep up with, so the last waves
// are a real fight instead of a victory lap.
export const WAVES = [
  { wisp: 6,  spitter: 0, brute: 0, splitter: 0, spawnGap: 1.15, hpMul: 1.00, speedMul: 1.00 },
  { wisp: 9,  spitter: 2, brute: 0, splitter: 0, spawnGap: 1.05, hpMul: 1.08, speedMul: 1.04 },
  { wisp: 11, spitter: 3, brute: 1, splitter: 1, spawnGap: 0.98, hpMul: 1.18, speedMul: 1.08 },
  { wisp: 13, spitter: 4, brute: 1, splitter: 2, spawnGap: 0.92, hpMul: 1.30, speedMul: 1.13 },
  { wisp: 15, spitter: 5, brute: 2, splitter: 2, spawnGap: 0.86, hpMul: 1.45, speedMul: 1.18 },
  { wisp: 18, spitter: 8, brute: 3, splitter: 4, spawnGap: 0.76, hpMul: 1.55, speedMul: 1.22 },
  { wisp: 20, spitter: 10, brute: 4, splitter: 4, spawnGap: 0.70, hpMul: 1.62, speedMul: 1.25 },
  { wisp: 21, spitter: 10, brute: 5, splitter: 5, spawnGap: 0.64, hpMul: 1.90, speedMul: 1.33 },
  { wisp: 22, spitter: 12, brute: 6, splitter: 5, spawnGap: 0.58, hpMul: 2.08, speedMul: 1.39 },
  { wisp: 25, spitter: 13, brute: 7, splitter: 6, spawnGap: 0.52, hpMul: 2.30, speedMul: 1.45 },
];

export const SPITTER = {
  // Preferred range band: close in when too far, back off when too close.
  wantMin: 260,
  wantMax: 360,
  shotSpeed: 275,
  shotRadius: 6,
  shotDamage: 9,
  shotInterval: 2.3,
};

export const BOONS = [
  { id: 'damage',  name: 'Ember Rounds',   blurb: '+30% bolt damage',        desc: 'Your bolts burn hotter.' },
  { id: 'rate',    name: 'Rapid Wick',     blurb: '+25% fire rate',          desc: 'The lantern spits light faster.' },
  { id: 'speed',   name: 'Swift Boots',    blurb: '+15% move speed',         desc: 'Lighter steps through the dark.' },
  { id: 'vitality',name: 'Hearth Heart',   blurb: '+25 max HP and heal 40', desc: 'A warm meal by the fire.' },
  { id: 'multishot',name: 'Twin Flames',   blurb: '+1 bolt per shot',        desc: 'The lantern splits its flame.' },
  { id: 'pierce',  name: 'Piercing Light', blurb: 'Bolts pierce +1 enemy',   desc: 'Light that passes straight through.' },
  { id: 'dash',    name: 'Gale Step',      blurb: 'Dash recharges 40% faster', desc: 'Wind at your heels.' },
  { id: 'light',   name: 'Wide Lantern',   blurb: '+35% lantern light radius', desc: 'The dark keeps further back.' },
];

// Colours of the night: deep indigo field, ember gold player, violet/teal dark.
export const PALETTE = {
  night: '#0a0a1e',
  nightEdge: '#05050f',
  arena: '#10102a',
  ember: '#ffb347',
  emberHot: '#ffe08a',
  gold: '#f5a623',
  wisp: '#b06ef5',
  spitter: '#3fd2c0',
  brute: '#8a5cf6',
  splitter: '#e06ef5',
  mote: '#c98df7',
  bolt: '#ffd97a',
  text: '#f2ead8',
  dim: '#9a94b8',
  danger: '#ff5d5d',
  heal: '#7dff9a',
};
