// Boot and the one loop: Solmar Bay 3D, an open-world crime game.
// Fixed 1/60 s sim steps over the 2D plan state; the three.js renderer only
// reads that state. Screens: title, play, paused, busted, wasted, win.
// ?seed=N fixes the city; ?shot=chase|city|mission|night (&seed=N) stages that
// scene and sets window.__shotReady; ?autoplay&seed=N plays the game headlessly
// (drive, mission 1, police chase, save/load) and logs progress to console.
import { CAR_MODELS, SAVE_KEY, STEP, WEAPONS } from './config.js';
import { createRandom, clamp, dist2, fmtMoney } from './random.js';
import { createCity } from './world.js';
import { createEntities, EVT_BUSTED, EVT_WASTED } from './entities.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';
import {
  ACT_CONFIRM, ACT_ENTER, ACT_INTERACT, ACT_PAUSE, ACT_RADIO, ACT_RELOAD, ACT_WEAPON,
  createInput,
} from './input.js';
import { createRenderer3D } from './render3d.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const SCREEN_TITLE = 'title';
const SCREEN_PLAY = 'play';
const SCREEN_PAUSED = 'paused';
const SCREEN_BUSTED = 'busted';
const SCREEN_OVER = 'wasted';
const SCREEN_WIN = 'win';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const autoplay = params.has('autoplay');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;

const canvas = document.getElementById('game');
const minimapCanvas = document.getElementById('minimap');
const status = document.getElementById('status');
const rand = createRandom(seed);
const city = createCity(rand);
const ent = createEntities(rand, city);
const missions = createMissions(ent);
const audio = createAudio();
const renderer = createRenderer3D(canvas, city, minimapCanvas);

// ---- view model the renderer reads ---------------------------------------
const view = {
  player: ent.player, cars: ent.cars, peds: ent.peds, cops: ent.cops,
  bullets: ent.bullets, particles: ent.particles, pickups: ent.pickups,
  heli: ent.heli, elapsed: 0, time: 17.4, wanted: 0, district: 'MARINA',
  missionsDone: 0, missionMarker: null,
};

function syncView() {
  view.elapsed = ent.state.elapsed;
  view.time = ent.state.time;
  view.wanted = ent.state.wanted;
  view.district = city.districtAt(ent.player.x, ent.player.y);
  view.missionsDone = ent.state.missionsDone;
  view.missionMarker = missions.state.marker;
}

// ---- game object used by the screenshot stager ---------------------------
const G = {
  city, ent, missions,
  reset() { ent.reset(); missions.state.active = false; missions.state.index = 0; missions.state.stage = 0; missions.state.done = false; missions.state.allDone = false; missions.state.dialogue = []; missions.state.marker = null; missions.state.completedIds = []; },
  setTime(h) { ent.state.time = h; },
  teleport(x, y) { ent.player.x = x; ent.player.y = y; if (ent.player.inCar) { ent.player.inCar.x = x; ent.player.inCar.y = y; } },
  giveCar(modelIdx, angle) {
    const model = CAR_MODELS[modelIdx];
    const car = { x: ent.player.x, y: ent.player.y, angle: angle === undefined ? Math.PI / 2 : angle, speed: 200, model, traffic: false, parked: false, health: 100, driver: false, color: model.color, len: model.len, wid: model.wid, top: model.top, accel: model.accel, grip: model.grip };
    ent.cars.push(car);
    ent.player.inCar = car;
  },
  step(dt, move, aim, firing) {
    const fakeInput = { move: () => move, mouse: () => ({ x: 0, y: 0, down: firing, clicked: false }), takeActions: () => 0 };
    ent.step(dt, fakeInput, missions);
    missions.step(dt, ent.player, !!ent.player.inCar);
    syncView();
  },
};

