// Solmar Bay 3D renderer (three.js, vendored under game/vendor/three/).
// The sim is pure 2D plan data; this file ONLY reads it and draws it:
//   plan (x, y) -> 3D (x * SCALE, height, y * SCALE), plan angle a -> rotation.y = -a.
// One clear job per helper: sky + sun, ground texture, ocean, buildings, palms,
// cars, peds, player, helicopter, particles, mission marker, minimap, camera.
import * as THREE from 'three';
import { SCALE, WORLD, CAMERA, PALETTE } from './config.js';

const S = SCALE;
const W3 = WORLD.width * S, H3 = WORLD.height * S;

function hexColor(h) { return new THREE.Color(h); }

function lerpColor(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)));
}

// Day factor: 0 at night, 1 at noon. The sun is up 05:30–19:00 and the 0.35
// power keeps the sky bright late into the afternoon (at 17:24 the sun is low
// but the light is still strong golden light, not night). Golden factor peaks
// at sunset (~18:40).
export function daylight(time) {
  const raw = time >= 5.5 && time <= 19 ? Math.sin(((time - 5.5) / 13.5) * Math.PI) : 0;
  const day = Math.pow(Math.max(0, raw), 0.35);
  const golden = Math.exp(-Math.pow((time - 18.7) / 1.7, 2)) + Math.exp(-Math.pow((time - 6.2) / 1.7, 2)) * 0.6;
  return { day: Math.max(0, Math.min(1, day)), golden: Math.max(0, Math.min(1, golden)) };
}

