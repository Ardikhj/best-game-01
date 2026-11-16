// The screenshot scenes behind ?shot=title|play|boon|victory. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot (kite away from the nearest shadow,
// keep the lantern's aim on it, fire whenever it can, dash when crowded),
// so the frame is what a real game looks like and the same seed always
// gives the same frame. No wall clock runs in shot mode.
import { ARENA, STEP } from './config.js';
import { startWave, stepWorld, applyBoon, EVENT_OVER, EVENT_VICTORY } from './world.js';
import { SCREEN_BOON, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const TITLE_SECONDS = 6;
const PLAY_LIMIT = 110;
const STEP_LIMIT = 60 * 60 * 12; // 12 simulated minutes at most

// Pick the boon the autopilot wants most: damage first, then more bolts,
// then the new skills (nova, chain), then fire rate, then the rest.
const BOON_WANT = ['damage', 'multishot', 'nova', 'chain', 'rate', 'orbit', 'lifesteal', 'aegis', 'vitality', 'pierce', 'speed', 'light', 'dash'];

function nearestEnemy(world) {
  const p = world.player;
  let best = null;
  let bestDist = Infinity;
  world.enemies.forEach((enemy) => {
    const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (d < bestDist) { bestDist = d; best = enemy; }
  });
  return { enemy: best, dist: bestDist };
}

// Steer: run from the nearest shadow when it is close, drift back toward
// the centre otherwise; always aim at the nearest shadow and keep firing.
function autopilot(world) {
  const p = world.player;
  const { enemy, dist } = nearestEnemy(world);
  let moveX = 0;
  let moveY = 0;
  let aimX = p.x;
  let aimY = p.y - 1;
  if (enemy) {
    aimX = enemy.x;
    aimY = enemy.y;
    if (dist < 150) {
      moveX = (p.x - enemy.x) / dist;
      moveY = (p.y - enemy.y) / dist;
    } else if (dist > 320) {
      moveX = (enemy.x - p.x) / dist;
      moveY = (enemy.y - p.y) / dist;
    } else {
      // Circle-strafe at mid range, drifting toward the centre.
      moveX = -(enemy.y - p.y) / dist * 0.7 + (ARENA.width / 2 - p.x) / 900;
      moveY = (enemy.x - p.x) / dist * 0.7 + (ARENA.height / 2 - p.y) / 900;
    }
    const len = Math.hypot(moveX, moveY);
    if (len > 1) { moveX /= len; moveY /= len; }
  }
  const crowded = world.enemies.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 90);
  const closeCount = world.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 170).length;
  return {
    moveX, moveY, aimX, aimY,
    firing: true,
    dash: crowded && p.dashCooldown <= 0,
    nova: p.nova && p.novaTimer <= 0 && closeCount >= 3,
    dt: STEP,
  };
}

function chooseBoonAuto(world) {
  for (let i = 0; i < BOON_WANT.length; i += 1) {
    const index = world.boonChoices.findIndex((b) => b.id === BOON_WANT[i]);
    if (index !== -1) { applyBoon(world, world.boonChoices[index].id); return; }
  }
  if (world.boonChoices.length > 0) applyBoon(world, world.boonChoices[0].id);
}

function idleControls(world) {
  return { moveX: 0, moveY: 0, aimX: world.player.x, aimY: world.player.y - 1, firing: false, dash: false, dt: STEP };
}

/**
 * Set `world` to the named scene and return the screen to draw over it
 * and the best score to show. Unknown names fall back to the title.
 */
export function stageShot(name, world) {
  if (name === 'title') {
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) stepWorld(world, idleControls(world));
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'play') {
    // Play until the arena is at its busiest (at least 6 shadows alive),
    // so the frame shows a real fight — or the time cap, whichever first.
    startWave(world, 0);
    for (let i = 0; i < PLAY_LIMIT / STEP; i += 1) {
      const events = stepWorld(world, autopilot(world));
      if (events & EVENT_OVER) break;
      if (world.waveState === 'boon') { chooseBoonAuto(world); startWave(world, world.wave); }
      if (world.enemies.length >= 6) break;
    }
    return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
  }

  if (name === 'boon') {
    startWave(world, 0);
    for (let i = 0; i < STEP_LIMIT; i += 1) {
      const events = stepWorld(world, autopilot(world));
      if (events & EVENT_OVER) break;
      if (world.waveState === 'boon') return { screen: SCREEN_BOON, best: world.score };
    }
    return { screen: SCREEN_PLAY, best: world.score };
  }

  if (name === 'victory') {
    startWave(world, 0);
    for (let i = 0; i < STEP_LIMIT; i += 1) {
      const events = stepWorld(world, autopilot(world));
      if (events & EVENT_VICTORY) return { screen: SCREEN_VICTORY, best: world.score };
      if (events & EVENT_OVER) break;
      if (world.waveState === 'boon') { chooseBoonAuto(world); startWave(world, world.wave); }
    }
    return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
  }

  for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) stepWorld(world, idleControls(world));
  return { screen: SCREEN_TITLE, best: 0 };
}