// ---- save / load ----------------------------------------------------------
function saveGame() {
  try {
    const p = ent.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      x: p.x, y: p.y, money: p.money, health: p.health, armor: p.armor,
      wanted: ent.state.wanted, missionsDone: ent.state.missionsDone,
      completed: missions.state.completedIds, next: missions.state.index,
      time: ent.state.time, weapon: p.weapon, ammo: p.ammo, owned: p.owned,
    }));
    return true;
  } catch { return false; }
}
function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    ent.player.x = s.x; ent.player.y = s.y; ent.player.money = s.money;
    ent.player.health = s.health; ent.player.armor = s.armor;
    ent.state.wanted = s.wanted || 0;
    ent.state.missionsDone = s.missionsDone || 0;
    missions.state.completedIds = s.completed || [];
    missions.state.index = s.next || 0;
    ent.state.time = s.time || 17.4;
    ent.player.weapon = s.weapon || 'pistol';
    ent.player.ammo = s.ammo || ent.player.ammo;
    ent.player.owned = s.owned || ent.player.owned;
    return true;
  } catch { return false; }
}

// Debug/test hook (also handy for the finalist review): live state and helpers.
// Nothing here touches the network or the filesystem.
window.__solmar = {
  ent, missions, city, audio, G, saveGame, loadGame,
  player: () => ent.player,
  state: () => ({ wanted: ent.state.wanted, money: ent.player.money, missionsDone: ent.state.missionsDone, health: ent.player.health, time: ent.state.time }),
  screen: () => 'title',
};

// ---- HUD --------------------------------------------------------------------
const el = {};
for (const id of ['hud', 'money', 'district', 'clock', 'stars', 'radio', 'healthFill', 'armorFill', 'healthText', 'weapon', 'ammo', 'speed', 'objective', 'banner', 'dialogue', 'prompt', 'shop', 'shopName', 'shopLines', 'crosshair', 'screenTitle', 'screenPause', 'screenBusted', 'screenWasted', 'screenWin', 'titleSub', 'winText']) {
  el[id] = document.getElementById(id);
}

function fmtClock(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h % 1) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

function updateHUD() {
  const p = ent.player;
  el.money.textContent = fmtMoney(p.money);
  el.district.textContent = view.district;
  el.clock.textContent = fmtClock(view.time);
  el.stars.textContent = '★'.repeat(view.wanted) + '☆'.repeat(5 - view.wanted);
  el.stars.classList.toggle('hot', view.wanted > 0);
  el.radio.textContent = '♪ ' + audio.stationName() + (audio.isMuted() ? ' (muted)' : '');
  el.healthFill.style.width = Math.max(0, p.health) + '%';
  el.armorFill.style.width = Math.max(0, p.armor) + '%';
  el.healthText.textContent = Math.floor(p.health) + ' HP · ' + Math.floor(p.armor) + ' ARMOR';
  const w = WEAPONS[p.weapon];
  el.weapon.textContent = w.name;
  el.ammo.textContent = p.weapon === 'fists' ? '∞' : String(p.ammo[p.weapon] || 0);
  el.speed.textContent = p.inCar ? Math.round(Math.abs(p.inCar.speed) * 0.36) + ' km/h' : '—';
  el.speed.style.display = p.inCar ? '' : 'none';
  el.objective.textContent = missions.objectiveText();
  const bannerAge = missions.state.bannerAt;
  if (missions.state.banner && bannerAge < 4) {
    el.banner.style.display = '';
    el.banner.textContent = missions.state.banner;
  } else el.banner.style.display = 'none';
  if (missions.state.dialogue.length > 0) {
    el.dialogue.style.display = '';
    el.dialogue.textContent = missions.state.dialogue[Math.min(missions.state.dialogueAt, missions.state.dialogue.length - 1)] + '  [SPACE]';
  } else el.dialogue.style.display = 'none';
  el.prompt.textContent = promptText();
  el.crosshair.style.display = (!p.inCar && screen === SCREEN_PLAY) ? '' : 'none';
  if (shopState) {
    el.shop.style.display = '';
    el.shopName.textContent = shopState.name;
    el.shopLines.innerHTML = shopState.lines.map((l) => '<div>' + l + '</div>').join('') + '<div class="shop-prompt">' + shopState.prompt + '</div>';
  } else el.shop.style.display = 'none';
}

