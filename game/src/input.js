// Keyboard + mouse input for the 3D game. Held keys give a movement vector;
// one-shot presses (enter car, shoot, pause, radio, interact) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost
// and never counted twice. The chase camera orbits with right-mouse drag and
// zooms with the wheel; the crosshair sits at screen centre and the player aims
// at whatever the camera looks at on the ground.
export const ACT_ENTER = 1;
export const ACT_PAUSE = 2;
export const ACT_CONFIRM = 4;
export const ACT_RELOAD = 8;
export const ACT_RADIO = 16;
export const ACT_INTERACT = 32;
export const ACT_WEAPON = 64;
export const ACT_HORN = 128;

const KEYS = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false };
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false, mouseClicked = false;
  let camYaw = 0, camDist = 0, camDragging = false, lastDragX = 0, lastDragY = 0;
  let camPitch = 0;

  window.addEventListener('keydown', (event) => {
    const name = KEYS[event.code];
    if (name) { held[name] = true; event.preventDefault(); return; }
    if (event.repeat) return;
    if (event.code === 'KeyE') actions |= ACT_ENTER;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACT_PAUSE;
    else if (event.code === 'Space' || event.code === 'Enter') actions |= ACT_CONFIRM;
    else if (event.code === 'KeyR') actions |= ACT_RELOAD;
    else if (event.code === 'KeyQ') actions |= ACT_RADIO;
    else if (event.code === 'KeyF') actions |= ACT_INTERACT;
    else if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3' || event.code === 'Digit4') actions |= ACT_WEAPON;
    else if (event.code === 'KeyH') actions |= ACT_HORN;
    else if (event.code === 'KeyM') actions |= ACT_RADIO;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYS[event.code];
    if (name) held[name] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(held)) held[k] = false;
    mouseDown = false; camDragging = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    mouseX = event.clientX; mouseY = event.clientY;
    if (camDragging) {
      camYaw -= (event.clientX - lastDragX) * 0.005;
      camPitch += (event.clientY - lastDragY) * 0.003;
      camPitch = Math.max(-0.25, Math.min(0.45, camPitch));
      lastDragX = event.clientX; lastDragY = event.clientY;
    }
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { mouseDown = true; mouseClicked = true; }
    if (event.button === 2) { camDragging = true; lastDragX = event.clientX; lastDragY = event.clientY; }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
    if (event.button === 2) camDragging = false;
  });
  canvas.addEventListener('wheel', (event) => {
    camDist += Math.sign(event.deltaY) * 1.5;
    camDist = Math.max(-4, Math.min(6, camDist));
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    move() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      return { x, y, run: held.run };
    },
    takeActions() { const t = actions; actions = 0; return t; },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked }; },
    clearClick() { mouseClicked = false; },
    camera() { return { yaw: camYaw, pitch: camPitch, dist: camDist }; },
    resetCamera() { camYaw = 0; camPitch = 0; camDist = 0; },
  };
}
