// The city of Solmar Bay: a fixed road grid, a beach and ocean on the west edge,
// building blocks, palms, parks and shop fronts. Pure data + collision — no drawing,
// no browser. Roads run on a 420px grid; every block between four roads holds
// buildings, a park or a parking lot.
import { WORLD, DISTRICTS } from './config.js';
import { clamp, pick, range, rangeInt } from './random.js';

export const SHOPS = [
  { id: 'guns', name: 'IRONWORKS GUNS', x: 1500, y: 420, kind: 'guns', blurb: 'P9 $250 · VK-9 $900 · Sweeper $1,400 · Ammo cheap' },
  { id: 'food', name: 'TICO TACOS', x: 900, y: 1500, kind: 'food', blurb: 'Tacos $25 — restores 50 health' },
  { id: 'clothes', name: 'NEON THREADS', x: 1750, y: 700, kind: 'clothes', blurb: 'Fresh fit $120 — armor +25' },
  { id: 'garage', name: 'ROSA GARAGE', x: 1150, y: 1950, kind: 'garage', blurb: 'Mama Rosa fixes your ride. Free repairs.' },
];

export function createCity(rand) {
  const roadsV = [];
  for (let x = WORLD.beachX + 220; x < WORLD.width; x += WORLD.roadGap) roadsV.push(x);
  const roadsH = [];
  for (let y = 210; y < WORLD.height; y += WORLD.roadGap) roadsH.push(y);

  const buildings = [];
  const palms = [];
  const parks = [];
  const lots = [];
  const palette = ['#b98a5e', '#8fa3b8', '#c9b18a', '#7e9c7a', '#a87a90', '#6f8fa8', '#c2a878'];
  for (let vi = 0; vi < roadsV.length - 1; vi += 1) {
    for (let hi = 0; hi < roadsH.length - 1; hi += 1) {
      const x0 = roadsV[vi] + 62, y0 = roadsH[hi] + 62;
      const x1 = roadsV[vi + 1] - 62, y1 = roadsH[hi + 1] - 62;
      const roll = rand();
      if (roll < 0.14) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let p = 0; p < 5; p += 1) palms.push({ x: range(rand, x0 + 20, x1 - 20), y: range(rand, y0 + 20, y1 - 20) });
        continue;
      }
      if (roll < 0.22) {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const cols = rangeInt(rand, 1, 2), rows = rangeInt(rand, 1, 2);
      const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const bw = cw * range(rand, 0.55, 0.8), bh = ch * range(rand, 0.55, 0.8);
          const bx = x0 + c * cw + (cw - bw) / 2, by = y0 + r * ch + (ch - bh) / 2;
          buildings.push({
            x: bx, y: by, w: bw, h: bh, color: pick(rand, palette),
            neon: rand() < 0.22, height: rangeInt(rand, 1, 3),
          });
        }
      }
      for (let p = 0; p < 2; p += 1) palms.push({ x: range(rand, x0, x1), y: range(rand, y0, y1) });
    }
  }
  // Beach palms along the boardwalk.
  for (let y = 120; y < WORLD.height; y += 170) {
    palms.push({ x: WORLD.beachX + 34 + rand() * 40, y: y + rand() * 60 });
  }

  function isRoad(x, y) {
    if (x < WORLD.beachX) return false;
    for (const rx of roadsV) if (Math.abs(x - rx) < 42) return true;
    for (const ry of roadsH) if (Math.abs(y - ry) < 42) return true;
    return false;
  }
  function onSidewalk(x, y) {
    if (x < WORLD.beachX + 60) return false;
    for (const rx of roadsV) if (Math.abs(x - rx) < 62 && Math.abs(x - rx) >= 42) return true;
    for (const ry of roadsH) if (Math.abs(y - ry) < 62 && Math.abs(y - ry) >= 42) return true;
    return false;
  }
  function hitBuilding(x, y, r) {
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }
  function nearestRoadPoint(x, y) {
    // Snap to the closest road centre line, for traffic spawning.
    let bestX = roadsV[0], bestD = Infinity;
    for (const rx of roadsV) { const d = Math.abs(x - rx); if (d < bestD) { bestD = d; bestX = rx; } }
    let bestY = roadsH[0]; bestD = Infinity;
    for (const ry of roadsH) { const d = Math.abs(y - ry); if (d < bestD) { bestD = d; bestY = ry; } }
    return { x: bestX, y: bestY };
  }
  function roadAngleAt(x, y) {
    // Traffic drives along the nearest road; pick its direction.
    let best = Infinity, vertical = true;
    for (const rx of roadsV) { const d = Math.abs(x - rx); if (d < best) { best = d; vertical = true; } }
    for (const ry of roadsH) { const d = Math.abs(y - ry); if (d < best) { best = d; vertical = false; } }
    if (vertical) return Math.PI / 2;
    return 0;
  }
  function districtAt(x, y) {
    for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
    return x < WORLD.beachX ? 'OCEAN' : 'SOLMAR BAY';
  }
  function clampToWorld(x, y, r) {
    return { x: clamp(x, r, WORLD.width - r), y: clamp(y, r, WORLD.height - r) };
  }

  return { roadsV, roadsH, buildings, palms, parks, lots, shops: SHOPS, isRoad, onSidewalk, hitBuilding, nearestRoadPoint, roadAngleAt, districtAt, clampToWorld };
}