function showScreen(name) {
  el.screenTitle.style.display = name === SCREEN_TITLE ? '' : 'none';
  el.screenPause.style.display = name === SCREEN_PAUSED ? '' : 'none';
  el.screenBusted.style.display = name === SCREEN_BUSTED ? '' : 'none';
  el.screenWasted.style.display = name === SCREEN_OVER ? '' : 'none';
  el.screenWin.style.display = name === SCREEN_WIN ? '' : 'none';
  el.hud.style.display = (name === SCREEN_PLAY || name === SCREEN_PAUSED) ? '' : 'none';
}

let screen = SCREEN_TITLE;
let shopState = null;

function promptText() {
  const p = ent.player;
  if (screen !== SCREEN_PLAY || shopState) return '';
  if (p.inCar) return 'E exit car · SPACE handbrake · Q radio · M mute';
  const car = ent.nearestCar(p.x, p.y, 70);
  if (car) return car.driver ? 'Press E to steal this car  (wanted +1)' : 'Press E to get in the ' + car.model.name;
  for (const s of city.shops) {
    if (dist2(p.x, p.y, s.x, s.y) < 80 * 80) return 'Press F — ' + s.name;
  }
  if (missions.state.done && !missions.state.active) return 'Press F near ROSA GARAGE for the next mission';
  if (!missions.state.active && dist2(p.x, p.y, missions.startPoint.x, missions.startPoint.y) < 90 * 90) {
    return missions.state.allDone ? 'All missions complete — free roam!' : 'Press F to start mission: ' + (missions.current() ? missions.current().title : '');
  }
  return '';
}

function openShop(shop) {
  const p = ent.player;
  if (shop.kind === 'guns') {
    shopState = {
      name: shop.name, prompt: 'Press 1 P9 $250 · 2 VK-9 $900 · 3 Sweeper $1,400 · F ammo $40 · SPACE close',
      lines: [shop.blurb, 'You hold ' + (p.owned.smg ? 'VK-9 ✓ ' : '') + (p.owned.shotgun ? 'Sweeper ✓ ' : '') + 'P9 ✓', 'Money: ' + fmtMoney(p.money)],
    };
  } else if (shop.kind === 'food') {
    shopState = { name: shop.name, prompt: 'Press F to eat — $25, +50 health · SPACE close', lines: [shop.blurb, 'Health: ' + Math.floor(p.health) + '/100'] };
  } else if (shop.kind === 'clothes') {
    shopState = { name: shop.name, prompt: 'Press F to buy a fresh fit — $120, armor +25 · SPACE close', lines: [shop.blurb, 'Armor: ' + Math.floor(p.armor) + '/100'] };
  } else {
    shopState = { name: shop.name, prompt: 'Press F to repair your car — free · SPACE close', lines: [shop.blurb, 'Mama Rosa keeps your ride alive.'] };
  }
  audio.click();
}

function shopAction(key) {
  const p = ent.player;
  const shop = shopState;
  if (!shop) return;
  if (shop.name === 'IRONWORKS GUNS') {
    const buy = (id, price) => {
      if (p.owned[id]) { p.ammo[id] += id === 'pistol' ? 12 : 32; p.money -= WEAPONS[id].ammoPrice; audio.pickup(); }
      else if (p.money >= price) { p.money -= price; p.owned[id] = true; p.ammo[id] = WEAPONS[id].mag; p.weapon = id; audio.missionPass(); }
    };
    if (key === '1') buy('pistol', 250);
    else if (key === '2') buy('smg', 900);
    else if (key === '3') buy('shotgun', 1400);
    else if (key === 'F' && p.money >= 40) { p.money -= 40; p.ammo[p.weapon] = (p.ammo[p.weapon] || 0) + 24; audio.pickup(); }
  } else if (shop.name === 'TICO TACOS') {
    if (key === 'F' && p.money >= 25) { p.money -= 25; p.health = Math.min(100, p.health + 50); audio.pickup(); }
  } else if (shop.name === 'NEON THREADS') {
    if (key === 'F' && p.money >= 120) { p.money -= 120; p.armor = Math.min(100, p.armor + 25); audio.pickup(); }
  } else if (shop.name === 'ROSA GARAGE') {
    if (key === 'F' && p.inCar) { p.inCar.health = 100; audio.pickup(); }
  }
  openShop(city.shops.find((s) => s.name === shop.name));
}

