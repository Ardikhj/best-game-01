// Emberwarden's world: the player, the shadow horde, the bolts of light,
// the waves and the boons between them. Pure simulation — it knows nothing
// about the canvas or the keyboard; the loop hands it a control packet
// each step and reads back the state to draw.
import { ARENA, BOONS, ENEMY, PLAYER, SKILLS, SPITTER, STEP, WAVES } from './config.js';
import { makeRng, pick, range, shuffle } from './random.js';

// Bit flags a step can report to the loop (for sounds and screen changes).
export const EVENT_NONE = 0;
export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_KILL = 4;
export const EVENT_HURT = 8;
export const EVENT_WAVE_CLEAR = 16;
export const EVENT_BOON_READY = 32;
export const EVENT_OVER = 64;
export const EVENT_VICTORY = 128;
export const EVENT_DASH = 256;
export const EVENT_NOVA = 512;
export const EVENT_CHAIN = 1024;
export const EVENT_AEGIS = 2048;

const KIND_ORDER = ['wisp', 'spitter', 'brute', 'splitter'];

export function createWorld(seed) {
  const rng = makeRng(seed);
  const world = {
    rng,
    seed,
    time: 0,
    player: freshPlayer(),
    enemies: [],
    bolts: [],
    shots: [],
    particles: [],
    floaters: [],
    arcs: [],
    rings: [],
    wave: 0,
    score: 0,
    kills: 0,
    best: 0,
    spawnQueue: [],
    spawnTimer: 0,
    waveState: 'idle', // idle | fighting | boon | done
    boonChoices: [],
    banner: '',
    bannerTimer: 0,
    shake: 0,
    over: false,
    victory: false,
  };
  return world;
}

function freshPlayer() {
  return {
    x: ARENA.width / 2,
    y: ARENA.height / 2,
    radius: PLAYER.radius,
    angle: -Math.PI / 2,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    speed: PLAYER.speed,
    damage: PLAYER.boltDamage,
    fireInterval: PLAYER.fireInterval,
    multishot: 1,
    pierce: 0,
    lightRadius: PLAYER.lightRadius,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 0,
    invuln: 0,
    // Skills granted by boons (see SKILLS in config.js).
    nova: false,                 // Ember Nova unlocked
    novaDamage: SKILLS.novaDamage,
    novaTimer: 0,                // cooldown left on the nova blast
    chain: 0,                    // Storm Lantern: arcs per bolt hit
    lifesteal: 0,                // Ember Feast: HP per kill
    aegisMax: 0,                 // Warden's Aegis: hits blocked per wave
    aegis: 0,                    // charges left this wave
    orbit: 0,                    // Ember Orbit: blades circling the player
    orbitAngle: 0,
    boons: [],
  };
}

export function resetWorld(world, seed) {
  const fresh = createWorld(seed);
  Object.keys(fresh).forEach((key) => { world[key] = fresh[key]; });
}

// --- Waves ---------------------------------------------------------------

function buildSpawnQueue(world, waveIndex) {
  const def = WAVES[waveIndex];
  const queue = [];
  KIND_ORDER.forEach((kind) => {
    for (let i = 0; i < def[kind]; i += 1) queue.push(kind);
  });
  return shuffle(world.rng, queue);
}

export function startWave(world, waveIndex) {
  world.wave = waveIndex + 1;
  world.spawnQueue = buildSpawnQueue(world, waveIndex);
  world.spawnTimer = 0.6;
  world.waveState = 'fighting';
  world.banner = `Wave ${world.wave}`;
  world.bannerTimer = 2.0;
  // The Aegis renews itself at the dawn of every wave.
  world.player.aegis = world.player.aegisMax;
}

function spawnEdgePoint(world) {
  const side = Math.floor(world.rng() * 4);
  const m = ARENA.margin + 12;
  if (side === 0) return { x: range(world.rng, m, ARENA.width - m), y: m };
  if (side === 1) return { x: range(world.rng, m, ARENA.width - m), y: ARENA.height - m };
  if (side === 2) return { x: m, y: range(world.rng, m, ARENA.height - m) };
  return { x: ARENA.width - m, y: range(world.rng, m, ARENA.height - m) };
}