function makeGroundTexture(city) {
  const cw = 2048, ch = Math.round(2048 * WORLD.height / WORLD.width);
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d');
  const px = (x) => (x / WORLD.width) * cw;
  const py = (y) => (y / WORLD.height) * ch;
  // Base grass.
  g.fillStyle = PALETTE.grass; g.fillRect(0, 0, cw, ch);
  // Ocean (west of the beach) with a depth gradient.
  const og = g.createLinearGradient(0, 0, px(WORLD.beachX), 0);
  og.addColorStop(0, PALETTE.oceanDeep); og.addColorStop(1, PALETTE.ocean);
  g.fillStyle = og; g.fillRect(0, 0, px(WORLD.beachX), ch);
  // Wet sand then dry sand.
  g.fillStyle = PALETTE.sandWet; g.fillRect(px(WORLD.beachX), 0, px(60), ch);
  g.fillStyle = PALETTE.sand; g.fillRect(px(WORLD.beachX + 60), 0, px(80), ch);
  // Boardwalk strip along the sand.
  g.fillStyle = '#b98d5f'; g.fillRect(px(WORLD.beachX + 140), 0, px(36), ch);
  g.fillStyle = 'rgba(0,0,0,0.15)';
  for (let y = 0; y < WORLD.height; y += 60) g.fillRect(px(WORLD.beachX + 140), py(y), px(36), py(4));
  // City blocks: sidewalk base under every block.
  g.fillStyle = PALETTE.sidewalk;
  for (let vi = 0; vi < city.roadsV.length - 1; vi += 1) {
    for (let hi = 0; hi < city.roadsH.length - 1; hi += 1) {
      g.fillRect(px(city.roadsV[vi] + 42), py(city.roadsH[hi] + 42),
        px(city.roadsV[vi + 1] - city.roadsV[vi] - 84), py(city.roadsH[hi + 1] - city.roadsH[hi] - 84));
    }
  }
  // Parks and parking lots.
  for (const p of city.parks) { g.fillStyle = PALETTE.park; g.fillRect(px(p.x), py(p.y), px(p.w), py(p.h)); }
  for (const l of city.lots) {
    g.fillStyle = '#6b7280'; g.fillRect(px(l.x), py(l.y), px(l.w), py(l.h));
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
    for (let x = l.x + 40; x < l.x + l.w - 20; x += 64) {
      g.beginPath(); g.moveTo(px(x), py(l.y + 12)); g.lineTo(px(x), py(l.y + l.h - 12)); g.stroke();
    }
  }
  // Roads: dark asphalt, then centre dashes.
  g.fillStyle = PALETTE.road;
  for (const rx of city.roadsV) g.fillRect(px(rx - 42), 0, px(84), ch);
  for (const ry of city.roadsH) g.fillRect(px(WORLD.beachX), py(ry - 42), px(WORLD.width - WORLD.beachX), py(84));
  g.fillStyle = PALETTE.lane;
  for (const rx of city.roadsV) {
    for (let y = 0; y < WORLD.height; y += 90) g.fillRect(px(rx - 3), py(y), px(6), py(44));
  }
  for (const ry of city.roadsH) {
    for (let x = WORLD.beachX; x < WORLD.width; x += 90) g.fillRect(px(x), py(ry - 3), px(44), py(6));
  }
  // Beach umbrellas: tiny colour dots along the sand.
  const cols = ['#ff4fd8', '#29e6ff', '#ffc93c', '#ff5a5a'];
  for (let i = 0; i < 40; i += 1) {
    g.fillStyle = cols[i % cols.length];
    g.beginPath(); g.arc(px(300 + (i * 53) % 90), py(60 + i * 62), 7, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeWindowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#2a2f3a';
  for (let y = 8; y < 120; y += 16) {
    for (let x = 8; x < 120; x += 16) g.fillRect(x, y, 9, 11);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3); // windows read as windows, not giant black slabs
  return tex;
}

function makeTextSprite(text, color) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 96;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(8,12,24,0.78)';
  g.beginPath(); g.roundRect(4, 10, 504, 76, 14); g.fill();
  g.strokeStyle = color; g.lineWidth = 4; g.stroke();
  g.fillStyle = color; g.font = 'bold 44px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(11, 2.06, 1);
  return spr;
}

export function createRenderer3D(canvas, city, minimapCanvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9fc8e8, 130, 460);
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 1200);

  // ---- sky dome + lights -------------------------------------------------
  const skyUniforms = {
    topColor: { value: new THREE.Color('#2f7fc9') },
    bottomColor: { value: new THREE.Color('#bfe3f2') },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: new THREE.Color('#ffd9a0') },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: skyUniforms,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vDir; uniform vec3 topColor; uniform vec3 bottomColor; uniform vec3 sunDir; uniform vec3 sunColor; void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 col = mix(bottomColor, topColor, pow(h, 0.65)); float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0); col += sunColor * (pow(s, 220.0) * 1.2 + pow(s, 8.0) * 0.22); gl_FragColor = vec4(col, 1.0); }',
    }),
  );
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xffe0b0, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfe3f2, 0x4a5a3a, 0.9);
  scene.add(hemi);

  // ---- ground + ocean ----------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W3 + 40, H3 + 40),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(city), roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(W3 / 2, 0, H3 / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  const oceanUniforms = { time: { value: 0 } };
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(240, H3 + 80, 48, 48),
    new THREE.ShaderMaterial({
      transparent: true, fog: false, uniforms: oceanUniforms,
      vertexShader: 'uniform float time; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x * 0.35 + time * 1.1) * 0.35 + cos(p.y * 0.28 + time * 0.8) * 0.3; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform float time; varying vec2 vUv; void main(){ vec3 deep = vec3(0.05, 0.32, 0.48); vec3 shal = vec3(0.10, 0.55, 0.72); float w = sin(vUv.x * 40.0 + time * 1.4) * sin(vUv.y * 34.0 - time); vec3 col = mix(deep, shal, vUv.x * 0.5 + w * 0.05); float foam = smoothstep(0.90, 0.99, vUv.x); col = mix(col, vec3(0.9, 0.95, 0.9), foam * 0.35); gl_FragColor = vec4(col, 0.92); }',
    }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-95, 0.06, H3 / 2);
  scene.add(ocean);

  // ---- buildings (instanced) ---------------------------------------------
  const winTex = makeWindowTexture();
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const bMat = new THREE.MeshStandardMaterial({
    map: winTex, roughness: 0.85, metalness: 0.05,
    emissiveMap: winTex, emissive: 0xffc46b, emissiveIntensity: 0.15,
  });
  const buildingsMesh = new THREE.InstancedMesh(bGeo, bMat, Math.max(1, city.buildings.length));
  buildingsMesh.castShadow = true; buildingsMesh.receiveShadow = true;
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6e5a44, roughness: 0.95 });
  const roofsMesh = new THREE.InstancedMesh(bGeo, roofMat, Math.max(1, city.buildings.length));
  const neonMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff4fd8, emissiveIntensity: 1.6, roughness: 0.4 });
  const neonIdx = city.buildings.map((b, i) => (b.neon ? i : -1)).filter((i) => i >= 0);
  const neonMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), neonMat, Math.max(1, neonIdx.length));
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    city.buildings.forEach((b, i) => {
      const h = 4 + b.height * 4.5;
      pos.set((b.x + b.w / 2) * S, 0, (b.y + b.h / 2) * S);
      sc.set(b.w * S, h, b.h * S);
      m.compose(pos, q, sc);
      buildingsMesh.setMatrixAt(i, m);
      buildingsMesh.setColorAt(i, hexColor(b.color));
      pos.y = h; sc.set(b.w * S + 0.3, 0.35, b.h * S + 0.3);
      m.compose(pos, q, sc);
      roofsMesh.setMatrixAt(i, m);
    });
    neonIdx.forEach((bi, j) => {
      const b = city.buildings[bi];
      const h = 4 + b.height * 4.5;
      pos.set((b.x + b.w / 2) * S, h + 0.35, (b.y + b.h / 2) * S);
      sc.set(b.w * S + 0.5, 0.28, 0.28);
      m.compose(pos, q, sc);
      neonMesh.setMatrixAt(j, m);
      neonMesh.setColorAt(j, new THREE.Color(j % 2 ? '#29e6ff' : '#ff4fd8'));
    });
    buildingsMesh.instanceMatrix.needsUpdate = true;
    if (buildingsMesh.instanceColor) buildingsMesh.instanceColor.needsUpdate = true;
    roofsMesh.instanceMatrix.needsUpdate = true;
    neonMesh.instanceMatrix.needsUpdate = true;
    if (neonMesh.instanceColor) neonMesh.instanceColor.needsUpdate = true;
  }
  scene.add(buildingsMesh); scene.add(roofsMesh); scene.add(neonMesh);

  // ---- palms (instanced trunks + crowns) ----------------------------------
  const palmCount = city.palms.length;
  const trunkGeo = new THREE.CylinderGeometry(0.09, 0.16, 2.8, 6);
  trunkGeo.translate(0, 1.4, 0);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 }), palmCount);
  trunkMesh.castShadow = true;
  const crownGeo = new THREE.ConeGeometry(1.5, 1.6, 7);
  crownGeo.translate(0, 3.2, 0);
  crownGeo.scale(1, 0.55, 1);
  const crownMesh = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0x3f9e4d, roughness: 0.9 }), palmCount);
  crownMesh.castShadow = true;
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    city.palms.forEach((p, i) => {
      e.set((i % 5 - 2) * 0.03, (i * 0.7) % (Math.PI * 2), (i % 3 - 1) * 0.04);
      q.setFromEuler(e);
      pos.set(p.x * S, 0, p.y * S);
      m.compose(pos, q, sc);
      trunkMesh.setMatrixAt(i, m);
      crownMesh.setMatrixAt(i, m);
      crownMesh.setColorAt(i, new THREE.Color().setHSL(0.32 + (i % 5) * 0.015, 0.55, 0.32 + (i % 3) * 0.04));
    });
    trunkMesh.instanceMatrix.needsUpdate = true;
    crownMesh.instanceMatrix.needsUpdate = true;
    if (crownMesh.instanceColor) crownMesh.instanceColor.needsUpdate = true;
  }
  scene.add(trunkMesh); scene.add(crownMesh);

  // ---- cars (instanced bodies + cabins + wheels) ---------------------------
  const MAX_CARS = 90;
  const carBodyGeo = new THREE.BoxGeometry(1, 1, 1);
  carBodyGeo.translate(0, 0.5, 0);
  const carBodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.55 });
  const carBodies = new THREE.InstancedMesh(carBodyGeo, carBodyMat, MAX_CARS);
  carBodies.castShadow = true;
  const cabinGeo = new THREE.BoxGeometry(1, 1, 1);
  cabinGeo.translate(0, 0.5, 0);
  const cabins = new THREE.InstancedMesh(cabinGeo, new THREE.MeshStandardMaterial({ color: 0x141c26, roughness: 0.15, metalness: 0.6 }), MAX_CARS);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10);
  wheelGeo.rotateX(Math.PI / 2);
  const wheels = new THREE.InstancedMesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.9 }), MAX_CARS * 4);
  const lightBarGeo = new THREE.BoxGeometry(1, 1, 1);
  const lightBars = new THREE.InstancedMesh(lightBarGeo, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 2.2 }), 8);
  scene.add(carBodies); scene.add(cabins); scene.add(wheels); scene.add(lightBars);

  // ---- pedestrians (instanced bodies + heads) ------------------------------
  const MAX_PEDS = 70;
  const pedBodyGeo = new THREE.CapsuleGeometry(0.26, 0.62, 3, 8);
  const pedBodies = new THREE.InstancedMesh(pedBodyGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), MAX_PEDS);
  pedBodies.castShadow = true;
  const pedHeadGeo = new THREE.SphereGeometry(0.21, 10, 8);
  const pedHeads = new THREE.InstancedMesh(pedHeadGeo, new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.8 }), MAX_PEDS);
  scene.add(pedBodies); scene.add(pedHeads);

  // ---- the player (one hero model, built from parts) -----------------------
  const playerGroup = new THREE.Group();
  const pTorso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 4, 10), new THREE.MeshStandardMaterial({ color: 0x2f8f7a, roughness: 0.8 }));
  pTorso.position.y = 1.05; pTorso.castShadow = true;
  const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.8 }));
  pHead.position.y = 1.78; pHead.castShadow = true;
  const pCap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xc94f43, roughness: 0.7 }));
  pCap.position.y = 1.95;
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2c3550, roughness: 0.9 });
  const pLegL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), legMat);
  const pLegR = pLegL.clone();
  pLegL.position.set(-0.14, 0.31, 0); pLegR.position.set(0.14, 0.31, 0);
  const pGun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.42), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.4, metalness: 0.6 }));
  pGun.position.set(0.34, 1.05, 0.28);
  playerGroup.add(pTorso, pHead, pCap, pLegL, pLegR, pGun);
  scene.add(playerGroup);

  // ---- police helicopter ----------------------------------------------------
  const heliGroup = new THREE.Group();
  const hBody = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 3.1), new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.4, metalness: 0.3 }));
  const hBelly = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x2f6df6, roughness: 0.4, metalness: 0.3 }));
  hBelly.position.y = -0.5;
  const hTail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 2.6), new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.4 }));
  hTail.position.set(0, 0.1, -2.7);
  const hRotor = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.06, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
  hRotor.position.y = 0.55;
  const hSpot = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  );
  hSpot.rotation.x = Math.PI;
  hSpot.position.y = -13;
  heliGroup.add(hBody, hBelly, hTail, hRotor, hSpot);
  heliGroup.visible = false;
  scene.add(heliGroup);

  // ---- bullets + particles --------------------------------------------------
  const MAX_BULLETS = 48;
  const bulletMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.55, 0.07, 0.07),
    new THREE.MeshBasicMaterial({ color: 0xffe08a }),
    MAX_BULLETS,
  );
  scene.add(bulletMesh);

  const MAX_PART = 600;
  const partGeo = new THREE.BufferGeometry();
  const partPos = new Float32Array(MAX_PART * 3);
  const partCol = new Float32Array(MAX_PART * 3);
  partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
  partGeo.setAttribute('color', new THREE.BufferAttribute(partCol, 3));
  const partPoints = new THREE.Points(partGeo, new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true }));
  partPoints.frustumCulled = false;
  scene.add(partPoints);

  // ---- pickups ---------------------------------------------------------------
  const MAX_PICK = 12;
  const cashMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.08, 0.36), new THREE.MeshStandardMaterial({ color: 0x2fae5f, emissive: 0x1d7a3a, emissiveIntensity: 0.7, roughness: 0.5 }), MAX_PICK);
  const healthMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 0.16), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, emissive: 0xaa2222, emissiveIntensity: 0.5, roughness: 0.5 }), MAX_PICK);
  scene.add(cashMesh); scene.add(healthMesh);

  // ---- mission marker ---------------------------------------------------------
  const markerCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 7, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  const markerGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.85),
    new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0xffb400, emissiveIntensity: 1.4, roughness: 0.3 }),
  );
  const markerBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 42, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  markerCyl.visible = false; markerGem.visible = false; markerBeam.visible = false;
  scene.add(markerCyl); scene.add(markerGem); scene.add(markerBeam);

  // ---- shop fronts + floating signs ------------------------------------------
  const SHOP_COLORS = { guns: '#ff5a5a', food: '#ffc93c', clothes: '#ff4fd8', garage: '#29e6ff' };
  for (const shop of city.shops) {
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 2.6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x222832, emissive: hexColor(SHOP_COLORS[shop.kind] || '#ffffff'), emissiveIntensity: 0.55, roughness: 0.6 }),
    );
    front.position.set(shop.x * S, 1.3, shop.y * S);
    front.castShadow = true;
    scene.add(front);
    const spr = makeTextSprite(shop.name, SHOP_COLORS[shop.kind] || '#ffffff');
    spr.position.set(shop.x * S, 4.6, shop.y * S);
    scene.add(spr);
  }

  // ---- headlight cones (player car, night only) -------------------------------
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false });
  const headGeo = new THREE.ConeGeometry(0.9, 9, 12, 1, true);
  headGeo.rotateX(-Math.PI / 2);
  headGeo.translate(0, 0, 4.5);
  const headL = new THREE.Mesh(headGeo, headlightMat);
  const headR = new THREE.Mesh(headGeo, headlightMat);
  headL.visible = false; headR.visible = false;
  scene.add(headL); scene.add(headR);
  const headSpot = new THREE.SpotLight(0xfff2c0, 0, 26, 0.55, 0.5, 1.2);
  scene.add(headSpot); scene.add(headSpot.target);

  // ---- minimap ------------------------------------------------------------------
  const mm = minimapCanvas ? minimapCanvas.getContext('2d') : null;
  function drawMinimap(view) {
    if (!mm) return;
    const W = minimapCanvas.width, H = minimapCanvas.height;
    const px = (x) => (x / WORLD.width) * W;
    const py = (y) => (y / WORLD.height) * H;
    mm.clearRect(0, 0, W, H);
    mm.fillStyle = 'rgba(10,16,28,0.88)';
    mm.beginPath(); mm.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2); mm.fill();
    mm.save();
    mm.beginPath(); mm.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2); mm.clip();
    mm.fillStyle = '#3f6b34'; mm.fillRect(0, 0, W, H);
    mm.fillStyle = '#1d7fa8'; mm.fillRect(0, 0, px(WORLD.beachX), H);
    mm.fillStyle = '#e8d29a'; mm.fillRect(px(WORLD.beachX), 0, px(140), H);
    mm.strokeStyle = '#3a3f4a'; mm.lineWidth = Math.max(2, W / 130);
    for (const rx of city.roadsV) { mm.beginPath(); mm.moveTo(px(rx), 0); mm.lineTo(px(rx), H); mm.stroke(); }
    for (const ry of city.roadsH) { mm.beginPath(); mm.moveTo(px(WORLD.beachX), py(ry)); mm.lineTo(W, py(ry)); mm.stroke(); }
    mm.fillStyle = 'rgba(180,190,205,0.5)';
    for (const b of city.buildings) mm.fillRect(px(b.x), py(b.y), Math.max(1.5, px(b.w)), Math.max(1.5, py(b.h)));
    for (const s of city.shops) { mm.fillStyle = SHOP_COLORS[s.kind]; mm.fillRect(px(s.x) - 3, py(s.y) - 3, 6, 6); }
    for (const pk of view.pickups) {
      if (pk.taken) continue;
      mm.fillStyle = pk.kind === 'cash' ? '#7ee787' : '#ffffff';
      mm.fillRect(px(pk.x) - 2, py(pk.y) - 2, 4, 4);
    }
    for (const c of view.cars) { mm.fillStyle = '#dfe6ee'; mm.fillRect(px(c.x) - 1.5, py(c.y) - 1.5, 3, 3); }
    if (view.missionMarker) {
      const pulse = 4 + Math.sin(view.elapsed * 5) * 1.5;
      mm.fillStyle = '#ffc93c';
      mm.beginPath(); mm.arc(px(view.missionMarker.x), py(view.missionMarker.y), pulse, 0, Math.PI * 2); mm.fill();
      mm.strokeStyle = '#fff2b0'; mm.lineWidth = 1.5;
      mm.beginPath(); mm.arc(px(view.missionMarker.x), py(view.missionMarker.y), pulse + 3, 0, Math.PI * 2); mm.stroke();
    }
    for (const cop of view.cops) { mm.fillStyle = '#ff3b30'; mm.beginPath(); mm.arc(px(cop.x), py(cop.y), 3.5, 0, Math.PI * 2); mm.fill(); }
    if (view.heli.active) { mm.fillStyle = '#ff3b30'; mm.beginPath(); mm.arc(px(view.heli.x), py(view.heli.y), 4.5, 0, Math.PI * 2); mm.fill(); }
    // Player arrow.
    const p = view.player;
    mm.save();
    mm.translate(px(p.x), py(p.y));
    mm.rotate(p.angle);
    mm.fillStyle = '#ffffff';
    mm.beginPath(); mm.moveTo(7, 0); mm.lineTo(-5, -4.5); mm.lineTo(-5, 4.5); mm.closePath(); mm.fill();
    mm.strokeStyle = '#111'; mm.lineWidth = 1; mm.stroke();
    mm.restore();
    mm.restore();
    mm.strokeStyle = 'rgba(255,255,255,0.85)'; mm.lineWidth = 2;
    mm.beginPath(); mm.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2); mm.stroke();
  }

  // ---- camera state -------------------------------------------------------------
  const camPos = new THREE.Vector3(120, 40, 180);
  const camTarget = new THREE.Vector3(90, 1, 130);
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const dummy = new THREE.Object3D();
  const colTmp = new THREE.Color();
  let lastPX = 0, lastPY = 0, walkSwing = 0;

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function updateSkyAndLight(time) {
    const { day, golden } = daylight(time);
    const skyTop = lerpColor('#0b1026', '#2f7fc9', day);
    skyTop.lerp(new THREE.Color('#c07a9e'), golden * 0.35);
    const skyBot = lerpColor('#1a2340', '#bfe3f2', day);
    skyBot.lerp(new THREE.Color('#ffb36b'), golden * 0.45);
    skyUniforms.topColor.value.copy(skyTop);
    skyUniforms.bottomColor.value.copy(skyBot);
    const sunCol = lerpColor('#cdd8ff', '#ffd9a0', day);
    sunCol.lerp(new THREE.Color('#ff7a2a'), golden * 0.7);
    skyUniforms.sunColor.value.copy(sunCol);
    const frac = ((time - 5.5 + 24) % 24) / 13.5; // 0..2 across the day
    const elev = Math.sin(frac * Math.PI) * 1.1;
    const azim = frac * Math.PI;
    const sd = new THREE.Vector3(Math.cos(azim), Math.max(0.08, elev), Math.sin(azim) * 0.6).normalize();
    skyUniforms.sunDir.value.copy(sd);
    const isNight = day < 0.08;
    sun.color.copy(isNight ? new THREE.Color('#8fa8ff') : sunCol);
    sun.intensity = isNight ? 0.55 : 0.95 + day * 1.5;
    hemi.intensity = isNight ? 0.4 : 0.7 + day * 0.5;
    hemi.color.copy(lerpColor('#2a3a66', '#bfe3f2', day));
    scene.fog.color.copy(lerpColor('#0d1526', '#9fc8e8', day).lerp(new THREE.Color('#e8a06a'), golden * 0.35));
    bMat.emissiveIntensity = 0.12 + (1 - day) * 0.85;
    neonMat.emissiveIntensity = 0.7 + (1 - day) * 1.6;
    return { day, golden, isNight };
  }

  function setCarInstance(list, idx, car, isCop) {
    const a = car.angle;
    dummy.position.set(car.x * S, 0, car.y * S);
    dummy.rotation.set(0, -a, 0);
    dummy.scale.set(car.len * S, 0.62, car.wid * S);
    dummy.updateMatrix();
    list.bodies.setMatrixAt(idx, dummy.matrix);
    list.bodies.setColorAt(idx, colTmp.set(car.color));
    dummy.position.y = 0.62;
    dummy.position.x -= Math.cos(a) * 0.35;
    dummy.position.z -= Math.sin(a) * 0.35;
    dummy.scale.set(car.len * S * 0.52, 0.5, car.wid * S * 0.82);
    dummy.updateMatrix();
    list.cabins.setMatrixAt(idx, dummy.matrix);
    // Wheels.
    const fx = Math.cos(a), fz = Math.sin(a);
    const rx = -fz, rz = fx;
    const wl = car.len * S * 0.32, ww = car.wid * S * 0.5;
    const wy = 0.34;
    const offs = [[wl, ww], [wl, -ww], [-wl, ww], [-wl, -ww]];
    for (let w = 0; w < 4; w += 1) {
      dummy.position.set(car.x * S + fx * offs[w][0] + rx * offs[w][1], wy, car.y * S + fz * offs[w][0] + rz * offs[w][1]);
      dummy.rotation.set(0, -a, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      list.wheels.setMatrixAt(idx * 4 + w, dummy.matrix);
    }
    if (isCop) {
      dummy.position.set(car.x * S, 1.18, car.y * S);
      dummy.rotation.set(0, -a, 0);
      dummy.scale.set(1.1, 0.18, 0.5);
      dummy.updateMatrix();
      list.bars.setMatrixAt(list.barCount, dummy.matrix);
      const flash = Math.sin(car.siren * 6) > 0;
      list.bars.setColorAt(list.barCount, colTmp.set(flash ? '#ff2a2a' : '#2a6bff'));
      list.barCount += 1;
    }
  }

  function draw(view, screen, camInput, dt) {
    const p = view.player;
    const time = view.time;
    const { day, isNight } = updateSkyAndLight(time);
    oceanUniforms.time.value = view.elapsed;

    // ---- cars ------------------------------------------------------------------
    const carList = { bodies: carBodies, cabins, wheels, bars: lightBars, barCount: 0 };
    let ci = 0;
    for (const car of view.cars) {
      if (ci >= MAX_CARS) break;
      setCarInstance(carList, ci, car, false);
      ci += 1;
    }
    for (const cop of view.cops) {
      if (ci >= MAX_CARS) break;
      setCarInstance(carList, ci, cop, true);
      ci += 1;
    }
    for (let i = ci; i < MAX_CARS; i += 1) {
      dummy.position.set(0, -50, 0); dummy.scale.set(0.001, 0.001, 0.001); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      carBodies.setMatrixAt(i, dummy.matrix);
      cabins.setMatrixAt(i, dummy.matrix);
      for (let w = 0; w < 4; w += 1) wheels.setMatrixAt(i * 4 + w, dummy.matrix);
    }
    for (let i = carList.barCount; i < 8; i += 1) {
      dummy.position.set(0, -50, 0); dummy.scale.set(0.001, 0.001, 0.001); dummy.updateMatrix();
      lightBars.setMatrixAt(i, dummy.matrix);
    }
    carBodies.instanceMatrix.needsUpdate = true;
    if (carBodies.instanceColor) carBodies.instanceColor.needsUpdate = true;
    cabins.instanceMatrix.needsUpdate = true;
    wheels.instanceMatrix.needsUpdate = true;
    lightBars.instanceMatrix.needsUpdate = true;
    if (lightBars.instanceColor) lightBars.instanceColor.needsUpdate = true;

    // ---- peds --------------------------------------------------------------------
    let pi = 0;
    for (const ped of view.peds) {
      if (pi >= MAX_PEDS) break;
      if (!ped.alive) continue;
      const bob = Math.abs(Math.sin(ped.walkPhase)) * 0.07;
      dummy.position.set(ped.x * S, 0.86 + bob, ped.y * S);
      dummy.rotation.set(0, -ped.angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pedBodies.setMatrixAt(pi, dummy.matrix);
      pedBodies.setColorAt(pi, colTmp.set(ped.color));
      dummy.position.y = 1.62 + bob;
      dummy.updateMatrix();
      pedHeads.setMatrixAt(pi, dummy.matrix);
      pi += 1;
    }
    for (let i = pi; i < MAX_PEDS; i += 1) {
      dummy.position.set(0, -50, 0); dummy.scale.set(0.001, 0.001, 0.001); dummy.updateMatrix();
      pedBodies.setMatrixAt(i, dummy.matrix);
      pedHeads.setMatrixAt(i, dummy.matrix);
    }
    pedBodies.instanceMatrix.needsUpdate = true;
    if (pedBodies.instanceColor) pedBodies.instanceColor.needsUpdate = true;
    pedHeads.instanceMatrix.needsUpdate = true;

    // ---- player ------------------------------------------------------------------
    const moving = Math.hypot(p.x - lastPX, p.y - lastPY) > 0.5;
    if (moving) walkSwing += dt * 9;
    lastPX = p.x; lastPY = p.y;
    playerGroup.visible = !p.inCar; // the driver sits inside the car, not on its roof
    playerGroup.position.set(p.x * S, 0, p.y * S);
    playerGroup.rotation.y = -p.angle;
    const swing = moving ? Math.sin(walkSwing) * 0.5 : 0;
    pLegL.rotation.x = swing;
    pLegR.rotation.x = -swing;
    pGun.visible = p.weapon !== 'fists';
    if (p.hurtFlash > 0) pTorso.material.emissive.setHex(0x881111);
    else pTorso.material.emissive.setHex(0x000000);

    // ---- helicopter ---------------------------------------------------------------
    heliGroup.visible = !!view.heli.active;
    if (view.heli.active) {
      heliGroup.position.set(view.heli.x * S, 27 + Math.sin(view.heli.search * 0.8) * 1.5, view.heli.y * S);
      heliGroup.rotation.y = -Math.atan2(p.y - view.heli.y, p.x - view.heli.x) + Math.PI / 2;
      hRotor.rotation.y += dt * 22;
    }

    // ---- bullets --------------------------------------------------------------------
    let bi = 0;
    for (const b of view.bullets) {
      if (bi >= MAX_BULLETS) break;
      dummy.position.set(b.x * S, 1.1, b.y * S);
      dummy.rotation.set(0, -Math.atan2(b.vy, b.vx), 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bulletMesh.setMatrixAt(bi, dummy.matrix);
      bi += 1;
    }
    for (let i = bi; i < MAX_BULLETS; i += 1) {
      dummy.position.set(0, -50, 0); dummy.scale.set(0.001, 0.001, 0.001); dummy.updateMatrix();
      bulletMesh.setMatrixAt(i, dummy.matrix);
    }
    bulletMesh.instanceMatrix.needsUpdate = true;

    // ---- particles --------------------------------------------------------------------
    for (let i = 0; i < MAX_PART; i += 1) {
      const pt = view.particles[i];
      if (pt) {
        const age = 1 - pt.life / pt.max;
        partPos[i * 3] = pt.x * S;
        partPos[i * 3 + 1] = 0.4 + age * 1.6;
        partPos[i * 3 + 2] = pt.y * S;
        colTmp.set(pt.color);
        partCol[i * 3] = colTmp.r; partCol[i * 3 + 1] = colTmp.g; partCol[i * 3 + 2] = colTmp.b;
      } else {
        partPos[i * 3 + 1] = -50;
      }
    }
    partGeo.attributes.position.needsUpdate = true;
    partGeo.attributes.color.needsUpdate = true;

    // ---- pickups -----------------------------------------------------------------------
    let ci2 = 0, hi2 = 0;
    for (const pk of view.pickups) {
      if (pk.taken) continue;
      const bobY = 0.55 + Math.sin(view.elapsed * 3 + pk.bob) * 0.16;
      dummy.position.set(pk.x * S, bobY, pk.y * S);
      dummy.rotation.set(0, view.elapsed * 1.5 + pk.bob, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      if (pk.kind === 'cash' && ci2 < MAX_PICK) { cashMesh.setMatrixAt(ci2, dummy.matrix); ci2 += 1; }
      if (pk.kind === 'health' && hi2 < MAX_PICK) { healthMesh.setMatrixAt(hi2, dummy.matrix); hi2 += 1; }
    }
    for (let i = ci2; i < MAX_PICK; i += 1) { dummy.position.set(0, -50, 0); dummy.scale.set(0.001, 0.001, 0.001); dummy.updateMatrix(); cashMesh.setMatrixAt(i, dummy.matrix); }
    for (let i = hi2; i < MAX_PICK; i += 1) { dummy.position.set(0, -50, 0); dummy.scale.set(0.001, 0.001, 0.001); dummy.updateMatrix(); healthMesh.setMatrixAt(i, dummy.matrix); }
    cashMesh.instanceMatrix.needsUpdate = true;
    healthMesh.instanceMatrix.needsUpdate = true;

    // ---- mission marker -------------------------------------------------------------------
    const mk = view.missionMarker;
    const showMarker = !!mk;
    markerCyl.visible = showMarker; markerGem.visible = showMarker; markerBeam.visible = showMarker;
    if (showMarker) {
      const mx = mk.x * S, mz = mk.y * S, mr = Math.max(2, mk.radius * S);
      markerCyl.position.set(mx, 3.5, mz);
      markerCyl.scale.set(mr, 1, mr);
      markerBeam.position.set(mx, 21, mz);
      markerGem.position.set(mx, 3.4 + Math.sin(view.elapsed * 2.4) * 0.5, mz);
      markerGem.rotation.y = view.elapsed * 1.8;
    }

    // ---- headlights -------------------------------------------------------------------------
    const inCarAtNight = !!p.inCar && isNight;
    headL.visible = inCarAtNight; headR.visible = inCarAtNight;
    if (inCarAtNight) {
      const car = p.inCar;
      const fx = Math.cos(car.angle), fz = Math.sin(car.angle);
      const rx = -fz, rz = fx;
      headL.position.set((car.x + fx * 2.4 + rx * 0.8) * S, 0.6, (car.y + fz * 2.4 + rz * 0.8) * S);
      headR.position.set((car.x + fx * 2.4 - rx * 0.8) * S, 0.6, (car.y + fz * 2.4 - rz * 0.8) * S);
      headL.rotation.y = -car.angle; headR.rotation.y = -car.angle;
      headSpot.position.copy(headL.position);
      headSpot.target.position.set((car.x + fx * 26) * S, 0.3, (car.y + fz * 26) * S);
      headSpot.intensity = 60;
    } else {
      headSpot.intensity = 0;
    }

    // ---- sun follows the player (shadows stay local) -------------------------------------------
    sun.position.set(p.x * S + 60, 90, p.y * S + 40);
    sun.target.position.set(p.x * S, 0, p.y * S);
    sun.target.updateMatrixWorld();

    // ---- camera ----------------------------------------------------------------------------------
    if (screen === 'title') {
      const t = view.elapsed * 0.05;
      tmpV.set(180 + Math.cos(t) * 120, 55, 130 + Math.sin(t) * 90);
      camPos.lerp(tmpV, 1 - Math.exp(-1.2 * dt));
      tmpV2.set(180, 2, 130);
      camTarget.lerp(tmpV2, 1 - Math.exp(-1.2 * dt));
    } else {
      const heading = p.angle + (camInput ? camInput.yaw : 0);
      const inCar = !!p.inCar;
      const dist = (inCar ? CAMERA.carDist : CAMERA.onFootDist) + (camInput ? camInput.dist : 0);
      const height = (inCar ? CAMERA.carHeight : CAMERA.onFootHeight) + (camInput ? camInput.pitch * 6 : 0);
      const fx = Math.cos(heading), fz = Math.sin(heading);
      tmpV.set(p.x * S - fx * dist, height, p.y * S - fz * dist);
      const k = 1 - Math.exp(-CAMERA.smooth * dt);
      camPos.lerp(tmpV, k);
      tmpV2.set(p.x * S + fx * 4, 1.4, p.y * S + fz * 4);
      camTarget.lerp(tmpV2, 1 - Math.exp(-9 * dt));
    }
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    sky.position.copy(camPos);

    drawMinimap(view);
    renderer.render(scene, camera);
  }

  function screenCenterGroundPoint() {
    // Ray from the camera through the centre of the screen onto the y=0 plane.
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    if (Math.abs(dir.y) < 0.001) return null;
    const t = -camera.position.y / dir.y;
    if (t < 0) return null;
    return { x: (camera.position.x + dir.x * t) / S, y: (camera.position.z + dir.z * t) / S };
  }

  return { draw, resize, screenCenterGroundPoint, getCamera: () => camera, renderer };
}
