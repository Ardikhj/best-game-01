// Emberwarden's drawing: procedural vector art with glow — the lantern
// keeper, the shadow wisps, the bolts of light — plus the HUD and every
// screen (title, boon choice, pause, game over, victory). No images.
import { ARENA, PALETTE, PLAYER, SKILLS, WAVES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_BOON = 'boon';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const ENEMY_COLOUR = {
  wisp: PALETTE.wisp,
  spitter: PALETTE.spitter,
  brute: PALETTE.brute,
  splitter: PALETTE.splitter,
  mote: PALETTE.mote,
};

// Layout of the three boon cards, shared by draw and click hit-testing.
export function boonCardRects() {
  const w = 300;
  const h = 210;
  const gap = 28;
  const total = w * 3 + gap * 2;
  const x0 = (ARENA.width - total) / 2;
  const y = 268;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

export function drawWorld(ctx, world, screen, best) {
  ctx.save();
  if (world.shake > 0.5) {
    const wob = world.time * 47;
    ctx.translate(Math.sin(wob) * world.shake * 0.5, Math.cos(wob * 1.3) * world.shake * 0.5);
  }
  drawArena(ctx, world);
  drawShots(ctx, world);
  drawEnemies(ctx, world);
  drawBolts(ctx, world);
  drawArcs(ctx, world);
  drawRings(ctx, world);
  drawPlayer(ctx, world);
  drawParticles(ctx, world);
  drawFloaters(ctx, world);
  ctx.restore();

  drawLanternLight(ctx, world, screen);
  if (screen !== SCREEN_TITLE) drawHud(ctx, world, best);
  if (world.bannerTimer > 0 && screen === SCREEN_PLAY) drawBanner(ctx, world);
  if (screen === SCREEN_TITLE) drawTitle(ctx, world, best);
  if (screen === SCREEN_BOON) drawBoon(ctx, world);
  if (screen === SCREEN_PAUSE) drawPause(ctx);
  if (screen === SCREEN_OVER) drawEnd(ctx, world, best, false);
  if (screen === SCREEN_VICTORY) drawEnd(ctx, world, best, true);
}

function drawArena(ctx, world) {
  const g = ctx.createRadialGradient(
    ARENA.width / 2, ARENA.height / 2, 120,
    ARENA.width / 2, ARENA.height / 2, 760,
  );
  g.addColorStop(0, PALETTE.arena);
  g.addColorStop(1, PALETTE.nightEdge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);

  // Faint ember stars and drifting motes of dust in the dark.
  ctx.fillStyle = 'rgba(255, 179, 71, 0.25)';
  for (let i = 0; i < 40; i += 1) {
    const x = ((i * 173.3 + world.time * 6) % ARENA.width);
    const y = ((i * 97.7 + 40) % ARENA.height);
    ctx.globalAlpha = 0.12 + 0.1 * Math.sin(world.time + i);
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Arena border: a thin ember ring.
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(ARENA.margin - 8, ARENA.margin - 8, ARENA.width - 2 * (ARENA.margin - 8), ARENA.height - 2 * (ARENA.margin - 8));
}

function drawLanternLight(ctx, world, screen) {
  if (screen === SCREEN_TITLE) return;
  const p = world.player;
  const r = p.lightRadius * (1 + 0.04 * Math.sin(world.time * 3));
  const g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, r);
  g.addColorStop(0, 'rgba(255, 200, 90, 0.20)');
  g.addColorStop(0.6, 'rgba(255, 170, 60, 0.08)');
  g.addColorStop(1, 'rgba(255, 170, 60, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
}

function drawArcs(ctx, world) {
  if (world.arcs.length === 0) return;
  ctx.save();
  ctx.shadowColor = '#bfefff';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#dff6ff';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  world.arcs.forEach((arc) => {
    const alpha = Math.max(0, arc.life / arc.maxLife);
    ctx.globalAlpha = alpha;
    // A jagged bolt: two kinks off the straight line, flickering with time.
    const mx = (arc.x1 + arc.x2) / 2;
    const my = (arc.y1 + arc.y2) / 2;
    const dx = arc.x2 - arc.x1;
    const dy = arc.y2 - arc.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const k1 = Math.sin(world.time * 61 + arc.x1) * 10;
    const k2 = Math.sin(world.time * 47 + arc.y2) * 10;
    ctx.beginPath();
    ctx.moveTo(arc.x1, arc.y1);
    ctx.lineTo(arc.x1 + dx * 0.33 + nx * k1, arc.y1 + dy * 0.33 + ny * k1);
    ctx.lineTo(mx + nx * k2, my + ny * k2);
    ctx.lineTo(arc.x1 + dx * 0.66 - nx * k1, arc.y1 + dy * 0.66 - ny * k1);
    ctx.lineTo(arc.x2, arc.y2);
    ctx.stroke();
  });
  ctx.restore();
}

function drawRings(ctx, world) {
  if (world.rings.length === 0) return;
  ctx.save();
  world.rings.forEach((ring) => {
    const alpha = Math.max(0, ring.life / ring.maxLife);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = PALETTE.emberHot;
    ctx.lineWidth = 5;
    ctx.shadowColor = PALETTE.ember;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

function drawPlayer(ctx, world) {
  const p = world.player;
  if (world.over) return;
  // Orbiting blades circle the keeper.
  if (p.orbit > 0) {
    ctx.save();
    ctx.shadowColor = PALETTE.emberHot;
    ctx.shadowBlur = 16;
    ctx.fillStyle = PALETTE.emberHot;
    for (let i = 0; i < p.orbit; i += 1) {
      const a = p.orbitAngle + (i / p.orbit) * Math.PI * 2;
      const bx = p.x + Math.cos(a) * SKILLS.orbitRadius;
      const by = p.y + Math.sin(a) * SKILLS.orbitRadius;
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a4d12';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, 9.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  // Flicker while invulnerable after a hit.
  if (p.invuln > 0 && Math.floor(world.time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
  // Cloak: a warm ember circle with a dark hood.
  ctx.shadowColor = PALETTE.ember;
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#3a2a18';
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.ember;
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER.radius - 5, 0, Math.PI * 2);
  ctx.fill();
  // The lantern itself, held toward the aim.
  ctx.rotate(p.angle);
  ctx.fillStyle = PALETTE.emberHot;
  ctx.beginPath();
  ctx.arc(PLAYER.radius + 2, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a4d12';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(PLAYER.radius + 2, 0, 9.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Dash cooldown arc under the player.
  if (p.dashCooldown > 0) {
    ctx.strokeStyle = 'rgba(242, 234, 216, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius + 8, -Math.PI / 2, -Math.PI / 2 + (1 - p.dashCooldown / 2.2) * Math.PI * 2);
    ctx.stroke();
  }
}

function drawEnemies(ctx, world) {
  world.enemies.forEach((enemy) => {
    const colour = ENEMY_COLOUR[enemy.kind];
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.shadowColor = colour;
    ctx.shadowBlur = 18;
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : colour;
    if (enemy.kind === 'brute') {
      // A heavy hexagon with a dark core.
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const px = Math.cos(a) * enemy.radius;
        const py = Math.sin(a) * enemy.radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1c1030';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'spitter') {
      // A diamond that pulses as it charges a shot.
      const pulse = 1 + 0.15 * Math.sin(world.time * 5 + enemy.wobble);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.moveTo(0, -enemy.radius);
      ctx.lineTo(enemy.radius, 0);
      ctx.lineTo(0, enemy.radius);
      ctx.lineTo(-enemy.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#06231f';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Wisps, splitters and motes: ghostly circles with trailing tails.
      const tail = enemy.kind === 'splitter' ? 16 : 10;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(-Math.cos(enemy.wobble) * tail, -Math.sin(enemy.wobble) * tail, enemy.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
      ctx.beginPath();
      ctx.arc(-4, -2, 3, 0, Math.PI * 2);
      ctx.arc(4, -2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Health bar for anything hurt.
    if (enemy.hp < enemy.maxHp) {
      const w = enemy.radius * 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w, 4);
      ctx.fillStyle = colour;
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w * (enemy.hp / enemy.maxHp), 4);
    }
  });
}

function drawBolts(ctx, world) {
  ctx.save();
  ctx.shadowColor = PALETTE.bolt;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = PALETTE.bolt;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  world.bolts.forEach((bolt) => {
    ctx.beginPath();
    ctx.moveTo(bolt.x - bolt.vx * 0.02, bolt.y - bolt.vy * 0.02);
    ctx.lineTo(bolt.x, bolt.y);
    ctx.stroke();
  });
  ctx.restore();
}

function drawShots(ctx, world) {
  ctx.save();
  ctx.shadowColor = PALETTE.spitter;
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#9ff5e8';
  world.shots.forEach((shot) => {
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawParticles(ctx, world) {
  world.particles.forEach((pt) => {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.colour;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx, world) {
  ctx.save();
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  world.floaters.forEach((fl) => {
    ctx.globalAlpha = Math.max(0, fl.life / 0.9);
    ctx.fillStyle = fl.colour;
    ctx.fillText(fl.text, fl.x, fl.y);
  });
  ctx.restore();
}

// --- HUD -----------------------------------------------------------------

function drawHud(ctx, world, best) {
  const p = world.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // HP bar, top left.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(18, 16, 240, 26);
  ctx.fillStyle = p.hp / p.maxHp > 0.35 ? PALETTE.heal : PALETTE.danger;
  ctx.fillRect(20, 18, 236 * (p.hp / p.maxHp), 22);
  ctx.strokeStyle = 'rgba(242, 234, 216, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 16, 240, 26);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.ceil(p.hp)} / ${p.maxHp}`, 28, 34);

  // Wave, score and best, top centre/right.
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`Wave ${Math.max(1, world.wave)} / ${WAVES.length}`, ARENA.width / 2, 34);
  ctx.textAlign = 'right';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`Score ${world.score}`, ARENA.width - 20, 28);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText(`Best ${Math.max(best, world.score)}`, ARENA.width - 20, 50);

  // Boons owned, bottom left.
  ctx.textAlign = 'left';
  ctx.font = '13px sans-serif';
  ctx.fillStyle = PALETTE.dim;
  const names = p.boons.map((id) => {
    const b = { damage: 'Ember Rounds', rate: 'Rapid Wick', speed: 'Swift Boots', vitality: 'Hearth Heart', multishot: 'Twin Flames', pierce: 'Piercing Light', dash: 'Gale Step', light: 'Wide Lantern', nova: 'Ember Nova', chain: 'Storm Lantern', lifesteal: 'Ember Feast', aegis: "Warden's Aegis", orbit: 'Ember Orbit' }[id];
    return b || id;
  });
  // Keep the line clear of the dash indicator on the right.
  const shown = names.length > 6 ? names.slice(0, 6).concat([`+${names.length - 6} more`]) : names;
  if (shown.length > 0) ctx.fillText(`Boons: ${shown.join(' · ')}`, 18, ARENA.height - 16);

  // Aegis charges: small shields next to the HP bar.
  if (p.aegisMax > 0) {
    for (let i = 0; i < p.aegisMax; i += 1) {
      const sx = 272 + i * 20;
      const sy = 29;
      ctx.fillStyle = i < p.aegis ? PALETTE.emberHot : 'rgba(242, 234, 216, 0.25)';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 7);
      ctx.lineTo(sx + 6, sy);
      ctx.lineTo(sx, sy + 7);
      ctx.lineTo(sx - 6, sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Dash and nova readiness, bottom right.
  ctx.textAlign = 'right';
  ctx.fillStyle = p.dashCooldown <= 0 ? PALETTE.ember : PALETTE.dim;
  ctx.font = 'bold 14px sans-serif';
  const dashLine = p.dashCooldown <= 0 ? 'DASH READY  [Shift]' : 'Dash recharging…';
  if (p.nova) {
    ctx.fillText(dashLine, ARENA.width - 20, ARENA.height - 34);
    ctx.fillStyle = p.novaTimer <= 0 ? PALETTE.emberHot : PALETTE.dim;
    ctx.fillText(p.novaTimer <= 0 ? 'NOVA READY  [E]' : `Nova ${Math.ceil(p.novaTimer)}s`, ARENA.width - 20, ARENA.height - 16);
  } else {
    ctx.fillText(dashLine, ARENA.width - 20, ARENA.height - 16);
  }
  ctx.restore();
}

function drawBanner(ctx, world) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, world.bannerTimer);
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillStyle = PALETTE.ember;
  ctx.shadowColor = PALETTE.ember;
  ctx.shadowBlur = 26;
  ctx.fillText(world.banner, ARENA.width / 2, 150);
  ctx.restore();
}

// --- Screens -------------------------------------------------------------

function dim(ctx) {
  ctx.fillStyle = 'rgba(5, 5, 15, 0.72)';
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
}

function titleText(ctx, text, y, size, colour) {
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = colour;
  ctx.fillText(text, ARENA.width / 2, y);
}

function drawTitle(ctx, world, best) {
  dim(ctx);
  ctx.save();
  ctx.shadowColor = PALETTE.ember;
  ctx.shadowBlur = 30;
  titleText(ctx, 'EMBERWARDEN', 190, 64, PALETTE.emberHot);
  ctx.restore();
  titleText(ctx, 'Hold the Last Lantern', 232, 26, PALETTE.ember);
  titleText(ctx, 'The dark is closing in. Your lantern is your weapon — and your life.', 300, 19, PALETTE.text);
  titleText(ctx, 'Survive all 10 waves. Between waves, choose a boon.', 330, 19, PALETTE.text);
  titleText(ctx, 'WASD / Arrows — move      Mouse — aim      Click / Space — fire bolt', 400, 18, PALETTE.dim);
  titleText(ctx, 'Shift — dash      E — nova blast (after the Ember Nova boon)      P — pause      M — mute', 428, 18, PALETTE.dim);
  if (best > 0) titleText(ctx, `Best score: ${best}`, 478, 18, PALETTE.gold);
  ctx.save();
  const pulse = 0.7 + 0.3 * Math.sin(world.time * 2.8);
  ctx.globalAlpha = pulse;
  titleText(ctx, 'Click or press Space to begin', 560, 24, PALETTE.emberHot);
  ctx.restore();
}

function drawBoon(ctx, world) {
  dim(ctx);
  titleText(ctx, `Wave ${world.wave} cleared!`, 150, 40, PALETTE.emberHot);
  titleText(ctx, 'Choose a boon — click a card or press 1, 2, 3', 196, 20, PALETTE.text);
  const rects = boonCardRects();
  world.boonChoices.forEach((boon, i) => {
    const r = rects[i];
    ctx.save();
    ctx.fillStyle = '#1b1b3d';
    ctx.strokeStyle = PALETTE.ember;
    ctx.lineWidth = 2;
    ctx.shadowColor = PALETTE.ember;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.emberHot;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(boon.name, r.x + r.w / 2, r.y + 52);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(boon.blurb, r.x + r.w / 2, r.y + 96);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '16px sans-serif';
    ctx.fillText(boon.desc, r.x + r.w / 2, r.y + 128);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, r.x + r.w / 2, r.y + 172);
    ctx.restore();
  });
}

function drawPause(ctx) {
  dim(ctx);
  titleText(ctx, 'PAUSED', 300, 48, PALETTE.emberHot);
  titleText(ctx, 'Press P or Esc to resume', 350, 20, PALETTE.text);
  titleText(ctx, 'R — restart the run', 382, 18, PALETTE.dim);
}

function drawEnd(ctx, world, best, isVictory) {
  dim(ctx);
  ctx.save();
  ctx.shadowColor = isVictory ? PALETTE.ember : PALETTE.danger;
  ctx.shadowBlur = 28;
  titleText(ctx, isVictory ? 'THE DAWN RETURNS' : 'THE LIGHT GOES OUT', 210, 52, isVictory ? PALETTE.emberHot : PALETTE.danger);
  ctx.restore();
  titleText(
    ctx,
    isVictory
      ? 'Ten waves held. The lantern still burns — and so do you.'
      : 'The shadows take the lantern… this time.',
    262, 21, PALETTE.text,
  );
  titleText(ctx, `Score  ${world.score}`, 330, 24, PALETTE.gold);
  titleText(ctx, `Wave reached  ${world.wave} / ${WAVES.length}      Shadows banished  ${world.kills}`, 366, 19, PALETTE.text);
  titleText(ctx, `Best score  ${Math.max(best, world.score)}`, 398, 19, PALETTE.dim);
  titleText(ctx, 'Press R or click to play again', 470, 20, PALETTE.ember);
}