function spawnEnemy(world, kind) {
  const def = WAVES[world.wave - 1];
  const base = ENEMY[kind];
  const at = spawnEdgePoint(world);
  const enemy = {
    kind,
    x: at.x,
    y: at.y,
    radius: base.radius,
    hp: Math.round(base.hp * def.hpMul),
    maxHp: Math.round(base.hp * def.hpMul),
    speed: base.speed * def.speedMul * range(world.rng, 0.9, 1.1),
    damage: base.damage,
    score: base.score,
    touchTimer: 0,
    shotTimer: range(world.rng, 1.0, 2.0),
    wobble: range(world.rng, 0, Math.PI * 2),
    flash: 0,
    orbitHit: 0,
  };
  world.enemies.push(enemy);
}

// --- Boons ---------------------------------------------------------------

export function rollBoons(world) {
  world.boonChoices = shuffle(world.rng, BOONS).slice(0, 3);
}

export function applyBoon(world, boonId) {
  const p = world.player;
  p.boons.push(boonId);
  if (boonId === 'damage') p.damage *= 1.3;
  else if (boonId === 'rate') p.fireInterval *= 0.8;
  else if (boonId === 'speed') p.speed *= 1.15;
  else if (boonId === 'vitality') { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 40); }
  else if (boonId === 'multishot') p.multishot += 1;
  else if (boonId === 'pierce') p.pierce += 1;
  else if (boonId === 'dash') world.dashMul = (world.dashMul ?? 1) * 0.6;
  else if (boonId === 'light') p.lightRadius *= 1.35;
  else if (boonId === 'nova') {
    // First pick unlocks the blast; later picks make it hit harder.
    if (p.nova) p.novaDamage += 20;
    p.nova = true;
  }
  else if (boonId === 'chain') p.chain += 1;
  else if (boonId === 'lifesteal') p.lifesteal += SKILLS.lifestealPerKill;
  else if (boonId === 'aegis') { p.aegisMax += 1; p.aegis += 1; }
  else if (boonId === 'orbit') p.orbit += 1;
}

// --- Combat helpers ------------------------------------------------------

function burst(world, x, y, colour, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = range(world.rng, 0, Math.PI * 2);
    const v = range(world.rng, speed * 0.3, speed);
    world.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: range(world.rng, 0.25, 0.6), maxLife: 0.6,
      size: range(world.rng, 2, 5), colour,
    });
  }
}

function floater(world, x, y, text, colour) {
  world.floaters.push({ x, y, text, colour, life: 0.9 });
}

function killEnemy(world, index, events) {
  const enemy = world.enemies[index];
  const colour = enemy.kind === 'spitter' ? '#3fd2c0' : enemy.kind === 'brute' ? '#8a5cf6' : '#b06ef5';
  burst(world, enemy.x, enemy.y, colour, enemy.kind === 'brute' ? 26 : 14, 190);
  floater(world, enemy.x, enemy.y - enemy.radius, `+${enemy.score}`, '#ffd97a');
  world.score += enemy.score;
  world.kills += 1;
  // Ember Feast: a little of the dark comes back as life.
  if (world.player.lifesteal > 0 && world.player.hp < world.player.maxHp) {
    world.player.hp = Math.min(world.player.maxHp, world.player.hp + world.player.lifesteal);
    floater(world, world.player.x, world.player.y - 24, `+${world.player.lifesteal}`, '#7dff9a');
  }
  if (enemy.kind === 'splitter') {
    for (let i = 0; i < 2; i += 1) {
      const a = range(world.rng, 0, Math.PI * 2);
      world.enemies.push({
        kind: 'mote',
        x: enemy.x + Math.cos(a) * 14, y: enemy.y + Math.sin(a) * 14,
        radius: ENEMY.mote.radius, hp: ENEMY.mote.hp, maxHp: ENEMY.mote.hp,
        speed: ENEMY.mote.speed, damage: ENEMY.mote.damage, score: ENEMY.mote.score,
        touchTimer: 0, shotTimer: 0, wobble: range(world.rng, 0, Math.PI * 2), flash: 0,
        orbitHit: 0,
      });
    }
  }
  world.enemies.splice(index, 1);
  return events | EVENT_KILL;
}

