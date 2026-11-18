// Procedural sound only: three radio stations built from WebAudio oscillators and
// noise, plus synthesized effects (gunshots, siren, engine hum, pickup chime).
// No audio files, no network. Everything is composed in code.
export const STATIONS = [
  { name: 'SOLMAR 88.4 — SUNSET FM', style: 'synthwave', bpm: 96, root: 55.0 },
  { name: 'BAY 102.1 — NEON NIGHTS', style: 'electro', bpm: 122, root: 65.41 },
  { name: 'PALM 95.5 — COASTAL CHILL', style: 'chill', bpm: 78, root: 49.0 },
];

const DJ_LINES = [
  ['Sunset FM', 'You are riding with DJ Marisol — Solmar Bay never looked this good.'],
  ['Sunset FM', 'That was the sound of the coast. Next up, something for the drive home.'],
  ['Neon Nights', 'DJ Vex here. If the cops are listening — this one is for you.'],
  ['Neon Nights', 'Neon Row is awake. Keep your headlights low and your bass high.'],
  ['Coastal Chill', 'Slow waves, slower Sundays. This is Palm 95.5.'],
  ['Coastal Chill', 'A gentle one for the boardwalk. Breathe in, Solmar.'],
];

const SCALES = {
  synthwave: [0, 3, 5, 7, 10],
  electro: [0, 2, 3, 7, 8],
  chill: [0, 2, 4, 7, 9],
};

export function createAudio() {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let station = 0, muted = false, stepTimer = null, stepIndex = 0;
  let djLine = 0, djTimer = 0;
  let engineOsc = null, engineGain = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.30; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
      return true;
    } catch { return false; }
  }

  function noteFreq(root, semis) { return root * Math.pow(2, semis / 12); }

  function playNote(freq, time, dur, type, gain, dest) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g); g.connect(dest || musicGain);
    osc.start(time); osc.stop(time + dur + 0.05);
  }

  function playStep() {
    if (!ctx || muted) return;
    const st = STATIONS[station];
    const beat = 60 / st.bpm / 2; // eighth notes
    const t = ctx.currentTime + 0.02;
    const scale = SCALES[st.style];
    const bar = Math.floor(stepIndex / 8) % 4;
    const idx = stepIndex % 8;
    // Bass on beats.
    if (idx % 2 === 0) {
      const semis = [0, 0, -4, 3][bar];
      playNote(noteFreq(st.root, semis), t, beat * 1.8, 'sawtooth', 0.16);
      playNote(noteFreq(st.root / 2, semis), t, beat * 1.8, 'triangle', 0.2);
    }
    // Lead arpeggio.
    const leadSteps = st.style === 'chill' ? [0, 2, 4, 2] : [0, 2, 4, 7, 9, 7, 4, 2];
    const semis = scale[leadSteps[stepIndex % leadSteps.length] % scale.length] + 12;
    if (stepIndex % 2 === 1 || st.style === 'electro') {
      playNote(noteFreq(st.root, semis), t, beat * 0.9, st.style === 'synthwave' ? 'square' : 'sine', 0.07);
    }
    // Hat tick on off-beats for electro.
    if (st.style === 'electro' && idx % 2 === 1) {
      const noise = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, 2205, 44100);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      noise.buffer = buf;
      const g = ctx.createGain(); g.gain.value = 0.05;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
      noise.connect(f); f.connect(g); g.connect(musicGain);
      noise.start(t);
    }
    stepIndex += 1;
    djTimer += beat;
    if (djTimer > 24) { djTimer = 0; djLine = (djLine + 1) % DJ_LINES.length; }
  }

  function startMusic() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (stepTimer) return;
    const st = STATIONS[station];
    stepTimer = window.setInterval(playStep, (60 / st.bpm / 2) * 1000);
  }

  function stopMusic() {
    if (stepTimer) { window.clearInterval(stepTimer); stepTimer = null; }
  }

  function nextStation() {
    return setStation(station + 1);
  }

  function setStation(next) {
    station = ((next % STATIONS.length) + STATIONS.length) % STATIONS.length;
    stepIndex = 0;
    if (stepTimer) { stopMusic(); startMusic(); }
    return STATIONS[station].name;
  }

  function djText() {
    const line = DJ_LINES[djLine];
    return line[0] + ': ' + line[1];
  }

  function blip(freq, dur, type, gain) {
    if (!ensure() || muted) return;
    playNote(freq, ctx.currentTime, dur, type, gain, sfxGain);
  }

  function noiseBurst(dur, gain, lowpass) {
    if (!ensure() || muted) return;
    const noise = ctx.createBufferSource();
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    noise.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    const g = ctx.createGain(); g.gain.value = gain;
    noise.connect(f); f.connect(g); g.connect(sfxGain);
    noise.start();
  }

  function engineStart(speed01) {
    if (!ensure()) return;
    if (!engineOsc) {
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    }
    engineOsc.frequency.value = 55 + speed01 * 130;
    engineGain.gain.value = muted ? 0 : 0.045 + speed01 * 0.05;
  }
  function engineStop() { if (engineGain) engineGain.gain.value = 0; }

  return {
    startMusic, stopMusic, setStation, nextStation, djText,
    stationName() { return STATIONS[station].name; },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.55; return muted; },
    isMuted() { return muted; },
    gunshot() { noiseBurst(0.12, 0.5, 2600); blip(160, 0.08, 'square', 0.25); },
    siren() { blip(880, 0.18, 'sine', 0.08); },
    pickup() { blip(660, 0.1, 'sine', 0.2); window.setTimeout(() => blip(990, 0.14, 'sine', 0.2), 90); },
    crash() { noiseBurst(0.3, 0.5, 700); },
    click() { blip(440, 0.05, 'square', 0.1); },
    missionPass() { [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => blip(f, 0.18, 'triangle', 0.22), i * 110)); },
    engineStart, engineStop,
  };
}
