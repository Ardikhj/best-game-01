// Keyboard and mouse input, kept in one small state object the world reads
// each step. Keys are tracked by their code so WASD and arrows both work.
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  dash: ['ShiftLeft', 'ShiftRight'],
  fire: ['Space'],
  pause: ['KeyP', 'Escape'],
  restart: ['KeyR'],
  mute: ['KeyM'],
};

export function createInput() {
  return {
    held: new Set(),
    // Edge-triggered presses, consumed once by the loop.
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
  };
}

export function attachInput(input, canvas) {
  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.code);
    input.held.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.held.clear();
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    input.mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.mouse.down = true;
      input.mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

export function isHeld(input, action) {
  return KEYS[action].some((code) => input.held.has(code));
}

export function wasPressed(input, action) {
  return KEYS[action].some((code) => input.pressed.has(code));
}

// Movement direction from the held keys, normalised to length 1.
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (isHeld(input, 'left')) x -= 1;
  if (isHeld(input, 'right')) x += 1;
  if (isHeld(input, 'up')) y -= 1;
  if (isHeld(input, 'down')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.sqrt(2);
    x *= inv;
    y *= inv;
  }
  return { x, y };
}

// Clear the edge-triggered presses at the end of each frame.
export function endFrame(input) {
  input.pressed.clear();
  input.mouse.clicked = false;
}