function hurtPlayer(world, amount, events) {
  const p = world.player;
  if (p.invuln > 0 || world.over) return events;
  // The Aegis takes the hit instead of the keeper.
  if (p.aegis > 0) {
    p.aegis -= 1;
    p.invuln = 0.6;
    burst(world, p.x, p.y, '#ffe08a', 16, 200);
    floater(world, p.x, p.y - 24, 'Aegis!', '#ffe08a');
    return events | EVENT_AEGIS;
  }
  p.hp -= amount;
  p.invuln = PLAYER.hurtGrace;
  world.shake = Math.min(16, world.shake + 9);
  burst(world, p.x, p.y, '#ff5d5d', 12, 160);
  floater(world, p.x, p.y - 24, `-${amount}`, '#ff5d5d');
  events |= EVENT_HURT;
  if (p.hp <= 0) {
    p.hp = 0;
    world.over = true;
    world.waveState = 'done';
    burst(world, p.x, p.y, '#ffb347', 40, 260);
    events |= EVENT_OVER;
  }
  return events;
}

// The Ember Nova: a ring of fire that hurts everything close and shoves
// the horde back. Costs its cooldown; the blast itself is the reward.
function novaBlast(world, events) {
  const p = world.player;
  p.novaTimer = SKILLS.novaCooldown;
  world.rings.push({ x: p.x, y: p.y, r: 20, maxR: SKILLS.novaRadius, life: 0.35, maxLife: 0.35 });
  burst(world, p.x, p.y, '#ffb347', 30, 320);
  world.shake = Math.min(18, world.shake + 8);
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = world.enemies[i];
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < SKILLS.novaRadius + enemy.radius) {
      enemy.hp -= p.novaDamage;
      enemy.flash = 0.15;
      enemy.x += (dx / dist) * 60;
      enemy.y += (dy / dist) * 60;
      if (enemy.hp <= 0) events = killEnemy(world, i, events);
    }
  }
  return events | EVENT_NOVA;
}

// --- The step ------------------------------------------------------------