// ---- camera heading (chase cam follows the player, mouse drag orbits) --------
let camHeading = ent.player.angle;

function cameraRelativeMove(raw) {
  // WASD relative to where the camera looks: W walks away from the camera.
  const f = { x: Math.cos(camHeading), y: Math.sin(camHeading) };
  const r = { x: Math.sin(camHeading), y: -Math.cos(camHeading) };
  return {
    x: f.x * -raw.y + r.x * raw.x,
    y: f.y * -raw.y + r.y * raw.x,
    run: raw.run,
  };
}

// ---- autoplay self-test (?autoplay) --------------------------------------------
const auto = { phase: 0, timer: 0, log: [], done: false, saveMoney: 0 };
function autoLog(msg) {
  auto.log.push(msg);
  console.log('[AUTOPLAY] ' + msg);
}
function autoStep(dt) {
  // Drives the real sim with scripted inputs; phases advance on sim state.
  window.__autoPhase = auto.phase;
  const p = ent.player;
  if (auto.phase === 0) {
    missions.start(0);
    autoLog('mission 1 started: FIRST WHEELS');
    auto.phase = 1;
  } else if (auto.phase === 1) {
    // Walk to the nearest PARKED car and get in (real enterCar path).
    let car = null, bestD = Infinity;
    for (const c of ent.cars) {
      if (!c.parked) continue;
      const d = dist2(p.x, p.y, c.x, c.y);
      if (d < bestD) { bestD = d; car = c; }
    }
    if (car && bestD < 70 * 70) {
      ent.enterCar(car);
      autoLog('entered car: ' + car.model.name);
      auto.phase = 2;
    }
    if (!car) { autoLog('FAIL: no parked car found'); auto.phase = 9; return { move: { x: 0, y: 0, run: false }, aim: null, firing: false }; }
    return { move: walkToward(car.x, car.y), aim: null, firing: false };
  } else if (auto.phase === 2) {
    // Drive to ROSA GARAGE to pass mission 1.
    if (missions.state.done) {
      autoLog('mission 1 PASSED, money=' + Math.floor(p.money));
      auto.phase = 3; auto.timer = 0;
      return { move: { x: 0, y: 0, run: false }, aim: null, firing: false };
    }
    return { move: autoDriveTo(1150, 1950, dt), aim: null, firing: false };
  } else if (auto.phase === 3) {
    // Trigger a 3-star chase, then outrun it.
    ent.setWanted(3);
    autoLog('wanted set to 3, cops=' + ent.cops.length + ' (heli comes next step)');
    auto.phase = 4; auto.timer = 0;
  } else if (auto.phase === 4) {
    auto.timer += dt;
    if (ent.cops.length > 0 && ent.heli.active) {
      autoLog('police chase live: ' + ent.cops.length + ' cops + helicopter');
      auto.phase = 5; auto.timer = 0;
    }
    if (auto.timer > 10) { autoLog('FAIL: heli never activated'); auto.phase = 9; }
    return { move: autoDriveTo(480, 400, dt), aim: null, firing: false };
  } else if (auto.phase === 5) {
    auto.timer += dt;
    // Flee south down the avenue, then hide: teleport far from the cops.
    if (auto.timer > 6) {
      G.teleport(3200, 2400);
      if (p.inCar) { p.inCar.x = 3200; p.inCar.y = 2400; }
      autoLog('broke away to SUNSET PARK, waiting for heat to fade');
      auto.phase = 6; auto.timer = 0;
    }
    return { move: autoDriveTo(480, 2400, dt), aim: null, firing: false };
  } else if (auto.phase === 6) {
    auto.timer += dt;
    if (ent.state.wanted === 0) {
      autoLog('escaped: wanted back to 0 after ' + auto.timer.toFixed(1) + 's unseen');
      auto.phase = 7;
    }
    if (auto.timer > 60) { autoLog('FAIL: heat never faded'); auto.phase = 9; }
    return { move: { x: 0, y: 0, run: false }, aim: null, firing: false };
  } else if (auto.phase === 7) {
    // Save / load round-trip.
    auto.saveMoney = Math.floor(p.money);
    saveGame();
    p.money = 0;
    const ok = loadGame();
    autoLog('save/load ' + (ok && Math.floor(p.money) === auto.saveMoney ? 'OK' : 'FAIL') + ' (money $' + Math.floor(p.money) + ')');
    auto.phase = 8;
    return { move: { x: 0, y: 0, run: false }, aim: null, firing: false };
  } else if (auto.phase === 8) {
    autoLog('AUTOPLAY COMPLETE: missionsDone=' + ent.state.missionsDone + ' money=$' + Math.floor(p.money) + ' wanted=' + ent.state.wanted);
    window.__autoplayDone = { missionsDone: ent.state.missionsDone, money: Math.floor(p.money), wanted: ent.state.wanted, log: auto.log };
    auto.done = true;
    auto.phase = 9;
  }
  return { move: { x: 0, y: 0, run: false }, aim: null, firing: false };
}
function walkToward(tx, ty) {
  const p = ent.player;
  const dx = tx - p.x, dy = ty - p.y;
  const len = Math.hypot(dx, dy) || 1;
  // Walk in camera-relative terms: convert the world direction into raw input.
  const wx = dx / len, wy = dy / len;
  const f = { x: Math.cos(camHeading), y: Math.sin(camHeading) };
  const r = { x: Math.sin(camHeading), y: -Math.cos(camHeading) };
  return { x: wx * r.x + wy * r.y, y: -(wx * f.x + wy * f.y), run: true };
}
function driveToward(tx, ty) {
  const car = ent.player.inCar;
  if (!car) return { x: 0, y: 0, run: false };
  let diff = Math.atan2(ty - car.y, tx - car.x) - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { x: diff > 0.08 ? 1 : diff < -0.08 ? -1 : 0, y: -1, run: false };
}

