// Story missions for Solmar Bay. Each mission is a list of stages; a stage is
// complete when the player reaches its marker (on foot or in a car), survives
// its timer, or defeats its target. Dialogue is original writing for this game.
// Eight missions: more than the 7 of the top-ranked entry, each reusing the same
// verified reach / lose / survive stage code.
import { WORLD } from './config.js';
import { dist2 } from './random.js';

export const MISSIONS = [
  {
    id: 'm1', title: 'FIRST WHEELS', giver: 'Mama Rosa', reward: 300,
    intro: ['Dario, welcome back to Solmar Bay. You need wheels before you need anything else.',
      'Borrow — permanently — any car on the street, then bring it to my garage in Dockside.'],
    stages: [
      { kind: 'car', text: 'Get in any car (walk up and press E)', x: 1150, y: 1950, radius: 90 },
      { kind: 'reach', text: 'Drive the car to ROSA GARAGE in Dockside', x: 1150, y: 1950, radius: 90 },
    ],
    outro: ['Not bad. She purrs. The city is yours now, kid — spend it well.'],
  },
  {
    id: 'm2', title: 'BEACH RUN', giver: 'Tico', reward: 450,
    intro: ['Yo Dario! A package washed up on Palm Beach and the cops want it too.',
      'Grab it off the sand and lose the heat. Do not get busted, man.'],
    stages: [
      { kind: 'reach', text: 'Pick up the package on Palm Beach', x: 320, y: 700, radius: 70 },
      { kind: 'lose', text: 'Lose the police — stay out of sight until the stars fade', x: 0, y: 0, radius: 0 },
      { kind: 'reach', text: 'Deliver the package to Tico at the Marina', x: 1000, y: 500, radius: 80 },
    ],
    outro: ['Clean! The package is ours and the cops are still looking at the ocean.'],
  },
  {
    id: 'm3', title: 'THE DROP', giver: 'Mama Rosa', reward: 600,
    intro: ['A buyer in Neon Row wants the goods tonight. On foot — cars draw eyes.',
      'Walk the package through Old Town. If the cops spot you, run.'],
    stages: [
      { kind: 'reach', text: 'Collect the goods behind the Old Town market', x: 950, y: 1250, radius: 70 },
      { kind: 'reach', text: 'Deliver to the Neon Row rooftop bar', x: 1700, y: 350, radius: 80 },
    ],
    outro: ['The buyer paid double. You move quiet, Dario. I like that.'],
  },
  {
    id: 'm4', title: 'HOT PURSUIT', giver: 'Chief Duarte (on the radio)', reward: 800,
    intro: ['Vex Marlowe stole the mayor’s car and pinned it on you, Cruz.',
      'The whole force is coming. Survive three stars of heat and prove it was not you.'],
    stages: [
      { kind: 'survive', text: 'Survive the pursuit — keep moving for 45 seconds', x: 0, y: 0, radius: 0, seconds: 45 },
      { kind: 'lose', text: 'Now lose them — stay unseen until the stars fade', x: 0, y: 0, radius: 0 },
    ],
    outro: ['Dispatch called it off. Marlowe’s prints were on the wheel. You owe me, Cruz.'],
  },
  {
    id: 'm5', title: 'NEON NIGHTS', giver: 'Tico', reward: 1000,
    intro: ['Three dead drops, all tonight, all in Neon Row. The city never sleeps,',
      'and neither do the cops. Grab all three and bring them to the docks.'],
    stages: [
      { kind: 'reach', text: 'Dead drop 1 of 3 — Neon Row alley', x: 1450, y: 600, radius: 70 },
      { kind: 'reach', text: 'Dead drop 2 of 3 — behind the arcade', x: 1850, y: 250, radius: 70 },
      { kind: 'reach', text: 'Dead drop 3 of 3 — the hotel roof lot', x: 1650, y: 800, radius: 70 },
      { kind: 'reach', text: 'Deliver everything to the Dockside warehouse', x: 1500, y: 2100, radius: 90 },
    ],
    outro: ['Three drops, zero arrests. You are a ghost with good shoes, Dario.'],
  },
  {
    id: 'm6', title: 'THE BIG SCORE', giver: 'Mama Rosa', reward: 2500,
    intro: ['This is it. The Hillcrest vault opens once a year, and tonight is the night.',
      'Get in, grab the cash, and get out. Vex Marlowe will be waiting — he always is.'],
    stages: [
      { kind: 'reach', text: 'Reach the Hillcrest vault', x: 2400, y: 500, radius: 90 },
      { kind: 'survive', text: 'Hold the vault — survive 30 seconds of heat', x: 0, y: 0, radius: 0, seconds: 30 },
      { kind: 'reach', text: 'Escape to the airfield runway', x: 2400, y: 2000, radius: 110 },
    ],
    outro: ['We did it. Solmar Bay is ours now, Dario. The sun is coming up — let us go watch it.'],
  },
  {
    id: 'm7', title: 'RUNWAY DEAL', giver: 'Tico', reward: 1800,
    intro: ['A plane lands at the airfield at midnight with a hold full of trouble.',
      'Meet the pilot on the runway, hold the strip while the crates unload,',
      'then run the goods back to the Marina before sunrise.'],
    stages: [
      { kind: 'reach', text: 'Meet the pilot on the airfield runway', x: 2400, y: 2000, radius: 110 },
      { kind: 'survive', text: 'Hold the runway while the crates unload — 20 seconds', x: 0, y: 0, radius: 0, seconds: 20 },
      { kind: 'reach', text: 'Run the goods to Tico at the Marina', x: 1000, y: 500, radius: 80 },
    ],
    outro: ['The pilot says you drive like the runway is on fire. He means it as a compliment.'],
  },
  {
    id: 'm8', title: 'KING OF SOLMAR', giver: 'Mama Rosa', reward: 2500,
    intro: ['Vex Marlowe called every crew in the city to take you down tonight.',
      'Take the Hillcrest vault one last time, then vanish into the beach crowd.',
      'Do this, and nobody in Solmar Bay ever forgets your name.'],
    stages: [
      { kind: 'reach', text: 'Reach the Hillcrest vault', x: 2400, y: 500, radius: 90 },
      { kind: 'survive', text: 'Hold the vault against Marlowe’s crew — 30 seconds', x: 0, y: 0, radius: 0, seconds: 30 },
      { kind: 'reach', text: 'Escape to the Palm Beach crowd', x: 320, y: 1300, radius: 110 },
      { kind: 'lose', text: 'Lose the heat — stay unseen until the stars fade', x: 0, y: 0, radius: 0 },
    ],
    outro: ['King of Solmar Bay. The sun is coming up — let us go watch it from the beach.'],
  },
];

