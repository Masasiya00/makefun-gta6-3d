// All moving things: the player (on foot and in a car), traffic cars, parked cars,
// pedestrians, police cars, the police helicopter, bullets and particles.
// No drawing here — state and rules only. Fully deterministic: every random draw
// comes from the seeded rand, so a seed replays the same city, traffic and chase.
import { CAR_MODELS, COP, PLAYER, STEP, WANTED, WORLD } from './config.js';
import { angleLerp, clamp, dist2, pick, range, rangeInt } from './random.js';

export const EVT_NONE = 0;
export const EVT_SHOT = 1;
export const EVT_HIT = 2;
export const EVT_BUSTED = 4;
export const EVT_WASTED = 8;
export const EVT_STEAL = 16;
export const EVT_MISSION = 32;

const PED_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8'];

function makeCar(rand, x, y, angle, model, traffic) {
  return {
    x, y, angle, speed: 0, model, traffic: !!traffic, parked: !traffic,
    health: 100, driver: traffic, wanted: false, brake: 0, siren: 0,
    color: model.color, len: model.len, wid: model.wid, top: model.top, accel: model.accel, grip: model.grip,
  };
}

export function createEntities(rand, city) {
  const player = {
    x: 900, y: 1300, angle: -Math.PI / 2, speed: 0, health: PLAYER.health, armor: PLAYER.armor,
    inCar: null, weapon: 'pistol', ammo: { pistol: 24, smg: 0, shotgun: 0 },
    owned: { pistol: true, smg: false, shotgun: false },
    fireCooldown: 0, punchCooldown: 0, hurtFlash: 0, money: 150,
  };
  const cars = [];
  const peds = [];
  const cops = [];
  const bullets = [];
  const particles = [];
  const pickups = [];
  const heli = { active: false, x: 0, y: 0, angle: 0, search: 0 };
  const state = {
    wanted: 0, heatTimer: 0, unseenTimer: 0, time: 17.4, // in-game clock, hours (starts golden hour)
    elapsed: 0, bustedTimer: 0, kills: 0, carsStolen: 0, missionsDone: 0,
  };

  function spawnTraffic(count) {
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 20) {
      tries += 1;
      const x = range(rand, 400, WORLD.width - 100), y = range(rand, 100, WORLD.height - 100);
      const p = city.nearestRoadPoint(x, y);
      let tooClose = false;
      for (const c of cars) if (dist2(p.x, p.y, c.x, c.y) < 90 * 90) { tooClose = true; break; }
      if (tooClose) continue;
      const angle = city.roadAngleAt(p.x, p.y) + (rand() < 0.5 ? 0 : Math.PI);
      const model = pick(rand, CAR_MODELS);
      const car = makeCar(rand, p.x + (rand() < 0.5 ? -14 : 14) * (angle === 0 ? 0 : 1), p.y + (rand() < 0.5 ? -14 : 14) * (angle === 0 ? 1 : 0), angle, model, true);
      car.speed = range(rand, 120, 220);
      cars.push(car);
      placed += 1;
    }
  }
  function spawnParked(count) {
    // Parked cars sit in neat rows inside parking lots, never on top of each other.
    let placed = 0;
    for (const lot of city.lots) {
      const cols = Math.max(1, Math.floor((lot.w - 40) / 64));
      const rows = Math.max(1, Math.floor((lot.h - 40) / 40));
      for (let r = 0; r < rows && placed < count; r += 1) {
        for (let c = 0; c < cols && placed < count; c += 1) {
          if (rand() < 0.35) continue;
          const model = pick(rand, CAR_MODELS);
          cars.push(makeCar(rand, lot.x + 40 + c * 64, lot.y + 40 + r * 40, rand() < 0.5 ? 0 : Math.PI, model, false));
          placed += 1;
        }
      }
      if (placed >= count) break;
    }
  }
  function spawnPeds(count) {
    for (let i = 0; i < count; i += 1) {
      const x = range(rand, 350, WORLD.width - 60), y = range(rand, 60, WORLD.height - 60);
      peds.push({
        x, y, angle: range(rand, 0, Math.PI * 2), speed: range(rand, 30, 70),
        color: pick(rand, PED_COLORS), panic: 0, alive: true, walkPhase: rand() * 6,
        tx: x, ty: y, retarget: rand() * 4,
      });
    }
  }
  function spawnPickups() {
    // Cash + health pickups scattered around the city.
    for (let i = 0; i < 10; i += 1) {
      pickups.push({ x: range(rand, 400, WORLD.width - 100), y: range(rand, 100, WORLD.height - 100), kind: i % 3 === 0 ? 'health' : 'cash', taken: false, bob: rand() * 6 });
    }
  }

  function reset() {
    cars.length = 0; peds.length = 0; cops.length = 0; bullets.length = 0; particles.length = 0; pickups.length = 0;
    player.x = 900; player.y = 1300; player.angle = -Math.PI / 2; player.speed = 0;
    player.health = PLAYER.health; player.armor = PLAYER.armor; player.inCar = null;
    player.weapon = 'pistol'; player.ammo = { pistol: 24, smg: 0, shotgun: 0 };
    player.owned = { pistol: true, smg: false, shotgun: false };
    player.fireCooldown = 0; player.punchCooldown = 0; player.hurtFlash = 0; player.money = 150;
    state.wanted = 0; state.heatTimer = 0; state.unseenTimer = 0; state.time = 17.4;
    state.elapsed = 0; state.bustedTimer = 0; state.kills = 0; state.carsStolen = 0; state.missionsDone = 0;
    heli.active = false;
    spawnTraffic(30); spawnParked(18); spawnPeds(55); spawnPickups();
  }

  function addWanted(n) {
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.heatTimer = 0; state.unseenTimer = 0;
  }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      particles.push({ x, y, vx: range(rand, -speed, speed), vy: range(rand, -speed, speed), life: range(rand, 0.25, 0.6), max: 0.6, color, size: range(rand, 2, 5) });
    }
  }
  function damagePlayer(amount) {
    if (player.armor > 0) { const absorbed = Math.min(player.armor, amount); player.armor -= absorbed; amount -= absorbed; }
    player.health -= amount;
    player.hurtFlash = 0.35;
    if (player.health <= 0) { player.health = 0; return EVT_WASTED; }
    return EVT_HIT;
  }

  function nearestCar(x, y, maxD) {
    let best = null, bestD = maxD * maxD;
    for (const c of cars) {
      const d = dist2(x, y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function enterCar(car) {
    if (car.driver && car.traffic) {
      // Stealing a driven car: yank the driver out, wanted +1, and get in.
      car.driver = false;
      addWanted(1);
      state.carsStolen += 1;
      burst(car.x, car.y, '#ffd166', 8, 120);
      player.inCar = car;
      player.x = car.x; player.y = car.y;
      return EVT_STEAL;
    }
    if (car.parked) { car.parked = false; state.carsStolen += 1; }
    player.inCar = car;
    player.x = car.x; player.y = car.y;
    return EVT_NONE;
  }
  function exitCar() {
    const car = player.inCar;
    if (!car) return;
    const side = car.angle + Math.PI / 2;
    player.x = car.x + Math.cos(side) * 34;
    player.y = car.y + Math.sin(side) * 34;
    const p = city.clampToWorld(player.x, player.y, 20);
    player.x = p.x; player.y = p.y;
    player.angle = car.angle;
    player.inCar = null;
    car.speed *= 0.2;
  }

  function fireBullet(fromX, fromY, angle, weapon, owner) {
    const pellets = weapon.pellets || 1;
    for (let i = 0; i < pellets; i += 1) {
      const spread = (rand() - 0.5) * (pellets > 1 ? 0.24 : 0.05);
      bullets.push({ x: fromX, y: fromY, vx: Math.cos(angle + spread) * 900, vy: Math.sin(angle + spread) * 900, damage: weapon.damage, range: weapon.range, traveled: 0, owner });
    }
    burst(fromX, fromY, '#ffe08a', 3, 90);
  }

  function stepPlayer(dt, move, aimAngle, firing, mission) {
    let events = 0;
    if (player.fireCooldown > 0) player.fireCooldown -= dt;
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (player.hurtFlash > 0) player.hurtFlash -= dt;
    if (player.inCar) return events;
    const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(move.x, move.y);
    if (len > 0) {
      const nx = move.x / len, ny = move.y / len;
      const nx2 = player.x + nx * speed * dt, ny2 = player.y + ny * speed * dt;
      if (!city.hitBuilding(nx2, player.y, PLAYER.radius)) player.x = nx2;
      if (!city.hitBuilding(player.x, ny2, PLAYER.radius)) player.y = ny2;
      const p = city.clampToWorld(player.x, player.y, PLAYER.radius);
      player.x = p.x; player.y = p.y;
      player.angle = Math.atan2(ny, nx);
    }
    if (aimAngle !== null) player.angle = aimAngle;
    // Shooting.
    if (firing && player.fireCooldown <= 0) {
      if (player.weapon === 'fists') {
        player.punchCooldown = PLAYER.punchCooldown;
        player.fireCooldown = PLAYER.punchCooldown;
        const px = player.x + Math.cos(player.angle) * PLAYER.punchRange;
        const py = player.y + Math.sin(player.angle) * PLAYER.punchRange;
        for (const ped of peds) {
          if (ped.alive && dist2(px, py, ped.x, ped.y) < 30 * 30) { ped.alive = false; ped.panic = 1; burst(ped.x, ped.y, '#ff6b6b', 6, 100); state.kills += 1; addWanted(1); events |= EVT_HIT; }
        }
      } else {
        const def = { pistol: { damage: 26, rate: 0.24, range: 430 }, smg: { damage: 15, rate: 0.085, range: 390 }, shotgun: { damage: 16, rate: 0.7, range: 270, pellets: 6 } }[player.weapon];
        if (player.ammo[player.weapon] > 0) {
          player.ammo[player.weapon] -= 1;
          player.fireCooldown = def.rate;
          const bx = player.x + Math.cos(player.angle) * 20, by = player.y + Math.sin(player.angle) * 20;
          fireBullet(bx, by, player.angle, def, 'player');
          events |= EVT_SHOT;
        } else {
          player.fireCooldown = 0.3; // dry click
        }
      }
    }
    // Pickups.
    for (const pk of pickups) {
      if (!pk.taken && dist2(player.x, player.y, pk.x, pk.y) < 30 * 30) {
        pk.taken = true;
        if (pk.kind === 'cash') { player.money += 50; }
        else player.health = Math.min(PLAYER.health, player.health + 40);
        burst(pk.x, pk.y, '#7ee787', 10, 110);
      }
    }
    return events;
  }

  function stepCar(dt, move, handbrake) {
    const car = player.inCar;
    if (!car) return;
    const steer = move.x;
    const throttle = -move.y; // up = forward
    if (throttle !== 0) car.speed += throttle * car.accel * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 520 * dt);
    car.speed = clamp(car.speed, -car.top * 0.45, car.top);
    if (Math.abs(car.speed) > 8) {
      car.angle += steer * car.grip * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 160);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = city.hitBuilding(nx, ny, car.len / 2 - 4);
    if (hit) {
      if (Math.abs(car.speed) > 240) { burst(car.x, car.y, '#ffb347', 12, 160); car.health -= 12; }
      car.speed *= -0.25;
    } else {
      car.x = nx; car.y = ny;
    }
    const p = city.clampToWorld(car.x, car.y, 30);
    car.x = p.x; car.y = p.y;
    player.x = car.x; player.y = car.y; player.angle = car.angle;
    // Running over pedestrians is a crime.
    for (const ped of peds) {
      if (ped.alive && dist2(car.x, car.y, ped.x, ped.y) < 26 * 26) {
        ped.alive = false; ped.panic = 1; burst(ped.x, ped.y, '#ff6b6b', 8, 120);
        state.kills += 1; addWanted(1); car.speed *= 0.92;
      }
    }
    // Collide with traffic cars.
    for (const other of cars) {
      if (other === car || other.parked) continue;
      if (dist2(car.x, car.y, other.x, other.y) < 34 * 34) {
        other.speed *= 0.5; car.speed *= 0.6;
        burst((car.x + other.x) / 2, (car.y + other.y) / 2, '#ffd166', 5, 100);
      }
    }
    if (car.health <= 0) {
      burst(car.x, car.y, '#ff6b35', 26, 220);
      burst(car.x, car.y, '#555', 16, 120);
      const idx = cars.indexOf(car);
      if (idx >= 0) cars.splice(idx, 1);
      player.inCar = null; player.health = Math.max(1, player.health - 20);
    }
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (!car.traffic || car === player.inCar) continue;
      // Follow the road direction closest to the car's current heading, so it
      // never makes a sudden 90-degree turn at an intersection.
      const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      let target = dirs[0], best = Infinity;
      for (const d of dirs) {
        let diff = Math.abs(d - car.angle);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
        if (diff < best) { best = diff; target = d; }
      }
      car.angle = angleLerp(car.angle, target, 1.2 * dt);
      car.speed += (180 - car.speed) * 0.5 * dt;
      // Slow for the car ahead.
      for (const other of cars) {
        if (other === car) continue;
        const dx = other.x - car.x, dy = other.y - car.y;
        const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (ahead > 0 && ahead < 70 && side < 24) car.speed = Math.min(car.speed, other.speed * 0.8);
      }
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const p = city.clampToWorld(car.x, car.y, 30);
      if (p.x !== car.x || p.y !== car.y) { car.angle += Math.PI / 2; car.x = p.x; car.y = p.y; }
    }
    // Separation: never let two cars overlap (fixes intersection pile-ups).
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i], b = cars[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 38 * 38 && d2 > 0.01) {
          const d = Math.sqrt(d2), push = (38 - d) / 2;
          const nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }
  }

  function stepPeds(dt) {
    const px = player.x, py = player.y;
    for (const ped of peds) {
      if (!ped.alive) continue;
      ped.walkPhase += dt * 6;
      ped.retarget -= dt;
      const danger = state.wanted > 0 && dist2(px, py, ped.x, ped.y) < 260 * 260;
      if (danger) ped.panic = 1;
      if (ped.panic > 0) {
        const dx = ped.x - px, dy = ped.y - py;
        const len = Math.hypot(dx, dy) || 1;
        ped.x += (dx / len) * 130 * dt;
        ped.y += (dy / len) * 130 * dt;
        ped.angle = Math.atan2(dy, dx);
      } else if (ped.retarget <= 0) {
        ped.tx = clamp(ped.x + range(rand, -260, 260), 300, WORLD.width - 60);
        ped.ty = clamp(ped.y + range(rand, -260, 260), 60, WORLD.height - 60);
        ped.retarget = range(rand, 3, 8);
      } else {
        const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
        const len = Math.hypot(dx, dy);
        if (len > 8) {
          ped.x += (dx / len) * ped.speed * dt;
          ped.y += (dy / len) * ped.speed * dt;
          ped.angle = Math.atan2(dy, dx);
        }
      }
      const p = city.clampToWorld(ped.x, ped.y, 12);
      ped.x = p.x; ped.y = p.y;
    }
  }

  function stepCops(dt) {
    const want = WANTED[state.wanted] || { cops: 0, heli: false, lose: 12 };
    // Spawn / despawn to match wanted level.
    while (cops.length < want.cops) {
      const a = range(rand, 0, Math.PI * 2);
      const x = clamp(player.x + Math.cos(a) * 700, 300, WORLD.width - 60);
      const y = clamp(player.y + Math.sin(a) * 700, 60, WORLD.height - 60);
      const p = city.nearestRoadPoint(x, y);
      const cop = makeCar(rand, p.x, p.y, city.roadAngleAt(p.x, p.y), { name: 'Interceptor', color: '#2f6df6', top: COP.top, accel: COP.accel, grip: COP.grip, len: COP.len, wid: COP.wid }, false);
      cop.siren = rand() * 2;
      cops.push(cop);
    }
    while (cops.length > want.cops) cops.pop();
    heli.active = !!want.heli && state.wanted > 0;
    if (heli.active) {
      // Last-seen pursuit, like the cops: the helicopter only tracks the
      // player while a cop still has eyes on them. Once the trail goes cold
      // it holds over the last known position, so a fast getaway can
      // actually shake the heat instead of being followed forever.
      let anyHunting = false;
      for (const cop of cops) if (dist2(player.x, player.y, cop.x, cop.y) < 550 * 550) anyHunting = true;
      if (anyHunting) {
        heli.x += (player.x - heli.x) * 0.4 * dt;
        heli.y += (player.y - 160 - heli.y) * 0.4 * dt;
      }
      heli.search += dt;
    }
    for (const cop of cops) {
      cop.siren += dt;
      const dx = player.x - cop.x, dy = player.y - cop.y;
      const d = Math.hypot(dx, dy);
      // Last-seen pursuit: a cop that can see the player (within 420) chases
      // hard; one that lost the trail (over 550 away) falls back to the last
      // place it saw the player and cruises there — so a fast getaway in any
      // car can actually shake the heat instead of being chased forever.
      if (d < 420) { cop.lastX = player.x; cop.lastY = player.y; }
      if (cop.lastX === undefined) { cop.lastX = cop.x; cop.lastY = cop.y; }
      const hunting = d < 550;
      const tx = hunting ? player.x : cop.lastX;
      const ty = hunting ? player.y : cop.lastY;
      if (!hunting && dist2(cop.x, cop.y, cop.lastX, cop.lastY) < 80 * 80) {
        cop.lastX = clamp(cop.x + range(rand, -350, 350), 300, WORLD.width - 60);
        cop.lastY = clamp(cop.y + range(rand, -350, 350), 60, WORLD.height - 60);
      }
      const target = Math.atan2(ty - cop.y, tx - cop.x);
      cop.angle = angleLerp(cop.angle, target, 2.2 * dt);
      const cruise = hunting ? COP.top : 280;
      cop.speed += (cruise - cop.speed) * 0.6 * dt;
      const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
      const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
      if (!city.hitBuilding(nx, ny, 24)) { cop.x = nx; cop.y = ny; }
      else { cop.angle += 0.6; cop.speed *= 0.7; }
      // Ram the player — but at most once per half second per cop, so a chase
      // is a chase and not an instant car explosion.
      if (cop.ramCd === undefined) cop.ramCd = 0;
      cop.ramCd = Math.max(0, cop.ramCd - dt);
      if (d < 40) {
        if (player.inCar) {
          if (cop.ramCd <= 0) {
            player.inCar.speed *= 0.85;
            player.inCar.health -= 4;
            burst(cop.x, cop.y, '#9db8ff', 4, 90);
            cop.ramCd = 0.5;
          }
        } else if (state.bustedTimer <= 0) {
          state.bustedTimer = 1.2;
        }
      }
    }
    if (state.bustedTimer > 0) {
      state.bustedTimer -= dt;
      if (state.bustedTimer <= 0 && state.wanted > 0) {
        // Busted: lose money, lose wanted, respawn at the station.
        player.money = Math.max(0, player.money - 100);
        state.wanted = 0;
        player.x = 900; player.y = 1300;
        if (player.inCar) { player.inCar = null; }
        player.health = Math.max(player.health, 40);
        return EVT_BUSTED;
      }
    }
    return EVT_NONE;
  }

  function stepBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.traveled += Math.hypot(b.vx, b.vy) * dt;
      let dead = b.traveled > b.range || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height;
      if (!dead && city.hitBuilding(b.x, b.y, 2)) { burst(b.x, b.y, '#c9c9c9', 3, 70); dead = true; }
      if (!dead && b.owner === 'player') {
        for (const ped of peds) {
          if (ped.alive && dist2(b.x, b.y, ped.x, ped.y) < 16 * 16) {
            ped.alive = false; ped.panic = 1; burst(ped.x, ped.y, '#ff6b6b', 8, 120);
            state.kills += 1; addWanted(1); dead = true; break;
          }
        }
        if (!dead) {
          for (const cop of cops) {
            if (dist2(b.x, b.y, cop.x, cop.y) < 26 * 26) {
              burst(b.x, b.y, '#9db8ff', 5, 100); dead = true; addWanted(1); break;
            }
          }
        }
      }
      if (!dead && b.owner === 'cop') {
        if (!player.inCar && dist2(b.x, b.y, player.x, player.y) < 16 * 16) {
          damagePlayer(6); dead = true;
        } else if (player.inCar && dist2(b.x, b.y, player.x, player.y) < 28 * 28) {
          player.inCar.health -= 1; dead = true;
        }
      }
      if (dead) bullets.splice(i, 1);
    }
  }

  function stepHeat(dt) {
    if (state.wanted === 0) return;
    // Seen while any cop is close or the heli's spotlight is overhead.
    let seen = false;
    for (const cop of cops) if (dist2(player.x, player.y, cop.x, cop.y) < 340 * 340) seen = true;
    if (heli.active && dist2(player.x, player.y, heli.x, heli.y + 160) < 340 * 340) seen = true;
    if (!seen) {
      state.unseenTimer += dt;
      const lose = (WANTED[state.wanted] || { lose: 8 }).lose;
      if (state.unseenTimer > lose) { state.wanted = 0; state.unseenTimer = 0; }
    } else {
      // A glimpse costs progress instead of wiping it: the timer drains
      // twice as fast as it fills, so a long clean getaway still pays off.
      state.unseenTimer = Math.max(0, state.unseenTimer - dt * 2);
    }
  }

  function step(dt, input, mission) {
    let events = EVT_NONE;
    state.elapsed += dt;
    state.time = (state.time + dt * 0.004) % 24; // a full day in ~7 min of play
    const move = input.move();
    const mouse = input.mouse();
    const aim = input.aimAngle ? input.aimAngle() : null;
    events |= stepPlayer(dt, move, aim, mouse.down || mouse.clicked, mission);
    stepCar(dt, move, mouse.down && player.inCar);
    stepTraffic(dt);
    stepPeds(dt);
    events |= stepCops(dt);
    stepBullets(dt);
    stepHeat(dt);
    // Particles.
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    // Cop gunfire at high wanted levels (seeded draws, so replays match).
    if (state.wanted >= 2 && cops.length > 0 && rand() < dt * 0.5) {
      const cop = cops[Math.floor(rand() * cops.length)];
      const a = Math.atan2(player.y - cop.y, player.x - cop.x) + (rand() - 0.5) * 0.4;
      bullets.push({ x: cop.x, y: cop.y, vx: Math.cos(a) * 800, vy: Math.sin(a) * 800, damage: 6, range: 420, traveled: 0, owner: 'cop' });
    }
    if (player.health <= 0) events |= EVT_WASTED;
    return events;
  }

  reset();
  return {
    state, player, cars, peds, cops, bullets, particles, pickups, heli,
    reset, step, addWanted, enterCar, exitCar, nearestCar, damagePlayer, burst,
    // Exposed for missions / shops / save.
    giveMoney(n) { player.money += n; },
    setWanted(n) { state.wanted = clamp(n, 0, 5); state.unseenTimer = 0; },
  };
}
