// Keyboard and pointer input. Held keys steer the thief; one-shot presses (start,
// pause, smoke, EMP) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. A mouse click is a coin
// lure aimed at that point on the floor.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SMOKE = 4;
export const ACTION_EMP = 8;
export const ACTION_LURE_KEY = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const SMOKE = new Set(['KeyQ']);
const EMP = new Set(['KeyE']);
const LURE = new Set(['KeyF']);

export function createInput(canvas) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let sprint = false;
  let actions = 0;
  let lurePoint = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (SPRINT.has(event.code)) sprint = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (SMOKE.has(event.code)) { if (!event.repeat) actions |= ACTION_SMOKE; }
    else if (EMP.has(event.code)) { if (!event.repeat) actions |= ACTION_EMP; }
    else if (LURE.has(event.code)) { if (!event.repeat) actions |= ACTION_LURE_KEY; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (SPRINT.has(event.code)) sprint = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    up = down = left = right = sprint = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    lurePoint = {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
    actions |= ACTION_CONFIRM;
  });

  return {
    /** Normalised steering vector from the held keys. */
    steer() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    sprinting() { return sprint; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last click point (in canvas pixels), or null; consumed once. */
    takeLurePoint() {
      const point = lurePoint;
      lurePoint = null;
      return point;
    },
  };
}