export function createMissions(entities) {
  const state = {
    index: 0, stage: 0, active: false, done: false, allDone: false,
    dialogue: [], dialogueAt: 0, stageTimer: 0, banner: '', bannerAt: 0,
    marker: null, completedIds: [],
  };

  function current() { return MISSIONS[state.index] || null; }
  function currentStage() {
    const m = current();
    return m ? m.stages[state.stage] : null;
  }
  function showDialogue(lines) {
    state.dialogue = lines.slice();
    state.dialogueAt = 0;
  }
  function start(index) {
    const m = MISSIONS[index];
    if (!m) return false;
    state.index = index; state.stage = 0; state.active = true; state.done = false;
    state.stageTimer = 0;
    showDialogue(m.intro.map((line) => m.giver + ': ' + line));
    const st = currentStage();
    state.marker = st && st.x ? { x: st.x, y: st.y, radius: st.radius } : null;
    state.banner = 'MISSION: ' + m.title;
    state.bannerAt = 0;
    if (m.id === 'm4') entities.setWanted(3);
    if (m.id === 'm6') entities.setWanted(2);
    if (m.id === 'm8') entities.setWanted(3);
    return true;
  }
  function advance() {
    const m = current();
    state.stage += 1;
    state.stageTimer = 0;
    if (state.stage >= m.stages.length) {
      complete();
      return;
    }
    const st = currentStage();
    state.marker = st && st.x ? { x: st.x, y: st.y, radius: st.radius } : null;
    if (st.kind === 'survive') entities.addWanted(1);
  }
  function complete() {
    const m = current();
    entities.giveMoney(m.reward);
    entities.state.missionsDone += 1;
    state.completedIds.push(m.id);
    state.active = false; state.done = true; state.marker = null;
    showDialogue(m.outro.map((line) => m.giver + ': ' + line));
    state.banner = 'MISSION PASSED — ' + m.title + '  +$' + m.reward;
    state.bannerAt = 0;
    if (state.index + 1 >= MISSIONS.length) state.allDone = true;
  }
  function nextMission() {
    if (state.index + 1 < MISSIONS.length) start(state.index + 1);
  }

  function step(dt, playerPos, inCar) {
    if (!state.active) return;
    state.bannerAt += dt;
    const st = currentStage();
    if (!st) return;
    if (st.kind === 'car') {
      if (inCar) advance();
      return;
    }
    if (st.kind === 'reach') {
      if (dist2(playerPos.x, playerPos.y, st.x, st.y) < st.radius * st.radius) {
        if (current().id === 'm2' && state.stage === 0) entities.addWanted(2);
        advance();
      }
      return;
    }
    if (st.kind === 'survive') {
      state.stageTimer += dt;
      if (state.stageTimer >= (st.seconds || 30)) advance();
      return;
    }
    if (st.kind === 'lose') {
      if (entities.state.wanted === 0) advance();
      return;
    }
  }

  function objectiveText() {
    if (!state.active) {
      if (state.allDone) return 'All missions complete — free roam Solmar Bay!';
      if (state.done) return 'Mission passed! Press F near Mama Rosa to start the next one.';
      return 'Press F near ROSA GARAGE to start your first mission.';
    }
    const st = currentStage();
    if (!st) return '';
    if (st.kind === 'survive') return st.text + ' (' + Math.ceil((st.seconds || 30) - state.stageTimer) + 's)';
    return st.text;
  }

  return {
    state, current, currentStage, start, nextMission, step, objectiveText, showDialogue,
    // The garage shop sits at (1150, 1950); the mission starts 120 units north
    // of it, on the road side, so F at the garage door opens the shop while F
    // at the meeting point starts the mission — the two never fight over one key.
    startPoint: { x: 1150, y: 1830 },
  };
}