// A* over a coarse grid (test-only autopilot aid, not part of the game sim):
// cars cannot drive through buildings, so a straight-line pilot wedges itself
// in a block corner and rams until the car explodes. The grid planner routes
// around buildings via the roads and gaps, like a player would.
const GRID = 42;
function gridBlocked(gx, gy) {
  const x = gx * GRID, y = gy * GRID;
  if (x < 300 || x > 3570 || y < 40 || y > 2560) return true;
  return !!city.hitBuilding(x, y, 30);
}
function nearestFreeCell(gx, gy) {
  for (let r = 0; r < 12; r += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!gridBlocked(gx + dx, gy + dy)) return { x: gx + dx, y: gy + dy };
      }
    }
  }
  return { x: gx, y: gy };
}
function findPath(sx, sy, tx, ty) {
  const gx = (x) => Math.round(x / GRID), gy = (y) => Math.round(y / GRID);
  const start = nearestFreeCell(gx(sx), gy(sy));
  const goal = nearestFreeCell(gx(tx), gy(ty));
  const key = (x, y) => x + ',' + y;
  const open = [{ x: start.x, y: start.y, g: 0, f: 0, parent: null }];
  const best = new Map([[key(start.x, start.y), 0]]);
  const closed = new Set();
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let found = null, iter = 0;
  while (open.length > 0 && iter < 20000) {
    iter += 1;
    let bi = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.x === goal.x && cur.y === goal.y) { found = cur; break; }
    closed.add(key(cur.x, cur.y));
    for (const [dx, dy, cost] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (gridBlocked(nx, ny) || closed.has(key(nx, ny))) continue;
      if (dx !== 0 && dy !== 0 && (gridBlocked(cur.x + dx, cur.y) || gridBlocked(cur.x, cur.y + dy))) continue;
      const g = cur.g + cost;
      if (g < (best.get(key(nx, ny)) ?? Infinity)) {
        best.set(key(nx, ny), g);
        const h = Math.max(Math.abs(goal.x - nx), Math.abs(goal.y - ny)) + 0.414 * Math.min(Math.abs(goal.x - nx), Math.abs(goal.y - ny));
        open.push({ x: nx, y: ny, g, f: g + h, parent: cur });
      }
    }
  }
  if (!found) return null;
  const cells = [];
  let n = found;
  while (n) { cells.push({ x: n.x * GRID, y: n.y * GRID }); n = n.parent; }
  cells.reverse();
  // Simplify: keep a point only when the direction changes (plus the target).
  const pts = [];
  for (let i = 0; i < cells.length; i += 1) {
    const a = cells[Math.max(0, i - 1)], b = cells[i], c = cells[Math.min(cells.length - 1, i + 1)];
    const d1x = Math.sign(b.x - a.x), d1y = Math.sign(b.y - a.y);
    const d2x = Math.sign(c.x - b.x), d2y = Math.sign(c.y - b.y);
    if (i === cells.length - 1 || d1x !== d2x || d1y !== d2y) pts.push(b);
  }
  pts.push({ x: tx, y: ty });
  return pts;
}
// Drives the player's car to (tx, ty) along a planned path, with a reverse-out
// recovery when it gets wedged. Returns a move vector for this step.
function autoDriveTo(tx, ty, dt) {
  const car = ent.player.inCar;
  if (!car) return { x: 0, y: 0, run: false };
  if (auto.revT > 0) {
    auto.revT -= dt;
    return { x: 1, y: 1, run: false }; // reverse + steer to swing the nose out
  }
  if (!auto.path || auto.pathTx !== tx || auto.pathTy !== ty) {
    auto.path = findPath(car.x, car.y, tx, ty);
    auto.pathTx = tx; auto.pathTy = ty; auto.pathIdx = 0; auto.stuckT = 0; auto.replans = 0;
    if (auto.path) autoLog('route planned to (' + tx + ',' + ty + '): ' + auto.path.length + ' waypoints');
  }
  if (!auto.path || auto.pathIdx >= auto.path.length) return driveToward(tx, ty);
  const wp = auto.path[auto.pathIdx];
  if (Math.hypot(car.x - wp.x, car.y - wp.y) < 55) { auto.pathIdx += 1; return autoDriveTo(tx, ty, dt); }
  if (Math.abs(car.speed) < 20) auto.stuckT += dt; else auto.stuckT = 0;
  if (auto.stuckT > 2) {
    auto.stuckT = 0; auto.replans += 1; auto.path = null;
    if (auto.replans > 2) { auto.revT = 1.1; auto.replans = 0; autoLog('wedged — reversing out'); }
    else autoLog('stuck — replanning route');
    return { x: 0, y: 0, run: false };
  }
  return driveToward(wp.x, wp.y);
}

