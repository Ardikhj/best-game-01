// Emberwarden — boot and the game loop. A fixed-timestep simulation
// (60 steps a second, capped catch-up) wrapped in a small screen state
// machine: title → play → boon → pause → over / victory → restart.
import { ARENA, STEP } from './config.js';
import { createAudio, ensureAudio, setMuted, startPad, SFX } from './audio.js';
import { attachInput, createInput, endFrame, isHeld, moveVector, wasPressed } from './input.js';
import {
  SCREEN_BOON, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY,
  boonCardRects, drawWorld,
} from './render.js';
import { createWorld, resetWorld, startWave, stepWorld, applyBoon,
  EVENT_AEGIS, EVENT_CHAIN, EVENT_DASH, EVENT_HIT, EVENT_HURT, EVENT_KILL,
  EVENT_NOVA, EVENT_OVER, EVENT_SHOOT, EVENT_VICTORY, EVENT_WAVE_CLEAR } from './world.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'emberwarden-best-score';

function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Storage may be unavailable; the best score is a nicety, not a need.
  }
}

// The ?shot= scenes run the real rules from a fixed seed with no wall
// clock, then expose one frame. Everything else is the live game.
function bootShotMode(canvas, ctx, params) {
  const world = createWorld(Number(params.get('seed') || 1));
  const staged = stageShot(params.get('shot') || 'title', world);
  const screen = staged.screen;
  drawWorld(ctx, world, screen, staged.best);
  window.__shotReady = true;
}

function main() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(window.location.search);
  if (params.has('shot')) {
    bootShotMode(canvas, ctx, params);
    return;
  }

  const input = createInput();
  attachInput(input, canvas);
  const audio = createAudio();
  const world = createWorld((Date.now() % 2147483647) || 1);
  let best = readBest();
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let lastTime = performance.now();

  function controlsFromInput() {
    const move = moveVector(input);
    return {
      moveX: move.x,
      moveY: move.y,
      aimX: input.mouse.x || world.player.x,
      aimY: input.mouse.y || world.player.y - 1,
      firing: input.mouse.down || isHeld(input, 'fire'),
      dash: wasPressed(input, 'dash'),
      nova: wasPressed(input, 'nova'),
      dt: STEP,
    };
  }

  function playEvents(events) {
    if (events & EVENT_SHOOT) SFX.shoot(audio);
    if (events & EVENT_HIT) SFX.hit(audio);
    if (events & EVENT_KILL) SFX.kill(audio);
    if (events & EVENT_HURT) SFX.hurt(audio);
    if (events & EVENT_DASH) SFX.dash(audio);
    if (events & EVENT_NOVA) SFX.nova(audio);
    if (events & EVENT_CHAIN) SFX.chain(audio);
    if (events & EVENT_AEGIS) SFX.aegis(audio);
    if (events & EVENT_WAVE_CLEAR) SFX.waveClear(audio);
    if (events & EVENT_OVER) SFX.gameOver(audio);
    if (events & EVENT_VICTORY) SFX.victory(audio);
  }

  function startRun() {
    resetWorld(world, (Date.now() % 2147483647) || 1);
    ensureAudio(audio);
    startPad(audio);
    startWave(world, 0);
    SFX.waveStart(audio);
    screen = SCREEN_PLAY;
  }

  function chooseBoon(index) {
    const boon = world.boonChoices[index];
    if (!boon) return;
    applyBoon(world, boon.id);
    SFX.pickup(audio);
    startWave(world, world.wave);
    SFX.waveStart(audio);
    screen = SCREEN_PLAY;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(0.25, (now - lastTime) / 1000);
    lastTime = now;

    if (wasPressed(input, 'mute')) setMuted(audio, !audio.muted);

    if (screen === SCREEN_TITLE) {
      if (input.mouse.clicked || wasPressed(input, 'fire')) startRun();
      stepWorld(world, { moveX: 0, moveY: 0, aimX: world.player.x, aimY: world.player.y - 1, firing: false, dash: false, dt: STEP });
    } else if (screen === SCREEN_PLAY) {
      if (wasPressed(input, 'pause')) {
        screen = SCREEN_PAUSE;
      } else {
        accumulator += elapsed;
        let guard = 0;
        while (accumulator >= STEP && guard < 5) {
          const events = stepWorld(world, controlsFromInput());
          playEvents(events);
          accumulator -= STEP;
          guard += 1;
          if (world.over) {
            screen = SCREEN_OVER;
            if (world.score > best) { best = world.score; saveBest(best); }
            break;
          }
          if (world.victory) {
            screen = SCREEN_VICTORY;
            if (world.score > best) { best = world.score; saveBest(best); }
            break;
          }
          if (world.waveState === 'boon') {
            screen = SCREEN_BOON;
            break;
          }
        }
      }
    } else if (screen === SCREEN_BOON) {
      if (input.pressed.has('Digit1')) chooseBoon(0);
      if (input.pressed.has('Digit2')) chooseBoon(1);
      if (input.pressed.has('Digit3')) chooseBoon(2);
      if (input.mouse.clicked) {
        const rects = boonCardRects();
        rects.forEach((rect, i) => {
          if (input.mouse.x >= rect.x && input.mouse.x <= rect.x + rect.w
            && input.mouse.y >= rect.y && input.mouse.y <= rect.y + rect.h) chooseBoon(i);
        });
      }
      stepWorld(world, { moveX: 0, moveY: 0, aimX: world.player.x, aimY: world.player.y - 1, firing: false, dash: false, dt: STEP });
    } else if (screen === SCREEN_PAUSE) {
      if (wasPressed(input, 'pause')) screen = SCREEN_PLAY;
      if (wasPressed(input, 'restart')) startRun();
    } else if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      if (wasPressed(input, 'restart') || input.mouse.clicked) startRun();
    }

    drawWorld(ctx, world, screen, best);
    endFrame(input);
  }

  // A small read-only handle for automated play-testing (screenshots and
  // scripted runs read the live state through it; the game never uses it).
  window.__emberwarden = {
    get screen() { return screen; },
    get world() { return world; },
    get best() { return best; },
  };

  requestAnimationFrame(frame);
}

main();