// controls: { moveX, moveY, aimX, aimY, firing, dash, dt } — dt is STEP in
// normal play; the screenshot scenes pass their own fixed dt too.
export function stepWorld(world, controls) {
  const dt = controls.dt ?? STEP;
  let events = EVENT_NONE;
  const p = world.player;
  world.time += dt;
  if (world.bannerTimer > 0) world.bannerTimer -= dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 40);

  if (world.over || world.victory || world.waveState === 'boon') {
    updateFx(world, dt);
    return events;
  }

  // --- Spawning ---
  if (world.waveState === 'fighting' && world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      spawnEnemy(world, world.spawnQueue.shift());
      world.spawnTimer = WAVES[world.wave - 1].spawnGap;
    }
  }

  // --- Player movement and dash ---
  const dashMul = world.dashMul ?? 1;
  if (p.dashCooldown > 0) p.dashCooldown -= dt;
  if (p.novaTimer > 0) p.novaTimer -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.fireTimer > 0) p.fireTimer -= dt;
  if (p.orbit > 0) p.orbitAngle += SKILLS.orbitSpeed * dt;
  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.x += p.dashX * PLAYER.dashSpeed * dt;
    p.y += p.dashY * PLAYER.dashSpeed * dt;
  } else {
    p.x += controls.moveX * p.speed * dt;
    p.y += controls.moveY * p.speed * dt;
    if (controls.dash && p.dashCooldown <= 0 && (controls.moveX !== 0 || controls.moveY !== 0)) {
      const len = Math.hypot(controls.moveX, controls.moveY) || 1;
      p.dashX = controls.moveX / len;
      p.dashY = controls.moveY / len;
      p.dashTimer = PLAYER.dashTime;
      p.dashCooldown = PLAYER.dashCooldown * dashMul;
      p.invuln = Math.max(p.invuln, PLAYER.dashTime + 0.05);
      events |= EVENT_DASH;
    }
  }
  p.x = Math.min(ARENA.width - ARENA.margin, Math.max(ARENA.margin, p.x));
  p.y = Math.min(ARENA.height - ARENA.margin, Math.max(ARENA.margin, p.y));
  p.angle = Math.atan2(controls.aimY - p.y, controls.aimX - p.x);

  // --- Firing ---
  if (controls.firing && p.fireTimer <= 0) {
    p.fireTimer = p.fireInterval;
    const spread = 0.14;
    const count = p.multishot;
    for (let i = 0; i < count; i += 1) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      const a = p.angle + offset;
      world.bolts.push({
        x: p.x + Math.cos(a) * (p.radius + 6),
        y: p.y + Math.sin(a) * (p.radius + 6),
        vx: Math.cos(a) * PLAYER.boltSpeed,
        vy: Math.sin(a) * PLAYER.boltSpeed,
        travelled: 0,
        pierceLeft: p.pierce,
        hitSet: new Set(),
      });
    }
    events |= EVENT_SHOOT;
  }

  // --- Ember Nova ---
  if (controls.nova && p.nova && p.novaTimer <= 0) {
    events = novaBlast(world, events);
  }

  // --- Bolts ---
  for (let i = world.bolts.length - 1; i >= 0; i -= 1) {
    const bolt = world.bolts[i];
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    bolt.travelled += PLAYER.boltSpeed * dt;
    let dead = bolt.travelled > PLAYER.boltRange
      || bolt.x < 0 || bolt.x > ARENA.width || bolt.y < 0 || bolt.y > ARENA.height;
    if (!dead) {
      for (let j = world.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = world.enemies[j];
        if (bolt.hitSet.has(enemy)) continue;
        const dx = enemy.x - bolt.x;
        const dy = enemy.y - bolt.y;
        const rr = enemy.radius + PLAYER.boltRadius;
        if (dx * dx + dy * dy < rr * rr) {
          enemy.hp -= p.damage;
          enemy.flash = 0.12;
          floater(world, enemy.x, enemy.y - enemy.radius - 6, `${Math.round(p.damage)}`, '#ffe08a');
          burst(world, bolt.x, bolt.y, '#ffd97a', 5, 120);
          events |= EVENT_HIT;
          bolt.hitSet.add(enemy);
          if (enemy.hp <= 0) {
            events = killEnemy(world, j, events);
          }
          // Storm Lantern: the bolt's light jumps to nearby foes.
          if (p.chain > 0) {
            const targets = world.enemies
              .filter((other) => other !== enemy
                && Math.hypot(other.x - enemy.x, other.y - enemy.y) < SKILLS.chainRadius)
              .sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y)
                - Math.hypot(b.x - enemy.x, b.y - enemy.y))
              .slice(0, p.chain);
            targets.forEach((target) => {
              const chainDamage = Math.round(p.damage * SKILLS.chainDamageMul);
              target.hp -= chainDamage;
              target.flash = 0.12;
              world.arcs.push({ x1: enemy.x, y1: enemy.y, x2: target.x, y2: target.y, life: 0.18, maxLife: 0.18 });
              burst(world, target.x, target.y, '#bfefff', 4, 110);
              events |= EVENT_CHAIN;
              if (target.hp <= 0) {
                const idx = world.enemies.indexOf(target);
                if (idx !== -1) events = killEnemy(world, idx, events);
              }
            });
          }
          if (bolt.pierceLeft > 0) {
            bolt.pierceLeft -= 1;
          } else {
            dead = true;
          }
          break;
        }
      }
    }
    if (dead) world.bolts.splice(i, 1);
  }

  // --- Enemies ---
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = world.enemies[i];
    if (enemy.flash > 0) enemy.flash -= dt;
    if (enemy.touchTimer > 0) enemy.touchTimer -= dt;
    if (enemy.orbitHit > 0) enemy.orbitHit -= dt;
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    enemy.wobble += dt * 3;
    const wob = Math.sin(enemy.wobble) * 0.35;
    const px = nx * Math.cos(wob) - ny * Math.sin(wob);
    const py = nx * Math.sin(wob) + ny * Math.cos(wob);

    if (enemy.kind === 'spitter') {
      // Hold a firing range: approach when far, retreat when close.
      if (dist > SPITTER.wantMax) { enemy.x += px * enemy.speed * dt; enemy.y += py * enemy.speed * dt; }
      else if (dist < SPITTER.wantMin) { enemy.x -= px * enemy.speed * 0.7 * dt; enemy.y -= py * enemy.speed * 0.7 * dt; }
      else { enemy.x += -py * enemy.speed * 0.4 * dt; enemy.y += px * enemy.speed * 0.4 * dt; }
      enemy.shotTimer -= dt;
      if (enemy.shotTimer <= 0 && dist < 560) {
        enemy.shotTimer = SPITTER.shotInterval * range(world.rng, 0.85, 1.15);
        world.shots.push({
          x: enemy.x, y: enemy.y,
          vx: nx * SPITTER.shotSpeed, vy: ny * SPITTER.shotSpeed,
          life: 3,
        });
      }
    } else {
      enemy.x += px * enemy.speed * dt;
      enemy.y += py * enemy.speed * dt;
    }
    enemy.x = Math.min(ARENA.width - 8, Math.max(8, enemy.x));
    enemy.y = Math.min(ARENA.height - 8, Math.max(8, enemy.y));

    // Touch damage, throttled per enemy.
    const rr = enemy.radius + PLAYER.radius - 2;
    if (dist < rr && enemy.touchTimer <= 0) {
      enemy.touchTimer = ENEMY[enemy.kind].touch;
      events = hurtPlayer(world, enemy.damage, events);
    }

    // Orbiting blades cut anything they touch, throttled per enemy.
    if (p.orbit > 0 && enemy.orbitHit <= 0 && !world.over) {
      for (let b = 0; b < p.orbit; b += 1) {
        const ba = p.orbitAngle + (b / p.orbit) * Math.PI * 2;
        const bx = p.x + Math.cos(ba) * SKILLS.orbitRadius;
        const by = p.y + Math.sin(ba) * SKILLS.orbitRadius;
        const odx = enemy.x - bx;
        const ody = enemy.y - by;
        const orr = enemy.radius + 12;
        if (odx * odx + ody * ody < orr * orr) {
          enemy.hp -= SKILLS.orbitDamage;
          enemy.flash = 0.12;
          enemy.orbitHit = SKILLS.orbitHitCooldown;
          burst(world, bx, by, '#ffe08a', 4, 100);
          events |= EVENT_HIT;
          if (enemy.hp <= 0) events = killEnemy(world, i, events);
          break;
        }
      }
    }
  }

  // --- Enemy shots ---
  for (let i = world.shots.length - 1; i >= 0; i -= 1) {
    const shot = world.shots[i];
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    const dx = p.x - shot.x;
    const dy = p.y - shot.y;
    const rr = PLAYER.radius + SPITTER.shotRadius;
    if (dx * dx + dy * dy < rr * rr) {
      events = hurtPlayer(world, SPITTER.shotDamage, events);
      world.shots.splice(i, 1);
      continue;
    }
    if (shot.life <= 0 || shot.x < 0 || shot.x > ARENA.width || shot.y < 0 || shot.y > ARENA.height) {
      world.shots.splice(i, 1);
    }
  }

  updateFx(world, dt);

  // --- Wave clear ---
  if (world.waveState === 'fighting' && world.spawnQueue.length === 0 && world.enemies.length === 0) {
    const bonus = 100 * world.wave;
    world.score += bonus;
    events |= EVENT_WAVE_CLEAR;
    if (world.wave >= WAVES.length) {
      world.victory = true;
      world.waveState = 'done';
      events |= EVENT_VICTORY;
    } else {
      world.waveState = 'boon';
      rollBoons(world);
      events |= EVENT_BOON_READY;
    }
  }
  return events;
}

function updateFx(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const pt = world.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.floaters.length - 1; i >= 0; i -= 1) {
    const fl = world.floaters[i];
    fl.y -= 42 * dt;
    fl.life -= dt;
    if (fl.life <= 0) world.floaters.splice(i, 1);
  }
  for (let i = world.arcs.length - 1; i >= 0; i -= 1) {
    world.arcs[i].life -= dt;
    if (world.arcs[i].life <= 0) world.arcs.splice(i, 1);
  }
  for (let i = world.rings.length - 1; i >= 0; i -= 1) {
    const ring = world.rings[i];
    ring.life -= dt;
    ring.r = ring.maxR * (1 - ring.life / ring.maxLife);
    if (ring.life <= 0) world.rings.splice(i, 1);
  }
}
