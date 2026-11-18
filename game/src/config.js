// Solmar Bay 3D — every tuning number and colour in one place.
// A sun-soaked fictional coastal city. All names, characters and places are original.
// The simulation still runs in the 2D plan coordinates of the original design
// (3600 x 2600); the renderer maps them to 3D metres with SCALE (1 unit = 10 plan
// units), so the whole proven sim ports unchanged and the 3D layer only reads it.
export const WORLD = { width: 3600, height: 2600, beachX: 260, roadGap: 420, block: 300 };

/** Plan units per 3D metre. World is 360 m x 260 m in 3D. */
export const SCALE = 0.1;

export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13, walkSpeed: 205, runSpeed: 305, health: 100, armor: 50,
  punchDamage: 14, punchRange: 38, punchCooldown: 0.38,
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 14, rate: 0.38, range: 44, auto: false, price: 0 },
  pistol: { name: 'P9 Pistol', damage: 26, rate: 0.24, range: 430, auto: false, mag: 12, price: 250, ammoPrice: 40 },
  smg: { name: 'VK-9 SMG', damage: 15, rate: 0.085, range: 390, auto: true, mag: 32, price: 900, ammoPrice: 120 },
  shotgun: { name: 'Street Sweeper', damage: 16, rate: 0.7, range: 270, auto: false, mag: 6, pellets: 6, price: 1400, ammoPrice: 150 },
};

export const CAR_MODELS = [
  { name: 'Comet Sedan', color: '#c94f43', top: 430, accel: 300, grip: 2.6, len: 52, wid: 26 },
  { name: 'Island Taxi', color: '#f2c230', top: 400, accel: 280, grip: 2.5, len: 50, wid: 26 },
  { name: 'Palm Hatch', color: '#4fa8c9', top: 380, accel: 260, grip: 2.8, len: 44, wid: 24 },
  { name: 'Vortex GT', color: '#8e44ad', top: 560, accel: 420, grip: 3.1, len: 54, wid: 26 },
  { name: 'Harbor Truck', color: '#7d8a96', top: 340, accel: 220, grip: 2.2, len: 62, wid: 28 },
  { name: 'Sunset Coupe', color: '#e67e22', top: 500, accel: 360, grip: 2.9, len: 50, wid: 25 },
];

export const COP = { top: 480, accel: 380, grip: 3.0, len: 52, wid: 26 };

export const WANTED = {
  1: { cops: 1, heli: false, lose: 8 },
  2: { cops: 2, heli: false, lose: 12 },
  3: { cops: 3, heli: true, lose: 18 },
  4: { cops: 4, heli: true, lose: 24 },
  5: { cops: 5, heli: true, lose: 32 },
};

export const ECONOMY = { startMoney: 150 };

export const PALETTE = {
  ocean: '#1d7fa8', oceanDeep: '#14607f', sand: '#e8d29a', sandWet: '#d9bf7f',
  grass: '#5da24a', park: '#4c8f3e', road: '#3a3f4a', roadEdge: '#2c303a',
  lane: '#e8e4c8', sidewalk: '#9aa0a8', building: '#b98a5e', building2: '#8fa3b8',
  building3: '#c9b18a', building4: '#7e9c7a', roof: '#6e5a44', neonPink: '#ff4fd8',
  neonCyan: '#29e6ff', neonGold: '#ffc93c', hudPanel: 'rgba(8,12,24,0.72)',
  text: '#f4f6f8', muted: '#aab4c0', money: '#7ee787', danger: '#ff5a5a',
  police: '#2f6df6', policeLight: '#ff3b30',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Third-person chase camera tuning (metres). */
export const CAMERA = {
  onFootDist: 7.5, onFootHeight: 3.6,
  carDist: 11.5, carHeight: 4.6,
  minDist: 5, maxDist: 18, smooth: 6.5,
};

export const SAVE_KEY = 'solmar-bay-3d.save.v1';

// Original story cast — none from any commercial game.
export const CAST = {
  player: 'Dario Cruz',
  fixer: 'Mama Rosa',
  friend: 'Tico',
  rival: 'Vex Marlowe',
  cop: 'Chief Duarte',
};

export const DISTRICTS = [
  { name: 'PALM BEACH', x: 260, y: 0, w: 420, h: 2600 },
  { name: 'MARINA', x: 680, y: 0, w: 640, h: 900 },
  { name: 'OLD TOWN', x: 680, y: 900, w: 640, h: 800 },
  { name: 'NEON ROW', x: 1320, y: 0, w: 700, h: 900 },
  { name: 'DOCKSIDE', x: 1320, y: 1700, w: 700, h: 900 },
  { name: 'HILLCREST', x: 2020, y: 0, w: 760, h: 1300 },
  { name: 'AIRFIELD', x: 2020, y: 1300, w: 760, h: 1300 },
  { name: 'SUNSET PARK', x: 2780, y: 0, w: 820, h: 2600 },
];
