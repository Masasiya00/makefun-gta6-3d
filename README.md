# SOLMAR BAY 3D

[![make.fun bounty gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![make.fun rank](https://make.fun/badge/gta6-01/Masasiya00/makefun-gta6-3d/rank.svg)](https://make.fun/bounty/gta6-01)
[![make.fun reward](https://make.fun/badge/gta6-01/Masasiya00/makefun-gta6-3d/reward.svg)](https://make.fun/bounty/gta6-01)

**SOLMAR BAY 3D** — a 3D third-person open-world crime game for the
[make.fun "Make GTA 6" bounty (gta6-01)](https://make.fun/bounty/gta6-01).
Built with three.js (vendored, zero network requests) on a fixed-timestep
simulation: the sim is pure 2D plan data, the renderer only reads it.

## The game

Sun-soaked fictional coastal city **Solmar Bay**: 8 districts, a beach and a
living ocean, palm trees, neon streets, golden-hour sunsets and night driving
with headlights.

- **8 story missions** with original dialogue ($300–$2,500): FIRST WHEELS,
  BEACH RUN, THE DROP, HOT PURSUIT, NEON NIGHTS, THE BIG SCORE, RUNWAY DEAL,
  KING OF SOLMAR. Missions 1–2 play end-to-end; 3–8 share the same verified
  reach / lose / survive stage code.
- **Wanted 1–5 stars** — police cars with last-seen pursuit AI, a police
  helicopter from 3 stars, heat that fades when you break line of sight.
  Get busted, lose $100. Get wasted, start over.
- **6 drivable car models** to steal and drive (Comet Sedan, Island Taxi,
  Palm Hatch, Vortex GT, Harbor Truck, Sunset Coupe), plus traffic AI and
  pedestrians with panic AI.
- **Combat**: fists, P9 pistol, VK-9 SMG, Street Sweeper shotgun — ammo,
  armor and health.
- **4 shops**: IRONWORKS GUNS, TICO TACOS, NEON THREADS, ROSA GARAGE
  (free repairs).
- **Full HUD**: money, district, clock, wanted stars, health/armor bars,
  weapon/ammo, speedometer, mission tracker, circular minimap with cop and
  mission blips.
- **3 procedural WebAudio radio stations** (Sunset FM, Neon Nights, Coastal
  Chill) with DJ lines, engine hum, sirens and gunshots — all synthesized,
  no audio files.
- **Save / load** via localStorage, day/night cycle, title / pause /
  busted / wasted / win screens.

## Controls

WASD move / drive · Mouse aim · Click shoot · E enter/exit car ·
F interact / start mission · Q radio · 1–4 weapons · R reload ·
Right-drag orbit camera · Wheel zoom · P pause · M mute

## Deterministic shots & self-test

- `?shot=chase|city|mission|night&seed=7` — fixed scenes for screenshots.
- `?autoplay&seed=7` — headless self-test: drives, completes mission 1,
  triggers a 3-star police chase with helicopter, escapes, and verifies
  save/load. Logs progress to the console and sets `window.__autoplayDone`.

## Run it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Open `game/index.html` in desktop Chrome. No build step, no network.

## Structure

- `game/index.html` — page, import map, HUD
- `game/src/config.js` — tuning, districts, car/weapon tables
- `game/src/world.js` — city generation + collision (pure data)
- `game/src/entities.js` — player, traffic, peds, police, bullets (pure sim)
- `game/src/missions.js` — 8 story missions, dialogue, stages
- `game/src/render3d.js` — three.js scene: city, cars, peds, sky, minimap, camera
- `game/src/audio.js` — procedural WebAudio radio + effects
- `game/src/input.js` — keyboard + mouse, camera orbit
- `game/src/shots.js` — deterministic screenshot scenes
- `game/src/main.js` — fixed-step loop, screens, HUD, shops, save/load, autoplay
- `game/vendor/three/three.module.min.js` — vendored three.js

Everything is original: our own city, characters, vehicles, names, story,
art and music. Nothing from Rockstar Games' Grand Theft Auto series or any
other commercial game.

## License

MIT
