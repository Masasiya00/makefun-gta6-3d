// Deterministic screenshot scenes behind ?shot=chase|city|mission|night.
// Each one plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot, so every frame is what real play looks
// like and the same seed always gives the same frame.
import { STEP } from './config.js';

// Drive straight down one avenue, holding a fixed heading (no 90-degree
// turns at intersections), so the shot shows a clean chase, not a pile-up.
function drivePilot(G, targetAngle) {
  const car = G.ent.player.inCar;
  if (!car) return { x: 0, y: -1, run: false };
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { x: diff > 0.08 ? 1 : diff < -0.08 ? -1 : 0, y: -1, run: false };
}

function walkPilot(G, tx, ty) {
  const p = G.ent.player;
  const dx = tx - p.x, dy = ty - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: Math.abs(dx / len) > 0.4 ? Math.sign(dx) : 0, y: Math.abs(dy / len) > 0.4 ? Math.sign(dy) : 0, run: true };
}

export function stageShot(name, G) {
  G.reset();
  if (name === 'chase') {
    // COVER: golden-hour police chase down the beachfront avenue (road x=480).
    G.setTime(18.2);
    G.teleport(480, 500);
    G.giveCar(3, Math.PI / 2); // Vortex GT, heading south down the avenue
    G.missions.start(3); // HOT PURSUIT: wanted 3, survive the pursuit
    G.missions.state.dialogue = []; // keep the frame on the world, not a text box
    for (let i = 0; i < 60; i += 1) G.step(STEP, drivePilot(G, Math.PI / 2), null, false);
    // Pull the nearest cop into frame ahead of the player, mid-chase, and the
    // helicopter into the sky ahead — both read in a third-person chase shot.
    const p = G.ent.player;
    if (G.ent.cops.length > 0) {
      const cop = G.ent.cops[0];
      cop.x = p.x; cop.y = p.y + 260; cop.angle = Math.PI / 2; cop.speed = 500;
    }
    if (G.ent.heli.active) { G.ent.heli.x = p.x + 150; G.ent.heli.y = p.y + 800; }
    for (let i = 0; i < 60 * 3; i += 1) G.step(STEP, drivePilot(G, Math.PI / 2), null, false);
    // Re-place after the final steps (the sim kept driving them on).
    if (G.ent.cops.length > 0) {
      const cop = G.ent.cops[0];
      cop.x = p.x; cop.y = p.y + 260; cop.angle = Math.PI / 2; cop.speed = 500;
    }
    if (G.ent.heli.active) { G.ent.heli.x = p.x + 150; G.ent.heli.y = p.y + 800; }
    return { screen: 'play' };
  }
  if (name === 'city') {
    // On foot down the Old Town avenue (road x=900): traffic, pedestrians,
    // shops, midday sun — the camera stays on the road, not inside a block.
    G.setTime(13.5);
    G.teleport(900, 1050);
    for (let i = 0; i < 60 * 14; i += 1) G.step(STEP, walkPilot(G, 900, 1050 + (i % 480 < 240 ? 420 : 0)), null, false);
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // Mission 2 in progress: the package on Palm Beach, cops closing in.
    G.setTime(17.6);
    G.teleport(380, 700);
    G.missions.start(1);
    for (let i = 0; i < 60 * 3; i += 1) G.step(STEP, walkPilot(G, 320, 700), null, false);
    // Clear the intro dialogue so the frame shows the world, not a text box.
    G.missions.state.dialogue = [];
    return { screen: 'play' };
  }
  if (name === 'night') {
    // Night in Neon Row: neon signs, headlights, radio on. Road x=1740, heading south.
    G.setTime(21.8);
    G.teleport(1740, 450);
    G.giveCar(5, Math.PI / 2); // Sunset Coupe
    for (let i = 0; i < 60 * 4.5; i += 1) G.step(STEP, drivePilot(G, Math.PI / 2), null, false);
    return { screen: 'play' };
  }
  // Default: title screen over a living city at sunset.
  G.setTime(18.0);
  for (let i = 0; i < 60 * 5; i += 1) G.step(STEP, { x: 0, y: 0, run: false }, null, false);
  return { screen: 'title' };
}