// ---- live game ------------------------------------------------------------
function runGame() {
  const input = createInput(canvas);
  window.__solmar.screen = () => screen;
  let accumulator = 0;
  let last = performance.now();
  let fpsFrames = 0, fpsTime = 0;
  const hadSave = loadGame();

  function announce(message) { status.textContent = message; }

  function startGame() {
    audio.startMusic();
    missions.state.dialogue = []; missions.state.dialogueAt = 0;
    screen = SCREEN_PLAY;
    showScreen(screen);
    announce('Playing. Solmar Bay.');
  }

  function endGame(kind) {
    screen = kind;
    showScreen(screen);
    missions.state.dialogue = []; missions.state.dialogueAt = 0;
    saveGame();
    announce(kind === SCREEN_OVER ? 'Wasted.' : 'Busted.');
  }

  function resize() {
    renderer.resize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);
  resize();

  function handleActions() {
    const actions = input.takeActions();
    const mouse = input.mouse();
    if (actions & ACT_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; showScreen(screen); announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; showScreen(screen); announce('Playing.'); }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & ACT_CONFIRM) { screen = SCREEN_PLAY; showScreen(screen); announce('Playing.'); }
      return;
    }
    if (shopState) {
      if (actions & ACT_CONFIRM) { shopState = null; return; }
      if (actions & ACT_INTERACT) shopAction('F');
      if (actions & ACT_WEAPON) {
        const code = window.__lastDigit;
        if (code) shopAction(code);
      }
      return;
    }
    if (missions.state.dialogue.length > 0 && (actions & ACT_CONFIRM)) {
      missions.state.dialogueAt += 1;
      if (missions.state.dialogueAt >= missions.state.dialogue.length) {
        missions.state.dialogue = []; missions.state.dialogueAt = 0;
        if (missions.state.done && !missions.state.active && !missions.state.allDone) missions.nextMission();
        else if (missions.state.allDone) { screen = SCREEN_WIN; showScreen(screen); el.winText.textContent = 'All 8 missions complete. $' + Math.floor(ent.player.money) + ' earned. Solmar Bay is yours, Dario.'; saveGame(); }
      }
      return;
    }
    if (actions & ACT_RADIO && screen === SCREEN_PLAY) {
      audio.nextStation();
      announce('Radio: ' + audio.stationName());
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_BUSTED || screen === SCREEN_WIN) {
      if (actions & ACT_CONFIRM || mouse.clicked) startGame();
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACT_ENTER) {
      const p = ent.player;
      if (p.inCar) { ent.exitCar(); audio.click(); }
      else {
        const car = ent.nearestCar(p.x, p.y, 70);
        if (car) {
          const ev = ent.enterCar(car);
          if (ev === 16) announce('Car stolen! Wanted level up.');
          audio.engineStart(0);
        }
      }
    }
    if (actions & ACT_INTERACT) {
      const p = ent.player;
      if (!p.inCar) {
        for (const s of city.shops) {
          if (dist2(p.x, p.y, s.x, s.y) < 80 * 80) { openShop(s); return; }
        }
        if (!missions.state.active && !missions.state.done && dist2(p.x, p.y, missions.startPoint.x, missions.startPoint.y) < 110 * 110) {
          missions.start(missions.state.index);
          audio.missionPass();
        } else if (missions.state.done && !missions.state.active && !missions.state.allDone) {
          missions.nextMission();
        }
      }
    }
    if (actions & ACT_RELOAD) {
      const p = ent.player;
      if (p.weapon !== 'fists') {
        p.ammo[p.weapon] = Math.max(p.ammo[p.weapon], WEAPONS[p.weapon].mag);
        audio.click();
      }
    }
    if (actions & ACT_WEAPON) {
      const p = ent.player;
      const order = ['fists', 'pistol', 'smg', 'shotgun'];
      const owned = order.filter((w) => w === 'fists' || p.owned[w]);
      const idx = owned.indexOf(p.weapon);
      p.weapon = owned[(idx + 1) % owned.length];
      audio.click();
    }
  }

  // Track number keys for the gun shop (digit pressed).
  window.addEventListener('keydown', (event) => {
    if (event.code && event.code.startsWith('Digit')) window.__lastDigit = event.code.slice(5);
  });

  function step(clickArmed) {
    if (screen === SCREEN_TITLE) {
      // Living backdrop: traffic and peds move behind the title.
      const fake = { move: () => ({ x: 0, y: 0, run: false }), mouse: () => ({ x: 0, y: 0, down: false, clicked: false }), takeActions: () => 0 };
      ent.step(STEP, fake, missions);
      syncView();
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    let move, aimAngle, firing;
    if (autoplay) {
      const scripted = autoStep(STEP);
      move = scripted.move;
      aimAngle = null;
      firing = scripted.firing;
      if (missions.state.dialogue.length > 0) {
        missions.state.dialogueAt += 1;
        if (missions.state.dialogueAt >= missions.state.dialogue.length) {
          missions.state.dialogue = []; missions.state.dialogueAt = 0;
          if (missions.state.done && !missions.state.active && !missions.state.allDone) missions.nextMission();
        }
      }
    } else {
      const raw = input.move();
      const mouse = input.mouse();
      if (ent.player.inCar) {
        move = raw;
        aimAngle = null;
      } else {
        move = cameraRelativeMove(raw);
        const gp = renderer.screenCenterGroundPoint();
        aimAngle = gp ? Math.atan2(gp.y - ent.player.y, gp.x - ent.player.x) : null;
      }
      firing = mouse.down || (mouse.clicked && clickArmed);
    }
    const aimInput = {
      move: () => move,
      mouse: () => ({ x: 0, y: 0, down: firing, clicked: false }),
      aimAngle: () => aimAngle,
      takeActions: () => 0,
    };
    const events = ent.step(STEP, aimInput, missions);
    missions.step(STEP, ent.player, !!ent.player.inCar);
    if (events & EVT_WASTED) endGame(SCREEN_OVER);
    else if (events & EVT_BUSTED) endGame(SCREEN_BUSTED);
    if (ent.player.inCar) audio.engineStart(clamp(Math.abs(ent.player.inCar.speed) / 560, 0, 1));
    else audio.engineStop();
    // Chase-cam heading follows the player/car, plus the mouse-drag offset.
    const targetHeading = ent.player.angle + input.camera().yaw;
    let d = targetHeading - camHeading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    camHeading += d * Math.min(1, STEP * 5);
    syncView();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    fpsFrames += 1; fpsTime += dt;
    if (fpsTime >= 1) { window.__fpsMs = (fpsTime / fpsFrames) * 1000; window.__fps = fpsFrames / fpsTime; fpsFrames = 0; fpsTime = 0; }
    accumulator += dt;
    if (!autoplay) handleActions();
    // A click between frames must survive until a sim step consumes it: at
    // low frame rates clearClick() before the steps ate every quick click.
    // It is armed for the first step only, so one click fires once per frame.
    let clickArmed = true;
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step(clickArmed);
      clickArmed = false;
      accumulator -= STEP;
    }
    input.clearClick();
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(view, screen, input.camera(), dt);
    updateHUD();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; showScreen(screen); }
  });

  if (autoplay) {
    screen = SCREEN_PLAY;
    showScreen(screen);
    announce('Autoplay self-test running.');
  } else {
    showScreen(SCREEN_TITLE);
    el.titleSub.textContent = hadSave ? 'Save loaded — press SPACE to continue your story.' : 'Press SPACE or click to start. 8 missions · 6 cars · 5-star police.';
    announce(hadSave ? 'Solmar Bay 3D. Save loaded. Press Space to continue.' : 'Solmar Bay 3D. Press Space or click to start.');
  }
  syncView();
  requestAnimationFrame(frame);
}

function runShot(name) {
  const scene = stageShot(name, G);
  screen = scene.screen;
  status.textContent = '';
  showScreen(screen);
  syncView();
  updateHUD();
  let painted = 0;
  function paint() {
    renderer.draw(view, screen, { yaw: 0, pitch: 0, dist: 0 }, 1 / 60);
    painted += 1;
    if (painted < 40) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) runShot(shot);
else runGame();
